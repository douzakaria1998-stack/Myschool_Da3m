'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DiscountType, GroupMeta } from '../types';
import {
  X,
  UserPlus,
  Printer,
  Check,
  Search,
  CreditCard,
  Layers,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { getGroupStatus, isGroupActive, isVipGroupId } from '../utils/sessionUtils';
import { sanitizePrintTitle } from '../utils/printTitleUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MultiGroupStudentEnrollModal({ isOpen, onClose }: Props) {
  const { data, enrollStudentMultiGroups } = useApp();

  // Student info
  const [studentName, setStudentName] = useState('');
  const [studentPhone, setStudentPhone] = useState('');
  const [discount, setDiscount] = useState<DiscountType>('1');

  // Selected groups and custom payments for each: { [groupId]: paymentAmount }
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  // Groups specifically selected for payment today
  const [payingGroupIds, setPayingGroupIds] = useState<string[]>([]);
  const [groupPayments, setGroupPayments] = useState<Record<string, number | string>>({});
  const [groupSearch, setGroupSearch] = useState('');
  const [receiptFormat, setReceiptFormat] = useState<'thermal' | 'a4'>('thermal');
  const [receiptScope, setReceiptScope] = useState<'all' | 'paid_only'>('all');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  // Compute fee for a group based on discount
  const getGroupFee = (group: GroupMeta): number => {
    const isVip =
      isVipGroupId(group.id) ||
      group.id.toUpperCase().includes('VIP') ||
      Boolean(group.isVip) ||
      Boolean(data.groupData[group.id]?.isVip) ||
      Boolean(group.type?.includes('10000'));
    const targetType = group.type || data.groupData[group.id]?.type || (isVip ? '4-10000' : '4-2500');
    const tier = data.pricingTiers?.find((t) => t.id === targetType);
    let baseFee = 2500;
    if (typeof group.studentFee === 'number' && group.studentFee > 0) {
      baseFee = group.studentFee;
    } else if (typeof data.groupData[group.id]?.studentFee === 'number' && (data.groupData[group.id]?.studentFee || 0) > 0) {
      baseFee = data.groupData[group.id]?.studentFee || 2500;
    } else if (tier && typeof tier.price === 'number' && tier.price > 0) {
      baseFee = tier.price;
    } else if (isVip) {
      baseFee = 10000;
    } else {
      baseFee = 2500;
    }
    if (discount === '0') return 0;
    if (discount === '0.8') return Math.round(baseFee * 0.8);
    return baseFee;
  };

  // Toggle group enrollment selection (Step 1: Registration)
  const handleToggleGroup = (group: GroupMeta) => {
    const isSelected = selectedGroupIds.includes(group.id);
    if (isSelected) {
      setSelectedGroupIds((prev) => prev.filter((id) => id !== group.id));
      setPayingGroupIds((prev) => prev.filter((id) => id !== group.id));
      setGroupPayments((prev) => {
        const next = { ...prev };
        delete next[group.id];
        return next;
      });
    } else {
      setSelectedGroupIds((prev) => [...prev, group.id]);
      // When newly selected, also pre-select for payment with full fee
      setPayingGroupIds((prev) => [...prev, group.id]);
      const defaultFee = getGroupFee(group);
      setGroupPayments((prev) => ({
        ...prev,
        [group.id]: defaultFee
      }));
    }
  };

  // Toggle whether student pays for this group now (Step 2: Payment Selection)
  const handleTogglePaying = (groupId: string) => {
    const isPaying = payingGroupIds.includes(groupId);
    const group = data.groups.find((g) => g.id === groupId);
    if (!group) return;

    if (isPaying) {
      // Uncheck payment -> set payment to 0 (registration only / debt)
      setPayingGroupIds((prev) => prev.filter((id) => id !== groupId));
      setGroupPayments((prev) => ({
        ...prev,
        [groupId]: 0
      }));
    } else {
      // Check payment -> set payment to full fee
      setPayingGroupIds((prev) => [...prev, groupId]);
      const fee = getGroupFee(group);
      setGroupPayments((prev) => ({
        ...prev,
        [groupId]: fee
      }));
    }
  };

  // Select all enrolled groups to be paid
  const handleSelectAllPaying = () => {
    setPayingGroupIds([...selectedGroupIds]);
    setGroupPayments((prev) => {
      const next = { ...prev };
      selectedGroupIds.forEach((id) => {
        const g = data.groups.find((grp) => grp.id === id);
        if (g) {
          next[id] = getGroupFee(g);
        }
      });
      return next;
    });
  };

  // Deselect all paying groups (registration only with 0 payment)
  const handleDeselectAllPaying = () => {
    setPayingGroupIds([]);
    setGroupPayments((prev) => {
      const next = { ...prev };
      selectedGroupIds.forEach((id) => {
        next[id] = 0;
      });
      return next;
    });
  };

  // Update payment amount for a specific group
  const handlePaymentChange = (groupId: string, val: string) => {
    setGroupPayments((prev) => ({
      ...prev,
      [groupId]: val
    }));
    const num = Number(val) || 0;
    if (num > 0) {
      if (!payingGroupIds.includes(groupId)) {
        setPayingGroupIds((prev) => [...prev, groupId]);
      }
    } else if (val === '0' || val === '') {
      setPayingGroupIds((prev) => prev.filter((id) => id !== groupId));
    }
  };

  // Quick fill full fee
  const handleFillFull = (group: GroupMeta) => {
    const fee = getGroupFee(group);
    setPayingGroupIds((prev) => (prev.includes(group.id) ? prev : [...prev, group.id]));
    setGroupPayments((prev) => ({
      ...prev,
      [group.id]: fee
    }));
  };

  // Quick fill zero (debt)
  const handleFillZero = (groupId: string) => {
    setPayingGroupIds((prev) => prev.filter((id) => id !== groupId));
    setGroupPayments((prev) => ({
      ...prev,
      [groupId]: 0
    }));
  };

  // Handle discount change
  const handleDiscountChange = (newDiscount: DiscountType) => {
    setDiscount(newDiscount);
    setGroupPayments((prev) => {
      const next = { ...prev };
      selectedGroupIds.forEach((id) => {
        if (payingGroupIds.includes(id)) {
          const g = data.groups.find((grp) => grp.id === id);
          if (g) {
            const isVip =
              isVipGroupId(g.id) ||
              g.id.toUpperCase().includes('VIP') ||
              Boolean(g.isVip) ||
              Boolean(data.groupData[g.id]?.isVip) ||
              Boolean(g.type?.includes('10000'));
            const targetType = g.type || data.groupData[g.id]?.type || (isVip ? '4-10000' : '4-2500');
            const tier = data.pricingTiers?.find((t) => t.id === targetType);
            let baseFee = 2500;
            if (typeof g.studentFee === 'number' && g.studentFee > 0) {
              baseFee = g.studentFee;
            } else if (typeof data.groupData[g.id]?.studentFee === 'number' && (data.groupData[g.id]?.studentFee || 0) > 0) {
              baseFee = data.groupData[g.id]?.studentFee || 2500;
            } else if (tier && typeof tier.price === 'number' && tier.price > 0) {
              baseFee = tier.price;
            } else if (isVip) {
              baseFee = 10000;
            } else {
              baseFee = 2500;
            }
            let newFee = baseFee;
            if (newDiscount === '0') newFee = 0;
            else if (newDiscount === '0.8') newFee = Math.round(baseFee * 0.8);
            next[id] = newFee;
          }
        }
      });
      return next;
    });
  };

  // Filter groups: EXCLUDE inactive groups (groups that reached their last session, e.g. 4/4 or 6/6 or 8/8)
  const filteredGroups = data.groups.filter((g) => {
    const groupStatus = getGroupStatus(g, data.groupData[g.id], data.pricingTiers);
    // User requirement: if the group is inactive, don't show the group on the list of registration
    if (groupStatus.status === 'inactive') {
      return false;
    }

    const q = groupSearch.toLowerCase();
    return (
      g.id.toLowerCase().includes(q) ||
      g.subject.toLowerCase().includes(q) ||
      g.teacherName.toLowerCase().includes(q)
    );
  });

  // Calculate totals
  const totalFees = selectedGroupIds.reduce((sum, gId) => {
    const g = data.groups.find((grp) => grp.id === gId);
    return sum + (g ? getGroupFee(g) : 0);
  }, 0);

  const totalPaid = selectedGroupIds.reduce((sum, gId) => {
    const val = groupPayments[gId];
    return sum + (val !== undefined && val !== '' ? Number(val) || 0 : 0);
  }, 0);

  const totalDebt = Math.max(0, totalFees - totalPaid);

  // Print multi-enrollment receipt (supporting 80mm thermal or standard A4)
  const handlePrintMultiReceipt = (
    enrolledRecords: { groupId: string; fee: number; paid: number; debt: number }[]
  ) => {
    const receiptNo = `REG-${Date.now().toString().slice(-6)}`;
    const printDocTitle =
      sanitizePrintTitle(`${studentName} - ${receiptNo}`) ||
      `وصل تسجيل - ${studentName}`;

    const originalParentTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = printDocTitle;
    }
    const restoreParentTitle = () => {
      if (typeof document !== 'undefined' && originalParentTitle) {
        document.title = originalParentTitle;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('afterprint', restoreParentTitle);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('afterprint', restoreParentTitle, { once: true });
      setTimeout(restoreParentTitle, 5000);
    }

    const printWindow = window.open('', '_blank', receiptFormat === 'thermal' ? 'width=420,height=650' : 'width=750,height=900');
    if (!printWindow) return;
    printWindow.document.title = printDocTitle;

    const printDate = new Date().toLocaleDateString('ar-DZ');
    const printTime = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    const printRecords = receiptScope === 'paid_only'
      ? enrolledRecords.filter((rec) => rec.paid > 0)
      : enrolledRecords;
    const recordsToPrint = printRecords.length > 0 ? printRecords : enrolledRecords;

    const itemsRows = recordsToPrint
      .map((rec) => {
        const groupMeta = data.groups.find((g) => g.id === rec.groupId);
        const isPaid = rec.paid > 0;
        return `
        <tr style="${!isPaid ? 'background-color: #fafafa;' : ''}">
          <td style="text-align: center; font-weight: bold;">${rec.groupId} ${groupMeta?.isVip ? '★' : ''}</td>
          <td>${groupMeta?.subject || ''}</td>
          <td>${groupMeta?.teacherName || ''}</td>
          <td style="text-align: center;">${groupMeta?.day1 || ''}</td>
          <td style="text-align: center;">${rec.fee.toLocaleString()} دج</td>
          <td style="text-align: center; font-weight: bold; color: ${isPaid ? '#15803d' : '#64748b'};">
            ${isPaid ? rec.paid.toLocaleString() + ' دج' : '0 دج'}
          </td>
          <td style="text-align: center; font-weight: bold; color: ${rec.debt > 0 ? '#b91c1c' : '#15803d'};">
            ${isPaid ? (rec.debt === 0 ? 'مسدد بالكامل ✓' : `متبقي ${rec.debt.toLocaleString()} دج`) : 'تسجيل فقط (دين)'}
          </td>
        </tr>
      `;
      })
      .join('');

    if (receiptFormat === 'thermal') {
      // 80mm Thermal Receipt Template
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>${printDocTitle}</title>
            <style>
              @page { size: 80mm auto; margin: 0mm !important; }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              html, body {
                font-family: 'Courier New', 'Cairo', Tahoma, sans-serif;
                width: 100% !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 6px 4px 14px 4px !important;
                font-size: 11px;
                line-height: 1.35;
                text-align: right;
                direction: rtl;
                background: #fff;
                color: #000;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .center { text-align: center; }
              .bold { font-weight: 900; }
              .divider { width: 100%; border-top: 1.5px dashed #000; margin: 5px 0; }
              .flex-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-size: 11px; }
              .group-box { border: 1px solid #000; padding: 4px; margin: 4px 0; border-radius: 3px; font-size: 10px; }
              .barcode { font-family: monospace; letter-spacing: 2px; text-align: center; margin: 6px 0 2px; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="center" style="margin-bottom: 4px;">
              <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" style="height: 34px; max-width: 60mm; object-fit: contain; display: block; margin: 0 auto; filter: grayscale(100%);" />
            </div>
            <div class="center bold" style="font-size: 13px;">${data.centerName}</div>
            <div class="center" style="font-size: 9px;">${data.cycle} | ${data.academicYear}</div>
            <div class="divider"></div>
            
            <div class="center bold" style="font-size: 12px;">وصل تسجيل متعدد ودفع</div>
            <div class="flex-row" style="font-size: 10px;">
              <span>رقم: #${receiptNo}</span>
              <span>${printDate} ${printTime}</span>
            </div>
            <div class="divider"></div>

            <div class="flex-row">
              <span>التلميذ:</span>
              <span class="bold" style="font-size: 12px;">${studentName}</span>
            </div>
            ${studentPhone ? `<div class="flex-row"><span>الهاتف:</span><span>${studentPhone}</span></div>` : ''}
            <div class="flex-row">
              <span>نوع التسجيل:</span>
              <span>${discount === '0' ? 'معفى (0%)' : discount === '0.8' ? 'تخفيض (80%)' : 'تسعيرة عادية'}</span>
            </div>
            <div class="divider"></div>

            <div class="bold" style="margin-bottom: 3px;">
              ${receiptScope === 'paid_only' ? 'الأفواج المسددة الآن' : 'الأفواج المسجل فيها'} (${recordsToPrint.length}):
            </div>
            ${recordsToPrint
              .map((rec) => {
                const g = data.groups.find((grp) => grp.id === rec.groupId);
                const isPaid = rec.paid > 0;
                return `
                <div class="group-box" style="${!isPaid ? 'border-style: dashed; opacity: 0.8;' : ''}">
                  <div class="flex-row bold">
                    <span>${rec.groupId} - ${g?.subject || ''}</span>
                    <span style="${isPaid ? 'color: #000;' : 'color: #555;'}">${isPaid ? rec.paid.toLocaleString() + ' دج' : '0 دج (دين)'}</span>
                  </div>
                  <div class="flex-row" style="color: #333; font-size: 9px;">
                    <span>الأستاذ: ${g?.teacherName || ''}</span>
                    <span>${isPaid ? (rec.debt === 0 ? 'مسدد ✓' : `متبقي: ${rec.debt} دج`) : `تسجيل كدين (${rec.fee.toLocaleString()} دج)`}</span>
                  </div>
                </div>
              `;
              })
              .join('')}

            <div class="divider"></div>
            <div class="flex-row bold" style="font-size: 11px;">
              <span>مجموع الرسوم:</span>
              <span>${totalFees.toLocaleString()} دج</span>
            </div>
            <div class="flex-row bold" style="font-size: 13px; border: 1px solid #000; padding: 3px;">
              <span>المسدد الآن:</span>
              <span>${totalPaid.toLocaleString()} دج</span>
            </div>
            <div class="flex-row bold" style="font-size: 11px;">
              <span>المتبقي (الدين):</span>
              <span>${totalDebt > 0 ? totalDebt.toLocaleString() + ' دج' : 'مسدد بالكامل ✓'}</span>
            </div>

            <div class="barcode">*${receiptNo}*</div>
            <div class="center" style="font-size: 9px; margin-top: 4px;">شكراً لثقتكم بمؤسستنا - بالتوفيق والنجاح</div>

            <script>
              window.onload = function() {
                document.title = ${JSON.stringify(printDocTitle)};
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
    } else {
      // Standard A4 Receipt Template
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>${printDocTitle}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              * { box-sizing: border-box; }
              body {
                font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
                color: #111;
                margin: 0;
                padding: 15px;
                direction: rtl;
                text-align: right;
                font-size: 13px;
                line-height: 1.5;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 2px solid #00639b;
                padding-bottom: 12px;
                margin-bottom: 16px;
              }
              .logo { height: 50px; width: auto; object-fit: contain; }
              .title-box { text-align: center; background: #f0f7ff; border: 1px solid #cde5ff; padding: 10px; border-radius: 6px; margin-bottom: 16px; }
              .title-box h2 { margin: 0 0 4px 0; color: #004b75; font-size: 18px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #fafafa; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 16px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 12px; }
              th { background: #f1f5f9; font-weight: bold; }
              .totals-box { border: 2px solid #00639b; border-radius: 6px; padding: 12px; background: #f8fafc; margin-bottom: 24px; }
              .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
              .paid-line { border-top: 1.5px solid #00639b; border-bottom: 1.5px solid #00639b; font-size: 16px; font-weight: 900; color: #00639b; padding: 6px 0; margin: 4px 0; }
              .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 30px; }
              .sig-box { text-align: center; width: 200px; }
              .sig-line { margin-top: 50px; border-top: 1px dashed #64748b; font-size: 11px; color: #64748b; padding-top: 4px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" class="logo" />
                <div>
                  <h1 style="margin: 0; font-size: 16px; font-weight: 900;">${data.centerName}</h1>
                  <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">${data.cycle} | ${data.academicYear}</p>
                </div>
              </div>
              <div style="text-align: left; font-size: 11px;">
                <div>رقم الوصل: <strong style="font-size: 13px; color: #00639b;">#${receiptNo}</strong></div>
                <div>التاريخ: <strong>${printDate}</strong></div>
                <div>الوقت: <strong>${printTime}</strong></div>
              </div>
            </div>

            <div class="title-box">
              <h2>وصل تسجيل واستلام مستحقات دراسية</h2>
              <div style="font-size: 11px; color: #475569;">إثبات رسمي لتسجيل التلميذ في الأفواج وتسديد المستحقات</div>
            </div>

            <div class="info-grid">
              <div><strong>اسم التلميذ:</strong> ${studentName}</div>
              <div><strong>رقم الهاتف:</strong> ${studentPhone || 'غير مسجل'}</div>
              <div><strong>تاريخ التسجيل:</strong> ${printDate}</div>
              <div><strong>نوع التسجيل:</strong> ${discount === '0' ? 'معفى (0%)' : discount === '0.8' ? 'تخفيض 20%' : 'تسعيرة عادية'}</div>
            </div>

            <div style="font-weight: bold; margin-bottom: 6px;">
              ${receiptScope === 'paid_only' ? 'الأفواج الدراسية المسددة الآن' : 'الأفواج الدراسية المسجل فيها'} (${recordsToPrint.length} فوج):
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 70px; text-align: center;">الفوج</th>
                  <th>المادة</th>
                  <th>الأستاذ</th>
                  <th style="text-align: center;">التوقيت</th>
                  <th style="text-align: center;">سعر الدورة</th>
                  <th style="text-align: center;">المسدد الآن</th>
                  <th style="text-align: center;">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <div class="totals-box">
              <div class="totals-row">
                <span>مجموع رسوم الدورات:</span>
                <strong>${totalFees.toLocaleString()} دج</strong>
              </div>
              <div class="totals-row paid-line">
                <span>إجمالي المبلغ المسدد الآن:</span>
                <span>${totalPaid.toLocaleString()} دج</span>
              </div>
              <div class="totals-row" style="color: ${totalDebt > 0 ? '#b91c1c' : '#15803d'}; font-weight: bold;">
                <span>إجمالي الدين المتبقي:</span>
                <span>${totalDebt > 0 ? totalDebt.toLocaleString() + ' دج' : 'تم التسديد بالكامل ✓'}</span>
              </div>
            </div>

            <div class="signatures">
              <div class="sig-box">
                <strong>ختم وإمضاء إدارة المركز</strong>
                <div class="sig-line">الإدارة المالية</div>
              </div>
              <div class="sig-box">
                <strong>إمضاء التلميذ / الولي</strong>
                <div class="sig-line">${studentName}</div>
              </div>
            </div>

            <script>
              window.onload = function() {
                document.title = ${JSON.stringify(printDocTitle)};
                window.print();
              };
            </script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
  };

  // Submit enrollment
  const handleEnrollStudent = (shouldPrint: boolean = false) => {
    if (!studentName.trim()) {
      alert('يرجى كتابة اسم ولقب التلميذ');
      return;
    }

    if (selectedGroupIds.length === 0) {
      alert('يرجى اختيار فوج واحد على الأقل لتسجيل التلميذ فيه');
      return;
    }

    const enrollments = selectedGroupIds.map((groupId) => ({
      groupId,
      paymentAmount: groupPayments[groupId] !== undefined && groupPayments[groupId] !== '' ? Number(groupPayments[groupId]) || 0 : 0
    }));

    const results = enrollStudentMultiGroups(
      {
        name: studentName.trim(),
        phone: studentPhone.trim(),
        discount
      },
      enrollments
    );

    setSuccessMsg(`تم تسجيل التلميذ بنجاح في ${selectedGroupIds.length} فوج!`);

    if (shouldPrint) {
      handlePrintMultiReceipt(results);
    }

    setTimeout(() => {
      onClose();
    }, shouldPrint ? 500 : 1200);
  };

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '90vh',
          padding: '18px 22px',
          borderRadius: 'var(--md-shape-lg)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.svg"
              alt="شعار المؤسسة"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 6px',
                borderRadius: 'var(--md-shape-xs)',
                boxShadow: 'var(--md-elevation-1)'
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserPlus size={18} color="var(--md-sys-color-primary)" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  تسجيل تلميذ ودفع (فوج أو عدة أفواج)
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', margin: '2px 0 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
                تسجيل فوري للتلميذ في عدة أفواج مع تحديد الدفعات وطباعة وصل استلام رسمي
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '30px', height: '30px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {successMsg && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-xs)',
              fontWeight: 700,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '2px' }}>
          {/* Student Info Inputs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr',
              gap: '10px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '10px 12px',
              borderRadius: 'var(--md-shape-sm)'
            }}
          >
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px' }}>
                اسم ولقب التلميذ *
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="مثال: محمد بن علي..."
                className="m3-input"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                autoFocus
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px' }}>
                رقم الهاتف
              </label>
              <input
                type="text"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                placeholder="06XXXXXXXX"
                className="m3-input"
                style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: '4px' }}>
                نوع التسجيل / التخفيض
              </label>
              <select
                value={discount}
                onChange={(e) => handleDiscountChange(e.target.value as DiscountType)}
                className="m3-input"
                style={{ padding: '6px 10px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                <option value="1">تسعيرة عادية (100%)</option>
                <option value="0.8">تخفيض الأخوة (80%)</option>
                <option value="0">معفى بالكامل (0%)</option>
                <option value="تعويض">حصة تعويضية</option>
              </select>
            </div>
          </div>

          {/* Group Selection Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="var(--md-sys-color-primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  اختر الأفواج المراد التسجيل فيها ({selectedGroupIds.length} محددة):
                </span>
              </div>

              <div style={{ position: 'relative', width: '180px' }}>
                <input
                  type="text"
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="تصفية الأفواج..."
                  className="m3-input"
                  style={{ padding: '3px 8px', fontSize: '0.75rem', width: '100%' }}
                />
              </div>
            </div>

            {/* Groups Grid / Chips */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '6px',
                maxHeight: '135px',
                overflowY: 'auto',
                border: '1px solid var(--md-sys-color-outline-variant)',
                padding: '8px',
                borderRadius: 'var(--md-shape-sm)',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)'
              }}
            >
              {filteredGroups.map((group) => {
                const isSelected = selectedGroupIds.includes(group.id);
                const fee = getGroupFee(group);
                const gStatus = getGroupStatus(group, data.groupData[group.id], data.pricingTiers);

                return (
                  <div
                    key={group.id}
                    onClick={() => handleToggleGroup(group)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: 'var(--md-shape-xs)',
                      border: isSelected ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by div click
                      style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.8rem', color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)' }}>
                            {group.id} {group.isVip ? '★' : ''}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--status-present-container)',
                              color: 'var(--status-present)'
                            }}
                          >
                            نشط ({gStatus.currentSession}/{gStatus.totalSessions})
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--status-present)' }}>
                          {fee.toLocaleString()} دج
                        </span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {group.subject} • {group.teacherName}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredGroups.length === 0 && (
                <div style={{ gridColumn: '1 / -1', padding: '16px', textAlign: 'center', color: 'var(--md-sys-color-outline)', fontSize: '0.8rem' }}>
                  لا توجد أفواج نشطة متاحة للتسجيل حالياً (الأفواج التي بلغت آخر حصة غير نشطة تلقائياً)
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Payment Selection for Selected Groups */}
          {selectedGroupIds.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '6px',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={16} color="var(--status-present)" />
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                    2. حدد الأفواج التي سيدفع عنها التلميذ الآن:
                  </span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '1px 7px',
                      borderRadius: '12px',
                      backgroundColor: payingGroupIds.length > 0 ? 'var(--status-present-container)' : 'var(--md-sys-color-surface-container-high)',
                      color: payingGroupIds.length > 0 ? 'var(--status-present)' : 'var(--md-sys-color-outline)'
                    }}
                  >
                    {payingGroupIds.length} من {selectedGroupIds.length} محددة للدفع
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllPaying}
                    className="m3-btn m3-btn-tonal m3-btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Check size={13} />
                    <span>دفع لجميع الأفواج</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAllPaying}
                    className="m3-btn m3-btn-outlined m3-btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.72rem', color: 'var(--md-sys-color-outline)' }}
                  >
                    <span>تسجيل فقط (بدون دفع 0 دج)</span>
                  </button>
                </div>
              </div>

              <div
                className="m3-table-container"
                style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--md-sys-color-outline-variant)' }}
              >
                <table className="m3-table" style={{ fontSize: '0.78rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '48px', textAlign: 'center', padding: '5px 6px' }}>
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.length > 0 && selectedGroupIds.every((id) => payingGroupIds.includes(id))}
                          onChange={
                            selectedGroupIds.length > 0 && selectedGroupIds.every((id) => payingGroupIds.includes(id))
                              ? handleDeselectAllPaying
                              : handleSelectAllPaying
                          }
                          style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--status-present)' }}
                          title="تحديد أو إلغاء تحديد دفع جميع الأفواج"
                        />
                      </th>
                      <th style={{ width: '75px', padding: '5px 8px' }}>الفوج</th>
                      <th style={{ padding: '5px 8px' }}>المادة والأستاذ</th>
                      <th style={{ textAlign: 'center', padding: '5px 8px' }}>المطلوب</th>
                      <th style={{ textAlign: 'center', width: '120px', padding: '5px 8px' }}>المسدد الآن (دج)</th>
                      <th style={{ textAlign: 'center', padding: '5px 8px' }}>خيارات</th>
                      <th style={{ textAlign: 'center', padding: '5px 8px' }}>حالة الدفع / الدين</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedGroupIds.map((groupId) => {
                      const group = data.groups.find((g) => g.id === groupId);
                      if (!group) return null;

                      const isPaying = payingGroupIds.includes(groupId);
                      const fee = getGroupFee(group);
                      const currentPay = groupPayments[groupId] !== undefined && groupPayments[groupId] !== '' ? Number(groupPayments[groupId]) || 0 : 0;
                      const debt = Math.max(0, fee - currentPay);

                      return (
                        <tr
                          key={groupId}
                          style={{
                            backgroundColor: isPaying ? 'rgba(16, 185, 129, 0.06)' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <input
                              type="checkbox"
                              checked={isPaying}
                              onChange={() => handleTogglePaying(groupId)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--status-present)' }}
                              title={isPaying ? 'إلغاء الدفع لهذا الفوج (تسجيل فقط كدين)' : 'تحديد هذا الفوج للدفع الآن'}
                            />
                          </td>
                          <td style={{ fontWeight: 800, padding: '4px 8px' }}>
                            <span style={{ color: isPaying ? 'var(--status-present)' : 'inherit' }}>
                              {group.id} {group.isVip ? '★' : ''}
                            </span>
                          </td>
                          <td style={{ padding: '4px 8px' }}>
                            {group.subject} ({group.teacherName})
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                            {fee.toLocaleString()} دج
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <input
                              type="number"
                              value={groupPayments[groupId] !== undefined && groupPayments[groupId] !== null ? groupPayments[groupId] : ''}
                              onChange={(e) => handlePaymentChange(groupId, e.target.value)}
                              placeholder="0 دج"
                              disabled={!isPaying}
                              className="m3-input"
                              style={{
                                width: '85px',
                                padding: '3px 6px',
                                textAlign: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                color: isPaying && currentPay > 0 ? 'var(--status-present)' : 'inherit',
                                backgroundColor: isPaying ? 'var(--md-sys-color-surface)' : 'var(--md-sys-color-surface-container-low)',
                                opacity: isPaying ? 1 : 0.65
                              }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 6px' }}>
                            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleFillFull(group)}
                                className="m3-btn m3-btn-outlined m3-btn-sm"
                                style={{
                                  padding: '1px 6px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  color: isPaying ? 'var(--status-present)' : 'inherit',
                                  borderColor: isPaying ? 'var(--status-present)' : undefined
                                }}
                                title="دفع كامل المبلغ المطلوب"
                              >
                                كامل
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFillZero(groupId)}
                                className="m3-btn m3-btn-text m3-btn-sm"
                                style={{ padding: '1px 5px', fontSize: '0.7rem', color: 'var(--md-sys-color-outline)' }}
                                title="تسجيل فقط بدون دفع (0 دج)"
                              >
                                0 دج
                              </button>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '4px 8px' }}>
                            {isPaying ? (
                              debt === 0 ? (
                                <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--status-present)' }}>
                                  مسدد بالكامل ✓
                                </span>
                              ) : (
                                <span style={{ fontWeight: 800, fontSize: '0.75rem', color: '#d97706' }}>
                                  تسديد جزئي (باقي {debt.toLocaleString()} دج)
                                </span>
                              )
                            ) : (
                              <span style={{ fontWeight: 800, fontSize: '0.75rem', color: 'var(--status-absent)' }}>
                                تسجيل فقط (دين كامل: {fee.toLocaleString()} دج)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Financial Totals Summary Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '8px 12px',
              borderRadius: 'var(--md-shape-sm)',
              textAlign: 'center'
            }}
          >
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                إجمالي المطلوب ({selectedGroupIds.length} فوج)
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                {totalFees.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--status-present)' }}>
                إجمالي المسدد الآن
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--status-present)' }}>
                {totalPaid.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: totalDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
                إجمالي الدين المتبقي
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: totalDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
                {totalDebt.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            paddingTop: '10px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          {/* Receipt format & scope toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700 }}>نوع الوصل:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="receiptFormat"
                  value="thermal"
                  checked={receiptFormat === 'thermal'}
                  onChange={() => setReceiptFormat('thermal')}
                />
                <span>حراري 80mm</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="receiptFormat"
                  value="a4"
                  checked={receiptFormat === 'a4'}
                  onChange={() => setReceiptFormat('a4')}
                />
                <span>قياسي A4</span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700 }}>الأفواج بالوصل:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="receiptScope"
                  value="all"
                  checked={receiptScope === 'all'}
                  onChange={() => setReceiptScope('all')}
                />
                <span>الكل ({selectedGroupIds.length})</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="receiptScope"
                  value="paid_only"
                  checked={receiptScope === 'paid_only'}
                  onChange={() => setReceiptScope('paid_only')}
                />
                <span>المسددة فقط ({payingGroupIds.length})</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text m3-btn-sm" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              إلغاء
            </button>
            <button
              type="button"
              onClick={() => handleEnrollStudent(false)}
              className="m3-btn m3-btn-tonal m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem' }}
            >
              <Check size={16} />
              <span>تسجيل فقط</span>
            </button>
            <button
              type="button"
              onClick={() => handleEnrollStudent(true)}
              className="m3-btn m3-btn-primary m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '0.85rem' }}
            >
              <Printer size={16} />
              <span>تسجيل وطباعة الوصل 🖨️</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

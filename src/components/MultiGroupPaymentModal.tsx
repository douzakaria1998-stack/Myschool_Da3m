'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp, calcStudentFinancesPure } from '../context/AppContext';
import { StudentRecord, GroupMeta } from '../types';
import {
  X,
  CreditCard,
  Printer,
  Check,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Scan,
  Layers,
  Sparkles,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { normalizeArabicName, getBarcodeCandidates } from '../utils/barcodeUtils';
import { isSummaryRow } from '../utils/sessionUtils';
import { playSuccessChime } from '../utils/soundUtils';
import { sanitizePrintTitle } from '../utils/printTitleUtils';
import { normalizeScannedBarcode } from '../utils/barcodeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialStudent?: { name: string; barcode?: string; phone?: string };
}

interface EnrolledGroupItem {
  groupId: string;
  subject: string;
  teacherName: string;
  isVip: boolean;
  day1?: string;
  time1?: string;
  totalFee: number;
  totalReceived: number;
  currentDebt: number;
  payingNow: number | string;
  isSelected: boolean;
  isNewEnrollment?: boolean;
}

function formatTiming(t?: string | number): string {
  if (!t) return '';
  const str = String(t).trim();
  const num = parseFloat(str);
  if (!isNaN(num) && num > 0 && num < 1) {
    const totalMinutes = Math.round(num * 24 * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  return str;
}

export default function MultiGroupPaymentModal({ isOpen, onClose, initialStudent }: Props) {
  const { data, recordMultiGroupPayment } = useApp();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{
    name: string;
    barcode: string;
    phone: string;
  } | null>(null);

  // Group payments list
  const [groupItems, setGroupItems] = useState<EnrolledGroupItem[]>([]);
  const [additionalGroupId, setAdditionalGroupId] = useState('');
  const [showPaidGroups, setShowPaidGroups] = useState(false);

  // Print settings
  const [receiptFormat, setReceiptFormat] = useState<'thermal' | 'a4'>('thermal');
  const [receiptScope, setReceiptScope] = useState<'paid_only' | 'all'>('paid_only');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Collect unique students across the center
  const allUniqueStudents = useMemo(() => {
    const studentMap = new Map<string, { name: string; barcode: string; phone: string; groupCount: number; totalDebt: number }>();
    
    Object.entries(data.groupData).forEach(([gid, group]) => {
      (group.students || []).forEach((s) => {
        if (isSummaryRow(s, gid) || !s.name?.trim()) return;
        const norm = normalizeArabicName(s.name);
        const existing = studentMap.get(norm);
        const debt = s.debt > 0 ? s.debt : 0;
        if (existing) {
          existing.groupCount += 1;
          existing.totalDebt += debt;
          if (!existing.barcode && s.barcode) existing.barcode = s.barcode;
          if (!existing.phone && s.phone) existing.phone = s.phone;
        } else {
          studentMap.set(norm, {
            name: s.name.trim(),
            barcode: s.barcode || '',
            phone: s.phone || '',
            groupCount: 1,
            totalDebt: debt
          });
        }
      });
    });

    return Array.from(studentMap.values());
  }, [data.groupData]);

  // Matching search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];

    const candidates = getBarcodeCandidates(q);
    const qNorm = normalizeArabicName(q);
    const qDigits = q.replace(/[^0-9]/g, '');

    return allUniqueStudents.filter((stu) => {
      const sNorm = normalizeArabicName(stu.name);
      const sBarcodeUpper = (stu.barcode || '').toUpperCase();
      const sPhoneClean = (stu.phone || '').replace(/[^0-9]/g, '');

      // Name match
      if (sNorm.includes(qNorm) || qNorm.includes(sNorm)) return true;

      // Barcode match with candidate permutations
      for (const cand of candidates) {
        const candUpper = cand.toUpperCase();
        if (sBarcodeUpper && candUpper === sBarcodeUpper) return true;
      }

      // Phone match
      if (qDigits.length >= 4 && sPhoneClean.includes(qDigits)) return true;

      return false;
    }).slice(0, 10);
  }, [searchQuery, allUniqueStudents]);

  // Select student and build their enrolled groups
  const handleSelectStudent = (stu: { name: string; barcode: string; phone: string }) => {
    setSelectedStudent(stu);
    setSearchQuery('');

    const normName = normalizeArabicName(stu.name);
    const barcodeUpper = (stu.barcode || '').toUpperCase();

    const items: EnrolledGroupItem[] = [];

    Object.entries(data.groupData).forEach(([gid, group]) => {
      const found = (group.students || []).find(
        (s) =>
          !isSummaryRow(s, gid) &&
          ((barcodeUpper && s.barcode && s.barcode.toUpperCase() === barcodeUpper) ||
            normalizeArabicName(s.name) === normName)
      );

      if (found) {
        const groupMeta = data.groups.find((g) => g.id === gid);
        const isVipGroup =
          gid.toUpperCase().startsWith('BACV') ||
          gid.toUpperCase().includes('VIP') ||
          Boolean(group.isVip) ||
          Boolean(groupMeta?.isVip) ||
          Boolean(group.type?.includes('10000')) ||
          Boolean(groupMeta?.type?.includes('10000'));

        const targetType = group.type || groupMeta?.type || (isVipGroup ? '4-10000' : '4-2500');
        const finances = calcStudentFinancesPure(
          found,
          targetType,
          data.pricingTiers,
          { ...group, groupId: gid, isVip: isVipGroup }
        );

        const expectedFee = finances.fee;
        const totalPaid = finances.totalReceived;
        const effectiveDebt = finances.debt;

        items.push({
          groupId: gid,
          subject: group.subject || groupMeta?.subject || '',
          teacherName: group.teacherName || groupMeta?.teacherName || '',
          isVip: isVipGroup,
          day1: group.day1 || groupMeta?.day1,
          time1: group.time1 || groupMeta?.time1,
          totalFee: expectedFee,
          totalReceived: totalPaid,
          currentDebt: effectiveDebt,
          payingNow: effectiveDebt > 0 ? effectiveDebt : '',
          isSelected: effectiveDebt > 0
        });
      }
    });

    setGroupItems(items);
  };

  // Hardware scanner auto-select
  useEffect(() => {
    if (!isOpen || selectedStudent) return;
    const cleanQ = normalizeScannedBarcode(searchQuery).trim();
    if (cleanQ.length >= 8) {
      const exactBarcodeMatch = allUniqueStudents.find(
        (s) => s.barcode && s.barcode.toUpperCase() === cleanQ.toUpperCase()
      );
      if (exactBarcodeMatch) {
        handleSelectStudent(exactBarcodeMatch);
      }
    }
  }, [searchQuery, isOpen, selectedStudent, allUniqueStudents]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      if (initialStudent) {
        handleSelectStudent({
          name: initialStudent.name,
          barcode: initialStudent.barcode || '',
          phone: initialStudent.phone || ''
        });
      } else {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    } else {
      setSelectedStudent(null);
      setGroupItems([]);
      setShowPaidGroups(false);
      setSearchQuery('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Toggle group selection
  const handleToggleGroup = (groupId: string) => {
    setGroupItems((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        const nextSelected = !item.isSelected;
        return {
          ...item,
          isSelected: nextSelected,
          payingNow: nextSelected ? (item.currentDebt > 0 ? item.currentDebt : item.totalFee) : ''
        };
      })
    );
  };

  // Update payment amount for a group
  const handlePaymentChange = (groupId: string, val: string) => {
    setGroupItems((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        const num = Number(val) || 0;
        return {
          ...item,
          payingNow: val,
          isSelected: num > 0 || item.isSelected
        };
      })
    );
  };

  // Quick fill buttons
  const handleQuickFill = (groupId: string, amount: number) => {
    setGroupItems((prev) =>
      prev.map((item) => {
        if (item.groupId !== groupId) return item;
        return {
          ...item,
          payingNow: amount,
          isSelected: amount > 0
        };
      })
    );
  };

  // Add additional group not yet enrolled
  const handleAddAdditionalGroup = () => {
    if (!additionalGroupId) return;
    const groupMeta = data.groups.find((g) => g.id === additionalGroupId);
    const groupSheet = data.groupData[additionalGroupId];
    if (!groupMeta && !groupSheet) return;

    if (groupItems.some((i) => i.groupId === additionalGroupId)) {
      alert('هذا الفوج مضاف بالفعل في القائمة أدناه');
      setAdditionalGroupId('');
      return;
    }

    const isVip =
      additionalGroupId.toUpperCase().includes('VIP') ||
      additionalGroupId.toUpperCase().startsWith('BACV') ||
      Boolean(groupSheet?.isVip) ||
      Boolean(groupMeta?.isVip) ||
      Boolean(groupSheet?.type?.includes('10000')) ||
      Boolean(groupMeta?.type?.includes('10000'));

    const targetType = groupSheet?.type || groupMeta?.type || (isVip ? '4-10000' : '4-2500');
    const tier = data.pricingTiers?.find((t) => t.id === targetType);

    let fee = 2500;
    if (typeof groupSheet?.studentFee === 'number' && groupSheet.studentFee > 0) {
      fee = groupSheet.studentFee;
    } else if (typeof groupMeta?.studentFee === 'number' && groupMeta.studentFee > 0) {
      fee = groupMeta.studentFee;
    } else if (tier && typeof tier.price === 'number' && tier.price > 0) {
      fee = tier.price;
    } else if (isVip) {
      fee = 10000;
    } else {
      fee = 2500;
    }

    const newItem: EnrolledGroupItem = {
      groupId: additionalGroupId,
      subject: groupSheet?.subject || groupMeta?.subject || '',
      teacherName: groupSheet?.teacherName || groupMeta?.teacherName || '',
      isVip,
      day1: groupSheet?.day1 || groupMeta?.day1,
      time1: groupSheet?.time1 || groupMeta?.time1,
      totalFee: fee,
      totalReceived: 0,
      currentDebt: fee,
      payingNow: fee,
      isSelected: true,
      isNewEnrollment: true
    };

    setGroupItems((prev) => [...prev, newItem]);
    setAdditionalGroupId('');
  };

  // Available groups for addition
  const availableGroupsToAdd = data.groups.filter(
    (g) => !groupItems.some((item) => item.groupId === g.id)
  );

  // Summary calculations
  const unpaidCount = groupItems.filter((i) => i.currentDebt > 0 || i.isNewEnrollment).length;
  const paidCount = groupItems.filter((i) => i.currentDebt <= 0 && !i.isNewEnrollment).length;
  const displayedGroups = groupItems.filter((i) => {
    if (showPaidGroups) return true;
    return i.currentDebt > 0 || i.isNewEnrollment;
  });

  const payingItems = groupItems.filter((i) => i.isSelected && Number(i.payingNow) > 0);
  const totalPaidNow = payingItems.reduce((sum, i) => sum + (Number(i.payingNow) || 0), 0);
  const totalFees = groupItems.filter((i) => i.isSelected).reduce((sum, i) => sum + i.totalFee, 0);
  const totalRemainingDebt = groupItems
    .filter((i) => i.isSelected)
    .reduce((sum, i) => {
      const pay = Number(i.payingNow) || 0;
      return sum + Math.max(0, i.currentDebt - pay);
    }, 0);

  // Save payments & print combined receipt
  const handleSaveAndPrint = (shouldPrint: boolean) => {
    if (!selectedStudent) {
      alert('يرجى اختيار تلميذ أولاً');
      return;
    }

    if (payingItems.length === 0) {
      alert('يرجى تحديد فوج واحد على الأقل وإدخال مبلغ التسديد');
      return;
    }

    setIsSaving(true);

    const paymentsToApply = payingItems.map((item) => ({
      groupId: item.groupId,
      paymentAmount: Number(item.payingNow) || 0
    }));

    const results = recordMultiGroupPayment(
      {
        name: selectedStudent.name,
        barcode: selectedStudent.barcode,
        phone: selectedStudent.phone
      },
      paymentsToApply
    );

    playSuccessChime();

    if (shouldPrint) {
      handlePrintReceipt(results);
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 300);
    } else {
      setIsSaving(false);
      onClose();
    }
  };

  // Print Combined Unified Receipt
  const handlePrintReceipt = (
    results: { groupId: string; rowId: number; fee: number; paidNow: number; totalReceived: number; debt: number }[]
  ) => {
    if (!selectedStudent) return;

    const studentId = selectedStudent.barcode;
    const printDocTitle =
      sanitizePrintTitle(`${selectedStudent.name} - ${studentId || 'وصل تسديد'}`) ||
      `وصل تسديد متعدد - ${selectedStudent.name}`;

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
    const receiptNo = `PAY-${Date.now().toString().slice(-6)}`;

    const recordsToPrint = receiptScope === 'paid_only'
      ? results.filter((r) => r.paidNow > 0)
      : results;

    const grandTotalPaid = recordsToPrint.reduce((s, r) => s + r.paidNow, 0);
    const grandTotalDebt = recordsToPrint.reduce((s, r) => s + r.debt, 0);

    if (receiptFormat === 'thermal') {
      // 80mm Thermal Combined Receipt
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
            
            <div class="center bold" style="font-size: 12px;">وصل تسديد مالي موحد</div>
            <div class="flex-row" style="font-size: 10px;">
              <span>رقم الوصل: #${receiptNo}</span>
              <span>${printDate} ${printTime}</span>
            </div>
            <div class="divider"></div>

            <div class="flex-row">
              <span>التلميذ:</span>
              <span class="bold" style="font-size: 12px;">${selectedStudent.name}</span>
            </div>
            ${selectedStudent.barcode ? `<div class="flex-row"><span>رقم الباركود:</span><span class="bold">${selectedStudent.barcode}</span></div>` : ''}
            ${selectedStudent.phone ? `<div class="flex-row"><span>الهاتف:</span><span>${selectedStudent.phone}</span></div>` : ''}
            <div class="divider"></div>

            <div class="bold" style="margin-bottom: 3px;">
              تفاصيل تسديد الأفواج (${recordsToPrint.length} فوج):
            </div>
            ${recordsToPrint
              .map((rec) => {
                const g = data.groups.find((grp) => grp.id === rec.groupId);
                return `
                <div class="group-box">
                  <div class="flex-row bold">
                    <span>${rec.groupId} - ${g?.subject || ''}</span>
                    <span>+ ${rec.paidNow.toLocaleString()} دج</span>
                  </div>
                  <div class="flex-row" style="color: #333; font-size: 9px;">
                    <span>الأستاذ: ${g?.teacherName || ''}</span>
                    <span>${rec.debt > 0 ? `متبقي دين: ${rec.debt.toLocaleString()} دج` : 'مسدد بالكامل ✓'}</span>
                  </div>
                </div>
              `;
              })
              .join('')}

            <div class="divider"></div>
            <div class="flex-row bold" style="font-size: 13px; border: 1.5px solid #000; padding: 4px; background: #eee;">
              <span>المجموع المسدد الآن:</span>
              <span>${grandTotalPaid.toLocaleString()} دج</span>
            </div>
            <div class="flex-row bold" style="font-size: 11px; margin-top: 3px;">
              <span>إجمالي المتبقي كدين:</span>
              <span>${grandTotalDebt > 0 ? grandTotalDebt.toLocaleString() + ' دج' : 'مسدد بالكامل ✓'}</span>
            </div>

            <div class="barcode">*${selectedStudent.barcode || receiptNo}*</div>
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
      // Standard A4 Combined Receipt
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>${printDocTitle}</title>
            <style>
              body { font-family: 'Cairo', sans-serif; padding: 30px; text-align: right; color: #111; }
              .header { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
              table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
              th { background: #f0f9ff; font-weight: bold; }
              .totals-box { border: 2px solid #0284c7; padding: 14px; border-radius: 8px; margin-top: 20px; background: #f0f9ff; }
              .flex-row { display: flex; justify-content: space-between; align-items: center; margin: 6px 0; font-size: 15px; }
              .total-paid { font-size: 20px; font-weight: 900; color: #0284c7; }
              .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" style="height: 50px; max-width: 220px; object-fit: contain; margin: 0 auto 8px; display: block;" />
              <h2 style="margin: 0; color: #0284c7;">${data.centerName}</h2>
              <p style="margin: 4px 0 0; color: #555;">${data.cycle} | ${data.academicYear}</p>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 14px;">
              <div>
                <p><strong>التلميذ:</strong> ${selectedStudent.name}</p>
                <p><strong>الهاتف:</strong> ${selectedStudent.phone || 'غير مسجل'}</p>
                <p><strong>رقم الباركود:</strong> ${selectedStudent.barcode || 'غير مسجل'}</p>
              </div>
              <div style="text-align: left;">
                <p><strong>رقم الوصل:</strong> #${receiptNo}</p>
                <p><strong>التاريخ:</strong> ${printDate}</p>
                <p><strong>الوقت:</strong> ${printTime}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>الفوج</th>
                  <th>المادة</th>
                  <th>الأستاذ</th>
                  <th>المبلغ المستحق</th>
                  <th>المسدد الآن</th>
                  <th>الوضعية</th>
                </tr>
              </thead>
              <tbody>
                ${recordsToPrint
                  .map((rec) => {
                    const g = data.groups.find((grp) => grp.id === rec.groupId);
                    return `
                    <tr>
                      <td style="font-weight: bold; text-align: center;">${rec.groupId}</td>
                      <td>${g?.subject || ''}</td>
                      <td>${g?.teacherName || ''}</td>
                      <td style="text-align: center;">${rec.fee.toLocaleString()} دج</td>
                      <td style="text-align: center; font-weight: bold; color: #0284c7;">${rec.paidNow.toLocaleString()} دج</td>
                      <td style="text-align: center; color: ${rec.debt > 0 ? '#b91c1c' : '#15803d'};">
                        ${rec.debt > 0 ? `متبقي دين: ${rec.debt.toLocaleString()} دج` : 'خالص ✓'}
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>

            <div class="totals-box">
              <div class="flex-row">
                <span>المبلغ الإجمالي المسدد الآن:</span>
                <span class="total-paid">${grandTotalPaid.toLocaleString()} دج</span>
              </div>
              <div class="flex-row" style="color: ${grandTotalDebt > 0 ? '#b91c1c' : '#15803d'}; font-weight: bold;">
                <span>إجمالي الديون المتبقية:</span>
                <span>${grandTotalDebt > 0 ? `${grandTotalDebt.toLocaleString()} دج` : 'مسدد بالكامل ✓'}</span>
              </div>
            </div>

            <div class="footer">
              <p>شكراً لثقتكم بمؤسستنا - نتمنى لتلميذنا دوام التفوق والنجاح</p>
            </div>

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
    }

    printWindow.document.close();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 140,
        padding: '12px'
      }}
      onClick={onClose}
    >
      <div
        className="m3-card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--md-elevation-5)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header (Compact) */}
        <div
          style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f0f9ff'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                backgroundColor: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}
            >
              <CreditCard size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0369a1', margin: 0 }}>
                تسديد جديد (فوج أو عدة أفواج)
              </h2>
              <p style={{ fontSize: '0.72rem', color: '#0284c7', margin: '1px 0 0' }}>
                تسديد مالي لتلميذ في عدة أفواج معاً واستخراج وصل موحد شامل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-icon"
            style={{ color: 'var(--md-sys-color-on-surface-variant)', width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '8px 14px', overflowY: 'auto', flex: 1 }}>
          {successMsg && (
            <div
              style={{
                padding: '6px 12px',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: 'var(--md-shape-md)',
                color: '#15803d',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: '8px'
              }}
            >
              <CheckCircle2 size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Search & Select Student */}
          {!selectedStudent ? (
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface)', marginBottom: '6px' }}>
                الخطوة 1: ابحث عن التلميذ بالاسم أو امسح الباركود
              </div>

              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--md-sys-color-primary)',
                    pointerEvents: 'none'
                  }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const cleanVal = normalizeScannedBarcode(e.target.value);
                    setSearchQuery(cleanVal);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData('text');
                    const cleanVal = normalizeScannedBarcode(pasted);
                    if (cleanVal !== pasted) {
                      e.preventDefault();
                      setSearchQuery(cleanVal);
                    }
                  }}
                  placeholder="اكتب اسم التلميذ، أو مرر بطاقة الباركود بالقارئ، أو اكتب الهاتف..."
                  className="m3-input"
                  style={{
                    width: '100%',
                    paddingRight: '36px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    height: '32px',
                    borderColor: 'var(--md-sys-color-primary)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    direction: /^[a-zA-Z0-9\-_]/.test(searchQuery) ? 'ltr' : 'rtl',
                    textAlign: /^[a-zA-Z0-9\-_]/.test(searchQuery) ? 'left' : 'right'
                  }}
                  autoFocus
                />
              </div>

              {/* Search Results Dropdown / List */}
              {searchResults.length > 0 ? (
                <div
                  style={{
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    borderRadius: 'var(--md-shape-md)',
                    overflow: 'hidden',
                    backgroundColor: '#fff',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}
                >
                  <div style={{ padding: '6px 12px', backgroundColor: '#f8fafc', fontSize: '0.74rem', fontWeight: 700, color: '#64748b' }}>
                    نتائج البحث ({searchResults.length}): اضغط على التلميذ لاختياره
                  </div>
                  {searchResults.map((stu) => (
                    <div
                      key={stu.name}
                      onClick={() => handleSelectStudent(stu)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0f172a' }}>
                          {stu.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                          {stu.phone ? `الهاتف: ${stu.phone} • ` : ''}
                          الأفواج: {stu.groupCount} فوج
                        </div>
                      </div>

                      <div style={{ textAlign: 'left' }}>
                        {stu.totalDebt > 0 ? (
                          <span style={{ color: '#b91c1c', fontWeight: 800, fontSize: '0.8rem' }}>
                            الدين: {stu.totalDebt.toLocaleString()} دج
                          </span>
                        ) : (
                          <span style={{ color: '#15803d', fontWeight: 700, fontSize: '0.74rem' }}>
                            مسدد بالكامل ✓
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', border: '1.5px dashed #cbd5e1', borderRadius: '10px' }}>
                  <Scan size={28} color="#94a3b8" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                    وجّه قارئ الباركود نحو بطاقة التلميذ، أو ابحث بالاسم لاختيار التلميذ
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Selected Student Card (Compact) */}
              <div
                style={{
                  backgroundColor: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  borderRadius: 'var(--md-shape-md)',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UserCheck size={16} color="#0284c7" />
                    <span style={{ fontSize: '0.98rem', fontWeight: 900, color: '#0369a1' }}>
                      {selectedStudent.name}
                    </span>
                    {selectedStudent.barcode && (
                      <span
                        style={{
                          backgroundColor: '#0284c7',
                          color: '#fff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          fontWeight: 700
                        }}
                      >
                        {selectedStudent.barcode}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#0284c7', marginTop: '1px' }}>
                    {selectedStudent.phone ? `الهاتف: ${selectedStudent.phone} • ` : ''}
                    الأفواج المسجل بها: {groupItems.filter((i) => !i.isNewEnrollment).length} فوج
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setGroupItems([]);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }}
                  className="m3-btn m3-btn-outlined"
                  style={{ fontSize: '0.74rem', padding: '2px 8px', height: '24px', borderColor: '#0284c7', color: '#0369a1', fontWeight: 700 }}
                >
                  تغيير التلميذ
                </button>
              </div>

              {/* STEP 2: Enrolled Groups & Payment Selection */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface)' }}>
                  الأفواج غير المسددة ({unpaidCount}):
                </div>
                {paidCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPaidGroups(!showPaidGroups)}
                    className="m3-btn-text"
                    style={{ fontSize: '0.72rem', color: '#0284c7', padding: '1px 6px', fontWeight: 700 }}
                  >
                    {showPaidGroups ? 'إخفاء الأفواج المسددة' : `عرض الأفواج المسددة (${paidCount})`}
                  </button>
                )}
              </div>

              {displayedGroups.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', marginBottom: '8px' }}>
                  <CheckCircle2 size={22} color="#166534" style={{ margin: '0 auto 4px' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.84rem' }}>
                    جميع أفواج التلميذ الحالية مسددة بالكامل ✓
                  </div>
                  <div style={{ fontSize: '0.72rem', marginTop: '2px', color: '#15803d' }}>
                    لا توجد أي ديون مستحقة على التلميذ. يمكنك إضافة فوج جديد للتسديد أدناه إذا لزم الأمر.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                  {displayedGroups.map((item) => {
                    const payNum = Number(item.payingNow) || 0;

                    return (
                      <div
                        key={item.groupId}
                        style={{
                          border: `1.5px solid ${item.isSelected ? '#0284c7' : '#e2e8f0'}`,
                          backgroundColor: item.isSelected ? '#f8fafc' : '#ffffff',
                          borderRadius: 'var(--md-shape-md)',
                          padding: '6px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          flexWrap: 'wrap',
                          transition: 'border-color 0.15s, background-color 0.15s'
                        }}
                      >
                        {/* Checkbox & Group details */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                          <input
                            type="checkbox"
                            checked={item.isSelected}
                            onChange={() => handleToggleGroup(item.groupId)}
                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0284c7' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span
                                style={{
                                  backgroundColor: item.isVip ? '#7e22ce' : '#00639b',
                                  color: '#fff',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 800,
                                  fontSize: '0.72rem'
                                }}
                              >
                                {item.groupId} {item.isVip ? '★' : ''}
                              </span>
                              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: '#1e293b' }}>
                                {item.subject}
                              </span>
                              {item.isNewEnrollment && (
                                <span style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontSize: '0.66rem', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                  فوج جديد
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>
                              الأستاذ: {item.teacherName}
                              {item.day1 ? ` • ${item.day1} ${formatTiming(item.time1)}` : ''}
                            </div>
                          </div>
                        </div>

                      {/* Current Status info */}
                      <div style={{ fontSize: '0.74rem', color: '#475569', minWidth: '130px' }}>
                        <div>الرسوم: <strong>{item.totalFee.toLocaleString()} دج</strong></div>
                        <div>
                          الدين الحالي:{' '}
                          <strong style={{ color: item.currentDebt > 0 ? '#b91c1c' : '#15803d' }}>
                            {item.currentDebt > 0 ? `${item.currentDebt.toLocaleString()} دج` : 'مسدد بالكامل ✓'}
                          </strong>
                        </div>
                      </div>

                      {/* Payment Input & Quick buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="number"
                            value={item.payingNow}
                            onChange={(e) => handlePaymentChange(item.groupId, e.target.value)}
                            disabled={!item.isSelected}
                            placeholder="0"
                            className="m3-input"
                            style={{
                              width: '95px',
                              height: '28px',
                              fontWeight: 900,
                              fontSize: '0.88rem',
                              padding: '2px 6px',
                              textAlign: 'center',
                              color: item.isSelected && payNum > 0 ? '#15803d' : '#64748b',
                              borderColor: item.isSelected && payNum > 0 ? '#15803d' : undefined,
                              opacity: item.isSelected ? 1 : 0.5
                            }}
                          />
                          <span style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#64748b', pointerEvents: 'none' }}>
                            دج
                          </span>
                        </div>

                        {/* Quick fill buttons */}
                        {item.isSelected && (
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {item.currentDebt > 0 && (
                              <button
                                type="button"
                                onClick={() => handleQuickFill(item.groupId, item.currentDebt)}
                                className="m3-btn m3-btn-outlined"
                                style={{ fontSize: '0.68rem', padding: '2px 5px', height: '24px', fontWeight: 700 }}
                                title="تسديد كامل الدين المتبقي"
                              >
                                كامل الدين
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const sCount = data.groupData[item.groupId]?.sessionDates?.length || data.groupData[item.groupId]?.sessionCount || 4;
                                handleQuickFill(item.groupId, Math.round(item.totalFee / sCount));
                              }}
                              className="m3-btn m3-btn-outlined"
                              style={{ fontSize: '0.68rem', padding: '2px 5px', height: '24px', fontWeight: 700 }}
                              title="تسديد حصة واحدة"
                            >
                              حصة
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickFill(item.groupId, 0)}
                              className="m3-btn m3-btn-text"
                              style={{ fontSize: '0.68rem', padding: '2px 5px', height: '24px', color: '#64748b' }}
                              title="تفريغ المبلغ"
                            >
                              تفريغ
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Add Additional Group Section */}
              {availableGroupsToAdd.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '5px 10px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--md-shape-md)',
                    border: '1px dashed #cbd5e1',
                    marginBottom: '8px'
                  }}
                >
                  <Plus size={15} color="#0284c7" />
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569' }}>
                    تسديد فوج إضافي:
                  </span>
                  <select
                    value={additionalGroupId}
                    onChange={(e) => setAdditionalGroupId(e.target.value)}
                    className="m3-input"
                    style={{ maxWidth: '240px', fontSize: '0.74rem', fontWeight: 700, height: '26px', padding: '1px 6px' }}
                  >
                    <option value="">اختر فوجاً إضافياً للتسديد...</option>
                    {availableGroupsToAdd.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id} - {g.subject} ({g.teacherName})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddAdditionalGroup}
                    disabled={!additionalGroupId}
                    className="m3-btn m3-btn-tonal"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', height: '26px', fontWeight: 700 }}
                  >
                    إضافة للقائمة
                  </button>
                </div>
              )}

              {/* Totals Summary Banner */}
              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: 'var(--md-shape-md)',
                  padding: '6px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '8px'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.76rem', color: '#166534', fontWeight: 700 }}>
                    الأفواج المحددة للدفع: <strong>{payingItems.length} فوج</strong>
                  </span>
                  <div style={{ fontSize: '0.72rem', color: '#15803d', marginTop: '1px' }}>
                    المتبقي كدين بعد هذا التسديد: <strong>{totalRemainingDebt.toLocaleString()} دج</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'left' }}>
                  <span style={{ fontSize: '0.74rem', color: '#166534', fontWeight: 700, display: 'block' }}>
                    المبلغ الإجمالي المستلم الآن:
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803d' }}>
                    {totalPaidNow.toLocaleString()}{' '}
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>دج</span>
                  </span>
                </div>
              </div>

              {/* Receipt Options */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '5px 10px',
                  backgroundColor: '#f8fafc',
                  borderRadius: 'var(--md-shape-md)',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '0.72rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#475569' }}>نوع الوصل:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      checked={receiptFormat === 'thermal'}
                      onChange={() => setReceiptFormat('thermal')}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <span>🖨️ حراري 80mm</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      checked={receiptFormat === 'a4'}
                      onChange={() => setReceiptFormat('a4')}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <span>📄 ورقي A4</span>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: '#475569' }}>نطاق الوصل:</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="scope"
                      checked={receiptScope === 'paid_only'}
                      onChange={() => setReceiptScope('paid_only')}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <span>الأفواج المسددة الآن فقط</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="scope"
                      checked={receiptScope === 'all'}
                      onChange={() => setReceiptScope('all')}
                      style={{ accentColor: '#0284c7' }}
                    />
                    <span>جميع أفواج التلميذ</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '6px 14px',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fafafa'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="m3-btn m3-btn-outlined"
            style={{ fontWeight: 700, height: '30px', fontSize: '0.78rem', padding: '3px 12px' }}
          >
            إلغاء
          </button>

          {selectedStudent && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleSaveAndPrint(false)}
                disabled={isSaving || payingItems.length === 0}
                className="m3-btn m3-btn-tonal"
                style={{ fontWeight: 800, height: '30px', fontSize: '0.78rem', padding: '3px 12px' }}
              >
                <Check size={15} />
                <span>حفظ بدون طباعة</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAndPrint(true)}
                disabled={isSaving || payingItems.length === 0}
                className="m3-btn m3-btn-primary"
                style={{
                  backgroundColor: '#0284c7',
                  borderColor: '#0284c7',
                  fontWeight: 900,
                  fontSize: '0.78rem',
                  height: '30px',
                  padding: '3px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                }}
              >
                <Printer size={15} />
                <span>حفظ وطباعة الوصل الموحد 🖨️</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

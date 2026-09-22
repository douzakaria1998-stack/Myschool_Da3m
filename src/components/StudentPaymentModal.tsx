'use client';

import React, { useState, useMemo } from 'react';
import { StudentRecord, DiscountType } from '../types';
import { useApp, calcStudentFinancesPure } from '../context/AppContext';
import { X, Check, Printer, AlertCircle, Receipt, Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { formatToYYYYMMDD } from '../utils/sessionUtils';
import { sanitizePrintTitle } from '../utils/printTitleUtils';

interface Props {
  groupId: string;
  student: StudentRecord;
  onClose: () => void;
}

export default function StudentPaymentModal({ groupId, student, onClose }: Props) {
  const { updateStudentFullFinances, data } = useApp();
  const group = data.groupData[groupId];

  const [discount, setDiscount] = useState<DiscountType>(student.discount || '1');
  const [payments, setPayments] = useState<(string | number)[]>(() =>
    (student.payments || []).map((p) => (p !== undefined && p !== null ? p : ''))
  );
  const [successMsg, setSuccessMsg] = useState('');

  const initialTotalPaid = useMemo(() => {
    return (student.payments || []).reduce<number>((acc, p) => acc + (Number(p) || 0), 0);
  }, [student.payments]);

  const [confirmRemovePaymentTarget, setConfirmRemovePaymentTarget] = useState<{
    type: 'ALL' | 'SESSION' | 'SAVE';
    sessionIdx?: number;
    amount: number;
  } | null>(null);

  // Live pure recalculation of finances on every keystroke and discount change
  const livePreview = useMemo(() => {
    return calcStudentFinancesPure(
      {
        ...student,
        discount,
        payments: payments.map((p) => (p === '' ? '' : Number(p) || 0))
      },
      group?.type || '4-2500',
      data.pricingTiers,
      group
    );
  }, [student, discount, payments, group, data.pricingTiers]);

  const handlePaymentChange = (index: number, val: string) => {
    const next = [...payments];
    next[index] = val;
    setPayments(next);
  };

  const handleExecuteRemovePayment = () => {
    if (!confirmRemovePaymentTarget) return;

    if (confirmRemovePaymentTarget.type === 'ALL') {
      const nextPayments = payments.map(() => '');
      updateStudentFullFinances(groupId, student.rowId, nextPayments, discount);
      onClose();
    } else if (confirmRemovePaymentTarget.type === 'SESSION' && confirmRemovePaymentTarget.sessionIdx !== undefined) {
      const nextPayments = [...payments];
      nextPayments[confirmRemovePaymentTarget.sessionIdx] = '';
      setPayments(nextPayments);
      updateStudentFullFinances(groupId, student.rowId, nextPayments, discount);
      setConfirmRemovePaymentTarget(null);
    } else if (confirmRemovePaymentTarget.type === 'SAVE') {
      updateStudentFullFinances(groupId, student.rowId, payments, discount);
      onClose();
    }
  };

  const handleSave = () => {
    // If the student previously had paid money, and the new total is less than what was paid before
    if (initialTotalPaid > 0 && livePreview.totalReceived < initialTotalPaid) {
      setConfirmRemovePaymentTarget({
        type: 'SAVE',
        amount: initialTotalPaid - livePreview.totalReceived
      });
      return;
    }

    // Save payments and discount atomically
    updateStudentFullFinances(groupId, student.rowId, payments, discount);
    onClose();
  };

  // Printable A4 receipt trigger
  const handlePrintReceipt = () => {
    // Auto-save changes first
    updateStudentFullFinances(groupId, student.rowId, payments, discount);

    const studentId = student.barcode || (student.rowId ? `STU-${student.rowId}` : '');
    const receiptTitle =
      sanitizePrintTitle(`${student.name} - ${studentId || 'وصل دفع'}`) ||
      `وصل دفع - ${student.name}`;

    const originalParentTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = receiptTitle;
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

    const printWindow = window.open('', '', 'width=600,height=700');
    if (!printWindow) return;
    printWindow.document.title = receiptTitle;

    const totalPaid = livePreview.totalReceived;
    const balance = livePreview.debt;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>${receiptTitle}</title>
          <style>
            body { font-family: 'Cairo', sans-serif; padding: 30px; text-align: right; color: #111; }
            .header { text-align: center; border-bottom: 2px solid #00639b; padding-bottom: 12px; margin-bottom: 20px; }
            .badge { display: inline-block; padding: 4px 10px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
            th { background: #f8fafc; }
            .total { font-size: 1.2rem; font-weight: bold; color: #00639b; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.85rem; color: #666; border-top: 1px dashed #ccc; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="text-align: center; margin-bottom: 8px;">
              <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" style="height: 54px; max-width: 220px; object-fit: contain; margin: 0 auto; display: block;" />
            </div>
            <h2>${data.centerName}</h2>
            <p>${data.cycle} | ${data.academicYear}</p>
            <h3>وصل تسديد المستحقات</h3>
          </div>
          <div>
            <p><strong>اسم التلميذ:</strong> ${student.name}</p>
            <p><strong>رقم الهاتف:</strong> ${student.phone || 'غير مسجل'}</p>
            <p><strong>الفوج:</strong> ${group?.groupId} - ${group?.subject} (الأستاذ: ${group?.teacherName})</p>
            <p><strong>تاريخ الوصل:</strong> ${new Date().toLocaleDateString('ar-DZ')}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>البيان</th>
                <th>المبلغ (دج)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>المبلغ الإجمالي للدورة (${discount === '0' ? 'معفى' : discount === '0.8' ? 'تخفيض 20%' : 'تسعيرة عادية'})</td>
                <td>${livePreview.fee} دج</td>
              </tr>
              <tr>
                <td>مجموع المبالغ المسددة</td>
                <td class="total">${totalPaid} دج</td>
              </tr>
              <tr>
                <td>المبلغ المتبقي (الدين)</td>
                <td style="color: ${balance > 0 ? '#dc2626' : '#16a34a'}; font-weight: bold;">
                  ${balance > 0 ? balance + ' دج (غير مسدد)' : 'مسدد بالكامل ✓'}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <p>شكراً لثقتكم بمؤسستنا - مع تمنياتنا لجميع التلاميذ بالتفوق والنجاح</p>
            <p>ختم وإمضاء الإدارة</p>
          </div>
          <script>
            window.onload = () => {
              document.title = ${JSON.stringify(receiptTitle)};
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Printable 80mm Thermal Receipt trigger
  const handlePrintThermalReceipt = () => {
    // Auto-save changes first
    updateStudentFullFinances(groupId, student.rowId, payments, discount);

    const studentId = student.barcode || (student.rowId ? `STU-${student.rowId}` : '');
    const receiptTitle =
      sanitizePrintTitle(`${student.name} - ${studentId || 'وصل حراري'}`) ||
      `وصل حراري - ${student.name}`;

    const originalParentTitle = typeof document !== 'undefined' ? document.title : '';
    if (typeof document !== 'undefined') {
      document.title = receiptTitle;
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

    const printWindow = window.open('', '_blank', 'width=400,height=550');
    if (!printWindow) return;
    printWindow.document.title = receiptTitle;

    const totalPaid = livePreview.totalReceived;
    const balance = livePreview.debt;
    const receiptNo = `${group?.groupId || 'REC'}-${(student.rowId || 1).toString().padStart(3, '0')}`;
    const printDate = new Date().toLocaleDateString('ar-DZ');
    const printTime = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>${receiptTitle}</title>
          <style>
            @page { size: 80mm auto; margin: 0mm !important; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              font-family: 'Courier New', 'Cairo', Tahoma, Arial, sans-serif;
              width: 100% !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              padding: 8px 4px 16px 4px !important;
              font-size: 12px;
              line-height: 1.4;
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
            .flex-row { width: 100%; display: flex; justify-content: space-between; align-items: center; margin: 2px 0; font-size: 12px; }
            .barcode { font-family: monospace; letter-spacing: 2px; text-align: center; margin: 6px 0 2px; font-weight: bold; font-size: 12px; }
            .cut-line { text-align: center; font-size: 10px; font-weight: bold; color: #222; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="center" style="margin-bottom: 6px;">
            <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" style="height: 36px; max-width: 65mm; object-fit: contain; display: block; margin: 0 auto; filter: grayscale(100%);" />
          </div>
          <div class="center bold" style="font-size: 13px;">${data.centerName}</div>
          <div class="center" style="font-size: 9px;">${data.cycle} | ${data.academicYear}</div>
          <div class="divider"></div>
          <div class="center bold" style="font-size: 12px;">وصل تسديد المستحقات</div>
          <div class="flex-row" style="font-size: 10px;">
            <span>رقم: #${receiptNo}</span>
            <span>${printDate} ${printTime}</span>
          </div>
          <div class="divider"></div>
          <div class="flex-row">
            <span>الفوج: <strong>${group?.groupId}</strong></span>
            <span>المادة: <strong>${group?.subject}</strong></span>
          </div>
          <div>الأستاذ: <strong>${group?.teacherName}</strong></div>
          <div class="divider"></div>
          <div class="flex-row">
            <span>التلميذ:</span>
            <span class="bold" style="font-size: 12px;">${student.name}</span>
          </div>
          ${student.phone ? `<div class="flex-row" style="font-size: 10px;"><span>الهاتف:</span><span>${student.phone}</span></div>` : ''}
          <div class="divider"></div>
          <div class="flex-row">
            <span>المبلغ الإجمالي (الدورة):</span>
            <span>${livePreview.fee} دج</span>
          </div>
          <div class="flex-row bold" style="font-size: 12px;">
            <span>مجموع المسدد:</span>
            <span>${totalPaid} دج</span>
          </div>
          <div class="divider"></div>
          <div class="flex-row bold" style="font-size: 12px;">
            <span>الوضعية:</span>
            <span>${balance > 0 ? `متبقي: ${balance} دج` : 'مسدد بالكامل ✓'}</span>
          </div>
          <div class="barcode">*${receiptNo}*</div>
          <div class="center" style="font-size: 9px; line-height: 1.3;">
            شكراً لثقتكم بمؤسستنا - مع تمنياتنا بالتفوق والنجاح<br />
            يرجى الاحتفاظ بهذا الوصل
          </div>
          <div class="cut-line">✄ - - - - - - - - - - - - - - - - - - -</div>
          <script>
            window.onload = function() {
              document.title = ${JSON.stringify(receiptTitle)};
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentTotalPaid = livePreview.totalReceived;
  const currentDebt = livePreview.debt;

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '14px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/logo.svg"
              alt="شعار المؤسسة"
              style={{
                height: '42px',
                width: 'auto',
                objectFit: 'contain',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '4px 8px',
                borderRadius: 'var(--md-shape-sm)',
                boxShadow: 'var(--md-elevation-1)'
              }}
            />
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                تسجيل المدفوعات والاشتراك
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {student.name} | فوج {groupId} ({group?.subject})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Live Financial Summary Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '20px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-md)'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>المطلوب (المجموع)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              {livePreview.fee.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>دج</span>
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--status-present-container)',
              borderRadius: 'var(--md-shape-md)'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--status-present)' }}>مجموع المسدد</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-present)' }}>
              {currentTotalPaid.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>دج</span>
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: currentDebt > 0 ? 'var(--status-absent-container)' : 'var(--status-present-container)',
              borderRadius: 'var(--md-shape-md)'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: currentDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
              المتبقي (الدين)
            </span>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: currentDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)'
              }}
            >
              {currentDebt.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>دج</span>
            </div>
          </div>
        </div>

        {/* Discount Selection */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
            نوع التخفيض أو الإعفاء:
          </label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: '1', label: 'كامل 100% (تسعيرة عادية)' },
              { id: '0.8', label: 'تخفيض 20% (دفع 80%)' },
              { id: '0', label: 'معفى تماماً (0 دج)' },
              { id: 'تعويض', label: 'حصة تعويضية' }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDiscount(opt.id)}
                className={`m3-btn m3-btn-sm ${discount === opt.id ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Installments (المستلم 1..N) */}
        {(() => {
          const sessionCount = group?.sessionDates?.length || group?.sessionCount || payments.length || 8;
          return (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface)' }}>
                  دفعات التسديد (المستلم 1 إلى {sessionCount}):
                </label>
                <span
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-sm)'
                  }}
                >
                  حسب حصص الفوج
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))',
                  gap: '10px',
                  alignItems: 'stretch'
                }}
              >
                {Array.from({ length: sessionCount }).map((_, i) => {
                  const dateStr = group?.sessionDates?.[i];
                  const hasPaid = payments[i] !== '' && Number(payments[i]) > 0;

                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        backgroundColor: hasPaid
                          ? 'var(--status-present-container)'
                          : 'var(--md-sys-color-surface-container-low)',
                        border: hasPaid
                          ? '1px solid var(--status-present)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        borderRadius: 'var(--md-shape-sm)',
                        padding: '8px 10px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Label & Date Container - fixed minHeight for 100% uniform alignment */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: '38px',
                          marginBottom: '6px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '100%' }}>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              color: hasPaid ? 'var(--status-present)' : 'var(--md-sys-color-on-surface)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            دفعة {i + 1}
                          </span>
                          {hasPaid && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmRemovePaymentTarget({
                                  type: 'SESSION',
                                  sessionIdx: i,
                                  amount: Number(payments[i]) || 0
                                });
                              }}
                              className="m3-btn-text"
                              style={{
                                color: '#dc2626',
                                padding: '1px 3px',
                                height: '18px',
                                minWidth: '18px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="حذف هذه الدفعة وإعادتها كغير مسدد"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        {dateStr ? (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: hasPaid ? 'var(--status-present)' : 'var(--md-sys-color-on-surface-variant)',
                              direction: 'ltr',
                              unicodeBidi: 'plaintext',
                              marginTop: '2px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {formatToYYYYMMDD(dateStr)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'transparent', marginTop: '2px' }}>-</span>
                        )}
                      </div>

                      {/* Payment Input */}
                      <div>
                        <input
                          type="number"
                          min={0}
                          step={50}
                          value={payments[i] !== undefined && payments[i] !== null ? payments[i] : ''}
                          onChange={(e) => handlePaymentChange(i, e.target.value)}
                          placeholder="0 دج"
                          className="m3-input"
                          style={{
                            padding: '6px 8px',
                            fontSize: '0.92rem',
                            fontWeight: 800,
                            textAlign: 'center',
                            width: '100%',
                            color: hasPaid ? 'var(--status-present)' : 'var(--md-sys-color-on-surface)',
                            backgroundColor: 'var(--md-sys-color-surface)'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Success Alert */}
        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-sm)',
              fontWeight: 700,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Check size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrintThermalReceipt}
              className="m3-btn m3-btn-primary m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              title="طباعة وصل حراري سريع فور الدفع (80mm)"
            >
              <Receipt size={16} />
              <span>وصل حراري (80mm)</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={16} />
              <span>وصل عادي A4</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {initialTotalPaid > 0 && (
              <button
                type="button"
                onClick={() => setConfirmRemovePaymentTarget({ type: 'ALL', amount: initialTotalPaid })}
                className="m3-btn m3-btn-outlined m3-btn-sm"
                style={{
                  color: '#dc2626',
                  borderColor: '#fca5a5',
                  backgroundColor: '#fef2f2',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700
                }}
                title="حذف جميع المبالغ المسددة وإعادة التلميذ كغير مسدد"
              >
                <Trash2 size={15} />
                <span>حذف المبلغ المسدد ({initialTotalPaid.toLocaleString()} دج)</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
              إلغاء
            </button>
            <button type="button" onClick={handleSave} className="m3-btn m3-btn-primary">
              حفظ التعديلات
            </button>
          </div>
        </div>

        {/* Confirmation Modal when Removing / Reducing Payment */}
        {confirmRemovePaymentTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 350,
              backdropFilter: 'blur(3px)'
            }}
            onClick={() => setConfirmRemovePaymentTarget(null)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '460px',
                width: '92%',
                boxShadow: 'var(--md-elevation-5)',
                direction: 'rtl'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', marginBottom: '14px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    backgroundColor: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Trash2 size={20} color="#dc2626" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                    تأكيد حذف المبلغ المسدد
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    إعادة التلميذ إلى وضعية غير مسدد
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '0.92rem', color: '#334155', lineHeight: 1.6, marginBottom: '14px' }}>
                هل أنت متأكد من رغبتك في حذف المبلغ المسدد{' '}
                <strong style={{ color: '#dc2626' }}>
                  ({confirmRemovePaymentTarget.amount.toLocaleString()} دج)
                </strong>{' '}
                للتلميذ <strong style={{ color: '#0f172a' }}>{student.name}</strong>؟
              </p>

              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.82rem',
                  color: '#991b1b',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  عند التأكيد، سيتم حذف هذا المبلغ من مدفوعات التلميذ وإعادته كـ{' '}
                  <strong>غير مسدد</strong> (دين: {livePreview.fee.toLocaleString()} دج)، مع الحفاظ التام على وجوده وسجل حضوره في الفوج.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setConfirmRemovePaymentTarget(null)}
                  className="m3-btn m3-btn-text"
                  style={{ fontWeight: 700 }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleExecuteRemovePayment}
                  className="m3-btn m3-btn-primary"
                  style={{
                    backgroundColor: '#dc2626',
                    borderColor: '#dc2626',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Trash2 size={16} />
                  <span>نعم، احذف المبلغ وأعد التلميذ كغير مسدد</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

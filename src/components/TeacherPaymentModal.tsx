'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Teacher, GroupSheet, TeacherPaymentRecord } from '../types';
import {
  X,
  Printer,
  Check,
  CreditCard,
  History,
  Trash2,
  AlertCircle,
  FileText,
  Banknote,
  Users
} from 'lucide-react';

interface Props {
  teacher: Teacher;
  stats: {
    totalStudents: number;
    totalTeacherPay: number;
    totalCollectedInGroups: number;
    groups: GroupSheet[];
  };
  onClose: () => void;
}

export default function TeacherPaymentModal({ teacher, stats, onClose }: Props) {
  const { data, payTeacher, deleteTeacherPayment } = useApp();

  const paidAmount = teacher.paidAmount || 0;
  const remainingDue = Math.max(0, stats.totalTeacherPay - paidAmount);

  // Form states
  const [amountToPay, setAmountToPay] = useState<number | string>(remainingDue > 0 ? remainingDue : '');
  const [paymentMethod, setPaymentMethod] = useState<'نقداً' | 'صك بريدي' | 'تحويل بنكي' | 'أخرى'>('نقداً');
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'pay' | 'history'>('pay');
  const [successMessage, setSuccessMessage] = useState('');

  // Print voucher function
  const handlePrintVoucher = (payment: TeacherPaymentRecord, currentRemaining: number) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const printDate = payment.date || new Date().toLocaleDateString('ar-DZ');
    const printTime = payment.time || new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    const groupsRows = stats.groups
      .map((g) => {
        let groupStudents = 0;
        let groupTeacherPay = 0;
        const gSheet = data.groupData[g.groupId];
        if (gSheet && gSheet.students) {
          groupStudents = gSheet.students.length;
          gSheet.students.forEach((s) => {
            groupTeacherPay += s.teacherPay || 0;
          });
        }
        return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${g.groupId} ${g.isVip ? '★ VIP' : ''}</td>
          <td>${g.subject}</td>
          <td>${g.day1 || ''} ${g.time1 || ''}</td>
          <td style="text-align: center;">${groupStudents} تلميذ</td>
          <td style="text-align: center; font-weight: bold;">${groupTeacherPay.toLocaleString()} دج</td>
        </tr>
      `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>وصل تسديد أتعاب الأستاذ - ${teacher.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
              color: #111;
              margin: 0;
              padding: 10px;
              direction: rtl;
              text-align: right;
              font-size: 13px;
              line-height: 1.5;
            }
            .header-container {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #00639b;
              padding-bottom: 12px;
              margin-bottom: 18px;
            }
            .center-logo {
              height: 52px;
              width: auto;
              object-fit: contain;
            }
            .title-box {
              text-align: center;
              background: #f0f7ff;
              border: 1px solid #cde5ff;
              padding: 8px 16px;
              border-radius: 6px;
              margin-bottom: 18px;
            }
            .title-box h2 {
              margin: 0 0 4px 0;
              color: #004b75;
              font-size: 18px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              background: #fafafa;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 12px 16px;
              margin-bottom: 18px;
            }
            .info-item {
              display: flex;
              gap: 8px;
            }
            .info-label {
              font-weight: bold;
              color: #475569;
              min-width: 100px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 8px 10px;
              font-size: 12px;
            }
            th {
              background: #f1f5f9;
              color: #1e293b;
              font-weight: bold;
            }
            .totals-box {
              border: 2px solid #00639b;
              border-radius: 8px;
              padding: 14px 18px;
              background: #f8fafc;
              margin-bottom: 24px;
            }
            .totals-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 13px;
            }
            .paid-highlight {
              border-top: 2px solid #00639b;
              border-bottom: 2px solid #00639b;
              margin: 6px 0;
              padding: 8px 0;
              font-size: 16px;
              font-weight: 900;
              color: #00639b;
            }
            .signatures-box {
              display: flex;
              justify-content: space-between;
              margin-top: 36px;
              padding: 0 30px;
            }
            .sig-block {
              text-align: center;
              width: 200px;
            }
            .sig-line {
              margin-top: 55px;
              border-top: 1px dashed #64748b;
              font-size: 11px;
              color: #64748b;
              padding-top: 4px;
            }
            .footer-note {
              text-align: center;
              font-size: 11px;
              color: #94a3b8;
              margin-top: 24px;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header-container">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" class="center-logo" />
              <div>
                <h1 style="margin: 0; font-size: 16px; font-weight: 900;">${data.centerName}</h1>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">
                  ${data.cycle} | الموسم الدراسي: ${data.academicYear}
                </p>
              </div>
            </div>
            <div style="text-align: left; font-size: 11px;">
              <div>رقم الوصل: <strong style="font-size: 13px; color: #00639b;">#${payment.receiptNo}</strong></div>
              <div>تاريخ التسديد: <strong>${printDate}</strong></div>
              <div>توقيت التسديد: <strong>${printTime}</strong></div>
            </div>
          </div>

          <!-- Title -->
          <div class="title-box">
            <h2>وصل تسديد أتعاب ومستحقات الأستاذ (Teacher Payout Voucher)</h2>
            <div style="font-size: 12px; color: #334155;">إثبات صرف مستحقات التدريس بالمركز</div>
          </div>

          <!-- Teacher Info -->
          <div class="info-grid">
            <div class="info-item"><span class="info-label">اسم الأستاذ:</span> <strong>${teacher.name}</strong></div>
            <div class="info-item"><span class="info-label">المعرف:</span> <strong>${teacher.id}</strong></div>
            <div class="info-item"><span class="info-label">المادة المدرسة:</span> <strong>${teacher.subject}</strong></div>
            <div class="info-item"><span class="info-label">رقم الهاتف:</span> <span>${teacher.phone || 'غير مسجل'}</span></div>
            <div class="info-item"><span class="info-label">الأفواج المشرف عليها:</span> <strong>${stats.groups.length} فوج</strong></div>
            <div class="info-item"><span class="info-label">إجمالي التلاميذ:</span> <strong>${stats.totalStudents} تلميذ</strong></div>
          </div>

          <!-- Groups Breakdown Table -->
          <div style="font-weight: bold; margin-bottom: 6px;">بيان الأفواج وحصص الأستاذ المحسوبة:</div>
          <table>
            <thead>
              <tr>
                <th style="width: 80px; text-align: center;">رمز الفوج</th>
                <th>المادة</th>
                <th>التوقيت والأيام</th>
                <th style="width: 100px; text-align: center;">عدد التلاميذ</th>
                <th style="width: 140px; text-align: center;">أتعاب الأستاذ المحسوبة</th>
              </tr>
            </thead>
            <tbody>
              ${groupsRows || '<tr><td colspan="5" style="text-align: center;">لا توجد أفواج مسندة</td></tr>'}
            </tbody>
          </table>

          <!-- Totals Calculation Block -->
          <div class="totals-box">
            <div class="totals-row">
              <span>إجمالي مستحقات الأستاذ المحسوبة عن الأفواج:</span>
              <strong>${stats.totalTeacherPay.toLocaleString()} دج</strong>
            </div>
            <div class="totals-row">
              <span>المبالغ المسددة سابقاً:</span>
              <span>${(paidAmount - payment.amount).toLocaleString()} دج</span>
            </div>
            <div class="totals-row paid-highlight">
              <span>المبلغ المسدد بموجب هذا الوصل (${payment.paymentMethod || 'نقداً'}):</span>
              <span>${payment.amount.toLocaleString()} دج</span>
            </div>
            <div class="totals-row" style="color: ${currentRemaining > 0 ? '#b91c1c' : '#15803d'}; font-weight: bold;">
              <span>الرصيد المتبقي بذمة المؤسسة للأستاذ:</span>
              <span>${currentRemaining.toLocaleString()} دج ${currentRemaining === 0 ? '(تمت التسوية بالكامل ✓)' : ''}</span>
            </div>
            ${payment.notes ? `<div style="margin-top: 8px; font-size: 11px; color: #475569; border-top: 1px dashed #cbd5e1; padding-top: 4px;">ملاحظات: ${payment.notes}</div>` : ''}
          </div>

          <!-- Signatures -->
          <div class="signatures-box">
            <div class="sig-block">
              <strong>إمضاء وختم إدارة المؤسسة</strong>
              <div class="sig-line">الإدارة المالية</div>
            </div>
            <div class="sig-block">
              <strong>إمضاء وتأكيد استلام الأستاذ</strong>
              <div class="sig-line">${teacher.name}</div>
            </div>
          </div>

          <div class="footer-note">
            تم استخراج هذا السند رسمياً من نظام إدارة المركز "دعم" | ${new Date().toLocaleDateString('ar-DZ')}
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Submit payment
  const handleRecordPayment = (shouldPrint: boolean = false) => {
    const numAmount = Number(amountToPay);
    if (!numAmount || numAmount <= 0) {
      alert('يرجى إدخال مبلغ دفع صحيح أكبر من الصفر');
      return;
    }

    const newRecord = payTeacher(teacher.id, numAmount, paymentMethod, notes);
    if (newRecord) {
      const nextRemaining = Math.max(0, stats.totalTeacherPay - (paidAmount + numAmount));
      setSuccessMessage(`تم تسجيل تسديد ${numAmount.toLocaleString()} دج بنجاح للأستاذ.`);
      if (shouldPrint) {
        handlePrintVoucher(newRecord, nextRemaining);
      }
      setTimeout(() => {
        onClose();
      }, shouldPrint ? 500 : 1200);
    }
  };

  const paymentHistory = teacher.paymentHistory || [];

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '680px',
          width: '95%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden'
        }}
      >
        {/* Dialog Header */}
        <div
          style={{
            padding: '18px 24px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/logo.svg"
              alt="شعار المؤسسة"
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  تسديد مستحقات الأستاذ
                </h3>
                <span
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  {teacher.id}
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {teacher.name} • {teacher.subject} {teacher.phone ? `(${teacher.phone})` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--md-sys-color-on-surface-variant)',
              padding: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Financial KPI Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: 'var(--md-sys-color-surface-container-lowest)'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '4px' }}>
              إجمالي الأتعاب المحسوبة
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
              {stats.totalTeacherPay.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: 'var(--md-sys-color-surface-container-lowest)'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--status-present)', marginBottom: '4px' }}>
              المبالغ المسددة سابقاً
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--status-present)' }}>
              {paidAmount.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
              border: remainingDue > 0 ? '1px solid var(--status-absent)' : 'none'
            }}
          >
            <div
              style={{
                fontSize: '0.75rem',
                color: remainingDue > 0 ? 'var(--status-absent)' : 'var(--status-present)',
                marginBottom: '4px',
                fontWeight: 700
              }}
            >
              المتبقي للأستاذ
            </div>
            <div
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: remainingDue > 0 ? 'var(--status-absent)' : 'var(--status-present)'
              }}
            >
              {remainingDue.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px 0',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          <button
            onClick={() => setActiveTab('pay')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'pay' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent',
              color: activeTab === 'pay' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Banknote size={18} />
            <span>تسجيل دفعة جديدة</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent',
              color: activeTab === 'history' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <History size={18} />
            <span>سجل الدفعات ({paymentHistory.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {successMessage && (
            <div
              style={{
                backgroundColor: 'var(--status-present-container)',
                color: 'var(--status-present)',
                padding: '12px 16px',
                borderRadius: 'var(--md-shape-sm)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                fontSize: '0.9rem'
              }}
            >
              <Check size={18} />
              <span>{successMessage}</span>
            </div>
          )}

          {activeTab === 'pay' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Payment Amount Input */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>
                  المبلغ المراد تسديده للأستاذ الآن (دج) *
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    value={amountToPay}
                    onChange={(e) => setAmountToPay(e.target.value)}
                    placeholder="أدخل المبلغ بالدينار الجزائري..."
                    className="m3-input"
                    style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}
                    autoFocus
                  />
                </div>

                {/* Quick Fill Amount Chips */}
                {remainingDue > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setAmountToPay(remainingDue)}
                      className="m3-chip"
                      style={{ cursor: 'pointer', backgroundColor: 'var(--status-present-container)', color: 'var(--status-present)' }}
                    >
                      كامل المتبقي ({remainingDue.toLocaleString()} دج)
                    </button>
                    {remainingDue > 10000 && (
                      <button
                        type="button"
                        onClick={() => setAmountToPay(Math.round(remainingDue / 2))}
                        className="m3-chip"
                        style={{ cursor: 'pointer' }}
                      >
                        نصف المتبقي ({Math.round(remainingDue / 2).toLocaleString()} دج)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAmountToPay(100000)}
                      className="m3-chip"
                      style={{ cursor: 'pointer' }}
                    >
                      100,000 دج
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountToPay(50000)}
                      className="m3-chip"
                      style={{ cursor: 'pointer' }}
                    >
                      50,000 دج
                    </button>
                    <button
                      type="button"
                      onClick={() => setAmountToPay(20000)}
                      className="m3-chip"
                      style={{ cursor: 'pointer' }}
                    >
                      20,000 دج
                    </button>
                  </div>
                )}
              </div>

              {/* Payment Method Selection */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>
                  طريقة الدفع
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['نقداً', 'صك بريدي', 'تحويل بنكي', 'أخرى'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--md-shape-full)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor:
                          paymentMethod === method
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-surface-container)',
                        color:
                          paymentMethod === method
                            ? 'var(--md-sys-color-on-primary)'
                            : 'var(--md-sys-color-on-surface)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes Input */}
              <div>
                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '6px' }}>
                  ملاحظات أو رقم الحوالة / الشيك (اختياري)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: تسوية شهر سبتمبر / شيك رقم 4582..."
                  className="m3-input"
                />
              </div>

              {/* Assigned Groups Mini Breakdown */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                  padding: '12px',
                  borderRadius: 'var(--md-shape-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  الأفواج المسندة للأستاذ ({stats.groups.length} فوج):
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {stats.groups.map((g) => (
                    <span
                      key={g.groupId}
                      className="m3-chip"
                      style={{
                        fontSize: '0.75rem',
                        backgroundColor: g.isVip ? 'var(--status-vip-container)' : 'var(--md-sys-color-surface-container)',
                        color: g.isVip ? 'var(--status-vip)' : 'var(--md-sys-color-on-surface)'
                      }}
                    >
                      {g.groupId} {g.isVip ? '★' : ''} ({g.day1})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Payment History Tab */
            <div>
              {paymentHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--md-sys-color-outline)' }}>
                  <History size={36} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                  <p>لا توجد دفعات مسجلة لهذا الأستاذ حتى الآن.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {paymentHistory.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        borderRadius: 'var(--md-shape-sm)'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--md-sys-color-primary)' }}>
                            {item.amount.toLocaleString()} دج
                          </span>
                          <span className="m3-chip" style={{ fontSize: '0.75rem' }}>
                            {item.paymentMethod}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }}>
                            #{item.receiptNo}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '3px' }}>
                          {item.date} {item.time ? `• ${item.time}` : ''} {item.notes ? `• ${item.notes}` : ''}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintVoucher(item, remainingDue)}
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          title="إعادة طباعة الوصل"
                        >
                          <Printer size={14} />
                          <span>طباعة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من إلغاء دفعة ${item.amount.toLocaleString()} دج؟`)) {
                              deleteTeacherPayment(teacher.id, item.id);
                            }
                          }}
                          className="m3-btn m3-btn-text m3-btn-sm"
                          style={{ padding: '4px 8px', color: 'var(--md-sys-color-error)' }}
                          title="حذف الدفعة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dialog Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
            إغلاق
          </button>

          {activeTab === 'pay' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => handleRecordPayment(false)}
                className="m3-btn m3-btn-tonal"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Check size={16} />
                <span>تسجيل الدفع فقط</span>
              </button>
              <button
                type="button"
                onClick={() => handleRecordPayment(true)}
                className="m3-btn m3-btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} />
                <span>تسجيل وطباعة الوصل 🖨️</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

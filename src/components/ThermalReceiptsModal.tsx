'use client';

import React, { useState, useEffect } from 'react';
import { GroupSheet, StudentRecord } from '../types';
import { useApp } from '../context/AppContext';
import { X, Printer, Receipt, Check, Save, CreditCard, Search } from 'lucide-react';
import { getDefaultSessionIndex, isSessionDateToday, isSummaryRow, formatToYYYYMMDD } from '../utils/sessionUtils';

interface Props {
  group: GroupSheet;
  onClose: () => void;
}

export default function ThermalReceiptsModal({ group, onClose }: Props) {
  const { data, batchUpdateSessionPayments } = useApp();

  // Selected session index (0 to 7):
  // Priority 1: Today's date matches session date
  // Priority 2: Last session that contains attendance
  // Priority 3: First session (0)
  const [selectedSessionIdx, setSelectedSessionIdx] = useState<number>(() => getDefaultSessionIndex(group));

  // Reset to default session when switching group
  useEffect(() => {
    setSelectedSessionIdx(getDefaultSessionIndex(group));
  }, [group.groupId]);

  const realStudents = React.useMemo(() => {
    return (group?.students || []).filter((s) => !isSummaryRow(s, group.groupId));
  }, [group?.students, group.groupId]);

  // Filter type: default is strictly ONLY students who paid on this day
  const [studentFilter, setStudentFilter] = useState<'paid_today' | 'all' | 'debt'>('paid_today');
  // Local state for editing session payments before saving - initialized eagerly so no input is ever uncontrolled
  const [localPayments, setLocalPayments] = useState<Record<number, string | number>>(() => {
    const initial: Record<number, string | number> = {};
    const defaultIdx = getDefaultSessionIndex(group);
    if (group?.students) {
      group.students.filter((s) => !isSummaryRow(s, group.groupId)).forEach((s) => {
        const raw = s.payments ? s.payments[defaultIdx] : '';
        initial[s.rowId] = raw !== undefined && raw !== null && raw !== '' ? raw : '';
      });
    }
    return initial;
  });
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [searchStudent, setSearchStudent] = useState('');

  // Sync local payments when group or selectedSessionIdx changes
  useEffect(() => {
    const initial: Record<number, string | number> = {};
    if (group?.students) {
      group.students.filter((s) => !isSummaryRow(s, group.groupId)).forEach((s) => {
        const pVal = s.payments ? s.payments[selectedSessionIdx] : '';
        initial[s.rowId] = pVal !== undefined && pVal !== null && pVal !== '' ? pVal : '';
      });
    }
    setLocalPayments(initial);
  }, [group, selectedSessionIdx]);

  // Set of selected student rowIds for printing thermal receipts
  // BY DEFAULT: Automatically selects all students who made a payment on this session/day
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    const defIdx = getDefaultSessionIndex(group);
    if (group?.students) {
      group.students.filter((s) => !isSummaryRow(s, group.groupId)).forEach((s) => {
        const raw = s.payments ? s.payments[defIdx] : 0;
        if (Number(raw) > 0) ids.add(s.rowId);
      });
    }
    return ids;
  });

  // Re-select students who paid on this day when session or group changes
  useEffect(() => {
    const ids = new Set<number>();
    if (group?.students) {
      group.students.forEach((s) => {
        const pVal = localPayments[s.rowId] !== undefined ? localPayments[s.rowId] : s.payments ? s.payments[selectedSessionIdx] : 0;
        if (Number(pVal) > 0) ids.add(s.rowId);
      });
    }
    setSelectedRowIds(ids);
  }, [selectedSessionIdx, group.groupId]);

  const sessionDate = formatToYYYYMMDD(group.sessionDates[selectedSessionIdx]) || `حصة ${selectedSessionIdx + 1}`;

  // Handle local payment change and auto-select for printing if amount > 0
  const handlePaymentInput = (rowId: number, val: string) => {
    setLocalPayments((prev) => ({
      ...prev,
      [rowId]: val ?? ''
    }));
    if (Number(val) > 0) {
      setSelectedRowIds((prev) => new Set(prev).add(rowId));
    }
  };

  // Toggle selection for a student
  const handleToggleSelectStudent = (rowId: number) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  // Quick selection helpers
  const handleSelectOnlyPaidToday = () => {
    const ids = new Set<number>();
    realStudents.forEach((s) => {
      const pVal = localPayments[s.rowId] !== undefined ? localPayments[s.rowId] : s.payments[selectedSessionIdx];
      if (Number(pVal) > 0) ids.add(s.rowId);
    });
    setSelectedRowIds(ids);
  };

  const handleSelectAll = () => {
    const ids = new Set<number>(realStudents.map((s) => s.rowId));
    setSelectedRowIds(ids);
  };

  const handleDeselectAll = () => {
    setSelectedRowIds(new Set());
  };

  // Save payments to system and localStorage
  const handleSaveAllPayments = () => {
    const updates = Object.entries(localPayments).map(([rowIdStr, amount]) => ({
      rowId: Number(rowIdStr),
      amount: amount === '' ? '' : Number(amount) || 0
    }));

    batchUpdateSessionPayments(group.groupId, selectedSessionIdx, updates);

    setSaveSuccessMsg('تم حفظ وتخزين بيانات التسديد بنجاح في قاعدة البيانات!');
    setTimeout(() => {
      setSaveSuccessMsg('');
    }, 3000);
  };

  // Quick fill full fee and auto-select
  const handleQuickPayFull = (student: StudentRecord) => {
    const remaining = Math.max(0, student.fee - (student.totalReceived - (Number(student.payments[selectedSessionIdx]) || 0)));
    handlePaymentInput(student.rowId, remaining.toString());
    setSelectedRowIds((prev) => new Set(prev).add(student.rowId));
  };

  // Filter students who paid on this day
  const studentsWhoPaidToday = realStudents.filter((student) => {
    const pVal = localPayments[student.rowId] !== undefined ? localPayments[student.rowId] : student.payments[selectedSessionIdx];
    const num = Number(pVal) || 0;
    return num > 0;
  });

  // Students to print: STRICTLY the checked / selected students
  const studentsToPrint = realStudents.filter((student) => selectedRowIds.has(student.rowId));

  // Total collected for this session
  const totalSessionCollected = studentsWhoPaidToday.reduce((sum, s) => {
    const pVal = localPayments[s.rowId] !== undefined ? localPayments[s.rowId] : s.payments[selectedSessionIdx];
    return sum + (Number(pVal) || 0);
  }, 0);

  // Trigger thermal 80mm bulk print (accepts custom student list or defaults to studentsToPrint)
  const handlePrintThermal = (targetList?: StudentRecord[]) => {
    // Auto-save any unsaved input first
    handleSaveAllPayments();

    const listToPrint = targetList || studentsToPrint;
    if (listToPrint.length === 0) {
      alert('يرجى تحديد تلميذ واحد على الأقل لطباعة وصله!');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=600');
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
      return;
    }

    const printDateStr = formatToYYYYMMDD(new Date());
    const printTimeStr = new Date().toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    // Generate HTML for each student who paid on that day
    const receiptsHtml = listToPrint
      .map((student, idx) => {
        const pVal = localPayments[student.rowId] !== undefined ? localPayments[student.rowId] : student.payments[selectedSessionIdx];
        const paidToday = Number(pVal) || 0;
        const totalPaid = student.totalReceived || 0;
        const balance = Math.max(0, student.fee - totalPaid);
        const receiptNo = `${group.groupId}-${(student.rowId || idx + 1).toString().padStart(3, '0')}`;

        return `
          <div class="receipt">
            <!-- School Logo -->
            <div class="center" style="margin-bottom: 6px;">
              <img src="${window.location.origin}/logo.svg" alt="شعار المؤسسة" style="height: 38px; max-width: 65mm; object-fit: contain; display: block; margin: 0 auto; filter: grayscale(100%);" />
            </div>
            <!-- Header -->
            <div class="center bold title">${data.centerName}</div>
            <div class="center subtitle">${data.cycle} | ${data.academicYear}</div>
            <div class="divider"></div>
            
            <div class="center bold receipt-title">وصل تسديد حصة الدعم</div>
            <div class="flex-row small">
              <span>رقم الوصل: <strong>#${receiptNo}</strong></span>
              <span>${printDateStr} ${printTimeStr}</span>
            </div>
            
            <div class="divider"></div>
            
            <!-- Group Info -->
            <div class="flex-row">
              <span>الفوج: <strong class="bold">${group.groupId} ${group.isVip ? '(VIP)' : ''}</strong></span>
              <span>المادة: <strong class="bold">${group.subject}</strong></span>
            </div>
            <div class="flex-row">
              <span>الأستاذ: <strong>${group.teacherName}</strong></span>
              <span>الحصة: <strong>${selectedSessionIdx + 1} (${sessionDate})</strong></span>
            </div>
            
            <div class="divider"></div>
            
            <!-- Student Info -->
            <div class="flex-row">
              <span>اسم التلميذ:</span>
              <span class="bold student-name">${student.name}</span>
            </div>
            ${student.phone ? `
            <div class="flex-row small">
              <span>الهاتف:</span>
              <span>${student.phone}</span>
            </div>` : ''}
            
            <!-- Payment Highlight for this day -->
            <div class="divider"></div>
            <div class="payment-box">
              <div class="pay-title">المبلغ المسدد اليوم (حصة ${selectedSessionIdx + 1}):</div>
              <div class="pay-amount">${paidToday.toLocaleString()} دج</div>
            </div>
            <div class="divider"></div>
            
            <!-- Overall Financial Status -->
            <div class="flex-row">
              <span>المبلغ الإجمالي للدورة:</span>
              <span>${student.fee} دج</span>
            </div>
            <div class="flex-row">
              <span>مجموع المبالغ المسددة:</span>
              <span class="bold">${totalPaid} دج</span>
            </div>
            <div class="divider"></div>
            <div class="flex-row bold status-text">
              <span>الوضعية المتبقية:</span>
              <span>${balance > 0 ? `دين متبقي: ${balance} دج` : 'خالص بالكامل ✓'}</span>
            </div>
            
            <!-- Barcode Simulation -->
            <div class="center barcode">*${receiptNo}*</div>
            
            <!-- Footer Note -->
            <div class="center footer-text">
              شكراً لثقتكم بمؤسستنا - مع تمنياتنا بالتفوق والنجاح<br />
              يرجى الاحتفاظ بهذا الوصل للاستظهار به عند الحاجة
            </div>
            
            <!-- Cut separator between receipts under each other -->
            <div class="cut-line">✄ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
          </div>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>وصولات الدفع الحرارية 80mm - فوج ${group.groupId}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              font-family: 'Courier New', 'Cairo', Tahoma, Arial, sans-serif;
              width: 100% !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #000000 !important;
              direction: rtl;
              text-align: right;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .receipt {
              width: 100% !important;
              max-width: 80mm !important;
              margin: 0 auto !important;
              padding: 8px 4px 16px 4px !important;
              /* Receipts appear continuously under each other on the roll */
              page-break-inside: avoid !important;
              break-inside: avoid !important;
              page-break-after: auto !important;
              break-after: auto !important;
              border-bottom: 2px dashed #000000;
            }
            .center {
              text-align: center;
            }
            .bold {
              font-weight: 900;
            }
            .title {
              font-size: 15px;
              font-weight: 900;
              line-height: 1.3;
              margin-bottom: 2px;
            }
            .subtitle {
              font-size: 11px;
              color: #333;
              margin-bottom: 3px;
            }
            .receipt-title {
              font-size: 13px;
              margin: 4px 0 2px;
            }
            .small {
              font-size: 11px;
            }
            .divider {
              width: 100%;
              border-top: 1.5px dashed #000000;
              margin: 5px 0;
            }
            .flex-row {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 2px 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .student-name {
              font-size: 15px;
              font-weight: 900;
            }
            .payment-box {
              width: 100%;
              text-align: center;
              padding: 6px 2px;
              background: #f2f2f2 !important;
              border: 2px solid #000000;
              margin: 5px 0;
            }
            .pay-title {
              font-size: 12px;
              font-weight: 700;
              margin-bottom: 2px;
            }
            .pay-amount {
              font-size: 22px;
              font-weight: 900;
              color: #000000;
            }
            .status-text {
              font-size: 13px;
            }
            .barcode {
              font-family: monospace;
              letter-spacing: 3px;
              margin: 6px 0 2px 0;
              font-size: 12px;
              font-weight: bold;
            }
            .footer-text {
              margin-top: 5px;
              line-height: 1.3;
              font-size: 10px;
            }
            .cut-line {
              text-align: center;
              font-size: 10px;
              font-weight: bold;
              color: #222;
              margin-top: 10px;
              padding-bottom: 4px;
            }
            @media print {
              html, body {
                width: 100% !important;
                max-width: 80mm !important;
              }
              .receipt {
                width: 100% !important;
                max-width: 80mm !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
                page-break-after: auto !important;
                break-after: auto !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipts-container">
            ${receiptsHtml}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter students for the quick-entry table
  const displayedStudents = realStudents.filter((s) =>
    s.name.toLowerCase().includes(searchStudent.toLowerCase()) ||
    (s.phone && s.phone.includes(searchStudent))
  );

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ padding: '12px' }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '600px',
          maxHeight: '86vh',
          padding: '16px 20px',
          borderRadius: 'var(--md-shape-lg)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '10px',
            marginBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo.svg"
              alt="شعار المؤسسة"
              style={{
                height: '30px',
                width: 'auto',
                objectFit: 'contain',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 6px',
                borderRadius: 'var(--md-shape-xs)',
                boxShadow: 'var(--md-elevation-1)'
              }}
            />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                طباعة وصولات الذين دفعوا اليوم (طابعة 80mm)
              </h2>
              <p style={{ fontSize: '0.75rem', margin: '2px 0 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
                فوج {group.groupId} | {group.subject} (الأستاذ: {group.teacherName})
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

        {/* Controls Bar: Select Session & Filter */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: '8px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            padding: '8px 12px',
            borderRadius: 'var(--md-shape-sm)',
            marginBottom: '10px'
          }}
        >
          {/* Session Picker */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                الحصة / تاريخ اليوم:
              </label>
              {isSessionDateToday(group.sessionDates[selectedSessionIdx]) && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    backgroundColor: 'var(--status-present-container)',
                    color: 'var(--status-present)',
                    padding: '1px 6px',
                    borderRadius: 'var(--md-shape-xs)',
                    fontWeight: 700
                  }}
                >
                  تاريخ اليوم ✓
                </span>
              )}
            </div>
            <select
              value={selectedSessionIdx}
              onChange={(e) => setSelectedSessionIdx(Number(e.target.value))}
              className="m3-input"
              style={{ padding: '4px 8px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-sys-color-primary)', cursor: 'pointer' }}
            >
              {group.sessionDates.map((date, idx) => {
                const isToday = isSessionDateToday(date);
                return (
                  <option key={idx} value={idx}>
                    دفعة الحصة {idx + 1} ({formatToYYYYMMDD(date)}){isToday ? ' ★ اليوم' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selection Controls */}
          <div>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.78rem', marginBottom: '3px' }}>
              تحديد التلاميذ للطباعة:
            </label>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSelectOnlyPaidToday}
                className="m3-chip"
                style={{
                  padding: '2px 7px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  backgroundColor: 'var(--status-present-container)',
                  color: 'var(--status-present)',
                  fontWeight: 700
                }}
                title="تحديد فقط التلاميذ الذين سددوا اليوم"
              >
                المسددين اليوم ({studentsWhoPaidToday.length})
              </button>
              <button
                type="button"
                onClick={handleSelectAll}
                className="m3-chip"
                style={{ padding: '2px 7px', fontSize: '0.72rem', cursor: 'pointer' }}
                title="تحديد كافة تلاميذ الفوج"
              >
                الكل ({realStudents.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="m3-chip"
                style={{ padding: '2px 7px', fontSize: '0.72rem', cursor: 'pointer', color: 'var(--md-sys-color-outline)' }}
                title="إلغاء تحديد الجميع"
              >
                إلغاء ({selectedRowIds.size})
              </button>
            </div>
          </div>
        </div>

        {/* Day's Financial Summary KPI */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '10px',
            textAlign: 'center'
          }}
        >
          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'var(--status-present-container)',
              borderRadius: 'var(--md-shape-xs)'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--status-present)', fontWeight: 600 }}>
              سددوا اليوم
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--status-present)' }}>
              {studentsWhoPaidToday.length} <span style={{ fontSize: '0.7rem' }}>تلميذ</span>
            </div>
          </div>

          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              borderRadius: 'var(--md-shape-xs)'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-primary-container)', fontWeight: 600 }}>
              محصلة اليوم
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--md-sys-color-on-primary-container)' }}>
              {totalSessionCollected.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>دج</span>
            </div>
          </div>

          <div
            style={{
              padding: '6px 8px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-xs)'
            }}
          >
            <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              المحددة للطباعة
            </span>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
              {studentsToPrint.length} <span style={{ fontSize: '0.7rem' }}>وصل 80mm</span>
            </div>
          </div>
        </div>

        {/* Success Alert on Save */}
        {saveSuccessMsg && (
          <div
            style={{
              padding: '6px 10px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-xs)',
              fontWeight: 700,
              fontSize: '0.8rem',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Check size={15} />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Quick Payment Entry & Verification Table */}
        <div style={{ marginBottom: '10px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
              <CreditCard size={15} color="var(--md-sys-color-primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>
                مبالغ الحصة {selectedSessionIdx + 1} ({sessionDate}) • محدد للطباعة ({studentsToPrint.length}):
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="text"
                value={searchStudent || ''}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="بحث..."
                className="m3-input"
                style={{ padding: '3px 8px', fontSize: '0.75rem', width: '110px' }}
              />

              <button
                type="button"
                onClick={handleSaveAllPayments}
                className="m3-btn m3-btn-tonal m3-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', fontSize: '0.75rem' }}
                title="حفظ المبالغ المدخلة فوراً في قاعدة البيانات"
              >
                <Save size={13} />
                <span>حفظ المبالغ</span>
              </button>
            </div>
          </div>

          <div
            className="m3-table-container"
            style={{ maxHeight: '165px', overflowY: 'auto', border: '1px solid var(--md-sys-color-outline-variant)' }}
          >
            <table className="m3-table" style={{ fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '28px', textAlign: 'center', padding: '5px 4px' }}>
                    <input
                      type="checkbox"
                      checked={displayedStudents.length > 0 && displayedStudents.every((s) => selectedRowIds.has(s.rowId))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            displayedStudents.forEach((s) => next.add(s.rowId));
                            return next;
                          });
                        } else {
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            displayedStudents.forEach((s) => next.delete(s.rowId));
                            return next;
                          });
                        }
                      }}
                      style={{ cursor: 'pointer', width: '14px', height: '14px' }}
                      title="تحديد / إلغاء تحديد الكل المعروضين"
                    />
                  </th>
                  <th style={{ width: '25px', textAlign: 'center', padding: '5px 4px' }}>#</th>
                  <th style={{ padding: '5px 8px' }}>اسم التلميذ</th>
                  <th style={{ textAlign: 'center', padding: '5px 6px' }}>المطلوب</th>
                  <th style={{ textAlign: 'center', width: '100px', padding: '5px 6px' }}>المبلغ اليوم</th>
                  <th style={{ textAlign: 'center', padding: '5px 6px' }}>إجراء سريع</th>
                  <th style={{ textAlign: 'center', padding: '5px 6px' }}>الحالة</th>
                  <th style={{ textAlign: 'center', width: '38px', padding: '5px 4px' }}>طباعة</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.map((s, idx) => {
                  const rawVal = localPayments[s.rowId];
                  const pVal = rawVal !== undefined && rawVal !== null && rawVal !== '' ? rawVal : '';
                  const numVal = Number(pVal) || 0;
                  const hasPaidToday = numVal > 0;
                  const isSelected = selectedRowIds.has(s.rowId);

                  return (
                    <tr
                      key={s.rowId}
                      style={{
                        backgroundColor: isSelected
                          ? (hasPaidToday ? 'var(--status-present-container)' : 'var(--md-sys-color-surface-container)')
                          : 'transparent'
                      }}
                    >
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectStudent(s.rowId)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          title="تحديد التلميذ لطباعة الوصل"
                        />
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', padding: '3px 4px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ fontWeight: 700, padding: '3px 8px' }}>{s.name}</td>
                      <td style={{ textAlign: 'center', padding: '3px 6px' }}>{s.fee} دج</td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <input
                          type="number"
                          value={localPayments[s.rowId] !== undefined && localPayments[s.rowId] !== null ? localPayments[s.rowId] : ''}
                          onChange={(e) => handlePaymentInput(s.rowId, e.target.value)}
                          placeholder="0 دج"
                          className="m3-input"
                          style={{
                            width: '80px',
                            padding: '2px 4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            borderColor: hasPaidToday ? 'var(--status-present)' : 'var(--md-sys-color-outline)'
                          }}
                        />
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <button
                          type="button"
                          onClick={() => handleQuickPayFull(s)}
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{ padding: '2px 5px', fontSize: '0.68rem' }}
                        >
                          دفع كامل ({s.fee})
                        </button>
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        {hasPaidToday ? (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              color: 'var(--status-present)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            <Check size={12} /> {numVal} دج
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-outline)' }}>
                            لم يسدد
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', padding: '3px 4px' }}>
                        <button
                          type="button"
                          onClick={() => handlePrintThermal([s])}
                          className="m3-btn m3-btn-tonal m3-btn-sm"
                          style={{ padding: '3px 6px' }}
                          title="طباعة وصل هذا التلميذ فقط"
                        >
                          <Printer size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            paddingTop: '10px',
            gap: '8px'
          }}
        >
          <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            طباعة حرارية 80mm للمحددين فقط ({studentsToPrint.length} تلميذ)
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text m3-btn-sm" style={{ padding: '5px 12px', fontSize: '0.8rem' }}>
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => handlePrintThermal()}
              className="m3-btn m3-btn-primary m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', fontSize: '0.82rem' }}
            >
              <Printer size={15} />
              <span>طباعة وصولات المحددين ({studentsToPrint.length} وصل)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

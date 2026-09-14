'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StudentRecord, GroupSheet, QueuedReceipt } from '../types';
import {
  Scan,
  X,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  Printer,
  Clock,
  ArrowRight,
  UserCheck,
  UserX,
  CreditCard,
  FileText,
  ListOrdered,
  HelpCircle,
  Sparkles,
  Layers,
  ChevronDown
} from 'lucide-react';
import { playSuccessChime, playWarningAlert } from '../utils/soundUtils';
import { printSingleThermalReceipt, printBatchThermalReceipts, ThermalReceiptData } from '../utils/printUtils';
import { isSummaryRow, formatToYYYYMMDD, isSessionDateToday } from '../utils/sessionUtils';

interface Props {
  initialGroupId?: string;
  onClose: () => void;
}

export default function BarcodeScannerModal({ initialGroupId, onClose }: Props) {
  const {
    data,
    updateAttendance,
    updatePayment,
    recordCoverAttendance,
    endSessionAndMarkAbsent,
    printQueue,
    addToPrintQueue,
    removeFromPrintQueue,
    clearPrintQueue
  } = useApp();

  // Active Group selection (defaults to initialGroupId or first group)
  const [activeGroupId, setActiveGroupId] = useState<string>(
    initialGroupId || data.groups[0]?.id || 'BAC01'
  );
  const activeGroup = data.groupData[activeGroupId] as GroupSheet | undefined;

  // Active Session selection (index 0 to sessionCount - 1)
  const [activeSessionIdx, setActiveSessionIdx] = useState<number>(() => {
    if (activeGroup?.sessionDates) {
      const todayIdx = activeGroup.sessionDates.findIndex((d) => isSessionDateToday(formatToYYYYMMDD(d) || d));
      if (todayIdx !== -1) return todayIdx;
    }
    return 0;
  });

  // Scanner Barcode Input State
  const [barcodeInput, setBarcodeInput] = useState('');
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Scanned Student resolution
  const [scannedResult, setScannedResult] = useState<{
    student: StudentRecord;
    homeGroupId: string;
    isInActiveGroup: boolean;
  } | null>(null);

  // Workflow Dialog States
  // 1. Covering Dialog: When student is not in active group
  const [showCoverDialog, setShowCoverDialog] = useState(false);
  const [selectedOriginalGroup, setSelectedOriginalGroup] = useState('');

  // 2. Unpaid / Payment Dialog: When student has debt or unpaid session
  const [showUnpaidDialog, setShowUnpaidDialog] = useState(false);
  const [willPayNow, setWillPayNow] = useState<boolean | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  // 3. Flash Success Message
  const [flashSuccess, setFlashSuccess] = useState<{
    name: string;
    statusText: string;
    details: string;
  } | null>(null);

  // 4. End Session Confirmation Modal
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [endSessionStats, setEndSessionStats] = useState<{
    presentCount: number;
    makeupCount: number;
    absentCount: number;
  } | null>(null);

  // 5. Print Queue Modal view
  const [showQueueModal, setShowQueueModal] = useState(false);

  // Keep scanner input focused at all times for hardware scanners
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !showCoverDialog &&
        !showUnpaidDialog &&
        !showEndSessionConfirm &&
        !showQueueModal &&
        document.activeElement !== scannerInputRef.current
      ) {
        scannerInputRef.current?.focus();
      }
    }, 400);
    return () => clearInterval(timer);
  }, [showCoverDialog, showUnpaidDialog, showEndSessionConfirm, showQueueModal]);

  // Reset scanner state for the next student
  const resetForNextStudent = () => {
    setBarcodeInput('');
    setScannedResult(null);
    setShowCoverDialog(false);
    setSelectedOriginalGroup('');
    setShowUnpaidDialog(false);
    setWillPayNow(null);
    setPayAmount('');
    setTimeout(() => {
      scannerInputRef.current?.focus();
    }, 50);
  };

  // Find student across all groups by barcode, phone, ID or name
  const findStudentByCode = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return null;

    // 1. Search in active group first
    if (activeGroup?.students) {
      const matchInActive = activeGroup.students.find((s) => {
        if (isSummaryRow(s, activeGroupId)) return false;
        const sBarcode = s.barcode?.toLowerCase() || '';
        const sId = `${activeGroupId}-${s.rowId}`.toLowerCase();
        const sPhone = s.phone?.trim() || '';
        const sRow = String(s.rowId);

        return (
          sBarcode === clean ||
          sId === clean ||
          sPhone === clean ||
          sRow === clean ||
          s.name.toLowerCase() === clean
        );
      });

      if (matchInActive) {
        return {
          student: matchInActive,
          homeGroupId: activeGroupId,
          isInActiveGroup: true
        };
      }
    }

    // 2. Search across all other groups
    for (const [gid, sheet] of Object.entries(data.groupData)) {
      for (const s of sheet.students || []) {
        if (isSummaryRow(s, gid)) return null;
        const sBarcode = s.barcode?.toLowerCase() || '';
        const sId = `${gid}-${s.rowId}`.toLowerCase();
        const sPhone = s.phone?.trim() || '';
        const sRow = String(s.rowId);

        if (
          sBarcode === clean ||
          sId === clean ||
          sPhone === clean ||
          sRow === clean ||
          s.name.toLowerCase() === clean
        ) {
          return {
            student: s,
            homeGroupId: gid,
            isInActiveGroup: gid === activeGroupId
          };
        }
      }
    }

    return null;
  };

  // Process a scanned card / barcode
  const handleBarcodeSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rawCode = barcodeInput.trim();
    if (!rawCode) return;

    const result = findStudentByCode(rawCode);

    if (!result) {
      playWarningAlert();
      alert(`لم يتم العثور على أي تلميذ مسجل بالرمز: "${rawCode}"`);
      setBarcodeInput('');
      return;
    }

    setScannedResult(result);

    // 1. Check if student belongs to active group
    if (!result.isInActiveGroup) {
      // Step 2: Session Validation & Covering Logic: Not in active group!
      setShowCoverDialog(true);
      setSelectedOriginalGroup(result.homeGroupId);
      return;
    }

    // In active group -> proceed directly to payment check
    proceedToPaymentCheck(result.student, activeGroupId, false);
  };

  // Step 3: Payment Verification
  const proceedToPaymentCheck = (student: StudentRecord, groupId: string, isCover: boolean, originalGid?: string) => {
    const isPaid = (student.debt || 0) <= 0 || (Number(student.payments?.[activeSessionIdx]) || 0) > 0;

    if (isPaid) {
      // Paid -> Mark Present, Chime, Reset screen
      playSuccessChime();
      if (isCover && originalGid) {
        recordCoverAttendance(groupId, originalGid, student.rowId, activeSessionIdx);
      } else {
        updateAttendance(groupId, student.rowId, activeSessionIdx, 'P');
      }

      setFlashSuccess({
        name: student.name,
        statusText: isCover ? 'حاضر (حصة تعويض) ✓' : 'حاضر (مسدد بالكامل) ✓',
        details: `فوج ${groupId} • الحصة ${activeSessionIdx + 1}`
      });

      setTimeout(() => {
        setFlashSuccess(null);
        resetForNextStudent();
      }, 1300);
    } else {
      // Not Paid -> Audio alert, Popup appears!
      playWarningAlert();
      setShowUnpaidDialog(true);
      const tierPrice = activeGroup?.type === '4-10000' ? 2500 : 625;
      const expectedAmount = student.debt > 0 ? Math.min(student.debt, tierPrice) : tierPrice;
      setPayAmount(String(expectedAmount));
    }
  };

  // Payment Processing: User chose "No, student will not pay now"
  const handleUnpaidNoPayment = (allowEntryAsDebtor: boolean) => {
    if (!scannedResult) return;

    if (allowEntryAsDebtor) {
      // Mark as present with debt
      if (showCoverDialog && selectedOriginalGroup) {
        recordCoverAttendance(activeGroupId, selectedOriginalGroup, scannedResult.student.rowId, activeSessionIdx);
      } else {
        updateAttendance(activeGroupId, scannedResult.student.rowId, activeSessionIdx, 'P');
      }

      setFlashSuccess({
        name: scannedResult.student.name,
        statusText: 'تم تسجيل الدخول (مدين) ⚠️',
        details: `المتبقي في الذمة: ${scannedResult.student.debt?.toLocaleString() || 0} دج`
      });

      setTimeout(() => {
        setFlashSuccess(null);
        resetForNextStudent();
      }, 1500);
    } else {
      // Deny entry / Cancel scan
      resetForNextStudent();
    }
  };

  // Payment Processing: "Save and Print" or "Next and Print Later"
  const handleProcessPayment = (printImmediately: boolean) => {
    if (!scannedResult) return;

    const amountNum = Number(payAmount) || 0;
    const student = scannedResult.student;
    const isCover = !scannedResult.isInActiveGroup;

    // 1. Save payment & mark attendance
    if (isCover && selectedOriginalGroup) {
      recordCoverAttendance(activeGroupId, selectedOriginalGroup, student.rowId, activeSessionIdx, amountNum);
    } else {
      updateAttendance(activeGroupId, student.rowId, activeSessionIdx, isCover ? 'M' : 'P');
      if (amountNum > 0) {
        updatePayment(activeGroupId, student.rowId, activeSessionIdx, amountNum);
      }
    }

    playSuccessChime();

    // Receipt preparation
    const receiptNo = `${activeGroupId}-${student.rowId.toString().padStart(3, '0')}`;
    const now = new Date();
    const dateStr = now.toLocaleDateString('ar-DZ');
    const timeStr = now.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });

    const totalFee = student.fee || 2500;
    const totalPaid = (student.totalReceived || 0) + amountNum;
    const balance = totalPaid - totalFee;

    const receiptData: ThermalReceiptData = {
      receiptNo,
      centerName: data.centerName,
      cycle: data.cycle,
      academicYear: data.academicYear,
      date: dateStr,
      time: timeStr,
      studentName: student.name,
      studentPhone: student.phone,
      groupId: activeGroupId,
      subject: activeGroup?.subject || '',
      teacherName: activeGroup?.teacherName || '',
      amount: amountNum,
      totalFee,
      totalPaid,
      balance,
      isCover,
      originalGroup: selectedOriginalGroup
    };

    if (printImmediately) {
      // Button 1: Save and Print
      printSingleThermalReceipt(receiptData);
    } else {
      // Button 2: Next and Print Later (Push to Print Queue)
      addToPrintQueue({
        id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        receiptNo,
        groupId: activeGroupId,
        subject: activeGroup?.subject || '',
        teacherName: activeGroup?.teacherName || '',
        studentRowId: student.rowId,
        studentName: student.name,
        studentPhone: student.phone,
        amount: amountNum,
        totalFee,
        totalPaid,
        balance,
        date: dateStr,
        time: timeStr,
        sessionIndex: activeSessionIdx,
        isCover,
        originalGroup: selectedOriginalGroup
      });
    }

    setFlashSuccess({
      name: student.name,
      statusText: printImmediately ? 'تم الدفع وطباعة الوصل فوراً ✓' : 'تم الدفع وتأجيل الطباعة للطابور ✓',
      details: `تم استلام: ${amountNum.toLocaleString()} دج`
    });

    setTimeout(() => {
      setFlashSuccess(null);
      resetForNextStudent();
    }, 1200);
  };

  // Automated Absence Tracking: End Session
  const handleConfirmEndSession = () => {
    const stats = endSessionAndMarkAbsent(activeGroupId, activeSessionIdx);
    setEndSessionStats(stats);
    setShowEndSessionConfirm(false);
  };

  // Real-time live counts in active session
  const sessionStats = useMemo(() => {
    if (!activeGroup?.students) return { present: 0, makeup: 0, absent: 0, unmarked: 0, total: 0 };
    let present = 0;
    let makeup = 0;
    let absent = 0;
    let unmarked = 0;

    const real = activeGroup.students.filter((s) => !isSummaryRow(s, activeGroupId));
    real.forEach((s) => {
      const st = s.attendance?.[activeSessionIdx] || '';
      if (st === 'P') present++;
      else if (st === 'M') makeup++;
      else if (st === 'A') absent++;
      else unmarked++;
    });

    return { present, makeup, absent, unmarked, total: real.length };
  }, [activeGroup, activeGroupId, activeSessionIdx]);

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 110 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '100%',
          padding: '24px',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-xl)',
          boxShadow: 'var(--md-elevation-4)',
          position: 'relative'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '14px',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Scan size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                محطة مسح البطاقات وقارئ الباركود (حضور ودفع سريع)
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                التعرف الفوري على التلميذ، معالجة حصص التعويض، والتسديد وطباعة الإيصال
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Print Queue Button */}
            <button
              onClick={() => setShowQueueModal(true)}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: printQueue.length > 0 ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                backgroundColor: printQueue.length > 0 ? 'var(--md-sys-color-primary-container)' : 'transparent',
                color: printQueue.length > 0 ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'
              }}
              title="عرض وطباعة الوصلات المؤجلة في قائمة الانتظار"
            >
              <Printer size={15} />
              <span>طابور الطباعة ({printQueue.length})</span>
            </button>

            <button
              onClick={onClose}
              className="m3-btn-text"
              style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar: Active Group & Active Session Selectors */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '12px 16px',
            borderRadius: 'var(--md-shape-lg)',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>
                الفوج النشط حالياً:
              </span>
              <select
                value={activeGroupId}
                onChange={(e) => {
                  setActiveGroupId(e.target.value);
                  resetForNextStudent();
                }}
                className="m3-input"
                style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700, minWidth: '180px' }}
              >
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    فوج {g.id} ({g.subject})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '4px' }}>
                الحصة المستهدفة:
              </span>
              <select
                value={activeSessionIdx}
                onChange={(e) => setActiveSessionIdx(Number(e.target.value))}
                className="m3-input"
                style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 700, width: '130px' }}
              >
                {Array.from({ length: activeGroup?.sessionCount || 4 }).map((_, idx) => (
                  <option key={idx} value={idx}>
                    الحصة {idx + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* End Session Button */}
          <div>
            <button
              onClick={() => setShowEndSessionConfirm(true)}
              className="m3-btn m3-btn-sm"
              style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px'
              }}
              title="إنهاء الحصة وتسجيل جميع من لم يحضروا كغائب (A) تلقائياً"
            >
              <UserX size={15} />
              <span>إنهاء الحصة وتسجيل الغياب التلقائي</span>
            </button>
          </div>
        </div>

        {/* Live Session Counter Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginBottom: '18px',
            textAlign: 'center'
          }}
        >
          <div style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '8px', borderRadius: 'var(--md-shape-md)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>حاضر (P)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{sessionStats.present}</div>
          </div>
          <div style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '8px', borderRadius: 'var(--md-shape-md)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>تعويض (M)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{sessionStats.makeup}</div>
          </div>
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '8px', borderRadius: 'var(--md-shape-md)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>غائب (A)</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{sessionStats.absent}</div>
          </div>
          <div style={{ backgroundColor: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface)', padding: '8px', borderRadius: 'var(--md-shape-md)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>لم يمسح بعد</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{sessionStats.unmarked}</div>
          </div>
        </div>

        {/* Barcode Scanner Box Area */}
        <form onSubmit={handleBarcodeSubmit} style={{ marginBottom: '18px' }}>
          <div
            style={{
              border: '2px dashed var(--md-sys-color-primary)',
              borderRadius: 'var(--md-shape-lg)',
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Scan size={36} color="var(--md-sys-color-primary)" className="animate-pulse" />
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--md-sys-color-on-primary-container)' }}>
                وجّه قارئ الباركود نحو بطاقة التلميذ
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-primary-container)', opacity: 0.85 }}>
                القارئ يتصرف كلوحة مفاتيح ويرسل الرمز متبوعاً بـ Enter تلقائياً
              </p>

              <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '420px', marginTop: '10px' }}>
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="امسح البطاقة أو اكتب الرمز هنا..."
                  className="m3-input"
                  style={{
                    textAlign: 'center',
                    fontSize: '1rem',
                    fontWeight: 700,
                    backgroundColor: '#fff',
                    borderColor: 'var(--md-sys-color-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                  }}
                  autoFocus
                />
                <button type="submit" className="m3-btn m3-btn-primary" style={{ fontWeight: 700, minWidth: '85px' }}>
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Flash Success Banner */}
        {flashSuccess && (
          <div
            style={{
              backgroundColor: '#dcfce7',
              border: '2px solid #86efac',
              borderRadius: 'var(--md-shape-lg)',
              padding: '16px',
              textAlign: 'center',
              animation: 'fadeIn 0.2s ease',
              marginBottom: '16px'
            }}
          >
            <CheckCircle2 size={36} color="#15803d" style={{ margin: '0 auto 6px' }} />
            <div style={{ fontWeight: 900, fontSize: '1.25rem', color: '#15803d' }}>
              {flashSuccess.name}
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#166534', marginTop: '2px' }}>
              {flashSuccess.statusText}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#14532d', marginTop: '2px' }}>
              {flashSuccess.details}
            </div>
          </div>
        )}

        {/* DIALOG 1: COVERING / MAKE-UP SESSION POPUP */}
        {showCoverDialog && scannedResult && (
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '2px solid #fde68a',
              borderRadius: 'var(--md-shape-lg)',
              padding: '18px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', marginBottom: '8px' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                تنبيه: التلميذ ليس مسجلاً في هذا الفوج ({activeGroupId})
              </h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#92400e', marginBottom: '12px' }}>
              التلميذ <strong>"{scannedResult.student.name}"</strong> مسجل في فوج ({scannedResult.homeGroupId}).
              <br />
              <strong>هل التلميذ في حصة تعويض؟</strong>
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                حدد الفوج الأصلي الذي تغيب فيه التلميذ:
              </label>
              <select
                value={selectedOriginalGroup}
                onChange={(e) => setSelectedOriginalGroup(e.target.value)}
                className="m3-input"
                style={{ width: '100%', maxWidth: '320px', fontWeight: 700 }}
              >
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    فوج {g.id} ({g.subject})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCoverDialog(false);
                  proceedToPaymentCheck(scannedResult.student, activeGroupId, true, selectedOriginalGroup);
                }}
                className="m3-btn m3-btn-primary"
                style={{ backgroundColor: '#d97706', borderColor: '#d97706', fontWeight: 700 }}
              >
                نعم (تسجيل كحصة تعويض)
              </button>
              <button
                type="button"
                onClick={resetForNextStudent}
                className="m3-btn m3-btn-outlined"
                style={{ borderColor: '#d97706', color: '#b45309' }}
              >
                لا (إلغاء العملية)
              </button>
            </div>
          </div>
        )}

        {/* DIALOG 2: UNPAID / PAYMENT VERIFICATION POPUP */}
        {showUnpaidDialog && scannedResult && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '2px solid #fecaca',
              borderRadius: 'var(--md-shape-lg)',
              padding: '18px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c', marginBottom: '8px' }}>
              <Volume2 size={24} className="animate-pulse" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                تنبيه صوتي: التلميذ غير مسدد (عليه مستحقات مالية)
              </h3>
            </div>

            <div style={{ fontSize: '0.9rem', color: '#991b1b', marginBottom: '14px' }}>
              التلميذ: <strong>{scannedResult.student.name}</strong>
              <br />
              المبلغ المتبقي في الذمة: <strong style={{ fontSize: '1.1rem' }}>{scannedResult.student.debt?.toLocaleString() || 'غير مسدد'} دج</strong>
            </div>

            {willPayNow === null ? (
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#7f1d1d', marginBottom: '10px' }}>
                  هل يريد التلميذ الدفع الآن؟
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setWillPayNow(true)}
                    className="m3-btn m3-btn-primary"
                    style={{ backgroundColor: '#15803d', borderColor: '#15803d', fontWeight: 700 }}
                  >
                    نعم (يريد الدفع الآن)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnpaidNoPayment(true)}
                    className="m3-btn m3-btn-outlined"
                    style={{ borderColor: '#b91c1c', color: '#b91c1c', fontWeight: 700 }}
                  >
                    لا (تسجيل الدخول كمدين)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnpaidNoPayment(false)}
                    className="m3-btn m3-btn-text"
                  >
                    إلغاء وتخطي
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                    المبلغ المستلم الآن (دج):
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="m3-input"
                    style={{ width: '100%', maxWidth: '240px', fontWeight: 800, fontSize: '1.1rem' }}
                    autoFocus
                  />
                </div>

                {/* THE 2 MANDATORY BUTTONS: Save & Print, Next & Print Later */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => handleProcessPayment(true)}
                    className="m3-btn m3-btn-primary"
                    style={{
                      backgroundColor: '#00639b',
                      borderColor: '#00639b',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="حفظ الدفعة، تسجيل الحضور وطباعة الوصل الحراري فوراً"
                  >
                    <Printer size={16} />
                    <span>حفظ وطباعة الوصل فوراً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleProcessPayment(false)}
                    className="m3-btn"
                    style={{
                      backgroundColor: '#0284c7',
                      color: '#fff',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="حفظ الدفعة، تسجيل الحضور وإضافة الوصل إلى طابور الطباعة لطباعته لاحقاً"
                  >
                    <ArrowRight size={16} />
                    <span>التالي وطباعة لاحقاً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWillPayNow(null)}
                    className="m3-btn m3-btn-text"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DIALOG 3: END SESSION CONFIRMATION MODAL */}
        {showEndSessionConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 150
            }}
            onClick={() => setShowEndSessionConfirm(false)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '480px',
                width: '90%',
                boxShadow: 'var(--md-elevation-4)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', marginBottom: '12px' }}>
                <UserX size={26} />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                  تأكيد إنهاء الحصة وتسجيل الغياب التلقائي
                </h3>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#444', lineHeight: 1.6, marginBottom: '16px' }}>
                أنت على وشك إنهاء <strong>الحصة {activeSessionIdx + 1}</strong> لفوج <strong>{activeGroupId}</strong>.
                <br />
                سيقوم النظام بالبحث عن جميع التلاميذ المسجلين بهذا الفوج الذين لم يمسحوا بطاقاتهم، وتسجيلهم كـ{' '}
                <strong style={{ color: '#b91c1c' }}>غائب (A)</strong> تلقائياً وإعادة حساب المستحقات والديون.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEndSessionConfirm(false)}
                  className="m3-btn m3-btn-text"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmEndSession}
                  className="m3-btn m3-btn-primary"
                  style={{ backgroundColor: '#b91c1c', borderColor: '#b91c1c', fontWeight: 700 }}
                >
                  نعم، أنهِ الحصة وسجل الغياب الآن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIALOG 4: END SESSION RESULTS SUMMARY TOAST */}
        {endSessionStats && (
          <div
            style={{
              backgroundColor: '#ecfdf5',
              border: '2px solid #a7f3d0',
              borderRadius: 'var(--md-shape-lg)',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px'
            }}
          >
            <CheckCircle2 size={32} color="#059669" style={{ margin: '0 auto 6px' }} />
            <h4 style={{ fontWeight: 800, fontSize: '1.1rem', color: '#065f46' }}>
              تم إنهاء الحصة بنجاح وحساب الغياب التلقائي!
            </h4>
            <div style={{ fontSize: '0.85rem', color: '#047857', marginTop: '4px' }}>
              تم تسجيل: <strong>{endSessionStats.presentCount} حاضر</strong> •{' '}
              <strong>{endSessionStats.makeupCount} تعويض</strong> •{' '}
              <strong style={{ color: '#b91c1c' }}>{endSessionStats.absentCount} غائب</strong>
            </div>
            <button
              onClick={() => setEndSessionStats(null)}
              className="m3-btn m3-btn-sm m3-btn-outlined"
              style={{ marginTop: '10px', fontSize: '0.78rem' }}
            >
              إغلاق
            </button>
          </div>
        )}

        {/* DIALOG 5: PRINT QUEUE MODAL */}
        {showQueueModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 160
            }}
            onClick={() => setShowQueueModal(false)}
          >
            <div
              style={{
                backgroundColor: '#fff',
                padding: '24px',
                borderRadius: 'var(--md-shape-xl)',
                maxWidth: '650px',
                width: '90%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--md-elevation-4)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                  paddingBottom: '12px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={22} color="var(--md-sys-color-primary)" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                    طابور الوصلات المؤجلة للطباعة ({printQueue.length})
                  </h3>
                </div>
                <button
                  onClick={() => setShowQueueModal(false)}
                  className="m3-btn-text"
                  style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
                >
                  <X size={18} />
                </button>
              </div>

              {printQueue.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--md-sys-color-outline)' }}>
                  طابور الطباعة فارغ حالياً. عند الضغط على "التالي وطباعة لاحقاً" أثناء مسح البطاقات، ستظهر الوصلات هنا.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <button
                      onClick={() => {
                        printBatchThermalReceipts(
                          printQueue.map((q) => ({
                            receiptNo: q.receiptNo,
                            centerName: data.centerName,
                            cycle: data.cycle,
                            academicYear: data.academicYear,
                            date: q.date,
                            time: q.time,
                            studentName: q.studentName,
                            studentPhone: q.studentPhone,
                            groupId: q.groupId,
                            subject: q.subject,
                            teacherName: q.teacherName,
                            amount: q.amount,
                            totalFee: q.totalFee,
                            totalPaid: q.totalPaid,
                            balance: q.balance,
                            isCover: q.isCover,
                            originalGroup: q.originalGroup
                          }))
                        );
                      }}
                      className="m3-btn m3-btn-primary"
                      style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Printer size={16} />
                      <span>طباعة جميع الوصلات المؤجلة دفعة واحدة ({printQueue.length})</span>
                    </button>

                    <button
                      onClick={clearPrintQueue}
                      className="m3-btn m3-btn-outlined m3-btn-sm"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    >
                      تفريغ الطابور
                    </button>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 'var(--md-shape-md)' }}>
                    {printQueue.map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: idx % 2 === 1 ? 'var(--md-sys-color-surface-container-lowest)' : 'transparent'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.studentName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                            فوج {item.groupId} ({item.subject}) • وصل رقم #{item.receiptNo} • {item.date} {item.time}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#15803d' }}>
                            {item.amount.toLocaleString()} دج
                          </span>
                          <button
                            onClick={() => {
                              printSingleThermalReceipt({
                                receiptNo: item.receiptNo,
                                centerName: data.centerName,
                                cycle: data.cycle,
                                academicYear: data.academicYear,
                                date: item.date,
                                time: item.time,
                                studentName: item.studentName,
                                studentPhone: item.studentPhone,
                                groupId: item.groupId,
                                subject: item.subject,
                                teacherName: item.teacherName,
                                amount: item.amount,
                                totalFee: item.totalFee,
                                totalPaid: item.totalPaid,
                                balance: item.balance,
                                isCover: item.isCover,
                                originalGroup: item.originalGroup
                              });
                              removeFromPrintQueue(item.id);
                            }}
                            className="m3-btn m3-btn-outlined m3-btn-sm"
                            style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                          >
                            طباعة الآن
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

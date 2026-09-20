'use client';

import React, { useState, useMemo } from 'react';
import { GroupSheet, StudentRecord } from '../types';
import { useApp, calcStudentFinancesPure } from '../context/AppContext';
import {
  X,
  Coins,
  Check,
  Search,
  Printer,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  RotateCcw,
  ArrowUpDown
} from 'lucide-react';
import { isSummaryRow, formatToYYYYMMDD, isSessionDateToday, getDefaultSessionIndex } from '../utils/sessionUtils';
import StudentPaymentModal from './StudentPaymentModal';

interface Props {
  group: GroupSheet;
  initialSessionIdx?: number;
  onClose: () => void;
}

export default function GroupSessionPaymentsModal({ group, initialSessionIdx, onClose }: Props) {
  const { data, batchUpdateAllSessionsPayments } = useApp();

  const realStudents = useMemo(() => {
    return (group?.students || []).filter((s) => !isSummaryRow(s, group.groupId));
  }, [group?.students, group.groupId]);

  const sessionCount = group.sessionDates?.length || group.sessionCount || 4;

  // Selected session index: 0, 1, 2, 3... or 'all' for matrix view
  const [selectedSessionIdx, setSelectedSessionIdx] = useState<number | 'all'>(() => {
    if (initialSessionIdx !== undefined && initialSessionIdx >= 0) return initialSessionIdx;
    return getDefaultSessionIndex(group);
  });

  // Local state for all students' payments across all sessions: [rowId]: (string | number)[]
  const [paymentsState, setPaymentsState] = useState<Record<number, (string | number)[]>>(() => {
    const initial: Record<number, (string | number)[]> = {};
    realStudents.forEach((student) => {
      const arr: (string | number)[] = [];
      for (let i = 0; i < sessionCount; i++) {
        const val = student.payments?.[i];
        arr.push(val !== undefined && val !== null && val !== '' ? val : '');
      }
      initial[student.rowId] = arr;
    });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'paid' | 'unpaid' | 'present'>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [studentForIndividualPayment, setStudentForIndividualPayment] = useState<StudentRecord | null>(null);

  // Group default session pricing
  const groupMeta = data.groups.find((g) => g.id === group.groupId);
  const tier = data.pricingTiers.find((t) => t.id === group.type);
  const totalGroupFee = group.studentFee ?? tier?.price ?? 2500;
  const standardSessionPrice = Math.round(totalGroupFee / sessionCount);

  // Live recalculated student list based on local payment state
  const liveStudents = useMemo(() => {
    return realStudents.map((s) => {
      const currentPayments = paymentsState[s.rowId] || [];
      const normalizedPayments = currentPayments.map((p) => (p === '' ? '' : Number(p) || 0));
      return calcStudentFinancesPure(
        { ...s, payments: normalizedPayments },
        group.type,
        data.pricingTiers,
        group
      );
    });
  }, [realStudents, paymentsState, group, data.pricingTiers]);

  // Compute stats for selected session (or overall)
  const sessionStats = useMemo(() => {
    const sIdx = typeof selectedSessionIdx === 'number' ? selectedSessionIdx : null;

    let totalCollected = 0;
    let paidStudentsCount = 0;
    let unpaidStudentsCount = 0;
    let presentStudentsCount = 0;

    liveStudents.forEach((student) => {
      const rawPayments = paymentsState[student.rowId] || [];
      if (sIdx !== null) {
        const amt = Number(rawPayments[sIdx]) || 0;
        totalCollected += amt;
        if (amt > 0) paidStudentsCount++;
        else unpaidStudentsCount++;

        const att = student.attendance[sIdx];
        if (att === 'P' || att === 'ح') presentStudentsCount++;
      } else {
        totalCollected += student.totalReceived;
        if (student.debt === 0 && student.totalReceived > 0) paidStudentsCount++;
        else if (student.debt > 0) unpaidStudentsCount++;
      }
    });

    const totalExpectedForSession = standardSessionPrice * liveStudents.length;
    const totalRemainingDebt = liveStudents.reduce((acc, s) => acc + s.debt, 0);

    return {
      totalCollected,
      paidStudentsCount,
      unpaidStudentsCount,
      presentStudentsCount,
      totalExpectedForSession,
      totalRemainingDebt
    };
  }, [liveStudents, paymentsState, selectedSessionIdx, standardSessionPrice]);

  // Filtered students for display
  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sIdx = typeof selectedSessionIdx === 'number' ? selectedSessionIdx : null;

    return liveStudents.filter((student) => {
      // Search
      if (q) {
        const nameMatch = (student.name || '').toLowerCase().includes(q);
        const phoneMatch = (student.phone || '').includes(q);
        const barcodeMatch = (student.barcode || '').toLowerCase().includes(q);
        const rowIdMatch = String(student.rowId).includes(q);
        if (!nameMatch && !phoneMatch && !barcodeMatch && !rowIdMatch) return false;
      }

      // Filter Mode
      const studentSessionPayment = sIdx !== null ? Number(paymentsState[student.rowId]?.[sIdx]) || 0 : 0;
      const att = sIdx !== null ? student.attendance[sIdx] : '';

      if (filterMode === 'paid') {
        if (sIdx !== null) return studentSessionPayment > 0;
        return student.debt === 0 && student.totalReceived > 0;
      }
      if (filterMode === 'unpaid') {
        if (sIdx !== null) return studentSessionPayment === 0;
        return student.debt > 0;
      }
      if (filterMode === 'present') {
        if (sIdx !== null) return att === 'P' || att === 'ح';
        return student.totalAttendance > 0;
      }

      return true;
    });
  }, [liveStudents, searchQuery, filterMode, selectedSessionIdx, paymentsState]);

  // Handle single cell payment change
  const handlePaymentChange = (rowId: number, sIdx: number, val: string) => {
    setPaymentsState((prev) => {
      const studentArr = [...(prev[rowId] || [])];
      while (studentArr.length < sessionCount) studentArr.push('');
      studentArr[sIdx] = val;
      return { ...prev, [rowId]: studentArr };
    });
    setSaveSuccessMsg('');
  };

  // Quick chip set amount for student
  const setStudentSessionAmount = (rowId: number, sIdx: number, amount: number | '') => {
    handlePaymentChange(rowId, sIdx, amount === '' ? '' : String(amount));
  };

  // Batch action: fill session fee for all students marked present 'P'
  const handleBatchPayPresent = () => {
    if (typeof selectedSessionIdx !== 'number') return;
    const sIdx = selectedSessionIdx;

    setPaymentsState((prev) => {
      const updated = { ...prev };
      realStudents.forEach((student) => {
        const att = student.attendance[sIdx];
        if (att === 'P' || att === 'ح') {
          const currentVal = updated[student.rowId]?.[sIdx];
          const curAmt = currentVal === '' ? 0 : Number(currentVal) || 0;
          if (curAmt === 0) {
            const studentFee = student.fee || totalGroupFee;
            const perSession = Math.round(studentFee / sessionCount);
            const arr = [...(updated[student.rowId] || [])];
            while (arr.length < sessionCount) arr.push('');
            arr[sIdx] = perSession;
            updated[student.rowId] = arr;
          }
        }
      });
      return updated;
    });
    setSaveSuccessMsg('');
  };

  // Batch action: reset all amounts for selected session
  const handleResetSessionPayments = () => {
    if (typeof selectedSessionIdx !== 'number') return;
    const sIdx = selectedSessionIdx;
    if (!confirm(`هل أنت متأكد من تصفير مبالغ الحصة ${sIdx + 1} لجميع التلاميذ؟`)) return;

    setPaymentsState((prev) => {
      const updated = { ...prev };
      realStudents.forEach((student) => {
        const arr = [...(updated[student.rowId] || [])];
        while (arr.length < sessionCount) arr.push('');
        arr[sIdx] = '';
        updated[student.rowId] = arr;
      });
      return updated;
    });
    setSaveSuccessMsg('');
  };

  // Save all changes
  const handleSaveAll = async () => {
    setIsSaving(true);
    setSaveSuccessMsg('');
    try {
      const updates = realStudents.map((s) => ({
        rowId: s.rowId,
        payments: paymentsState[s.rowId] || []
      }));

      batchUpdateAllSessionsPayments(group.groupId, updates);

      setSaveSuccessMsg('تم حفظ جميع الدفعات ومزامنتها بنجاح مع السحابة (Supabase) ✓');
      setTimeout(() => {
        setSaveSuccessMsg('');
      }, 4000);
    } catch (err) {
      console.error('Error saving session payments:', err);
      alert('حدث خطأ أثناء حفظ الدفعات. يرجى المحاولة مجدداً.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="m3-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="m3-card m3-card-elevated"
        style={{
          width: '100%',
          maxWidth: '1200px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: 'var(--md-shape-xl)',
          overflow: 'hidden',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--md-sys-color-on-primary-container)'
              }}
            >
              <Coins size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  تدقيق ودفعات الحصص — فوج {group.groupId}
                </h2>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)'
                  }}
                >
                  {group.subject}
                </span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', margin: 0 }}>
                الأستاذ: <strong>{group.teacherName}</strong> | تسعيرة الفوج: <strong>{totalGroupFee.toLocaleString()} دج</strong> (حصة: {standardSessionPrice.toLocaleString()} دج)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="m3-btn-icon"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* KPIs Snapshot Banner */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px',
            padding: '12px 22px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              {typeof selectedSessionIdx === 'number' ? `مجموع محصل (حصة ${selectedSessionIdx + 1})` : 'مجموع محصل (كامل الموسم)'}
            </span>
            <strong style={{ fontSize: '1.25rem', color: '#15803d' }}>
              {sessionStats.totalCollected.toLocaleString()} <span style={{ fontSize: '0.78rem' }}>دج</span>
            </strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              {typeof selectedSessionIdx === 'number' ? `عدد مسددي الحصة ${selectedSessionIdx + 1}` : 'مسددين بالكامل'}
            </span>
            <strong style={{ fontSize: '1.2rem', color: 'var(--md-sys-color-on-surface)' }}>
              {sessionStats.paidStudentsCount} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>/ {realStudents.length} تلميذ</span>
            </strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              {typeof selectedSessionIdx === 'number' ? `لم يسددوا في الحصة ${selectedSessionIdx + 1}` : 'عليهم ديون'}
            </span>
            <strong style={{ fontSize: '1.2rem', color: sessionStats.unpaidStudentsCount > 0 ? '#b91c1c' : '#15803d' }}>
              {sessionStats.unpaidStudentsCount} <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>تلميذ</span>
            </strong>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              إجمالي الديون المتبقية للفوج
            </span>
            <strong style={{ fontSize: '1.25rem', color: sessionStats.totalRemainingDebt > 0 ? '#b91c1c' : '#15803d' }}>
              {sessionStats.totalRemainingDebt.toLocaleString()} <span style={{ fontSize: '0.78rem' }}>دج</span>
            </strong>
          </div>
        </div>

        {/* Sessions Switcher Tabs */}
        <div
          style={{
            padding: '10px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface-variant)' }}>
            اختر الحصة:
          </span>

          {group.sessionDates.map((dateStr, idx) => {
            const isSelected = selectedSessionIdx === idx;
            const formattedDate = formatToYYYYMMDD(dateStr);
            const isToday = isSessionDateToday(formattedDate || dateStr);

            // Count how many students paid this session
            const sessionPaidCount = realStudents.filter((s) => {
              const amt = Number(paymentsState[s.rowId]?.[idx]) || 0;
              return amt > 0;
            }).length;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedSessionIdx(idx)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: 'var(--md-shape-full)',
                  border: isSelected ? '2px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: isSelected ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)',
                  color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                  fontWeight: isSelected ? 800 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>حصة {idx + 1}</span>
                {isToday && <span style={{ color: '#047857', fontWeight: 800 }}>★</span>}
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '10px',
                    backgroundColor: sessionPaidCount > 0 ? '#dcfce7' : 'var(--md-sys-color-surface-container-high)',
                    color: sessionPaidCount > 0 ? '#15803d' : 'var(--md-sys-color-outline)',
                    fontWeight: 700
                  }}
                >
                  {sessionPaidCount}/{realStudents.length}
                </span>
              </button>
            );
          })}

          {/* Matrix view button: All Sessions */}
          <button
            type="button"
            onClick={() => setSelectedSessionIdx('all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--md-shape-full)',
              border: selectedSessionIdx === 'all' ? '2px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
              backgroundColor: selectedSessionIdx === 'all' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)',
              color: selectedSessionIdx === 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
              fontWeight: selectedSessionIdx === 'all' ? 800 : 600,
              fontSize: '0.78rem',
              cursor: 'pointer',
              marginInlineStart: 'auto'
            }}
          >
            <ArrowUpDown size={14} />
            <span>جدول جميع الحصص (كشف شامل)</span>
          </button>
        </div>

        {/* Filter and Quick Batch Bar */}
        <div
          style={{
            padding: '10px 22px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)'
          }}
        >
          {/* Search + Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '260px' }}>
              <input
                type="text"
                placeholder="ابحث بالاسم، الهاتف أو المعرّف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="m3-input"
                style={{
                  paddingInlineStart: '32px',
                  paddingInlineEnd: searchQuery ? '28px' : '8px',
                  paddingBlock: '6px',
                  fontSize: '0.8rem'
                }}
              />
              <Search
                size={15}
                style={{
                  position: 'absolute',
                  insetInlineStart: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    insetInlineEnd: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--md-sys-color-outline)'
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter mode chips */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderRadius: 'var(--md-shape-full)',
                padding: '2px'
              }}
            >
              {[
                { id: 'all', label: 'الجميع' },
                { id: 'paid', label: 'مسدد' },
                { id: 'unpaid', label: 'غير مسدد' },
                { id: 'present', label: 'حاضر (P)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterMode(tab.id as any)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--md-shape-full)',
                    border: 'none',
                    backgroundColor: filterMode === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                    color: filterMode === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Batch Actions for Single Session */}
          {typeof selectedSessionIdx === 'number' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleBatchPayPresent}
                className="m3-btn m3-btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#ecfdf5',
                  color: '#065f46',
                  border: '1px solid #6ee7b7',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  padding: '5px 12px',
                  borderRadius: 'var(--md-shape-full)',
                  cursor: 'pointer'
                }}
                title={`تسجيل تسعيرة الحصة لكل تلميذ حاضر في الحصة ${selectedSessionIdx + 1}`}
              >
                <Sparkles size={14} color="#059669" />
                <span>تسديد الحصة لجميع الحاضرين ({standardSessionPrice} دج) ⚡</span>
              </button>

              <button
                type="button"
                onClick={handleResetSessionPayments}
                className="m3-btn m3-btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'transparent',
                  color: 'var(--md-sys-color-error)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 'var(--md-shape-full)',
                  cursor: 'pointer'
                }}
                title="تصفير مبالغ هذه الحصة"
              >
                <RotateCcw size={13} />
                <span>تصفير الحصة</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Students List Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 22px' }}>
          {filteredStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--md-sys-color-outline)' }}>
              لا يوجد تلاميذ مطابقين لمعايير البحث أو التصفية الحالية.
            </div>
          ) : typeof selectedSessionIdx === 'number' ? (
            /* ========================================================================= */
            /* SINGLE SESSION MODE: Focused list with quick chips and amount entry       */
            /* ========================================================================= */
            <div className="m3-table-container">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th>التلميذ</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>حالة الحضور</th>
                    <th style={{ minWidth: '250px', textAlign: 'center' }}>
                      المبلغ المسدد لحصة {selectedSessionIdx + 1}
                    </th>
                    <th style={{ width: '120px', textAlign: 'center' }}>المسدد (الإجمالي)</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>المطلوب</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>الدين</th>
                    <th style={{ width: '80px', textAlign: 'center' }}>وصل</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const sIdx = selectedSessionIdx;
                    const att = student.attendance[sIdx];
                    const currentVal = paymentsState[student.rowId]?.[sIdx] ?? '';
                    const studentFee = student.fee || totalGroupFee;
                    const studentSessionFee = Math.round(studentFee / sessionCount);

                    return (
                      <tr key={student.rowId}>
                        <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                          {idx + 1}
                        </td>

                        {/* Student Name & Phone */}
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                            {student.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                            {student.phone || '—'} {student.barcode ? `• ${student.barcode}` : ''}
                          </div>
                        </td>

                        {/* Attendance in this session */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={
                              att === 'P'
                                ? 'm3-chip-p'
                                : att === 'A'
                                ? 'm3-chip-a'
                                : att === 'M'
                                ? 'm3-chip-m'
                                : undefined
                            }
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '2px 8px',
                              borderRadius: 'var(--md-shape-sm)',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              border: !att ? '1px solid var(--md-sys-color-outline-variant)' : undefined,
                              color: !att ? 'var(--md-sys-color-outline)' : undefined
                            }}
                          >
                            {att === 'P' ? 'P حاضر' : att === 'A' ? 'A غائب' : att === 'M' ? 'M تعويض' : '— لم يسجل'}
                          </span>
                        </td>

                        {/* Amount Input for this session + Quick Chips */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              step="50"
                              min="0"
                              placeholder="0"
                              value={currentVal}
                              onChange={(e) => handlePaymentChange(student.rowId, sIdx, e.target.value)}
                              className="m3-input"
                              style={{
                                width: '90px',
                                padding: '4px 8px',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                textAlign: 'center',
                                direction: 'ltr'
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>دج</span>

                            {/* Quick Presets */}
                            <button
                              type="button"
                              onClick={() => setStudentSessionAmount(student.rowId, sIdx, studentSessionFee)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                borderRadius: 'var(--md-shape-sm)',
                                border: '1px solid #6ee7b7',
                                backgroundColor: '#ecfdf5',
                                color: '#065f46',
                                cursor: 'pointer'
                              }}
                              title={`تسديد كامل حصة هذا التلميذ (${studentSessionFee} دج)`}
                            >
                              كامل ({studentSessionFee})
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentSessionAmount(student.rowId, sIdx, Math.round(studentSessionFee / 2))}
                              style={{
                                padding: '3px 8px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                borderRadius: 'var(--md-shape-sm)',
                                border: '1px solid #cbd5e1',
                                backgroundColor: 'var(--md-sys-color-surface-container)',
                                color: 'var(--md-sys-color-on-surface)',
                                cursor: 'pointer'
                              }}
                              title={`تسديد نصف حصة (${Math.round(studentSessionFee / 2)} دج)`}
                            >
                              نصف ({Math.round(studentSessionFee / 2)})
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentSessionAmount(student.rowId, sIdx, '')}
                              style={{
                                padding: '3px 6px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                borderRadius: 'var(--md-shape-sm)',
                                border: '1px solid #fca5a5',
                                backgroundColor: '#fef2f2',
                                color: '#b91c1c',
                                cursor: 'pointer'
                              }}
                              title="تفريغ المبلغ (0)"
                            >
                              0
                            </button>
                          </div>
                        </td>

                        {/* Total Received so far */}
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#15803d' }}>
                          {student.totalReceived.toLocaleString()} دج
                        </td>

                        {/* Student Fee */}
                        <td style={{ textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)' }}>
                          {student.fee.toLocaleString()} دج
                        </td>

                        {/* Debt */}
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: 800,
                              color: student.debt > 0 ? '#b91c1c' : '#15803d'
                            }}
                          >
                            {student.debt > 0 ? `${student.debt.toLocaleString()} دج` : 'مسدد ✓'}
                          </span>
                        </td>

                        {/* Actions / Receipt */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setStudentForIndividualPayment(student)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: 'var(--md-sys-color-primary)',
                              cursor: 'pointer',
                              padding: '4px'
                            }}
                            title="فتح نافذة الدفع المفصلة وطباعة الوصل"
                          >
                            <Printer size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ========================================================================= */
            /* ALL SESSIONS MATRIX MODE: Full spreadsheet view for all sessions         */
            /* ========================================================================= */
            <div className="m3-table-container">
              <table className="m3-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th style={{ minWidth: '160px' }}>التلميذ</th>
                    {group.sessionDates.map((d, i) => (
                      <th key={i} style={{ textAlign: 'center', minWidth: '95px' }}>
                        حصة {i + 1}
                      </th>
                    ))}
                    <th style={{ textAlign: 'center', minWidth: '100px' }}>المجموع المسدد</th>
                    <th style={{ textAlign: 'center', minWidth: '80px' }}>المطلوب</th>
                    <th style={{ textAlign: 'center', minWidth: '90px' }}>الدين</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, idx) => {
                    const studentPayments = paymentsState[student.rowId] || [];

                    return (
                      <tr key={student.rowId}>
                        <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{student.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                            {student.phone || '—'}
                          </div>
                        </td>

                        {/* Each Session Input */}
                        {Array.from({ length: sessionCount }).map((_, sIdx) => {
                          const val = studentPayments[sIdx] ?? '';
                          const att = student.attendance[sIdx];

                          return (
                            <td key={sIdx} style={{ textAlign: 'center', padding: '4px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <input
                                  type="number"
                                  step="50"
                                  min="0"
                                  placeholder="0"
                                  value={val}
                                  onChange={(e) => handlePaymentChange(student.rowId, sIdx, e.target.value)}
                                  className="m3-input"
                                  style={{
                                    width: '78px',
                                    padding: '3px 4px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textAlign: 'center',
                                    direction: 'ltr',
                                    borderColor: val && Number(val) > 0 ? '#10b981' : undefined,
                                    backgroundColor: val && Number(val) > 0 ? '#f0fdf4' : undefined
                                  }}
                                />
                                {att && (
                                  <span
                                    style={{
                                      fontSize: '0.62rem',
                                      fontWeight: 800,
                                      color: att === 'P' ? '#15803d' : att === 'A' ? '#b91c1c' : '#b45309'
                                    }}
                                  >
                                    {att === 'P' ? 'حاضر' : att === 'A' ? 'غائب' : att === 'M' ? 'تعويض' : ''}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}

                        {/* Live Total Received */}
                        <td style={{ textAlign: 'center', fontWeight: 800, color: '#15803d' }}>
                          {student.totalReceived.toLocaleString()} دج
                        </td>

                        {/* Fee */}
                        <td style={{ textAlign: 'center' }}>
                          {student.fee.toLocaleString()}
                        </td>

                        {/* Debt */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: student.debt > 0 ? '#b91c1c' : '#15803d' }}>
                            {student.debt > 0 ? `${student.debt.toLocaleString()} دج` : 'مسدد ✓'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              className="m3-btn m3-btn-outlined m3-btn-sm"
            >
              إلغاء وإغلاق
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              يتم حفظ التغييرات فوراً في الذاكرة المحلية وقاعدة البيانات السحابية
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {saveSuccessMsg && (
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d' }}>
                {saveSuccessMsg}
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="m3-btn m3-btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 22px',
                fontWeight: 800,
                fontSize: '0.88rem',
                boxShadow: '0 2px 8px rgba(0, 99, 155, 0.4)',
                cursor: isSaving ? 'default' : 'pointer'
              }}
            >
              <Save size={16} />
              <span>{isSaving ? 'جاري الحفظ والمزامنة...' : 'حفظ التغييرات في السحابة 💾'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Individual Student Payment Modal if opened from list */}
      {studentForIndividualPayment && (
        <StudentPaymentModal
          groupId={group.groupId}
          student={studentForIndividualPayment}
          onClose={() => setStudentForIndividualPayment(null)}
        />
      )}
    </div>
  );
}

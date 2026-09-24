'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StudentRecord, AttendanceStatus } from '../types';
import { ArrowLeftRight, X, Sparkles, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { playSuccessChime } from '../utils/soundUtils';
import { getDefaultSessionIndex } from '../utils/sessionUtils';

interface Props {
  student: StudentRecord;
  currentGroupId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ChangeStudentGroupModal({
  student,
  currentGroupId,
  onClose,
  onSuccess
}: Props) {
  const { data, transferStudent } = useApp();
  const currentGroup = data.groupData[currentGroupId];

  // Destination groups (excluding current group)
  const availableGroups = useMemo(() => {
    return data.groups.filter((g) => g.id.trim().toUpperCase() !== currentGroupId.trim().toUpperCase());
  }, [data.groups, currentGroupId]);

  // Sort groups: same subject first
  const sortedGroups = useMemo(() => {
    const curSubj = currentGroup?.subject?.trim().toLowerCase();
    return [...availableGroups].sort((a, b) => {
      const aSame = a.subject?.trim().toLowerCase() === curSubj;
      const bSame = b.subject?.trim().toLowerCase() === curSubj;
      if (aSame && !bSame) return -1;
      if (!aSame && bSame) return 1;
      return a.id.localeCompare(b.id);
    });
  }, [availableGroups, currentGroup?.subject]);

  const [targetGroupId, setTargetGroupId] = useState<string>(() => sortedGroups[0]?.id || '');
  const targetGroupSheet = data.groupData[targetGroupId];

  const defaultStartSession = useMemo(() => {
    if (!targetGroupSheet) return 0;
    return Math.max(0, getDefaultSessionIndex(targetGroupSheet, new Date()));
  }, [targetGroupSheet]);

  const [targetSessionIdx, setTargetSessionIdx] = useState<number>(defaultStartSession);

  // Financial & Session Breakdown Calculations
  const fromSessionCount = currentGroup?.sessionDates?.length || currentGroup?.sessionCount || 4;
  const fromTier = data.pricingTiers?.find((t) => t.id === currentGroup?.type) || {
    price: 2500,
    teacherRate: 1500,
    schoolRate: 1000,
    sessions: 4
  };
  const fromBasePrice =
    typeof currentGroup?.studentFee === 'number' && currentGroup.studentFee > 0
      ? currentGroup.studentFee
      : fromTier.price;
  const fromPerSessionPrice = Math.round(fromBasePrice / fromSessionCount);

  // Completed sessions in old group
  const completedAttendanceCount = useMemo(() => {
    return (student.attendance || [])
      .slice(0, fromSessionCount)
      .filter((st) => ['P', 'A', 'M', 'C', 'ح', 'غ', 'م'].includes(String(st || '').trim().toUpperCase()))
      .length;
  }, [student.attendance, fromSessionCount]);

  const remainingOldSessionsCount = Math.max(0, fromSessionCount - completedAttendanceCount);

  let feeForCompletedInOld = completedAttendanceCount * fromPerSessionPrice;
  if (student.discount === '0') {
    feeForCompletedInOld = 0;
  } else if (student.discount === '0.8') {
    feeForCompletedInOld = Math.round(completedAttendanceCount * fromPerSessionPrice * 0.8);
  }

  const oldTotalReceived = useMemo(() => {
    return (
      (student.payments || []).reduce<number>((sum, p) => {
        const val = typeof p === 'number' ? p : parseFloat(String(p));
        return sum + (isNaN(val) ? 0 : val);
      }, 0) || student.totalReceived || 0
    );
  }, [student.payments, student.totalReceived]);

  const creditToTransfer = Math.max(0, oldTotalReceived - feeForCompletedInOld);
  const keptPaymentInOld = oldTotalReceived - creditToTransfer;

  // New group finances
  const toSessionCount = targetGroupSheet?.sessionDates?.length || targetGroupSheet?.sessionCount || 4;
  const toTier = data.pricingTiers?.find((t) => t.id === targetGroupSheet?.type) || {
    price: 2500,
    teacherRate: 1500,
    schoolRate: 1000,
    sessions: 4
  };
  const toBasePrice =
    typeof targetGroupSheet?.studentFee === 'number' && targetGroupSheet.studentFee > 0
      ? targetGroupSheet.studentFee
      : toTier.price;
  const toPerSessionPrice = Math.round(toBasePrice / toSessionCount);

  const applicableSessionsInNew = Math.max(0, toSessionCount - targetSessionIdx);
  let expectedFeeInNew = applicableSessionsInNew * toPerSessionPrice;
  if (student.discount === '0') {
    expectedFeeInNew = 0;
  } else if (student.discount === '0.8') {
    expectedFeeInNew = Math.round(applicableSessionsInNew * toPerSessionPrice * 0.8);
  }

  const expectedDebtInNew = Math.max(0, expectedFeeInNew - creditToTransfer);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmTransfer = () => {
    if (!targetGroupId) {
      alert('يرجى اختيار الفوج الوجهة');
      return;
    }

    setIsSubmitting(true);
    const ok = transferStudent(currentGroupId, targetGroupId, student.rowId, targetSessionIdx, {
      name: student.name,
      barcode: student.barcode
    });

    if (ok) {
      playSuccessChime();
      if (onSuccess) onSuccess();
      onClose();
    } else {
      alert('تعذر إتمام عملية نقل التلميذ');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 300,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--md-shape-xl)',
          width: '100%',
          maxWidth: '560px',
          boxShadow: 'var(--md-elevation-5)',
          direction: 'rtl',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#4338ca',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeftRight size={22} color="#ffffff" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900 }}>
                تغيير فوج التلميذ (Group Change)
              </h3>
              <div style={{ fontSize: '0.78rem', color: '#c7d2fe', marginTop: '2px' }}>
                نقل التلميذ مع الحفاظ الكامل على الحضور والمدفوعات السابقة
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="m3-btn-icon"
            style={{ color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Student Banner */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px'
            }}
          >
            <div>
              <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{student.name}</strong>
              <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                الهاتف: {student.phone || '—'} • الباركود: {student.barcode || '—'}
              </div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  border: '1px solid #fca5a5'
                }}
              >
                الفوج الحالي: {currentGroupId} ({currentGroup?.subject || ''})
              </span>
            </div>
          </div>

          {/* Destination Group & Start Session Select */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                الفوج الجديد (الوجهة):
              </label>
              <select
                value={targetGroupId}
                onChange={(e) => {
                  setTargetGroupId(e.target.value);
                  const sheet = data.groupData[e.target.value];
                  if (sheet) {
                    setTargetSessionIdx(Math.max(0, getDefaultSessionIndex(sheet, new Date())));
                  }
                }}
                className="m3-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem', fontWeight: 800 }}
              >
                {sortedGroups.map((g) => {
                  const isSameSubj = g.subject?.trim().toLowerCase() === currentGroup?.subject?.trim().toLowerCase();
                  return (
                    <option key={g.id} value={g.id}>
                      فوج {g.id} ({g.subject}{g.teacherName ? ` - ${g.teacherName}` : ''}) {isSameSubj ? '⭐ نفس المادة' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                يبدأ من الحصة (N):
              </label>
              <select
                value={targetSessionIdx}
                onChange={(e) => setTargetSessionIdx(Number(e.target.value))}
                className="m3-input"
                style={{ width: '100%', height: '36px', fontSize: '0.82rem', fontWeight: 800 }}
              >
                {Array.from({ length: toSessionCount }).map((_, i) => (
                  <option key={i} value={i}>
                    الحصة {i + 1} (تُسجل كـ N)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Financial Breakdown Preview */}
          <div
            style={{
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="#4f46e5" />
              <span>معاينة الأثر المالي وتوزيع الحصص:</span>
            </div>

            {/* Grid 1: Old Group */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '0.76rem',
                color: '#334155',
                lineHeight: 1.6
              }}
            >
              <div>• <strong>الفوج السابق ({currentGroupId}):</strong> حضر <strong>{completedAttendanceCount}</strong> من أصل {fromSessionCount} حصص. الحصص المتبقية ({remainingOldSessionsCount}) تصبح <strong>CH</strong>.</div>
              <div>• <strong>المستحق عن الحضور السابق:</strong> {feeForCompletedInOld.toLocaleString()} دج | <strong>المسدد في الفوج السابق:</strong> {oldTotalReceived.toLocaleString()} دج.</div>
            </div>

            {/* Grid 2: Credit Transfer */}
            <div
              style={{
                backgroundColor: creditToTransfer > 0 ? '#ecfdf5' : '#f8fafc',
                border: `1px solid ${creditToTransfer > 0 ? '#6ee7b7' : '#e2e8f0'}`,
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '0.78rem',
                color: creditToTransfer > 0 ? '#065f46' : '#64748b',
                fontWeight: 700
              }}
            >
              {creditToTransfer > 0 ? (
                <span>✓ سيتم تحويل رصيد متبقي قدره <strong>{creditToTransfer.toLocaleString()} دج</strong> إلى الفوج الجديد تلقائياً.</span>
              ) : (
                <span>• لا يوجد رصيد زائد لتحويله (المبلغ المسدد يغطي الحصص السابقة التي حضرها التلميذ فقط).</span>
              )}
            </div>

            {/* Grid 3: New Group Expectations */}
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '0.76rem',
                color: '#334155',
                lineHeight: 1.6
              }}
            >
              <div>• <strong>الفوج الجديد ({targetGroupId}):</strong> سيبدأ من الحصة {targetSessionIdx + 1} (تُسجل كـ <strong>N</strong>).</div>
              <div>• <strong>عدد الحصص المستحقة:</strong> {applicableSessionsInNew} حصص (بقيمة {expectedFeeInNew.toLocaleString()} دج).</div>
              <div style={{ marginTop: '2px', fontWeight: 800, color: expectedDebtInNew > 0 ? '#b91c1c' : '#15803d' }}>
                • <strong>صافي الدين في الفوج الجديد:</strong> {expectedDebtInNew.toLocaleString()} دج
              </div>
            </div>
          </div>

          {/* Official Business Rule Confirmation Notice */}
          <div
            style={{
              backgroundColor: '#fffbeb',
              border: '1.5px solid #fde68a',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <ShieldAlert size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.5, fontWeight: 700 }}>
              تغيير الفوج سيحافظ على سجل الحضور والمدفوعات السابق للتلميذ. الحصص المتبقية في الفوج القديم ستُسجل كـ <strong>CH</strong>، وأول حصة في الفوج الجديد ستُسجل كـ <strong>N</strong>.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="m3-btn m3-btn-text"
            style={{ fontSize: '0.82rem', fontWeight: 700 }}
            disabled={isSubmitting}
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirmTransfer}
            className="m3-btn m3-btn-primary"
            style={{
              backgroundColor: '#4338ca',
              borderColor: '#4338ca',
              fontSize: '0.84rem',
              fontWeight: 800,
              padding: '6px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            disabled={isSubmitting || !targetGroupId}
          >
            <ArrowLeftRight size={16} />
            <span>تأكيد نقل التلميذ الآن (CH / N)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

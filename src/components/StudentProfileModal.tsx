'use client';

import React, { useState } from 'react';
import { StudentRecord, GroupSheet } from '../types';
import { useApp, calcStudentFinancesPure } from '../context/AppContext';
import {
  X,
  User,
  Phone,
  BookOpen,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Receipt,
  GraduationCap,
  Sparkles,
  ExternalLink,
  IdCard
} from 'lucide-react';
import Link from 'next/link';
import StudentPaymentModal from './StudentPaymentModal';
import ThermalReceiptsModal from './ThermalReceiptsModal';
import StudentBadgeModal from './StudentBadgeModal';
import { formatGroupTime, isSummaryRow } from '../utils/sessionUtils';
import { normalizeArabicName } from '../utils/barcodeUtils';

interface Props {
  student: StudentRecord;
  groupId: string;
  onClose: () => void;
}

export default function StudentProfileModal({ student, groupId, onClose }: Props) {
  const { data } = useApp();
  const group = data.groupData[groupId] as GroupSheet | undefined;
  const groupMeta = data.groups.find((g) => g.id === groupId);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);

  // Find all enrollments for this student across all groups with live pure finances
  const allEnrollments = React.useMemo(() => {
    const list: { groupId: string; groupSheet: GroupSheet; studentRecord: StudentRecord }[] = [];
    const normStudentName = normalizeArabicName(student.name);
    const barcodeUpper = (student.barcode || '').toUpperCase();

    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      const match = gSheet.students.find(
        (s) =>
          !isSummaryRow(s, gid) &&
          ((s.rowId === student.rowId && gid === groupId) ||
           (barcodeUpper && s.barcode && s.barcode.toUpperCase() === barcodeUpper) ||
           (s.name && normalizeArabicName(s.name) === normStudentName))
      );
      if (match) {
        const isVipGroup =
          gid.toUpperCase().startsWith('BACV') ||
          gid.toUpperCase().includes('VIP') ||
          Boolean(gSheet.isVip) ||
          Boolean(gSheet.type?.includes('10000'));
        const targetType = gSheet.type || (isVipGroup ? '4-10000' : '4-2500');

        const liveFinances = calcStudentFinancesPure(
          match,
          targetType,
          data.pricingTiers,
          { ...gSheet, groupId: gid, isVip: isVipGroup }
        );

        list.push({ groupId: gid, groupSheet: gSheet, studentRecord: liveFinances });
      }
    });
    return list;
  }, [data.groupData, data.pricingTiers, student, groupId]);

  const currentStudent = allEnrollments.find((e) => e.groupId === groupId)?.studentRecord || student;
  const totalCenterPaid = allEnrollments.reduce((sum, item) => sum + (item.studentRecord.totalReceived || 0), 0);
  const totalCenterRequired = allEnrollments.reduce((sum, item) => sum + (item.studentRecord.fee || 0), 0);
  const totalCenterDebt = allEnrollments.reduce((sum, item) => sum + (item.studentRecord.debt || 0), 0);

  const sessionCount = group?.sessionCount || group?.sessionDates?.length || 4;
  const sessionDates = group?.sessionDates || [];

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ padding: '12px' }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '740px',
          width: '95%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '12px',
            marginBottom: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  {student.name}
                </h2>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-sm)',
                    backgroundColor: totalCenterDebt > 0 ? 'var(--status-absent-container)' : 'var(--status-present-container)',
                    color: totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)',
                    border: `1px solid ${totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)'}`
                  }}
                >
                  {totalCenterDebt > 0 ? `إجمالي الدين: ${totalCenterDebt.toLocaleString()} دج` : 'مسدد بالكامل ✓'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={13} />
                  {student.phone || 'لا يوجد هاتف مسجل'}
                </span>
                <span>•</span>
                <span>المعرّف: <strong>#{student.rowId}</strong></span>
                <span>•</span>
                <span>مسجل في <strong>{allEnrollments.length}</strong> {allEnrollments.length > 1 ? 'أفواج' : 'فوج'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', paddingInlineEnd: '4px' }}>
          {/* Quick Balance Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-shape-sm)',
                padding: '10px 12px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '3px' }}>
                إجمالي المطلوب (جميع الأفواج)
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                {totalCenterRequired.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--status-present-container)',
                border: '1px solid var(--status-present)',
                borderRadius: 'var(--md-shape-sm)',
                padding: '10px 12px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--status-present)', marginBottom: '3px', fontWeight: 700 }}>
                مجموع المبالغ المسددة
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-present)' }}>
                {totalCenterPaid.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: totalCenterDebt > 0 ? 'var(--status-absent-container)' : 'var(--md-sys-color-surface-container)',
                border: `1px solid ${totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-outline-variant)'}`,
                borderRadius: 'var(--md-shape-sm)',
                padding: '10px 12px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.75rem', color: totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface-variant)', marginBottom: '3px', fontWeight: 700 }}>
                إجمالي الدين المتبقي
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
                {totalCenterDebt > 0 ? `${totalCenterDebt.toLocaleString()} دج` : '0 دج (خالص)'}
              </div>
            </div>
          </div>

          {/* Group & Course Info Card */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-shape-sm)',
              padding: '12px 14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} color="var(--md-sys-color-primary)" />
                بيانات الفوج الحالي: <strong style={{ color: 'var(--md-sys-color-primary)' }}>{groupId}</strong>
                {group?.isVip && <span className="m3-chip m3-chip-vip">VIP خاص</span>}
              </span>

              <Link
                href="/attendance"
                className="m3-btn-text"
                style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--md-sys-color-primary)' }}
              >
                <span>فتح كشف الحضور</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>المادة:</span>
                <strong>{group?.subject || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>الأستاذ:</span>
                <strong>{group?.teacherName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>الموعد الأسبوعي:</span>
                <strong>{group?.day1} ({formatGroupTime(group?.time1) || '08:00'})</strong>
              </div>
              <div>
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>نوع التسجيل:</span>
                <strong>
                  {student.discount === '0'
                    ? 'معفى بالكامل'
                    : student.discount === '0.8'
                    ? 'تخفيض 20%'
                    : student.discount === 'تعويض'
                    ? 'تعويض'
                    : 'تسجيل عادي (100%)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Attendance Breakdown (Session-by-Session) */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-shape-sm)',
              padding: '12px 14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={16} color="var(--md-sys-color-primary)" />
                سجل حضور الحصص التفصيلي:
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                نسبة الحضور: {student.totalAttendance || 0} من أصل {sessionCount} حصص (
                {Math.round(((student.totalAttendance || 0) / (sessionCount || 1)) * 100)}%)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sessionCount}, 1fr)`, gap: '8px' }}>
              {Array.from({ length: sessionCount }).map((_, sIdx) => {
                const status = student.attendance?.[sIdx] || '';
                const dateStr = sessionDates[sIdx] || `حصة ${sIdx + 1}`;
                const isPresent = status === 'P';
                const isAbsent = status === 'A';
                const isMakeup = status === 'M';

                return (
                  <div
                    key={sIdx}
                    style={{
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: 'var(--md-shape-sm)',
                      padding: '8px 6px',
                      textAlign: 'center',
                      backgroundColor: isPresent
                        ? 'var(--status-present-container)'
                        : isAbsent
                        ? 'var(--status-absent-container)'
                        : isMakeup
                        ? 'var(--status-makeup-container)'
                        : 'var(--md-sys-color-surface-container)'
                    }}
                  >
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, marginBottom: '2px', color: 'var(--md-sys-color-on-surface)' }}>
                      ح {sIdx + 1}
                    </div>
                    <div
                      style={{
                        fontSize: '0.65rem',
                        color: 'var(--md-sys-color-on-surface-variant)',
                        marginBottom: '6px',
                        direction: 'ltr',
                        unicodeBidi: 'plaintext'
                      }}
                    >
                      {dateStr}
                    </div>
                    <div>
                      {isPresent ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-present)' }}>حاضر ✓</span>
                      ) : isAbsent ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-absent)' }}>غائب ✕</span>
                      ) : isMakeup ? (
                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-makeup)' }}>تعويض</span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-outline)' }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Financial Breakdown & Installments History */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-shape-sm)',
              padding: '12px 14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CreditCard size={16} color="var(--md-sys-color-primary)" />
                تفاصيل الدفعات والتسديد (سجل المستلم):
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                المطلوب: <strong>{student.fee?.toLocaleString()} دج</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
              {(student.payments || []).map((pay, pIdx) => {
                const amount = Number(pay) || 0;
                return (
                  <div
                    key={pIdx}
                    style={{
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: 'var(--md-shape-sm)',
                      padding: '8px 10px',
                      backgroundColor: amount > 0 ? 'var(--md-sys-color-surface-container-lowest)' : 'transparent',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '2px' }}>
                      الدفعة {pIdx + 1} (المستلم {pIdx + 1})
                    </div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: amount > 0 ? 'var(--status-present)' : 'var(--md-sys-color-outline)' }}>
                      {amount > 0 ? `${amount.toLocaleString()} دج` : '0 دج'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Enrolled Groups List (if in multiple groups) */}
          {allEnrollments.length > 1 && (
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: 'var(--md-shape-sm)',
                padding: '12px 14px'
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.88rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={16} color="var(--md-sys-color-primary)" />
                جميع الأفواج المسجل بها التلميذ في المركز ({allEnrollments.length} أفواج):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allEnrollments.map((enr) => (
                  <div
                    key={enr.groupId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 'var(--md-shape-sm)',
                      backgroundColor: enr.groupId === groupId ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
                      border: enr.groupId === groupId ? '1px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ color: enr.groupId === groupId ? 'var(--md-sys-color-primary)' : undefined }}>
                        فوج {enr.groupId}
                      </strong>
                      <span>• {enr.groupSheet.subject}</span>
                      <span>({enr.groupSheet.teacherName})</span>
                      {enr.groupSheet.isVip && <span className="m3-chip m3-chip-vip">VIP</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span>المسدد: <strong style={{ color: 'var(--status-present)' }}>{enr.studentRecord.totalReceived.toLocaleString()} دج</strong></span>
                      <span>الدين: <strong style={{ color: enr.studentRecord.debt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
                        {enr.studentRecord.debt > 0 ? `${enr.studentRecord.debt.toLocaleString()} دج` : 'خالص ✓'}
                      </strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            paddingTop: '12px',
            marginTop: '12px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsBadgeModalOpen(true)}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ea580c', borderColor: '#fdba74' }}
              title="معاينة وطباعة بطاقة وشارة التلميذ المعتمدة CR80 PVC"
            >
              <IdCard size={15} />
              <span>بطاقة التلميذ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsThermalModalOpen(true)}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Printer size={15} />
              <span>طباعة وصل حراري (80mm)</span>
            </button>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              className="m3-btn m3-btn-primary m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Receipt size={15} />
              <span>تسجيل دفعة / تعديل المبالغ</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="m3-btn m3-btn-tonal m3-btn-sm"
          >
            إغلاق الملف
          </button>
        </div>
      </div>

      {/* Embedded Sub-Modals */}
      {isPaymentModalOpen && (
        <StudentPaymentModal
          groupId={groupId}
          student={student}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}

      {isThermalModalOpen && group && (
        <ThermalReceiptsModal
          group={group}
          onClose={() => setIsThermalModalOpen(false)}
        />
      )}

      {isBadgeModalOpen && (
        <StudentBadgeModal
          student={currentStudent}
          groupId={groupId}
          allGroups={allEnrollments.map((e) => e.groupId)}
          onClose={() => setIsBadgeModalOpen(false)}
        />
      )}
    </div>
  );
}

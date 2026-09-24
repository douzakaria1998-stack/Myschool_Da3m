'use client';

import React, { useState } from 'react';
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
  IdCard,
  Edit3,
  Check,
  Trash2,
  Wallet,
  History,
  Coins,
  ArrowRightLeft,
  RotateCcw
} from 'lucide-react';
import { StudentRecord, GroupSheet, DiscountType } from '../types';
import Link from 'next/link';
import StudentPaymentModal from './StudentPaymentModal';
import ThermalReceiptsModal from './ThermalReceiptsModal';
import StudentBadgeModal from './StudentBadgeModal';
import { formatGroupTime, isSummaryRow } from '../utils/sessionUtils';
import { normalizeArabicName } from '../utils/barcodeUtils';
import { getStudentPaymentAccount } from '../utils/studentAccountUtils';

interface Props {
  student: StudentRecord;
  groupId: string;
  onClose: () => void;
}

export default function StudentProfileModal({ student, groupId, onClose }: Props) {
  const { data, updateStudent, deleteStudent, applyStudentCredit } = useApp();
  const group = data.groupData[groupId] as GroupSheet | undefined;
  const groupMeta = data.groups.find((g) => g.id === groupId);

  const [activeTab, setActiveTab] = useState<'overview' | 'account'>('overview');
  const [creditApplySuccess, setCreditApplySuccess] = useState('');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);

  // Edit Student Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(student.name);
  const [editPhone, setEditPhone] = useState(student.phone || '');
  const [editBarcode, setEditBarcode] = useState(student.barcode || '');
  const [editDiscount, setEditDiscount] = useState<DiscountType>(student.discount || '1');
  const [syncAllGroups, setSyncAllGroups] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  // Central Student Payment Account (tracks Money Account vs Attendance Account)
  const paymentAccount = React.useMemo(() => {
    return getStudentPaymentAccount(student.name, student.barcode, data);
  }, [student.name, student.barcode, data]);

  const sessionCount = group?.sessionCount || group?.sessionDates?.length || 4;
  const sessionDates = group?.sessionDates || [];

  // Sync edit form state when student changes
  React.useEffect(() => {
    setEditName(currentStudent.name);
    setEditPhone(currentStudent.phone || '');
    setEditBarcode(currentStudent.barcode || '');
    setEditDiscount(currentStudent.discount || '1');
  }, [currentStudent]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editName.trim();
    if (!cleanName) return;

    setIsSaving(true);
    const cleanPhone = editPhone.trim();
    const cleanBarcode = editBarcode.trim();

    if (syncAllGroups && allEnrollments.length > 0) {
      allEnrollments.forEach((enrollment) => {
        const isCurrentGroup = enrollment.groupId === groupId;
        updateStudent(enrollment.groupId, enrollment.studentRecord.rowId, {
          name: cleanName,
          phone: cleanPhone,
          barcode: cleanBarcode,
          ...(isCurrentGroup ? { discount: editDiscount } : {})
        });
      });
    } else {
      updateStudent(groupId, student.rowId, {
        name: cleanName,
        phone: cleanPhone,
        barcode: cleanBarcode,
        discount: editDiscount
      });
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsEditing(false);
    }, 600);
  };

  const handleDeleteStudent = () => {
    if (window.confirm(`هل أنت متأكد من حذف التلميذ "${currentStudent.name}" نهائياً من الفوج ${groupId}؟`)) {
      deleteStudent(groupId, student.rowId);
      onClose();
    }
  };

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`m3-btn ${isEditing ? 'm3-btn-primary' : 'm3-btn-tonal'} m3-btn-sm`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: 'var(--md-shape-sm)',
                fontWeight: 700
              }}
              title="تعديل بيانات التلميذ (الاسم، الهاتف، الباركود، التخفيض)"
            >
              <Edit3 size={15} />
              <span>{isEditing ? 'إلغاء التعديل' : 'تعديل البيانات'}</span>
            </button>

            <button
              onClick={onClose}
              className="m3-btn-text"
              style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Edit Student Profile Panel */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="m3-card"
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1.5px solid var(--md-sys-color-primary)',
              borderRadius: 'var(--md-shape-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '14px',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="var(--md-sys-color-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  تعديل بيانات التلميذ
                </h3>
              </div>
              {saveSuccess && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--status-present)',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>تم حفظ التعديلات بنجاح!</span>
                </span>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '5px' }}>
                  الاسم واللقب <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="m3-input"
                  style={{ width: '100%', fontWeight: 700 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '5px' }}>
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="m3-input"
                  style={{ width: '100%', direction: 'ltr', textAlign: 'right' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '5px' }}>
                  رقم الباركود / المعرّف (Barcode)
                </label>
                <input
                  type="text"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                  placeholder="مثال: STU-12345"
                  className="m3-input"
                  style={{ width: '100%', direction: 'ltr', textAlign: 'right', fontWeight: 700 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '5px' }}>
                  نوع التخفيض في هذا الفوج ({groupId})
                </label>
                <select
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(e.target.value as any)}
                  className="m3-select"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <option value="1">عادي - تسديد 100%</option>
                  <option value="0.8">تخفيض - تسديد 80%</option>
                  <option value="0">معفى بالكامل - 0%</option>
                  <option value="تعويض">حصة تعويض</option>
                </select>
              </div>
            </div>

            {/* Sync all enrollments checkbox if enrolled in multiple groups */}
            {allEnrollments.length > 1 && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  cursor: 'pointer',
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <input
                  type="checkbox"
                  checked={syncAllGroups}
                  onChange={(e) => setSyncAllGroups(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--md-sys-color-primary)' }}
                />
                <span>تطبيق تعديل الاسم، الهاتف والباركود تلقائياً على جميع أفواج التلميذ ({allEnrollments.length} أفواج)</span>
              </label>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleDeleteStudent}
                className="m3-btn-text"
                style={{
                  color: 'var(--md-sys-color-error)',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="حذف التلميذ من الفوج الحالي"
              >
                <Trash2 size={15} />
                <span>حذف من هذا الفوج</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ borderRadius: '8px' }}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="m3-btn m3-btn-primary m3-btn-sm"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    backgroundColor: 'var(--status-present)',
                    color: '#ffffff'
                  }}
                >
                  <Check size={16} />
                  <span>{isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', paddingInlineEnd: '4px' }}>
          {/* Quick Balance Cards (4 Metrics) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
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
              <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '3px' }}>
                إجمالي المطلوب (المستحق)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
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
              <div style={{ fontSize: '0.74rem', color: 'var(--status-present)', marginBottom: '3px', fontWeight: 700 }}>
                مجموع المبالغ المسددة
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--status-present)' }}>
                {totalCenterPaid.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: paymentAccount.availableBalance > 0 ? '#ecfdf5' : 'var(--md-sys-color-surface-container)',
                border: `1px solid ${paymentAccount.availableBalance > 0 ? '#059669' : 'var(--md-sys-color-outline-variant)'}`,
                borderRadius: 'var(--md-shape-sm)',
                padding: '10px 12px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '0.74rem', color: paymentAccount.availableBalance > 0 ? '#065f46' : 'var(--md-sys-color-on-surface-variant)', marginBottom: '3px', fontWeight: 700 }}>
                الرصيد المتاح (فائض)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: paymentAccount.availableBalance > 0 ? '#047857' : 'var(--md-sys-color-on-surface)' }}>
                {paymentAccount.availableBalance > 0 ? `+${paymentAccount.availableBalance.toLocaleString()} دج` : '0 دج'}
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
              <div style={{ fontSize: '0.74rem', color: totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface-variant)', marginBottom: '3px', fontWeight: 700 }}>
                إجمالي الدين المتبقي
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: totalCenterDebt > 0 ? 'var(--status-absent)' : 'var(--status-present)' }}>
                {totalCenterDebt > 0 ? `${totalCenterDebt.toLocaleString()} دج` : '0 دج (خالص)'}
              </div>
            </div>
          </div>

          {/* Tab Navigation Switcher */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--md-sys-color-outline-variant)', paddingBottom: '2px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 800,
                border: 'none',
                borderBottom: activeTab === 'overview' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent',
                backgroundColor: activeTab === 'overview' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                color: activeTab === 'overview' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <BookOpen size={15} />
              <span>الفوج الحالي والحضور</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('account')}
              style={{
                padding: '8px 16px',
                fontSize: '0.84rem',
                fontWeight: 800,
                border: 'none',
                borderBottom: activeTab === 'account' ? '3px solid var(--md-sys-color-primary)' : '3px solid transparent',
                backgroundColor: activeTab === 'account' ? 'var(--md-sys-color-surface-container)' : 'transparent',
                color: activeTab === 'account' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Wallet size={15} />
              <span>حساب التلميذ المالي والأرصدة</span>
              {paymentAccount.availableBalance > 0 && (
                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#059669', color: '#fff', fontWeight: 900 }}>
                  +{paymentAccount.availableBalance.toLocaleString()} دج
                </span>
              )}
              {paymentAccount.recoverySessions > 0 && (
                <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '10px', backgroundColor: '#d97706', color: '#fff', fontWeight: 900 }}>
                  {paymentAccount.recoverySessions} تعويض
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: OVERVIEW & ATTENDANCE */}
          {activeTab === 'overview' && (
            <>
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
                    سجل حضور الحصص التفصيلي (تحتسب حصص P فقط):
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                    الحضور الفعلي المحتسب: {student.totalAttendance || 0} من أصل {sessionCount} حصص (
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
                    const isCovered = status === 'C';
                    const isChange = status === 'CH';
                    const isNew = status === 'N';

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
                            : isCovered
                            ? '#fef3c7'
                            : isChange
                            ? '#ede9fe'
                            : isNew
                            ? '#ecfdf5'
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
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-present)' }}>حاضر (P) ✓</span>
                          ) : isAbsent ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-absent)' }}>غائب (A) ✕</span>
                          ) : isMakeup ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--status-makeup)' }}>تعويض (M)</span>
                          ) : isCovered ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#b45309' }}>مغطاة (C)</span>
                          ) : isChange ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#6d28d9' }}>تغيير (CH)</span>
                          ) : isNew ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#047857' }}>جديد (N)</span>
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
                    تفاصيل الدفعات والتسديد في هذا الفوج:
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
                          الدفعة {pIdx + 1}
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
            </>
          )}

          {/* TAB 2: CENTRAL STUDENT PAYMENT ACCOUNT & LEDGER */}
          {activeTab === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Notification Banner on Credit Apply */}
              {creditApplySuccess && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #a7f3d0',
                    color: '#065f46',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>{creditApplySuccess}</span>
                </div>
              )}

              {/* 6 Key Financial Account Metrics (Matching Specification Section 28) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>إجمالي المدفوعات (Total Paid)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#15803d' }}>{paymentAccount.totalPaid.toLocaleString()} دج</strong>
                </div>

                <div style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>المستهلك للحصص (Used)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#334155' }}>{paymentAccount.amountUsed.toLocaleString()} دج</strong>
                </div>

                <div style={{ backgroundColor: paymentAccount.availableBalance > 0 ? '#ecfdf5' : 'var(--md-sys-color-surface-container-low)', border: `1.5px solid ${paymentAccount.availableBalance > 0 ? '#059669' : 'var(--md-sys-color-outline-variant)'}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: paymentAccount.availableBalance > 0 ? '#065f46' : 'var(--md-sys-color-on-surface-variant)', fontWeight: 700 }}>الرصيد المتاح كفائض (Credit)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#047857' }}>+{paymentAccount.availableBalance.toLocaleString()} دج</strong>
                </div>

                <div style={{ backgroundColor: paymentAccount.recoverySessions > 0 ? '#fffbeb' : 'var(--md-sys-color-surface-container-low)', border: `1.5px solid ${paymentAccount.recoverySessions > 0 ? '#d97706' : 'var(--md-sys-color-outline-variant)'}`, borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: paymentAccount.recoverySessions > 0 ? '#92400e' : 'var(--md-sys-color-on-surface-variant)', fontWeight: 700 }}>حصص التعويض المستحقة (Recovery)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#b45309' }}>{paymentAccount.recoverySessions} حصص</strong>
                </div>

                <div style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>الحصص المحتسبة (P)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#0284c7' }}>{paymentAccount.countablePSessions} حصص</strong>
                </div>

                <div style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>الحصص غير المحتسبة (A/N/CH)</div>
                  <strong style={{ fontSize: '1.15rem', color: '#64748b' }}>{paymentAccount.nonCountableSessions} حصص</strong>
                </div>
              </div>

              {/* Action Banner: Apply Existing Credit */}
              {paymentAccount.availableBalance > 0 && currentStudent.debt > 0 && (
                <div
                  style={{
                    backgroundColor: '#ecfdf5',
                    border: '1.5px solid #10b981',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.86rem', color: '#065f46', display: 'block' }}>
                      💡 يتوفر للتلميذ رصيد فائض بقيمة {paymentAccount.availableBalance.toLocaleString()} دج
                    </strong>
                    <span style={{ fontSize: '0.74rem', color: '#047857' }}>
                      يمكنك تطبيقه لتسديد دين الفوج الحالي {groupId} (المطلوب: {currentStudent.debt.toLocaleString()} دج)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const amountToUse = Math.min(paymentAccount.availableBalance, currentStudent.debt);
                      const ok = applyStudentCredit(student.name, student.barcode, groupId, amountToUse);
                      if (ok) {
                        setCreditApplySuccess(`تم تطبيق رصيد بقيمة ${amountToUse.toLocaleString()} دج على الفوج ${groupId} بنجاح ✓`);
                        setTimeout(() => setCreditApplySuccess(''), 3000);
                      }
                    }}
                    className="m3-btn m3-btn-sm"
                    style={{
                      backgroundColor: '#059669',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.76rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      borderRadius: '6px',
                      padding: '4px 10px'
                    }}
                  >
                    <Coins size={14} />
                    <span>تطبيق الرصيد ({Math.min(paymentAccount.availableBalance, currentStudent.debt).toLocaleString()} دج)</span>
                  </button>
                </div>
              )}

              {/* Recovery Sessions List (Matching Specification Section 9 & 21) */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCcw size={15} color="#d97706" />
                    <span>حصص الغياب القابلة للتعويض (Recovery Sessions):</span>
                  </div>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#92400e' }}>
                    المتبقي للتعويض: {paymentAccount.recoverySessions} حصة
                  </span>
                </div>

                {paymentAccount.recoveryDetails.length === 0 ? (
                  <div style={{ fontSize: '0.76rem', color: '#059669', textAlign: 'center', padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '6px' }}>
                    ✓ لا توجد حصص غياب معلقة لهذا التلميذ (الحضور منتظم بكافة الحصص)
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {paymentAccount.recoveryDetails.map((rec, rIdx) => (
                      <div
                        key={rIdx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          backgroundColor: rec.isRecovered ? '#f0fdf4' : '#fffbeb',
                          border: `1px solid ${rec.isRecovered ? '#bbf7d0' : '#fde68a'}`,
                          fontSize: '0.78rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <strong style={{ color: rec.isRecovered ? '#15803d' : '#b45309' }}>
                            الحصة {rec.sessionNumber} ({rec.dateStr})
                          </strong>
                          <span>• فوج {rec.groupId}</span>
                          <span>• {rec.subject}</span>
                          {rec.teacherName && <span style={{ color: '#64748b' }}>({rec.teacherName})</span>}
                        </div>

                        <div>
                          {rec.isRecovered ? (
                            <span style={{ color: '#15803d', fontWeight: 800, fontSize: '0.72rem', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px' }}>
                              تم التعويض بنجاح ✓
                            </span>
                          ) : (
                            <span style={{ color: '#b45309', fontWeight: 800, fontSize: '0.72rem', backgroundColor: '#fef3c7', padding: '2px 8px', borderRadius: '4px' }}>
                              مستحقة للتعويض ⚠️
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transaction Ledger Table (Matching Specification Section 29 & 31) */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  borderRadius: '8px',
                  padding: '12px'
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <History size={15} color="var(--md-sys-color-primary)" />
                  <span>سجل الحركات المالية الموثق (Payment Transaction Ledger):</span>
                </div>

                {paymentAccount.transactions.length === 0 ? (
                  <div style={{ fontSize: '0.76rem', color: 'var(--md-sys-color-outline)', textAlign: 'center', padding: '12px' }}>
                    لا توجد حركات مالية مسجلة بعد
                  </div>
                ) : (
                  <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--md-sys-color-surface-container)', borderBottom: '1.5px solid var(--md-sys-color-outline-variant)' }}>
                          <th style={{ padding: '6px 8px' }}>التاريخ / الوقت</th>
                          <th style={{ padding: '6px 8px' }}>نوع العملية</th>
                          <th style={{ padding: '6px 8px' }}>المبلغ</th>
                          <th style={{ padding: '6px 8px' }}>البيان / الفوج</th>
                          <th style={{ padding: '6px 8px' }}>الرصيد بعد الحركة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentAccount.transactions.map((tx) => {
                          const isCredit = tx.amount > 0;
                          return (
                            <tr key={tx.id} style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                              <td style={{ padding: '6px 8px', direction: 'ltr', textAlign: 'right' }}>
                                {tx.dateStr} <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{tx.timeStr}</span>
                              </td>
                              <td style={{ padding: '6px 8px' }}>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    backgroundColor:
                                      tx.type === 'PAYMENT'
                                        ? '#dcfce7'
                                        : tx.type === 'SESSION_ALLOCATION'
                                        ? '#f1f5f9'
                                        : tx.type === 'TRANSFER'
                                        ? '#e0f2fe'
                                        : tx.type === 'REFUND'
                                        ? '#fee2e2'
                                        : '#ede9fe',
                                    color:
                                      tx.type === 'PAYMENT'
                                        ? '#15803d'
                                        : tx.type === 'SESSION_ALLOCATION'
                                        ? '#475569'
                                        : tx.type === 'TRANSFER'
                                        ? '#0284c7'
                                        : tx.type === 'REFUND'
                                        ? '#b91c1c'
                                        : '#7c3aed'
                                  }}
                                >
                                  {tx.type === 'PAYMENT'
                                    ? 'دفعة نقداً'
                                    : tx.type === 'SESSION_ALLOCATION'
                                    ? 'استهلاك حصص'
                                    : tx.type === 'TRANSFER'
                                    ? 'تحويل رصيد'
                                    : tx.type === 'REFUND'
                                    ? 'استرجاع نقدي'
                                    : 'تسوية'}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: '6px 8px',
                                  fontWeight: 800,
                                  color: isCredit ? '#15803d' : '#b91c1c'
                                }}
                              >
                                {isCredit ? `+${tx.amount.toLocaleString()} دج` : `${tx.amount.toLocaleString()} دج`}
                              </td>
                              <td style={{ padding: '6px 8px', color: 'var(--md-sys-color-on-surface)' }}>
                                {tx.description}
                              </td>
                              <td style={{ padding: '6px 8px', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                                {tx.balanceAfter.toLocaleString()} دج
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
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
            <button
              type="button"
              onClick={() => {
                if (confirm(`هل أنت متأكد من حذف التلميذ "${student.name}" من فوج ${groupId}؟\nسيتم حذف جميع سجلاته ومدفوعاته في هذا الفوج نهائياً.`)) {
                  deleteStudent(groupId, student.rowId);
                  onClose();
                }
              }}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b91c1c', borderColor: '#fca5a5' }}
              title="حذف التلميذ ومدفوعاته من هذا الفوج"
            >
              <Trash2 size={15} />
              <span>حذف التلميذ</span>
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

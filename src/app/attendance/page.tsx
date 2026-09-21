'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import { AttendanceStatus, StudentRecord, Teacher } from '../../types';
import {
  CalendarCheck,
  Search,
  UserPlus,
  Printer,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  Trash2,
  Filter,
  Sparkles,
  ChevronDown,
  Coins,
  Receipt,
  RotateCw,
  Eye,
  EyeOff,
  CheckCheck,
  Scan,
  UserX,
  IdCard,
  ArrowUp,
  X,
  Banknote
} from 'lucide-react';
import StudentPaymentModal from '../../components/StudentPaymentModal';
import AddStudentModal from '../../components/AddStudentModal';
import ThermalReceiptsModal from '../../components/ThermalReceiptsModal';
import EditGroupModal from '../../components/EditGroupModal';
import RenewGroupModal from '../../components/RenewGroupModal';
import GroupSearchSelect from '../../components/GroupSearchSelect';
import GroupBadgesModal from '../../components/GroupBadgesModal';
import SecurityPinModal from '../../components/SecurityPinModal';
import HourlyPaymentFilterModal from '../../components/HourlyPaymentFilterModal';
import GroupSessionPaymentsModal from '../../components/GroupSessionPaymentsModal';
import TeacherPaymentModal from '../../components/TeacherPaymentModal';
import { collectTodayAndHourlyPayments } from '../../utils/paymentLogger';
import { normalizeScannedBarcode, normalizeArabicName } from '../../utils/barcodeUtils';
import {
  isSessionDateToday,
  isGroupToday,
  formatGroupTime,
  getGroupStatus,
  isGroupActive,
  isGroupEnded,
  isSummaryRow,
  formatToYYYYMMDD,
  generateSessionDates,
  getStudentSessionInfo,
  recalculateSubsequentDates,
  getDefaultSessionIndex
} from '../../utils/sessionUtils';

export default function AttendancePage() {
  const {
    data,
    selectedGroup,
    setSelectedGroup,
    updateAttendance,
    cycleAttendance,
    markAllPresent,
    deleteStudent,
    getGroupStats,
    updateSessionDates,
    endSessionAndMarkAbsent
  } = useApp();

  const group = data.groupData[selectedGroup] || Object.values(data.groupData)[0];
  const groupStats = getGroupStats(group?.groupId || selectedGroup);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filterDebt, setFilterDebt] = useState<'all' | 'debt' | 'paid' | 'exempt'>('all');
  const [activeStudentForPayment, setActiveStudentForPayment] = useState<StudentRecord | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isThermalModalOpen, setIsThermalModalOpen] = useState(false);
  const [isEditFinancesOpen, setIsEditFinancesOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isGroupBadgesModalOpen, setIsGroupBadgesModalOpen] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [showFinancialStats, setShowFinancialStats] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isHourlyModalOpen, setIsHourlyModalOpen] = useState(false);
  const [isSessionPaymentsModalOpen, setIsSessionPaymentsModalOpen] = useState(false);
  const [isGroupTeacherPayModalOpen, setIsGroupTeacherPayModalOpen] = useState(false);
  const [statsDisplayMode, setStatsDisplayMode] = useState<'cumulative' | 'hourly'>('cumulative');
  const [inlineFromTime, setInlineFromTime] = useState('13:00');
  const [inlineToTime, setInlineToTime] = useState('15:00');
  const [inlinePreset, setInlinePreset] = useState('1to3pm');

  // Find assigned teacher for this group
  const currentGroupTeacher = useMemo(() => {
    if (!group) return null;
    const tNorm = normalizeArabicName(group.teacherName || '');
    let found = data.teachers.find((t) => normalizeArabicName(t.name) === tNorm);
    if (!found && (group as any).teacherId) {
      found = data.teachers.find((t) => t.id === (group as any).teacherId);
    }
    if (!found) {
      return {
        id: `T-${group.groupId}`,
        name: group.teacherName || 'أستاذ الفوج',
        subject: group.subject || '',
        paidAmount: 0,
        paymentHistory: []
      } as Teacher;
    }
    return found;
  }, [data.teachers, group]);

  // Calculate teacher financial dues specifically for this group
  const groupTeacherStats = useMemo(() => {
    if (!group) {
      return {
        totalStudents: 0,
        totalTeacherPay: 0,
        totalCollectedInGroups: 0,
        groups: []
      };
    }
    const realStudents = (group.students || []).filter((s) => !isSummaryRow(s, group.groupId));
    let totalTeacherPay = 0;
    let totalCollected = 0;
    realStudents.forEach((s) => {
      totalTeacherPay += s.teacherPay || 0;
      totalCollected += s.totalReceived || 0;
    });

    return {
      totalStudents: realStudents.length,
      totalTeacherPay,
      totalCollectedInGroups: totalCollected,
      groups: [group]
    };
  }, [group]);

  // Calculate live hourly payments for today and selected hours in this group
  const inlineHourlySummary = React.useMemo(() => {
    return collectTodayAndHourlyPayments(data, {
      dateStr: formatToYYYYMMDD(new Date()),
      fromTime: inlineFromTime,
      toTime: inlineToTime,
      groupId: group?.groupId || selectedGroup
    });
  }, [data, inlineFromTime, inlineToTime, group?.groupId, selectedGroup]);
  const [editableDates, setEditableDates] = useState<string[]>(
    group?.sessionDates || ['حصة 1', 'حصة 2', 'حصة 3', 'حصة 4', 'حصة 5', 'حصة 6', 'حصة 7', 'حصة 8']
  );
  const [autoCascadeDates, setAutoCascadeDates] = useState(true);

  // Sticky Floating Header on scroll
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 150);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Automated Absence Tracking: End Session action
  const handleEndSession = (sessionIndex: number) => {
    const sessionLabel = group.sessionDates[sessionIndex] || `حصة ${sessionIndex + 1}`;
    if (
      confirm(
        `هل أنت متأكد من إنهاء "${sessionLabel}" للفوج (${group.groupId})؟\n\nتنبيه: سيتم تلقائياً رصد جميع التلاميذ المسجلين في هذا الفوج الذين لم يمسحوا بطاقاتهم كـ "غائب (A)" مع إعادة احتساب ديونهم المالية فوراً.`
      )
    ) {
      const res = endSessionAndMarkAbsent(group.groupId, sessionIndex);
      alert(
        `تم إنهاء الحصة بنجاح:\n✓ الحاضرون: ${res.presentCount}\n✓ في حصة تعويض: ${res.makeupCount}\n✓ تم تسجيلهم غياب تلقائي (A): ${res.absentCount}`
      );
    }
  };

  // Sync editableDates whenever group changes
  React.useEffect(() => {
    if (group?.sessionDates) {
      setEditableDates(group.sessionDates);
    }
  }, [group?.groupId, group?.sessionDates]);

  if (!group) {
    return <div>لم يتم العثور على الفوج المطلوب.</div>;
  }

  const realStudents = React.useMemo(() => {
    return (group.students || []).filter((s) => !isSummaryRow(s, group.groupId));
  }, [group.students, group.groupId]);

  const todaySessionIndex = group.sessionDates.findIndex((d) => isSessionDateToday(formatToYYYYMMDD(d) || d));

  // Dynamic Session Attendance Stats Selector (defaults to today or latest session with attendance)
  const [selectedSessionStatsIndex, setSelectedSessionStatsIndex] = useState<number>(() => {
    return todaySessionIndex !== -1 ? todaySessionIndex : getDefaultSessionIndex(group, new Date());
  });

  // Keep selectedSessionStatsIndex in sync when group changes
  React.useEffect(() => {
    if (group?.sessionDates) {
      const todayIdx = group.sessionDates.findIndex((d) => isSessionDateToday(formatToYYYYMMDD(d) || d));
      const defaultIdx = todayIdx !== -1 ? todayIdx : getDefaultSessionIndex(group, new Date());
      setSelectedSessionStatsIndex(defaultIdx >= 0 && defaultIdx < group.sessionDates.length ? defaultIdx : 0);
    }
  }, [group?.groupId, group?.sessionDates]);

  // Filter students (supports Name, Student ID / Barcode, Phone)
  const filteredStudents = realStudents.filter((s) => {
    const rawQ = searchQuery.trim();
    if (!rawQ) {
      if (filterDebt === 'debt') return s.debt > 0;
      if (filterDebt === 'paid') return s.debt === 0 && s.fee > 0;
      if (filterDebt === 'exempt') return s.discount === '0';
      return true;
    }

    const q = rawQ.toLowerCase();
    const normalizedScan = normalizeScannedBarcode(rawQ).toLowerCase();
    const normalizedDigits = q.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const cleanDigits = normalizedDigits.replace(/\D/g, '');

    const barcode = (s.barcode || '').toLowerCase();
    const matchesId =
      (barcode && (barcode.includes(q) || barcode.includes(normalizedScan) || barcode.includes(normalizedDigits))) ||
      (cleanDigits.length >= 2 && barcode.replace(/\D/g, '').includes(cleanDigits)) ||
      (cleanDigits.length > 0 && String(s.rowId) === cleanDigits);

    const matchesSearch =
      matchesId ||
      s.name.toLowerCase().includes(q) ||
      (s.phone && (s.phone.includes(q) || s.phone.includes(cleanDigits)));

    if (!matchesSearch) return false;
    if (filterDebt === 'debt') return s.debt > 0;
    if (filterDebt === 'paid') return s.debt === 0 && s.fee > 0;
    if (filterDebt === 'exempt') return s.discount === '0';
    return true;
  });

  // Calculate live aggregate attendance statistics for the selected session
  const sessionAttendanceStats = React.useMemo(() => {
    if (!group || selectedSessionStatsIndex < 0) {
      return { present: 0, absent: 0, makeup: 0, unmarked: 0, total: 0, rate: 0 };
    }
    const targetStudents = filteredStudents.length > 0 ? filteredStudents : realStudents;
    let present = 0;
    let absent = 0;
    let makeup = 0;
    let unmarked = 0;

    targetStudents.forEach((s) => {
      const val = s.attendance?.[selectedSessionStatsIndex];
      const st = typeof val === 'string' ? val.trim().toUpperCase() : '';
      if (st === 'P' || st === 'ح') present++;
      else if (st === 'A' || st === 'غ') absent++;
      else if (st === 'M' || st === 'م') makeup++;
      else unmarked++;
    });

    const total = targetStudents.length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, makeup, unmarked, total, rate };
  }, [group, selectedSessionStatsIndex, filteredStudents, realStudents]);


  // Save session dates
  const handleSaveDates = () => {
    const formatted = editableDates.map((d) => formatToYYYYMMDD(d) || d);
    updateSessionDates(group.groupId, formatted);
    setEditableDates(formatted);
    setIsEditingDates(false);
  };

  // Cascade recalculation of subsequent dates when session date at index `idx` changes
  const handleDateChange = (idx: number, newDateVal: string, isFinalDate: boolean = false) => {
    const groupMeta = data.groups.find((g) => g.id === group.groupId);
    const effectiveDay1 = groupMeta?.day1 || group.day1 || 'السبت';
    const effectiveDay2 = groupMeta?.day2 || group.day2;

    if (autoCascadeDates) {
      if (isFinalDate) {
        const next = recalculateSubsequentDates(editableDates, idx, newDateVal, effectiveDay1, effectiveDay2);
        setEditableDates(next);
      } else {
        const clean = formatToYYYYMMDD(newDateVal);
        const isComplete = /^\d{4}\/\d{2}\/\d{2}$/.test(clean);
        if (isComplete) {
          const next = recalculateSubsequentDates(editableDates, idx, clean, effectiveDay1, effectiveDay2);
          setEditableDates(next);
        } else {
          const next = [...editableDates];
          next[idx] = newDateVal;
          setEditableDates(next);
        }
      }
    } else {
      const next = [...editableDates];
      next[idx] = isFinalDate ? (formatToYYYYMMDD(newDateVal) || newDateVal) : newDateVal;
      setEditableDates(next);
    }
  };

  // Auto-generate weekly dates in YYYY/MM/DD for this group
  const handleAutoGenerateDates = () => {
    const groupMeta = data.groups.find((g) => g.id === group.groupId);
    const day = groupMeta?.day1 || group.day1 || 'السبت';
    const day2 = groupMeta?.day2 || group.day2;
    const baseStart = editableDates[0] ? formatToYYYYMMDD(editableDates[0]) : undefined;
    const generated = generateSessionDates(day, editableDates.length || group.sessionCount || 4, baseStart, day2);
    setEditableDates(generated);
  };

  // Generate completely new upcoming dates for this group (starting from the upcoming class date)
  const handleGenerateNewUpcomingDates = () => {
    const groupMeta = data.groups.find((g) => g.id === group.groupId);
    const day = groupMeta?.day1 || group.day1 || 'السبت';
    const day2 = groupMeta?.day2 || group.day2;
    const generated = generateSessionDates(day, editableDates.length || group.sessionCount || 4, undefined, day2);
    setEditableDates(generated);
  };

  const handleAddSession = () => {
    let nextDateStr = '';
    const lastDate = editableDates[editableDates.length - 1];
    if (lastDate) {
      const groupMeta = data.groups.find((g) => g.id === group.groupId);
      const effectiveDay1 = groupMeta?.day1 || group.day1 || 'السبت';
      const effectiveDay2 = groupMeta?.day2 || group.day2;
      const rec = recalculateSubsequentDates([lastDate, ''], 0, lastDate, effectiveDay1, effectiveDay2);
      nextDateStr = rec[1];
    }
    if (!nextDateStr) {
      nextDateStr = formatToYYYYMMDD(new Date());
    }
    setEditableDates([...editableDates, nextDateStr]);
  };

  const handleRemoveSession = () => {
    if (editableDates.length <= 1) return;
    setEditableDates(editableDates.slice(0, -1));
  };

  // Export to CSV
  const handleExportCsv = () => {
    const sessionHeaders = group.sessionDates.map((d, i) => formatToYYYYMMDD(d) || `حصة ${i + 1}`);
    const headers = [
      '#',
      'الاسم واللقب',
      'الهاتف',
      ...sessionHeaders,
      'التخفيض',
      'المجموع',
      'مجموع المستلم',
      'مجموع الأستاذ',
      'المدرسة',
      'الدين',
      'مجموع الحضور'
    ];

    const rows = realStudents.map((s, idx) => {
      const attCells = group.sessionDates.map((_, i) => s.attendance[i] || '');
      return [
        idx + 1,
        `"${s.name}"`,
        `"${s.phone}"`,
        ...attCells,
        `"${s.discount}"`,
        s.fee,
        s.totalReceived,
        s.teacherPay,
        s.schoolEarn,
        s.debt,
        s.totalAttendance
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `حضور_فوج_${group.groupId}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Sticky Floating Bar on Scroll (Always keeps Add Student, Group Info, Attendance Count & Print Worksheet) */}
      {isScrolled && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: '64px',
            insetInlineStart: '88px',
            insetInlineEnd: 0,
            zIndex: 45,
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.1)',
            padding: '7px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-in-out'
          }}
        >
          {/* Right Section (in RTL): Essential Group Info & Session Attendance */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
            {/* Group ID & Subject Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                padding: '3px 10px',
                borderRadius: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <strong style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)' }}>
                فوج {group.groupId}
              </strong>
              <span style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                ({group.subject})
              </span>
            </div>

            {/* Teacher, Day & Time */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.78rem',
                color: 'var(--md-sys-color-on-surface-variant)',
                whiteSpace: 'nowrap'
              }}
            >
              <span>|</span>
              <span>الأستاذ: <strong style={{ color: 'var(--md-sys-color-on-surface)' }}>{group.teacherName}</strong></span>
              <span>|</span>
              <span>التوقيت: <strong>{group.day1} ({formatGroupTime(group.time1) || 'صباحاً'})</strong></span>
            </div>

            {/* Number of students who attend the session */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                padding: '3px 10px',
                borderRadius: 'var(--md-shape-full)',
                fontSize: '0.78rem',
                fontWeight: 800,
                whiteSpace: 'nowrap'
              }}
              title={`إحصائيات الحصة ${selectedSessionStatsIndex + 1}: ${sessionAttendanceStats.present} حاضر من أصل ${sessionAttendanceStats.total}`}
            >
              <span>الحصة {selectedSessionStatsIndex + 1}:</span>
              <strong style={{ fontSize: '0.88rem' }}>{sessionAttendanceStats.present}</strong>
              <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>/ {sessionAttendanceStats.total} حاضر</span>
              {sessionAttendanceStats.absent > 0 && (
                <span style={{ marginInlineStart: '4px', color: '#b91c1c' }}>
                  ({sessionAttendanceStats.absent} غائب)
                </span>
              )}
            </div>
          </div>

          {/* Left Section (in RTL): Print Worksheet, ADD STUDENT (Sticky!), and Scroll Top */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {/* Print Worksheet Link */}
            <Link
              href="/print"
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '34px',
                padding: '0 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderRadius: 'var(--md-shape-full)',
                textDecoration: 'none',
                whiteSpace: 'nowrap'
              }}
              title="طباعة كشف الحضور لهذا الفوج (Worksheet / Roster)"
            >
              <Printer size={15} />
              <span>طباعة الكشف</span>
            </Link>

            {/* The primary requested ALWAYS VISIBLE Add Student button! */}
            <button
              onClick={() => setIsAddStudentOpen(true)}
              className="m3-btn m3-btn-primary m3-btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '34px',
                padding: '0 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                borderRadius: 'var(--md-shape-full)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 99, 155, 0.4)',
                whiteSpace: 'nowrap'
              }}
              title="إضافة تلميذ جديد لهذا الفوج"
            >
              <UserPlus size={16} />
              <span>إضافة تلميذ</span>
            </button>

            {/* Smooth Scroll Back to Top */}
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="m3-btn m3-btn-tonal m3-btn-sm"
              style={{
                width: '34px',
                height: '34px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--md-shape-full)',
                cursor: 'pointer'
              }}
              title="الرجوع إلى أعلى الصفحة"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      )}
      {/* Top Header & Group Selector Bar */}
      <div
        className="m3-card"
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <GroupSearchSelect
            selectedGroupId={group.groupId}
            onSelectGroup={(newGroupId) => {
              setSelectedGroup(newGroupId);
              const selectedG = data.groupData[newGroupId];
              if (selectedG) setEditableDates(selectedG.sessionDates);
            }}
            label="اختر الفوج الدراسي (بحث سريع):"
            placeholder="ابحث برمز الفوج، المادة، أو الأستاذ..."
            width="320px"
          />

          <div
            style={{
              paddingInlineStart: '16px',
              borderInlineStart: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                فوج {group.groupId}
              </h2>
              {/* Group Active / Inactive Status */}
              {(() => {
                const groupMeta = data.groups.find((g) => g.id === group.groupId) || {
                  id: group.groupId,
                  type: group.type,
                  sessionCount: group.sessionCount,
                  isVip: group.isVip,
                  teacherId: '',
                  teacherName: group.teacherName,
                  subject: group.subject,
                  day1: group.day1,
                  time1: group.time1
                };
                const statusInfo = getGroupStatus(groupMeta, group, data.pricingTiers);
                return statusInfo.status === 'active' ? (
                  <span
                    className="m3-chip"
                    style={{
                      backgroundColor: 'var(--status-present-container)',
                      color: 'var(--status-present)',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title={`فوج نشط - أنجز ${statusInfo.currentSession} من أصل ${statusInfo.totalSessions} حصص`}
                  >
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-present)' }} />
                    <span>نشط ({statusInfo.currentSession}/{statusInfo.totalSessions})</span>
                  </span>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      className="m3-chip"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                        color: 'var(--md-sys-color-outline)',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        padding: '2px 8px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title={`فوج غير نشط - بلغ آخر حصة (${statusInfo.totalSessions}/${statusInfo.totalSessions})`}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                      <span>غير نشط • مكتمل ({statusInfo.totalSessions}/{statusInfo.totalSessions})</span>
                    </span>

                    {/* New button next to status to open new group */}
                    <button
                      type="button"
                      onClick={() => setIsRenewModalOpen(true)}
                      className="m3-btn m3-btn-primary m3-btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.78rem',
                        padding: '4px 12px',
                        fontWeight: 800,
                        borderRadius: 'var(--md-shape-full)',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        cursor: 'pointer'
                      }}
                      title="فتح دورة جديدة للفوج بمعرّف جديد ونقل تلاميذ الحصة الأولى تلقائياً"
                    >
                      <RotateCw size={13} />
                      <span>فتح فوج جديد (دورة جديدة) 🔁</span>
                    </button>
                  </div>
                );
              })()}
              {isGroupToday(group, group) && (
                <span
                  className="m3-chip"
                  style={{
                    backgroundColor: 'var(--status-present-container)',
                    color: 'var(--status-present)',
                    fontWeight: 800,
                    border: '1px solid var(--status-present)',
                    padding: '2px 8px'
                  }}
                >
                  موعد اليوم ★
                </span>
              )}
              {group.isVip && <span className="m3-chip m3-chip-vip">VIP خاص</span>}
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  padding: '2px 8px',
                  borderRadius: 'var(--md-shape-sm)'
                }}
              >
                {group.type}
              </span>
              <span
                className="m3-chip"
                style={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '2px 8px',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  color: 'var(--md-sys-color-on-surface)'
                }}
              >
                👥 {realStudents.length} تلميذ
              </span>

              {/* Group rates breakdown badge & edit trigger */}
              {(() => {
                const tier = data.pricingTiers.find((t) => t.id === group.type);
                const fee = group.studentFee ?? tier?.price ?? (group.type.includes('10000') ? 10000 : 2500);
                const teacherRate = group.teacherPayPerStudent ?? tier?.teacherRate ?? (group.type.includes('10000') ? 7500 : 1500);
                const schoolRate = group.schoolSharePerStudent ?? tier?.schoolRate ?? (fee - teacherRate);

                return (
                  <button
                    type="button"
                    onClick={() => setIsEditFinancesOpen(true)}
                    className="m3-btn-text"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      padding: '3px 10px',
                      borderRadius: 'var(--md-shape-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid var(--md-sys-color-outline-variant)'
                    }}
                    title="تعديل جميع معلومات ومستحقات هذا الفوج"
                  >
                    <Coins size={14} color="var(--md-sys-color-primary)" />
                    <span>تسعيرة التلميذ:</span>
                    <span style={{ color: 'var(--md-sys-color-primary)' }}>{fee.toLocaleString()} دج</span>
                    <span style={{ textDecoration: 'underline', color: 'var(--md-sys-color-primary)', marginInlineStart: '4px' }}>تعديل الفوج ✏️</span>
                  </button>
                );
              })()}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              المادة: <strong>{group.subject}</strong> | الأستاذ: <strong>{group.teacherName}</strong> | التوقيت:{' '}
              {group.day1} ({formatGroupTime(group.time1) || 'صباحاً'})
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Link
            href={`/scanner?groupId=${group.groupId}`}
            className="m3-btn m3-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              color: '#ffffff',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'none'
            }}
            title="الانتقال إلى محطة مسح الباركود والبطاقات الذكية لهذا الفوج"
          >
            <Scan size={16} />
            <span>قارئ الباركود والبطاقات ⚡</span>
          </Link>

          <button
            onClick={() => setIsAddStudentOpen(true)}
            className="m3-btn m3-btn-primary m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <UserPlus size={16} />
            <span>إضافة تلميذ</span>
          </button>

          <button
            onClick={() => setIsThermalModalOpen(true)}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', borderColor: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-primary)' }}
            title="طباعة وصولات حرارية لجميع طلبة الفوج (80mm)"
          >
            <Receipt size={16} />
            <span>وصولات حرارية (80mm)</span>
          </button>

          <Link
            href="/print"
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <Printer size={16} />
            <span>طباعة الكشف</span>
          </Link>

          <button
            onClick={handleExportCsv}
            className="m3-btn m3-btn-tonal m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="تصدير إلى Excel / CSV"
          >
            <Download size={16} />
            <span>تصدير CSV</span>
          </button>

          {/* Hourly Income Filter Trigger Button */}
          <button
            type="button"
            onClick={() => setIsHourlyModalOpen(true)}
            className="m3-btn m3-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #6ee7b7',
              fontWeight: 800
            }}
            title="تصفية المداخيل حسب الساعات واليوم لمعرفة المبالغ المحصلة وعدد التلاميذ الذين دفعوا"
          >
            <Clock size={16} />
            <span>تصفية المداخيل بالساعات 🕒</span>
          </button>

          {/* Pay Teacher For This Group Only Button */}
          <button
            type="button"
            onClick={() => setIsGroupTeacherPayModalOpen(true)}
            className="m3-btn m3-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fcd34d',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title={`تسديد مستحقات وأتعاب الأستاذ (${group.teacherName}) لهذا الفوج (${group.groupId}) فقط - المستحق المحسوب: ${groupTeacherStats.totalTeacherPay.toLocaleString()} دج`}
          >
            <Banknote size={16} color="#b45309" />
            <span>تسديد أتعاب الأستاذ 💰</span>
          </button>

          {/* Optional Toggle to show/hide Financial KPIs (Hidden by default as requested) */}
          <button
            type="button"
            onClick={() => {
              if (showFinancialStats) {
                setShowFinancialStats(false);
              } else {
                setIsPinModalOpen(true);
              }
            }}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: showFinancialStats ? 'var(--md-sys-color-primary-container)' : undefined,
              color: showFinancialStats ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderColor: showFinancialStats ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'
            }}
            title={showFinancialStats ? 'إخفاء شريط الإحصائيات المالية' : 'إظهار شريط الإحصائيات المالية (يتطلب الرمز 1234)'}
          >
            {showFinancialStats ? <EyeOff size={15} /> : <Eye size={15} />}
            <span>{showFinancialStats ? 'إخفاء الإحصائيات المالية' : 'إظهار الإحصائيات المالية'}</span>
          </button>
        </div>
      </div>

      {/* Group Financial & Attendance KPIs Bar (Hidden by default as requested) */}
      {showFinancialStats && (
        <div
          className="m3-card"
          style={{
            padding: '16px 20px',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            animation: 'fadeIn 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {/* Sub-Header: Mode Selector between Cumulative and Hourly */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              paddingBottom: '10px',
              borderBottom: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setStatsDisplayMode('cumulative')}
                className={`m3-btn m3-btn-sm ${statsDisplayMode === 'cumulative' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                style={{ fontSize: '0.76rem', padding: '4px 12px', borderRadius: 'var(--md-shape-full)' }}
              >
                📊 المجموع التراكمي للفوج (كامل الموسم)
              </button>

              <button
                type="button"
                onClick={() => setStatsDisplayMode('hourly')}
                className={`m3-btn m3-btn-sm ${statsDisplayMode === 'hourly' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                style={{
                  fontSize: '0.76rem',
                  padding: '4px 12px',
                  borderRadius: 'var(--md-shape-full)',
                  backgroundColor: statsDisplayMode === 'hourly' ? '#059669' : undefined,
                  color: statsDisplayMode === 'hourly' ? '#ffffff' : undefined,
                  borderColor: '#059669'
                }}
              >
                🕒 تصفية اليوم حسب الساعات (فلتر زمني حي)
              </button>
            </div>

            {statsDisplayMode === 'hourly' && (
              <button
                type="button"
                onClick={() => setIsHourlyModalOpen(true)}
                className="m3-btn-text"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>فتح كشف التفاصيل والطباعة</span>
                <span>👈</span>
              </button>
            )}
          </div>

          {/* Quick Hourly Controls Bar when in Hourly Mode */}
          {statsDisplayMode === 'hourly' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '8px 12px',
                backgroundColor: '#ecfdf5',
                borderRadius: '8px',
                border: '1px solid #a7f3d0'
              }}
            >
              {/* Presets Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#065f46' }}>
                  فترات سريعة:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePreset('1to3pm');
                    setInlineFromTime('13:00');
                    setInlineToTime('15:00');
                  }}
                  className={`m3-btn-sm ${inlinePreset === '1to3pm' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: inlinePreset === '1to3pm' ? '#047857' : '#fff',
                    color: inlinePreset === '1to3pm' ? '#fff' : '#047857'
                  }}
                >
                  ⭐ 13:00 - 15:00 (1 PM - 3 PM)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePreset('last2h');
                    const curH = new Date().getHours();
                    setInlineFromTime(`${String(Math.max(0, curH - 2)).padStart(2, '0')}:00`);
                    setInlineToTime(`${String(curH + 1).padStart(2, '0')}:00`);
                  }}
                  className={`m3-btn-sm ${inlinePreset === 'last2h' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: inlinePreset === 'last2h' ? '#047857' : '#fff',
                    color: inlinePreset === 'last2h' ? '#fff' : '#047857'
                  }}
                >
                  آخر ساعتين ⏳
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePreset('allDay');
                    setInlineFromTime('00:00');
                    setInlineToTime('23:59');
                  }}
                  className={`m3-btn-sm ${inlinePreset === 'allDay' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: inlinePreset === 'allDay' ? '#047857' : '#fff',
                    color: inlinePreset === 'allDay' ? '#fff' : '#047857'
                  }}
                >
                  كامل اليوم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePreset('morning');
                    setInlineFromTime('08:00');
                    setInlineToTime('12:00');
                  }}
                  className={`m3-btn-sm ${inlinePreset === 'morning' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: inlinePreset === 'morning' ? '#047857' : '#fff',
                    color: inlinePreset === 'morning' ? '#fff' : '#047857'
                  }}
                >
                  الصباح (08-12)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlinePreset('evening');
                    setInlineFromTime('16:00');
                    setInlineToTime('20:00');
                  }}
                  className={`m3-btn-sm ${inlinePreset === 'evening' ? 'm3-btn-filled' : 'm3-btn-outlined'}`}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: inlinePreset === 'evening' ? '#047857' : '#fff',
                    color: inlinePreset === 'evening' ? '#fff' : '#047857'
                  }}
                >
                  المساء (16-20)
                </button>
              </div>

              {/* Exact Time Pickers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46' }}>من:</span>
                <input
                  type="time"
                  value={inlineFromTime}
                  onChange={(e) => {
                    setInlineFromTime(e.target.value);
                    setInlinePreset('custom');
                  }}
                  className="m3-input"
                  style={{ padding: '2px 6px', fontSize: '0.76rem', fontWeight: 700, width: '85px', height: '26px' }}
                />
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#065f46' }}>إلى:</span>
                <input
                  type="time"
                  value={inlineToTime}
                  onChange={(e) => {
                    setInlineToTime(e.target.value);
                    setInlinePreset('custom');
                  }}
                  className="m3-input"
                  style={{ padding: '2px 6px', fontSize: '0.76rem', fontWeight: 700, width: '85px', height: '26px' }}
                />
              </div>
            </div>
          )}

          {/* KPIs Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              textAlign: 'center'
            }}
          >
            {statsDisplayMode === 'cumulative' ? (
              <>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>عدد التلاميذ</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{groupStats.studentCount} تلميذ</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>المطلوب (المجموع)</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    {groupStats.totalExpected.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-present)' }}>مجموع المحصل</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-present)' }}>
                    {groupStats.totalReceived.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-absent)' }}>إجمالي الديون</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--status-absent)' }}>
                    {groupStats.totalDebt.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-secondary)' }}>مستحق الأستاذ</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-secondary)' }}>
                    {groupStats.totalTeacherPay.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>حصة المركز الصافية</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                    {groupStats.totalSchoolEarn.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    عدد التلاميذ المسددين (في هذه الساعات)
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>
                    {inlineHourlySummary.uniqueStudentsCount} تلميذ
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--status-present)' }}>
                    مجموع المحصل في هذه الفترة
                  </span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--status-present)' }}>
                    {inlineHourlySummary.totalAmount.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    عدد عمليات الدفع
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                    {inlineHourlySummary.paymentsCount} عملية
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-secondary)' }}>
                    مستحق الأستاذ (في هذه الفترة)
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-secondary)' }}>
                    {inlineHourlySummary.teacherTotal.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                    حصة المركز الصافية (في هذه الفترة)
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                    {inlineHourlySummary.schoolEarnTotal.toLocaleString()} <span style={{ fontSize: '0.75rem' }}>دج</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setIsHourlyModalOpen(true)}
                    className="m3-btn m3-btn-sm"
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      backgroundColor: '#ecfdf5',
                      color: '#065f46',
                      border: '1px solid #6ee7b7',
                      padding: '8px 12px',
                      borderRadius: '8px'
                    }}
                  >
                    عرض قائمة المسددين ({inlineHourlySummary.paymentsCount}) 👈
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter and Date Settings Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Search & Debt Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '310px' }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery ?? ''}
              onFocus={(e) => e.target.select()}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              onChange={(e) => {
                const cleanVal = normalizeScannedBarcode(e.target.value);
                setSearchQuery(cleanVal);
                if (/^(?:STU[-_]?\d+|(?:BAC|BACV)[-_]?\d+[-_]?\d*)$/i.test(cleanVal)) {
                  setTimeout(() => {
                    searchInputRef.current?.select();
                  }, 50);
                }
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                const cleanVal = normalizeScannedBarcode(pasted);
                if (cleanVal !== pasted) {
                  e.preventDefault();
                  setSearchQuery(cleanVal);
                  setTimeout(() => {
                    searchInputRef.current?.select();
                  }, 50);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLInputElement).select();
                }
              }}
              placeholder="ابحث باسم التلميذ، المعرّف (ID) أو الهاتف..."
              className="m3-input"
              style={{
                paddingInlineStart: '36px',
                paddingInlineEnd: searchQuery ? '32px' : '10px',
                paddingBlock: '8px',
                fontSize: '0.85rem',
                direction: /^[a-zA-Z0-9\-_]/.test(searchQuery) ? 'ltr' : 'rtl',
                textAlign: /^[a-zA-Z0-9\-_]/.test(searchQuery) ? 'left' : 'right'
              }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                insetInlineStart: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--md-sys-color-outline)',
                pointerEvents: 'none'
              }}
            />
            {Boolean(searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  insetInlineEnd: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--md-sys-color-on-surface-variant)',
                  borderRadius: '50%'
                }}
                title="مسح البحث"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              padding: '3px'
            }}
          >
            {[
              { id: 'all', label: 'الجميع' },
              { id: 'debt', label: 'عليهم دين ⚠️' },
              { id: 'paid', label: 'مسدد بالكامل ✓' },
              { id: 'exempt', label: 'معفى' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterDebt(tab.id as any)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--md-shape-full)',
                  border: 'none',
                  backgroundColor: filterDebt === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                  color: filterDebt === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Print All Group Badges Button (Matching user screenshot red rectangle) */}
          <button
            type="button"
            onClick={() => setIsGroupBadgesModalOpen(true)}
            className="m3-btn m3-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: '#fff7ed',
              color: '#ea580c',
              border: '1px solid #fdba74',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(234, 88, 12, 0.12)'
            }}
            title="طباعة بطاقات وشارات جميع تلاميذ الفوج دفعة واحدة"
          >
            <IdCard size={16} color="#ea580c" />
            <span>طباعة بطاقات الفوج ({realStudents.length})</span>
          </button>

          {/* Check Who Paid & Put Amount Per Session Button (User Requested Position) */}
          <button
            type="button"
            onClick={() => setIsSessionPaymentsModalOpen(true)}
            className="m3-btn m3-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #6ee7b7',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(5, 150, 105, 0.12)'
            }}
            title="تدقيق ومتابعة دفعات التلاميذ وتسجيل المبالغ المسددة لكل حصة"
          >
            <Coins size={16} color="#059669" />
            <span>دفعات الحصص 💰</span>
          </button>
        </div>

        {/* Edit Dates Toggle */}
        <div>
          <button
            onClick={() => setIsEditingDates(!isEditingDates)}
            className="m3-btn m3-btn-outlined m3-btn-sm"
          >
            {isEditingDates ? 'إغلاق تعديل الحصص' : `تعديل تواريخ الحصص (${group.sessionDates.length} حصة)`}
          </button>
        </div>
      </div>

      {/* Editable Dates Tray (if open) */}
      {isEditingDates && (
        <div
          className="m3-card"
          style={{
            padding: '16px',
            backgroundColor: 'var(--md-sys-color-surface-container)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
                تعديل تواريخ الحصص لهذا الفوج ({editableDates.length} حصص) — بالترتيب YYYY/MM/DD:
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '2px' }}>
                صيغة التاريخ: سنة/شهر/يوم (مثال: 2026/08/22)
              </div>
              <div style={{ marginTop: '6px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', color: 'var(--md-sys-color-primary)' }}>
                  <input
                    type="checkbox"
                    checked={autoCascadeDates}
                    onChange={(e) => setAutoCascadeDates(e.target.checked)}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>تحديث تلقائي للحصص التالية حسب أيام الدراسة ({group.day1 || 'السبت'}{group.day2 ? ` و ${group.day2}` : ''}) ⚡</span>
                </label>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAutoGenerateDates}
                className="m3-btn m3-btn-filled m3-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--md-sys-color-primary)' }}
                title="توليد تواريخ أسبوعية تلقائية لهذا الفوج استناداً لتاريخ الحصة الأولى"
              >
                <Sparkles size={14} />
                <span>توليد تلقائي YYYY/MM/DD ⚡</span>
              </button>
              <button
                type="button"
                onClick={handleGenerateNewUpcomingDates}
                className="m3-btn m3-btn-outlined m3-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#059669', borderColor: '#10b981', backgroundColor: '#ecfdf5' }}
                title="توليد تواريخ جديدة تبدأ من أقرب موعد قادم للفوج (تواريخ جديدة)"
              >
                <RotateCw size={14} />
                <span>تواريخ جديدة قادمة 📅</span>
              </button>
              <button
                type="button"
                onClick={handleAddSession}
                className="m3-btn m3-btn-tonal m3-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                title="إضافة حصة إضافية لهذا الفوج"
              >
                <span>+ إضافة حصة</span>
              </button>
              {editableDates.length > 1 && (
                <button
                  type="button"
                  onClick={handleRemoveSession}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ color: 'var(--md-sys-color-error)', borderColor: 'var(--md-sys-color-error)' }}
                  title="حذف آخر حصة من الفوج"
                >
                  <span>- حذف آخر حصة</span>
                </button>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: '8px' }}>
            {editableDates.map((date, idx) => (
              <div key={idx}>
                <label style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '3px' }}>
                  حصة {idx + 1}
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    placeholder="YYYY/MM/DD"
                    value={date ?? ''}
                    onChange={(e) => handleDateChange(idx, e.target.value, false)}
                    onBlur={(e) => {
                      if (e.target.value) {
                        handleDateChange(idx, e.target.value, true);
                      }
                    }}
                    className="m3-input"
                    style={{
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      direction: 'ltr',
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      flex: 1
                    }}
                  />
                  <input
                    type="date"
                    value={date && /^\d{4}\/\d{2}\/\d{2}$/.test(date) ? date.replace(/\//g, '-') : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleDateChange(idx, e.target.value, true);
                      }
                    }}
                    title="اختيار التاريخ من التقويم"
                    style={{
                      width: '28px',
                      padding: '2px',
                      cursor: 'pointer',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button onClick={handleSaveDates} className="m3-btn m3-btn-primary m3-btn-sm">
              حفظ التواريخ (YYYY/MM/DD)
            </button>
          </div>
        </div>
      )}

      {/* Quick Legend Guide */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.8rem',
          color: 'var(--md-sys-color-on-surface-variant)',
          flexWrap: 'wrap'
        }}
      >
        <span style={{ fontWeight: 700 }}>دليل الحضور:</span>
        <span className="m3-chip m3-chip-p">P حاضر</span>
        <span className="m3-chip m3-chip-a">A غائب</span>
        <span className="m3-chip m3-chip-m">M تعويض</span>

        {todaySessionIndex !== -1 && (
          <button
            type="button"
            onClick={() => markAllPresent(group.groupId, todaySessionIndex, filteredStudents.map((s) => s.rowId))}
            className="m3-btn m3-btn-filled m3-btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              backgroundColor: 'var(--md-sys-color-primary)',
              borderRadius: 'var(--md-shape-full)',
              cursor: 'pointer'
            }}
            title={`تسجيل حضور جميع التلاميذ لحصة اليوم (حصة ${todaySessionIndex + 1})`}
          >
            <CheckCheck size={14} />
            <span>تحضير الكل لحصة اليوم (ح{todaySessionIndex + 1})</span>
          </button>
        )}

        {/* Live Total Attendance for Selected Session with Session Switcher */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            border: '1.5px solid var(--md-sys-color-outline-variant)',
            padding: '3px 10px',
            borderRadius: 'var(--md-shape-full)',
            flexWrap: 'wrap'
          }}
        >
          {/* Interactive Session Switcher */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              إحصائيات الحصة:
            </span>
            <select
              value={selectedSessionStatsIndex}
              onChange={(e) => setSelectedSessionStatsIndex(Number(e.target.value))}
              style={{
                padding: '2px 8px',
                fontSize: '0.75rem',
                fontWeight: 800,
                borderRadius: '6px',
                border: '1px solid var(--md-sys-color-outline)',
                backgroundColor: 'var(--md-sys-color-surface)',
                color: 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                outline: 'none'
              }}
              title="اختر أي حصة لعرض إجمالي الحضور والغياب الخاص بها فوراً"
            >
              {group.sessionDates.map((d, sIdx) => {
                const formattedDate = formatToYYYYMMDD(d);
                const isToday = isSessionDateToday(formattedDate || d);
                return (
                  <option key={sIdx} value={sIdx}>
                    الحصة {sIdx + 1} {isToday ? '★ (اليوم)' : ''} ({formattedDate || d || `ح${sIdx + 1}`})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Present Total Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
              fontWeight: 800,
              fontSize: '0.76rem',
              whiteSpace: 'nowrap'
            }}
            title={`عدد الحاضرين في الحصة ${selectedSessionStatsIndex + 1}: ${sessionAttendanceStats.present} من أصل ${sessionAttendanceStats.total} (${sessionAttendanceStats.rate}%)`}
          >
            <span>حاضر:</span>
            <strong style={{ fontSize: '0.84rem' }}>{sessionAttendanceStats.present}</strong>
            <span style={{ fontSize: '0.68rem', opacity: 0.85 }}>/ {sessionAttendanceStats.total}</span>
          </span>

          {/* Absent Total Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fca5a5',
              fontWeight: 800,
              fontSize: '0.76rem',
              whiteSpace: 'nowrap'
            }}
            title={`عدد الغائبين في الحصة ${selectedSessionStatsIndex + 1}: ${sessionAttendanceStats.absent}`}
          >
            <span>غائب:</span>
            <strong style={{ fontSize: '0.84rem' }}>{sessionAttendanceStats.absent}</strong>
          </span>

          {/* Makeup Badge (if any) */}
          {sessionAttendanceStats.makeup > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--md-shape-full)',
                backgroundColor: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                fontWeight: 800,
                fontSize: '0.76rem',
                whiteSpace: 'nowrap'
              }}
              title={`عدد تلاميذ التعويض في الحصة ${selectedSessionStatsIndex + 1}: ${sessionAttendanceStats.makeup}`}
            >
              <span>تعويض:</span>
              <strong style={{ fontSize: '0.84rem' }}>{sessionAttendanceStats.makeup}</strong>
            </span>
          )}

          {/* Unmarked Badge (if any) */}
          {sessionAttendanceStats.unmarked > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--md-shape-full)',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                color: 'var(--md-sys-color-on-surface-variant)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                fontWeight: 700,
                fontSize: '0.76rem',
                whiteSpace: 'nowrap'
              }}
              title={`تلاميذ لم تُسجل حالتهم بعد في الحصة ${selectedSessionStatsIndex + 1}: ${sessionAttendanceStats.unmarked}`}
            >
              <span>لم يمسح:</span>
              <strong style={{ fontSize: '0.84rem' }}>{sessionAttendanceStats.unmarked}</strong>
            </span>
          )}
        </div>

        <span style={{ marginInlineStart: 'auto', fontStyle: 'italic' }}>
          عرض {filteredStudents.length} من أصل {realStudents.length} تلميذ
        </span>
      </div>

      {/* Attendance & Financial Table */}
      <div className="m3-table-container">
        <table className="m3-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
              <th style={{ minWidth: '170px' }}>الاسم واللقب</th>
              <th style={{ minWidth: '110px' }}>الهاتف</th>
              {/* Session Columns */}
              {group.sessionDates.map((d, i) => {
                const formattedDate = formatToYYYYMMDD(d);
                const isToday = isSessionDateToday(formattedDate || d);
                const targetStudents = filteredStudents.length > 0 ? filteredStudents : realStudents;
                const isAllPresent = targetStudents.length > 0 && targetStudents.every((s) => s.attendance[i] === 'P');
                const presentCount = targetStudents.filter((s) => s.attendance[i] === 'P').length;
                const isSelected = selectedSessionStatsIndex === i;

                return (
                  <th
                    key={i}
                    onClick={() => setSelectedSessionStatsIndex(i)}
                    style={{
                      textAlign: 'center',
                      minWidth: '86px',
                      padding: '8px 4px',
                      cursor: 'pointer',
                      backgroundColor: isToday
                        ? 'var(--md-sys-color-primary-container)'
                        : isSelected
                        ? 'var(--md-sys-color-surface-container-highest)'
                        : 'var(--md-sys-color-surface-container-high)',
                      outline: isSelected
                        ? '2.5px solid var(--md-sys-color-primary)'
                        : isToday
                        ? '2px dashed var(--md-sys-color-primary)'
                        : undefined,
                      outlineOffset: '-2px',
                      transition: 'all 0.15s ease'
                    }}
                    title={`انقر لاختيار الحصة ${i + 1} وعرض إجمالي حضورها`}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'var(--md-sys-color-on-primary-container)' : undefined }}>
                      ح {i + 1} {isToday ? '★' : ''} {isSelected && !isToday ? '●' : ''}
                    </div>
                    <div
                      style={{
                        fontSize: '0.68rem',
                        color: isToday ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                        fontWeight: isToday || isSelected ? 700 : 500,
                        direction: 'ltr',
                        unicodeBidi: 'plaintext',
                        fontFamily: 'monospace',
                        letterSpacing: '0.3px',
                        display: 'block'
                      }}
                      title={formattedDate || d}
                    >
                      {formattedDate || d || `حصة ${i + 1}`}
                    </div>
                    {isToday && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                        (اليوم)
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        color: presentCount > 0 ? '#15803d' : 'var(--md-sys-color-outline)',
                        marginTop: '2px'
                      }}
                      title={`حاضر: ${presentCount} من ${targetStudents.length}`}
                    >
                      {presentCount}/{targetStudents.length} حاضر
                    </div>
                    {/* Mark All Present and End Session Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAllPresent(group.groupId, i, filteredStudents.map((s) => s.rowId));
                        }}
                        style={{
                          padding: '3px 4px',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          borderRadius: 'var(--md-shape-full)',
                          border: isAllPresent
                            ? '1px solid #10b981'
                            : isToday
                            ? '1px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: isAllPresent
                            ? '#d1fae5'
                            : isToday
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-surface-container-highest)',
                          color: isAllPresent
                            ? '#065f46'
                            : isToday
                            ? 'var(--md-sys-color-on-primary)'
                            : 'var(--md-sys-color-on-surface)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          width: '100%',
                          maxWidth: '82px',
                          margin: '0 auto',
                          boxShadow: isToday && !isAllPresent ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title={
                          isAllPresent
                            ? `جميع التلاميذ حاضرون (${presentCount}/${targetStudents.length}) — اضغط لإلغاء التحديد`
                            : `تسجيل حضور الجميع للحصة ${i + 1} (${presentCount}/${targetStudents.length})`
                        }
                      >
                        <CheckCheck size={11} />
                        <span>الكل حاضر</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEndSession(i);
                        }}
                        style={{
                          padding: '2px 4px',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          borderRadius: 'var(--md-shape-full)',
                          border: '1px solid #ef4444',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '2px',
                          width: '100%',
                          maxWidth: '82px',
                          margin: '0 auto',
                          transition: 'all 0.15s ease'
                        }}
                        title={`إنهاء الحصة ${i + 1} وتثبيت الغياب التلقائي (A) لمن لم يمسح بطاقته`}
                      >
                        <UserX size={10} />
                        <span>إنهاء الحصة</span>
                      </button>
                    </div>
                  </th>
                );
              })}
              <th style={{ textAlign: 'center' }}>التخفيض</th>
              <th style={{ textAlign: 'center' }}>المجموع</th>
              <th style={{ textAlign: 'center' }}>المسدد</th>
              <th style={{ textAlign: 'center' }}>الدين</th>
              <th style={{ textAlign: 'center' }}>حضور</th>
              <th style={{ textAlign: 'center', width: '90px' }}>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={group.sessionDates.length + 8} style={{ textAlign: 'center', padding: '36px', color: 'var(--md-sys-color-outline)' }}>
                  لا توجد نتائج مطابقة للبحث أو التصفية الحالية.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, sIdx) => {
                const cycleSessions = group.sessionCount || 4;
                const groupEnded = isGroupEnded(group, undefined, data.pricingTiers);
                const sessionInfo = getStudentSessionInfo(student.attendance, cycleSessions, student.totalReceived, groupEnded);
                const studentCountedSessions = sessionInfo.countedSessions;

                return (
                  <tr key={student.rowId}>
                    <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                      {sIdx + 1}
                    </td>

                    {/* Student Name */}
                    <td style={{ fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                      {student.name}
                    </td>

                    {/* Phone */}
                    <td style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {student.phone || '—'}
                    </td>

                    {/* Dynamic Attendance Session Cells */}
                    {Array.from({ length: group.sessionDates.length }).map((_, sessionIdx) => {
                      const status = student.attendance[sessionIdx] || '';
                      const isCounted = sessionInfo.isSessionCounted(sessionIdx);
                      let chipClass = '';
                      if (status === 'P') chipClass = 'm3-chip-p';
                      else if (status === 'A') chipClass = 'm3-chip-a';
                      else if (status === 'M') chipClass = 'm3-chip-m';

                      let cellTitle = 'اضغط لتغيير حالة الحضور (P / A / M)';
                      if (status === '') {
                        if (!isCounted) {
                          cellTitle = 'حصة غير محتسبة — لم ينضم التلميذ بعد للفوج (اضغط لتسجيل الحضور)';
                        } else {
                          cellTitle = 'حصة محتسبة — التلميذ مسجل رسمياً في الفوج (اضغط لتغيير الحالة)';
                        }
                      }

                      return (
                        <td
                          key={sessionIdx}
                          onClick={() => cycleAttendance(group.groupId, student.rowId, sessionIdx)}
                          style={{
                            textAlign: 'center',
                            cursor: 'pointer',
                            padding: '4px',
                            userSelect: 'none'
                          }}
                          title={cellTitle}
                        >
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              margin: '0 auto',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 'var(--md-shape-sm)',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                              transition: 'var(--transition-standard)',
                              opacity: status === '' && !isCounted ? 0.45 : 1,
                              color: status === '' && !isCounted ? 'var(--md-sys-color-outline)' : undefined
                            }}
                            className={chipClass || undefined}
                          >
                            {status || '—'}
                          </div>
                        </td>
                      );
                    })}

                    {/* Discount Badge */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        onClick={() => setActiveStudentForPayment(student)}
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: 'var(--md-shape-sm)',
                          backgroundColor:
                            student.discount === '0'
                              ? 'var(--status-exempt-container)'
                              : student.discount === '0.8'
                              ? 'var(--status-makeup-container)'
                              : 'var(--md-sys-color-surface-container)',
                          color:
                            student.discount === '0'
                              ? 'var(--status-exempt)'
                              : student.discount === '0.8'
                              ? 'var(--status-makeup)'
                              : 'var(--md-sys-color-on-surface)'
                        }}
                      >
                        {student.discount === '0'
                          ? 'معفى'
                          : student.discount === '0.8'
                          ? '20%-'
                          : student.discount === 'تعويض'
                          ? 'تعويض'
                          : 'عادي'}
                      </span>
                    </td>

                    {/* Total Fee */}
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {student.fee.toLocaleString()}
                    </td>

                    {/* Total Received (Clickable to open payment modal) */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => setActiveStudentForPayment(student)}
                        className="m3-btn m3-btn-sm"
                        style={{
                          padding: '3px 8px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          backgroundColor: 'var(--status-present-container)',
                          color: 'var(--status-present)',
                          borderRadius: 'var(--md-shape-sm)'
                        }}
                        title="إدارة الدفعات والوصل"
                      >
                        {student.totalReceived.toLocaleString()} دج
                      </button>
                    </td>

                    {/* Debt */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.9rem',
                          color:
                            student.debt > 0
                              ? 'var(--status-absent)'
                              : student.fee === 0 && student.totalReceived === 0
                              ? 'var(--md-sys-color-outline)'
                              : 'var(--status-present)'
                        }}
                      >
                        {student.debt > 0
                          ? `${student.debt.toLocaleString()} دج`
                          : student.fee === 0 && student.totalReceived === 0
                          ? '—'
                          : 'مسدد ✓'}
                      </span>
                    </td>

                    {/* Total Attendance */}
                    <td
                      dir="ltr"
                      style={{ textAlign: 'center', fontWeight: 800 }}
                      title={`${student.totalAttendance} حضور من أصل ${studentCountedSessions} حصص محتسبة لهذا التلميذ`}
                    >
                      {student.totalAttendance} / {studentCountedSessions}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <button
                          onClick={() => setActiveStudentForPayment(student)}
                          className="m3-btn-text"
                          title="تسجيل دفعة وطباعة وصل"
                          style={{ padding: '6px', color: 'var(--md-sys-color-primary)' }}
                        >
                          <CreditCard size={17} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف التلميذ "${student.name}" من هذا الفوج؟`)) {
                              deleteStudent(group.groupId, student.rowId);
                            }
                          }}
                          className="m3-btn-text"
                          title="حذف التلميذ"
                          style={{ padding: '6px', color: 'var(--md-sys-color-error)' }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Payment & Installment Modal */}
      {activeStudentForPayment && (
        <StudentPaymentModal
          groupId={group.groupId}
          student={activeStudentForPayment}
          onClose={() => setActiveStudentForPayment(null)}
        />
      )}

      {/* Add Student Modal */}
      {isAddStudentOpen && (
        <AddStudentModal groupId={group.groupId} onClose={() => setIsAddStudentOpen(false)} />
      )}

      {/* Thermal Receipts 80mm Modal */}
      {isThermalModalOpen && (
        <ThermalReceiptsModal group={group} onClose={() => setIsThermalModalOpen(false)} />
      )}

      {/* Edit Group Modal */}
      {isEditFinancesOpen && (
        <EditGroupModal groupId={group.groupId} onClose={() => setIsEditFinancesOpen(false)} />
      )}

      {/* Renew Group / Rollover Modal */}
      {isRenewModalOpen && (
        <RenewGroupModal
          sourceGroupId={group.groupId}
          onClose={() => setIsRenewModalOpen(false)}
        />
      )}

      {/* Batch Print All Student Badges of Current Group */}
      {isGroupBadgesModalOpen && (
        <GroupBadgesModal
          groupId={group.groupId}
          students={realStudents}
          onClose={() => setIsGroupBadgesModalOpen(false)}
        />
      )}

      {/* Security PIN Modal to unlock financial statistics */}
      <SecurityPinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={() => setShowFinancialStats(true)}
        title="تأكيد إظهار الإحصائيات المالية"
        description="يرجى إدخال رمز الأمان (1234) لعرض المداخيل ومستحقات الفوج"
        expectedPin="1234"
      />

      {/* Hourly and Daily Payments Filter Modal */}
      {isHourlyModalOpen && (
        <HourlyPaymentFilterModal
          isOpen={isHourlyModalOpen}
          onClose={() => setIsHourlyModalOpen(false)}
          initialGroupId={group.groupId}
        />
      )}

      {/* Session Payments Check & Batch Entry Modal */}
      {isSessionPaymentsModalOpen && (
        <GroupSessionPaymentsModal
          group={group}
          initialSessionIdx={selectedSessionStatsIndex}
          onClose={() => setIsSessionPaymentsModalOpen(false)}
        />
      )}

      {/* Teacher Payment Modal for this group only */}
      {isGroupTeacherPayModalOpen && currentGroupTeacher && (
        <TeacherPaymentModal
          teacher={currentGroupTeacher}
          stats={groupTeacherStats}
          specificGroupId={group.groupId}
          onClose={() => setIsGroupTeacherPayModalOpen(false)}
        />
      )}
    </div>
  );
}

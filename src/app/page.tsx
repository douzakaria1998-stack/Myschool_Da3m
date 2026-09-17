'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import { StudentRecord } from '../types';
import {
  Users,
  CreditCard,
  GraduationCap,
  CalendarCheck,
  ArrowUpRight,
  Sparkles,
  Search,
  PlusCircle,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  Calendar,
  UserPlus,
  RotateCw,
  Eye,
  EyeOff,
  Phone,
  Receipt,
  Download,
  FileText,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Filter,
  ExternalLink,
  Edit3
} from 'lucide-react';
import AddGroupModal from '../components/AddGroupModal';
import EditGroupModal from '../components/EditGroupModal';
import MultiGroupStudentEnrollModal from '../components/MultiGroupStudentEnrollModal';
import MultiGroupPaymentModal from '../components/MultiGroupPaymentModal';
import RenewGroupModal from '../components/RenewGroupModal';
import StudentProfileModal from '../components/StudentProfileModal';
import StudentPaymentModal from '../components/StudentPaymentModal';
import {
  isGroupToday,
  getTodayArabicDayName,
  getGroupStatus,
  isGroupActive,
  formatGroupTime,
  isSummaryRow,
  sortGroupsActiveFirstOldToNew
} from '../utils/sessionUtils';

export default function DashboardPage() {
  const { data, getCenterStats, getGroupStats, setSelectedGroup, lang } = useApp();

  // Dynamic Period & Scope Filter state for Stats
  const [statsPeriodType, setStatsPeriodType] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'prev_month' | 'custom'>('all');
  const [statsCustomStart, setStatsCustomStart] = useState('');
  const [statsCustomEnd, setStatsCustomEnd] = useState('');
  const [statsGroupScope, setStatsGroupScope] = useState<'all' | 'regular' | 'vip'>('all');
  const [statsSpecificGroup, setStatsSpecificGroup] = useState<string>('all');

  const stats = useMemo(() => {
    return getCenterStats({
      periodType: statsPeriodType,
      startDate: statsPeriodType === 'custom' ? statsCustomStart : undefined,
      endDate: statsPeriodType === 'custom' ? statsCustomEnd : undefined,
      groupType: statsGroupScope,
      groupId: statsSpecificGroup
    });
  }, [getCenterStats, statsPeriodType, statsCustomStart, statsCustomEnd, statsGroupScope, statsSpecificGroup, data]);

  // Groups state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'today' | 'regular' | 'vip'>('all');
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [isMultiPaymentOpen, setIsMultiPaymentOpen] = useState(false);
  const [renewingGroupId, setRenewingGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // Student Section state
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGroupFilter, setStudentGroupFilter] = useState('all');
  const [studentStatusFilter, setStudentStatusFilter] = useState<'all' | 'debt' | 'paid' | 'exempt' | 'vip'>('all');
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(25);
  const [selectedStudentProfile, setSelectedStudentProfile] = useState<{ student: StudentRecord; groupId: string } | null>(null);
  const [activePaymentModal, setActivePaymentModal] = useState<{ student: StudentRecord; groupId: string } | null>(null);

  const todayDayName = getTodayArabicDayName();
  const todayGroupsCount = data.groups.filter((g) => isGroupToday(g, data.groupData[g.id])).length;
  const activeGroupsCount = data.groups.filter((g) => isGroupActive(g, data.groupData[g.id], data.pricingTiers)).length;
  const inactiveGroupsCount = data.groups.length - activeGroupsCount;

  // Filter and sort groups: ALWAYS start with active groups from oldest to newest ID
  const filteredGroups = useMemo(() => {
    const matched = data.groups.filter((g) => {
      const matchesSearch =
        g.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.teacherName.toLowerCase().includes(searchQuery.toLowerCase());

      if (filterType === 'active') return matchesSearch && isGroupActive(g, data.groupData[g.id], data.pricingTiers);
      if (filterType === 'inactive') return matchesSearch && !isGroupActive(g, data.groupData[g.id], data.pricingTiers);
      if (filterType === 'today') return matchesSearch && isGroupToday(g, data.groupData[g.id]);
      if (filterType === 'regular') return matchesSearch && !g.isVip;
      if (filterType === 'vip') return matchesSearch && g.isVip;
      return matchesSearch;
    });

    return sortGroupsActiveFirstOldToNew(matched, data.groupData, data.pricingTiers);
  }, [data.groups, data.groupData, data.pricingTiers, searchQuery, filterType]);

  // Flatten all students across all groups
  interface FlatStudent {
    groupId: string;
    groupType: string;
    subject: string;
    teacherName: string;
    isVip: boolean;
    sessionCount: number;
    sessionDates: string[];
    student: StudentRecord;
  }

  const allStudents = useMemo(() => {
    const list: FlatStudent[] = [];
    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      (gSheet.students || []).forEach((s) => {
        if (isSummaryRow(s, gid)) return;
        list.push({
          groupId: gid,
          groupType: gSheet.type,
          subject: gSheet.subject,
          teacherName: gSheet.teacherName,
          isVip: gSheet.isVip,
          sessionCount: gSheet.sessionDates?.length || gSheet.sessionCount || 4,
          sessionDates: gSheet.sessionDates || [],
          student: s
        });
      });
    });
    return list;
  }, [data.groupData]);

  // Counts for quick chips
  const debtorsCount = useMemo(() => allStudents.filter((s) => (s.student.debt || 0) > 0).length, [allStudents]);
  const paidCount = useMemo(() => allStudents.filter((s) => (s.student.debt || 0) === 0 && (s.student.fee || 0) > 0).length, [allStudents]);
  const exemptCount = useMemo(() => allStudents.filter((s) => s.student.discount === '0').length, [allStudents]);

  // Filter students (supports Name, Student ID / Barcode, Phone, Group, Subject, Teacher)
  const filteredStudents = useMemo(() => {
    const rawQ = studentSearch.trim();
    if (!rawQ) {
      return allStudents.filter((item) => {
        const matchesGroup = studentGroupFilter === 'all' || item.groupId === studentGroupFilter;
        if (!matchesGroup) return false;
        if (studentStatusFilter === 'debt') return (item.student.debt || 0) > 0;
        if (studentStatusFilter === 'paid') return (item.student.debt || 0) === 0 && (item.student.fee || 0) > 0;
        if (studentStatusFilter === 'exempt') return item.student.discount === '0';
        if (studentStatusFilter === 'vip') return item.isVip;
        return true;
      });
    }

    const q = rawQ.toLowerCase();
    const normalizedDigits = q.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const cleanDigits = normalizedDigits.replace(/\D/g, '');

    return allStudents.filter((item) => {
      const barcode = (item.student.barcode || '').toLowerCase();
      const matchesId =
        (barcode && (barcode.includes(q) || barcode.includes(normalizedDigits))) ||
        (cleanDigits.length >= 2 && barcode.replace(/\D/g, '').includes(cleanDigits)) ||
        (cleanDigits.length > 0 && String(item.student.rowId) === cleanDigits);

      const matchesSearch =
        matchesId ||
        item.student.name.toLowerCase().includes(q) ||
        (item.student.phone && (item.student.phone.includes(q) || item.student.phone.includes(cleanDigits))) ||
        item.groupId.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q);

      const matchesGroup = studentGroupFilter === 'all' || item.groupId === studentGroupFilter;

      if (!matchesSearch || !matchesGroup) return false;

      if (studentStatusFilter === 'debt') return (item.student.debt || 0) > 0;
      if (studentStatusFilter === 'paid') return (item.student.debt || 0) === 0 && (item.student.fee || 0) > 0;
      if (studentStatusFilter === 'exempt') return item.student.discount === '0';
      if (studentStatusFilter === 'vip') return item.isVip;

      return true;
    });
  }, [allStudents, studentSearch, studentGroupFilter, studentStatusFilter]);

  // Pagination
  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const paginatedStudents = useMemo(() => {
    if (studentPageSize >= 9999) return filteredStudents;
    const start = (studentPage - 1) * studentPageSize;
    return filteredStudents.slice(start, start + studentPageSize);
  }, [filteredStudents, studentPage, studentPageSize]);

  // Export CSV
  const handleExportStudentsCsv = () => {
    const headers = ['#', 'الاسم واللقب', 'الهاتف', 'الفوج', 'نوع الفوج', 'المادة', 'الأستاذ', 'نوع التسجيل', 'المطلوب (دج)', 'المسدد (دج)', 'الدين (دج)', 'الحصص المحضورة', 'إجمالي الحصص'];
    const rows = filteredStudents.map((item, idx) => [
      idx + 1,
      `"${item.student.name}"`,
      `"${item.student.phone || ''}"`,
      item.groupId,
      item.isVip ? 'VIP' : 'عادي',
      item.subject,
      `"${item.teacherName}"`,
      item.student.discount === '0' ? 'معفى' : item.student.discount === '0.8' ? '20%' : item.student.discount === 'تعويض' ? 'تعويض' : 'عادي',
      item.student.fee,
      item.student.totalReceived,
      item.student.debt,
      item.student.totalAttendance,
      item.sessionCount
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `بيانات_التلاميذ_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Welcome & Overview Header */}
      <div
        className="m3-card-elevated"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, var(--md-sys-color-primary-container) 0%, var(--md-sys-color-surface-container-high) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
          <img
            src="/logo.svg"
            alt={data.centerName}
            style={{
              height: '56px',
              width: 'auto',
              objectFit: 'contain',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              padding: '6px 12px',
              borderRadius: 'var(--md-shape-sm)',
              boxShadow: 'var(--md-elevation-1)'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <Sparkles size={22} color="var(--md-sys-color-primary)" />
              <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--md-sys-color-on-primary-container)' }}>
                مرحباً بكم في {data.centerName}
              </h2>
            </div>
            <p style={{ color: 'var(--md-sys-color-on-primary-container)', opacity: 0.9, fontSize: '0.95rem' }}>
              متابعة شاملة للحصص، تسجيل حضور التلاميذ، اقتسام الأتعاب مع الأساتذة ومراقبة مداخيل المركز
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsEnrollModalOpen(true)}
            className="m3-btn m3-btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--status-present)',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
            }}
          >
            <UserPlus size={18} />
            <span>تسجيل تلميذ ودفع (فوج أو أكثر)</span>
          </button>
          <button
            onClick={() => setIsAddGroupOpen(true)}
            className="m3-btn m3-btn-tonal"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FolderPlus size={18} />
            <span>إنشاء فوج جديد</span>
          </button>
          <Link
            href="/attendance"
            className="m3-btn m3-btn-tonal"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <CalendarCheck size={18} />
            <span>تسجيل الحضور</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowStats(!showStats)}
            className="m3-btn m3-btn-outlined"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: showStats ? 'var(--md-sys-color-primary-container)' : undefined,
              color: showStats ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface-variant)',
              borderColor: showStats ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'
            }}
            title={showStats ? 'إخفاء الإحصائيات العامة والمالية' : 'إظهار الإحصائيات العامة والمالية'}
          >
            {showStats ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>{showStats ? 'إخفاء الإحصائيات' : 'إظهار الإحصائيات'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMultiPaymentOpen(true)}
            className="m3-btn m3-btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
            }}
            title="تسديد مالي لتلميذ في عدة أفواج معاً واستخراج وصل موحد شامل"
          >
            <CreditCard size={18} />
            <span>تسديد جديد (فوج أو أكثر)</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Section with Dynamic Period Filter */}
      {showStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', animation: 'fadeIn 0.2s ease-in-out' }}>
          {/* Dynamic Period & Scope Filter Toolbar */}
          <div
            className="m3-card"
            style={{
              padding: '10px 16px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRadius: 'var(--md-shape-md)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {/* Period Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--md-sys-color-primary)', fontWeight: 700, fontSize: '0.8rem', marginLeft: '4px' }}>
                  <Calendar size={15} />
                  <span>الفترة:</span>
                </div>
                {[
                  { id: 'all', label: 'كامل الموسم' },
                  { id: 'today', label: 'اليوم' },
                  { id: 'this_week', label: 'هذا الأسبوع' },
                  { id: 'this_month', label: 'شهر سبتمبر' },
                  { id: 'prev_month', label: 'شهر أوت' },
                  { id: 'custom', label: 'مخصصة 📅' }
                ].map((p) => {
                  const isActive = statsPeriodType === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setStatsPeriodType(p.id as any)}
                      style={{
                        padding: '3px 10px',
                        borderRadius: '14px',
                        fontSize: '0.78rem',
                        fontWeight: isActive ? 700 : 500,
                        backgroundColor: isActive ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface)',
                        color: isActive ? '#ffffff' : 'var(--md-sys-color-on-surface)',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.12)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Group Scope Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--md-sys-color-secondary)', fontWeight: 700, fontSize: '0.78rem' }}>
                  <Filter size={14} />
                  <span>الفوج:</span>
                </div>
                <select
                  value={statsGroupScope}
                  onChange={(e) => {
                    setStatsGroupScope(e.target.value as any);
                    setStatsSpecificGroup('all');
                  }}
                  className="m3-input"
                  style={{ width: 'auto', minWidth: '115px', maxWidth: '140px', padding: '3px 8px', fontSize: '0.78rem', height: '30px', borderRadius: '6px' }}
                >
                  <option value="all">كافة الأفواج (24)</option>
                  <option value="regular">أفواج عادية (9)</option>
                  <option value="vip">أفواج VIP (15)</option>
                </select>

                <select
                  value={statsSpecificGroup}
                  onChange={(e) => {
                    setStatsSpecificGroup(e.target.value);
                  }}
                  className="m3-input"
                  style={{ width: 'auto', minWidth: '130px', maxWidth: '180px', padding: '3px 8px', fontSize: '0.78rem', height: '30px', borderRadius: '6px' }}
                >
                  <option value="all">جميع الأفواج المحددة</option>
                  {data.groups
                    .filter((g) => {
                      if (statsGroupScope === 'regular') return !g.isVip;
                      if (statsGroupScope === 'vip') return g.isVip;
                      return true;
                    })
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.id} - {g.subject} ({g.teacherName})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range Controls */}
            {statsPeriodType === 'custom' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 12px',
                  backgroundColor: 'var(--md-sys-color-surface)',
                  borderRadius: 'var(--md-shape-sm)',
                  border: '1px dashed var(--md-sys-color-primary)',
                  flexWrap: 'wrap',
                  animation: 'fadeIn 0.2s ease-in-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>من:</span>
                  <input
                    type="date"
                    value={statsCustomStart}
                    onChange={(e) => setStatsCustomStart(e.target.value)}
                    className="m3-input"
                    style={{ width: 'auto', padding: '2px 8px', fontSize: '0.78rem', height: '28px' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>إلى:</span>
                  <input
                    type="date"
                    value={statsCustomEnd}
                    onChange={(e) => setStatsCustomEnd(e.target.value)}
                    className="m3-input"
                    style={{ width: 'auto', padding: '2px 8px', fontSize: '0.78rem', height: '28px' }}
                  />
                </div>
                {(statsCustomStart || statsCustomEnd) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatsCustomStart('');
                      setStatsCustomEnd('');
                    }}
                    className="m3-btn m3-btn-outlined"
                    style={{ padding: '2px 8px', fontSize: '0.72rem', height: '28px' }}
                  >
                    مسح التواريخ
                  </button>
                )}
              </div>
            )}

            {/* Active Period Status Info Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '4px',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface-variant)',
                flexWrap: 'wrap',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-present)'
                  }}
                />
                <span>
                  <strong>النطاق النشط:</strong> {stats.periodLabel || 'كامل الموسم'} • موزعة على{' '}
                  <strong>{stats.totalGroups}</strong> فوج •{' '}
                  <strong>{stats.matchingSessionsCount ?? stats.totalGroups * 4}</strong> حصة
                </span>
              </div>
              {(statsPeriodType !== 'all' || statsGroupScope !== 'all' || statsSpecificGroup !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatsPeriodType('all');
                    setStatsCustomStart('');
                    setStatsCustomEnd('');
                    setStatsGroupScope('all');
                    setStatsSpecificGroup('all');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--md-sys-color-primary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textDecoration: 'underline'
                  }}
                >
                  <RotateCw size={11} />
                  <span>إعادة الضبط للإجمالي</span>
                </button>
              )}
            </div>
          </div>

          <div className="m3-grid-stats">
          {/* Active & Total Students Card */}
          <div className="m3-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
                    {lang === 'ar' ? 'التلاميذ النشطين' : 'Active Students'}
                  </span>
                  <span
                    style={{
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      color: '#b45309',
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px'
                    }}
                  >
                    Active Users
                  </span>
                </div>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--md-sys-color-primary)'
                  }}
                >
                  <Users size={16} />
                </div>
              </div>

              {/* Big Active Users Display */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                  {stats.activeStudents ?? stats.totalStudents}
                </div>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                  {lang === 'ar' ? 'تلميذ نشط' : 'Active Students'}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: 'var(--md-sys-color-on-surface-variant)',
                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                    padding: '1px 6px',
                    borderRadius: '6px'
                  }}
                >
                  {lang === 'ar'
                    ? `(${stats.activeGroups ?? stats.totalGroups} فوج نشط)`
                    : `(${stats.activeGroups ?? stats.totalGroups} active)`}
                </span>
              </div>
            </div>

            {/* Total Users Info Section */}
            <div
              style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '4px',
                fontSize: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#dc2626',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    padding: '1px 5px',
                    borderRadius: '6px'
                  }}
                >
                  Total Users
                </span>
                <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                  إجمالي المسجلين:
                </span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                {stats.totalStudents !== (stats.totalCenterStudents || 1100)
                  ? `${stats.totalStudents} (${stats.totalCenterStudents || 1100} بالمركز)`
                  : `${stats.totalCenterStudents || 1100}`}{' '}
                تلميذ ({stats.totalGroups} فوج)
              </span>
            </div>
          </div>

          {/* Total Collected */}
          <div className="m3-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--status-present)' }}>
                  المبالغ المحصلة (مجموع المستلم)
                </span>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-present-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--status-present)'
                  }}
                >
                  <CheckCircle2 size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-present)' }}>
                {stats.totalReceived.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>دج</span>
              </div>
            </div>
            <div
              style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              من إجمالي متوقع: {stats.totalExpected.toLocaleString()} دج
            </div>
          </div>

          {/* Outstanding Debts */}
          <div className="m3-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--status-absent)' }}>
                  إجمالي ديون المركز (لدى الطلبة)
                </span>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--status-absent-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--status-absent)'
                  }}
                >
                  <AlertTriangle size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-absent)' }}>
                {stats.totalDebt.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>دج</span>
              </div>
            </div>
            <div
              style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface-variant)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <Link href="/students" style={{ color: 'var(--status-absent)', textDecoration: 'underline' }}>
                معاينة ديون الطلبة
              </Link>
              <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                (على عاتق المركز فقط)
              </span>
            </div>
          </div>

          {/* Center Net Share */}
          <div className="m3-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                  حصة المركز الصافية (المدرسة)
                </span>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--md-sys-color-primary)'
                  }}
                >
                  <CreditCard size={16} />
                </div>
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                {stats.totalSchoolEarn.toLocaleString()} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>دج</span>
              </div>
            </div>
            <div
              style={{
                marginTop: '8px',
                paddingTop: '6px',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface-variant)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>مستحقات الأساتذة:</span>
                <strong>{stats.totalTeacherPay.toLocaleString()} دج</strong>
              </div>
              <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--status-present)', marginTop: '1px', fontWeight: 600 }}>
                (مضمونة: 75% VIP • 60% عادي)
              </span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Group Directory & Quick Jump */}
      <div className="m3-card" style={{ padding: '24px' }}>
        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px'
          }}
        >
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              الأفواج الدراسية والحصص النشطة ({data.groups.length})
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              اضغط على أي فوج لفتح كشف الحضور والمالية الخاص به مباشرة
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن فوج أو أستاذ..."
                className="m3-input"
                style={{ paddingInlineStart: '36px', paddingBlock: '8px', fontSize: '0.85rem' }}
              />
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  insetInlineStart: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
            </div>

            {/* Segmented Filter */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderRadius: 'var(--md-shape-full)',
                padding: '3px',
                gap: '2px',
                overflowX: 'auto'
              }}
            >
              {[
                { id: 'all', label: 'الكل' },
                { id: 'active', label: 'النشطة', count: activeGroupsCount },
                { id: 'inactive', label: 'المكتملة (غير النشطة)', count: inactiveGroupsCount },
                { id: 'today', label: `أفواج اليوم (${todayDayName})`, count: todayGroupsCount },
                { id: 'regular', label: 'عادي (BAC)' },
                { id: 'vip', label: 'خاص (VIP)' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--md-shape-full)',
                    border: 'none',
                    backgroundColor: filterType === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                    color: filterType === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    transition: 'var(--transition-standard)'
                  }}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && (
                    <span
                      style={{
                        backgroundColor: filterType === tab.id
                          ? 'rgba(255, 255, 255, 0.28)'
                          : tab.id === 'inactive'
                          ? 'var(--md-sys-color-surface-container-high)'
                          : 'var(--status-present-container)',
                        color: filterType === tab.id
                          ? '#ffffff'
                          : tab.id === 'inactive'
                          ? 'var(--md-sys-color-outline)'
                          : 'var(--status-present)',
                        borderRadius: 'var(--md-shape-full)',
                        padding: '1px 7px',
                        fontSize: '0.72rem',
                        fontWeight: 800
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Groups Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
            alignItems: 'start'
          }}
        >
          {filteredGroups.map((group) => {
            const groupStats = getGroupStats(group.id);
            const groupInfo = data.groupData[group.id];
            const isToday = isGroupToday(group, groupInfo);
            const statusInfo = getGroupStatus(group, groupInfo, data.pricingTiers);

            return (
              <div
                key={group.id}
                className="m3-card"
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  opacity: statusInfo.status === 'inactive' ? 0.94 : 1,
                  border: isToday
                    ? '2px solid var(--md-sys-color-primary)'
                    : group.isVip
                    ? '1.5px solid var(--status-vip)'
                    : statusInfo.status === 'inactive'
                    ? '1px dashed var(--md-sys-color-outline-variant)'
                    : '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                {/* Header Row: Group ID + Status on right, Edit on left (strictly one line) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  {/* Right side: Group ID + Status Badge + Today/VIP */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--md-sys-color-primary)',
                        whiteSpace: 'nowrap',
                        lineHeight: 1
                      }}
                    >
                      {group.id}
                    </span>

                    {/* Active vs Inactive Status Badge directly next to group ID */}
                    {statusInfo.status === 'active' ? (
                      <span
                        className="m3-chip"
                        style={{
                          backgroundColor: 'var(--status-present-container)',
                          color: 'var(--status-present)',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          padding: '2px 7px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title={`فوج نشط - أنجز ${statusInfo.currentSession} من أصل ${statusInfo.totalSessions} حصص`}
                      >
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-present)' }} />
                        <span>نشط ({statusInfo.currentSession}/{statusInfo.totalSessions})</span>
                      </span>
                    ) : (
                      <span
                        className="m3-chip"
                        style={{
                          backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                          color: 'var(--md-sys-color-outline)',
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          padding: '2px 7px',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          whiteSpace: 'nowrap'
                        }}
                        title={`فوج غير نشط - بلغ آخر حصة (${statusInfo.totalSessions}/${statusInfo.totalSessions})`}
                      >
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                        <span>غير نشط ({statusInfo.totalSessions}/{statusInfo.totalSessions})</span>
                      </span>
                    )}

                    {isToday && (
                      <span
                        className="m3-chip"
                        style={{
                          backgroundColor: 'var(--status-present-container)',
                          color: 'var(--status-present)',
                          fontWeight: 800,
                          border: '1px solid var(--status-present)',
                          padding: '2px 6px',
                          fontSize: '0.7rem',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        اليوم ★
                      </span>
                    )}
                    {group.isVip && (
                      <span
                        className="m3-chip m3-chip-vip"
                        style={{
                          whiteSpace: 'nowrap',
                          fontSize: '0.7rem',
                          padding: '2px 7px'
                        }}
                      >
                        VIP خاص
                      </span>
                    )}
                  </div>

                  {/* Left side: Edit button aligned to the left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingGroupId(group.id);
                      }}
                      className="m3-btn-text"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: 'var(--md-shape-sm)',
                        backgroundColor: 'var(--md-sys-color-surface-container-high)',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        color: 'var(--md-sys-color-primary)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'var(--transition-standard)',
                        whiteSpace: 'nowrap'
                      }}
                      title="تعديل جميع معلومات الفوج"
                    >
                      <Edit3 size={12} />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>

                {/* Rollover / New ID Button: Placed below, sized to the whole space (width: 100%) */}
                {statusInfo.status === 'inactive' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setRenewingGroupId(group.id);
                    }}
                    className="m3-btn-text"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      borderRadius: 'var(--md-shape-sm)',
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                      border: '1px solid var(--md-sys-color-primary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'var(--transition-standard)'
                    }}
                    title="فتح دورة جديدة ونقل التلاميذ الذين حضروا الحصة الأولى"
                  >
                    <RotateCw size={13} />
                    <span>دورة جديدة 🔁</span>
                  </button>
                )}

                {/* Teacher name first, then subject, after that time in ONE line */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    backgroundColor: isToday ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
                    border: isToday ? '1px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                    padding: '7px 10px',
                    borderRadius: 'var(--md-shape-sm)',
                    fontSize: '0.82rem'
                  }}
                >
                  <span style={{ color: isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)' }}>
                    الأستاذ: <strong>{group.teacherName}</strong>
                  </span>

                  <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>•</span>

                  <strong style={{ color: 'var(--md-sys-color-primary)', fontWeight: 800, fontSize: '0.86rem' }}>
                    {group.subject}
                  </strong>

                  <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>•</span>

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)' }}>
                    <Calendar size={13} color={isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-primary)'} />
                    <span>
                      {group.day1} ({formatGroupTime(group.time1) || 'صباحاً'})
                      {group.day2 ? ` • ${group.day2} (${formatGroupTime(group.time2)})` : ''}
                    </span>
                    {isToday && <span style={{ fontWeight: 800, color: 'var(--status-present)', marginInlineStart: '4px' }}>★ موعد اليوم</span>}
                  </div>
                </div>

                {/* Micro stats */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      padding: '8px 4px',
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      borderRadius: 'var(--md-shape-sm)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>التلاميذ</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{groupStats.studentCount}</div>
                  </div>
                  <div
                    style={{
                      padding: '8px 4px',
                      backgroundColor: 'var(--status-present-container)',
                      borderRadius: 'var(--md-shape-sm)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--status-present)' }}>المحصل</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--status-present)' }}>
                      {groupStats.totalReceived.toLocaleString()}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: '8px 4px',
                      backgroundColor: groupStats.totalDebt > 0 ? 'var(--status-absent-container)' : 'var(--md-sys-color-surface-container)',
                      borderRadius: 'var(--md-shape-sm)'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: groupStats.totalDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface-variant)' }}>
                      الديون
                    </div>
                    <div
                      style={{
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        color: groupStats.totalDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface)'
                      }}
                    >
                      {groupStats.totalDebt.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link
                    href="/attendance"
                    onClick={() => setSelectedGroup(group.id)}
                    className="m3-btn m3-btn-primary m3-btn-sm"
                    style={{ flex: 1, textDecoration: 'none' }}
                  >
                    <span>كشف الحضور</span>
                    <ArrowUpRight size={16} />
                  </Link>
                  <Link
                    href="/print"
                    onClick={() => setSelectedGroup(group.id)}
                    className="m3-btn m3-btn-outlined m3-btn-sm"
                    style={{ textDecoration: 'none' }}
                    title="طباعة كشف الفوج"
                  >
                    <span>طباعة</span>
                  </Link>
                </div>
              </div>
            );
          })}

          {filteredGroups.length === 0 && (
            <div
              className="m3-card"
              style={{
                gridColumn: '1 / -1',
                padding: '44px 20px',
                textAlign: 'center',
                color: 'var(--md-sys-color-outline)'
              }}
            >
              <Calendar size={38} style={{ margin: '0 auto 12px', color: 'var(--md-sys-color-primary)' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', marginBottom: '6px' }}>
                {filterType === 'today' ? `لا توجد أفواج مبرمجة لليوم (${todayDayName})` : 'لا توجد نتائج مطابقة للبحث'}
              </h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {filterType === 'today'
                  ? 'يمكنك الاطلاع على جدول باقي أيام الأسبوع باختيار "الكل" أعلاه.'
                  : 'يرجى التحقق من مصطلح البحث.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Comprehensive Student Data Section */}
      <div className="m3-card" style={{ padding: '24px', marginTop: '24px' }}>
          {/* Header & Controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={22} color="var(--md-sys-color-primary)" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)', margin: 0 }}>
                  سجل وبيانات جميع التلاميذ ({filteredStudents.length} / {allStudents.length})
                </h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface-variant)', margin: '4px 0 0 0' }}>
                يتضمن جميع بيانات التلميذ: أرقام الهواتف، الفوج والأستاذ، حضور كل حصة بالتفصيل، المبالغ المسددة، والديون
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleExportStudentsCsv}
                className="m3-btn m3-btn-outlined m3-btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="تصدير جميع بيانات التلاميذ إلى ملف CSV / Excel"
              >
                <Download size={15} />
                <span>تصدير CSV</span>
              </button>
            </div>
          </div>

          {/* Search, Filter by Group & Status Chips */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px'
            }}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search input */}
              <div style={{ position: 'relative', width: '310px' }}>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.preventDefault();
                  }}
                  placeholder="ابحث بالاسم، المعرّف (ID)، الهاتف، الفوج..."
                  className="m3-input"
                  style={{ paddingInlineStart: '34px', paddingBlock: '7px', fontSize: '0.82rem' }}
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
              </div>

              {/* Group filter dropdown */}
              <select
                value={studentGroupFilter}
                onChange={(e) => {
                  setStudentGroupFilter(e.target.value);
                  setStudentPage(1);
                }}
                className="m3-input"
                style={{ width: '170px', paddingBlock: '7px', fontSize: '0.82rem' }}
              >
                <option value="all">كل الأفواج ({data.groups.length})</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    فوج {g.id} {g.isVip ? '★ VIP' : ''} ({g.subject})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter Chips */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                borderRadius: 'var(--md-shape-full)',
                padding: '3px',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'all', label: `الكل (${allStudents.length})` },
                { id: 'debt', label: `عليهم دين (${debtorsCount})` },
                { id: 'paid', label: `مسدد بالكامل (${paidCount})` },
                { id: 'exempt', label: `معفى (${exemptCount})` },
                { id: 'vip', label: 'أفواج VIP ★' }
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setStudentStatusFilter(chip.id as any);
                    setStudentPage(1);
                  }}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--md-shape-full)',
                    border: 'none',
                    backgroundColor: studentStatusFilter === chip.id ? 'var(--md-sys-color-primary)' : 'transparent',
                    color: studentStatusFilter === chip.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Students Comprehensive Data Table */}
          <div className="m3-table-container" style={{ border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 'var(--md-shape-sm)' }}>
            <table className="m3-table" style={{ fontSize: '0.8rem', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '36px', textAlign: 'center', padding: '10px 4px', whiteSpace: 'nowrap' }}>#</th>
                  <th style={{ minWidth: '150px', padding: '10px 8px', whiteSpace: 'nowrap' }}>اسم ولقب التلميذ</th>
                  <th style={{ minWidth: '110px', textAlign: 'center', padding: '10px 8px', whiteSpace: 'nowrap' }}>الهاتف</th>
                  <th style={{ minWidth: '95px', textAlign: 'center', padding: '10px 8px', whiteSpace: 'nowrap' }}>الفوج</th>
                  <th style={{ minWidth: '170px', padding: '10px 8px', whiteSpace: 'nowrap' }}>المادة والأستاذ</th>
                  <th style={{ minWidth: '90px', textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>نوع التسجيل</th>
                  <th style={{ minWidth: '95px', textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>المطلوب</th>
                  <th style={{ minWidth: '95px', textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>المسدد</th>
                  <th style={{ minWidth: '100px', textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>الدين المتبقي</th>
                  <th style={{ minWidth: '115px', textAlign: 'center', padding: '10px 6px', whiteSpace: 'nowrap' }}>سجل الحصص</th>
                  <th
                    style={{
                      width: '120px',
                      minWidth: '120px',
                      textAlign: 'center',
                      padding: '8px 8px',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      left: 0,
                      zIndex: 11,
                      backgroundColor: 'var(--md-sys-color-surface-container)',
                      boxShadow: '-3px 0 6px rgba(0, 0, 0, 0.08)',
                      borderInlineStart: '1px solid var(--md-sys-color-outline-variant)'
                    }}
                  >
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '36px', color: 'var(--md-sys-color-outline)' }}>
                      لا يوجد تلاميذ مطابقين لمعايير البحث والتصفية.
                    </td>
                  </tr>
                ) : (
                  paginatedStudents.map((item, idx) => {
                    const absIdx = (studentPage - 1) * studentPageSize + idx + 1;
                    const maxSessions = item.sessionCount || 4;

                    return (
                      <tr
                        key={`${item.groupId}-${item.student.rowId}`}
                        onClick={() => setSelectedStudentProfile({ student: item.student, groupId: item.groupId })}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: idx % 2 === 1 ? 'var(--md-sys-color-surface-container-lowest)' : 'transparent',
                          transition: 'background-color 0.15s ease'
                        }}
                        className="clickable-student-row"
                        title="اضغط على أي مكان في السطر لفتح الملف الشامل للتلميذ"
                      >
                        <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                          {absIdx}
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--md-sys-color-primary)', padding: '6px 8px', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                          <span>{item.student.name}</span>
                        </td>
                        <td style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.75rem', textAlign: 'center', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          {item.student.phone ? (
                            <a
                              href={`tel:${item.student.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ color: 'inherit', textDecoration: 'none', direction: 'ltr', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                            >
                              <Phone size={11} />
                              {item.student.phone}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 800,
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              color: item.isVip ? 'var(--status-vip)' : 'var(--md-sys-color-primary)',
                              backgroundColor: item.isVip ? 'var(--md-sys-color-surface-container)' : 'var(--md-sys-color-primary-container)',
                              padding: '2px 7px',
                              borderRadius: 'var(--md-shape-sm)'
                            }}
                          >
                            {item.groupId} {item.isVip ? '★ VIP' : ''}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700 }}>{item.subject}</span>
                          <span style={{ color: 'var(--md-sys-color-outline)', margin: '0 4px' }}>•</span>
                          <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{item.teacherName}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 4px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '2px 6px',
                              whiteSpace: 'nowrap',
                              borderRadius: 'var(--md-shape-sm)',
                              backgroundColor:
                                item.student.discount === '0'
                                  ? 'var(--status-exempt-container)'
                                  : item.student.discount === '0.8'
                                  ? 'var(--status-makeup-container)'
                                  : 'var(--md-sys-color-surface-container)',
                              color:
                                item.student.discount === '0'
                                  ? 'var(--status-exempt)'
                                  : item.student.discount === '0.8'
                                  ? 'var(--status-makeup)'
                                  : 'var(--md-sys-color-on-surface)'
                            }}
                          >
                            {item.student.discount === '0'
                              ? 'معفى'
                              : item.student.discount === '0.8'
                              ? 'تخفيض 20%'
                              : item.student.discount === 'تعويض'
                              ? 'تعويض'
                              : 'عادي'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, padding: '6px 6px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {(item.student.fee || 0).toLocaleString()} دج
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--status-present)', fontWeight: 800, padding: '6px 6px', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                          {(item.student.totalReceived || 0).toLocaleString()} دج
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              whiteSpace: 'nowrap',
                              color: (item.student.debt || 0) > 0 ? 'var(--status-absent)' : 'var(--status-present)'
                            }}
                          >
                            {(item.student.debt || 0) > 0 ? `${(item.student.debt || 0).toLocaleString()} دج` : 'خالص ✓'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                          <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                            {Array.from({ length: Math.min(maxSessions, 4) }).map((_, sIdx) => {
                              const att = item.student.attendance?.[sIdx];
                              const isP = att === 'P';
                              const isA = att === 'A';
                              const isM = att === 'M';

                              return (
                                <span
                                  key={sIdx}
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.62rem',
                                    fontWeight: 800,
                                    backgroundColor: isP
                                      ? 'var(--status-present-container)'
                                      : isA
                                      ? 'var(--status-absent-container)'
                                      : isM
                                      ? 'var(--status-makeup-container)'
                                      : 'var(--md-sys-color-surface-container)',
                                    color: isP
                                      ? 'var(--status-present)'
                                      : isA
                                      ? 'var(--status-absent)'
                                      : isM
                                      ? 'var(--status-makeup)'
                                      : 'var(--md-sys-color-outline)'
                                  }}
                                  title={`حصة ${sIdx + 1}: ${isP ? 'حاضر' : isA ? 'غائب' : isM ? 'تعويض' : 'لم تسجل'}`}
                                >
                                  {isP ? '✓' : isA ? '✕' : isM ? 'ع' : '—'}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, padding: '6px 4px', fontSize: '0.78rem' }}>
                          {item.student.totalAttendance || 0}/{item.sessionCount}
                        </td>
                        <td
                          style={{
                            textAlign: 'center',
                            padding: '6px 8px',
                            whiteSpace: 'nowrap',
                            position: 'sticky',
                            left: 0,
                            zIndex: 10,
                            backgroundColor: idx % 2 === 1 ? 'var(--md-sys-color-surface-container-lowest)' : 'var(--md-sys-color-surface)',
                            boxShadow: '-3px 0 6px rgba(0, 0, 0, 0.08)',
                            borderInlineStart: '1px solid var(--md-sys-color-outline-variant)'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: 'inline-flex', gap: '5px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentProfile({ student: item.student, groupId: item.groupId });
                              }}
                              className="m3-btn m3-btn-outlined m3-btn-sm"
                              style={{ padding: '2px 7px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                              title="عرض كافة بيانات وسجل الحضور والمالية للتلميذ"
                            >
                              <FileText size={12} />
                              <span>الملف</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActivePaymentModal({ student: item.student, groupId: item.groupId });
                              }}
                              className="m3-btn m3-btn-primary m3-btn-sm"
                              style={{ padding: '2px 7px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                              title="تسديد دفعة جديدة أو طباعة وصل"
                            >
                              <Receipt size={12} />
                              <span>دفع</span>
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

          {/* Table Footer: Pagination & Page Size */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginTop: '14px',
              paddingTop: '10px',
              borderTop: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>
                عرض <strong>{filteredStudents.length > 0 ? (studentPage - 1) * studentPageSize + 1 : 0}</strong> إلى{' '}
                <strong>{Math.min(studentPage * studentPageSize, filteredStudents.length)}</strong> من أصل{' '}
                <strong>{filteredStudents.length}</strong> سجل
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem' }}>عدد الأسطر:</span>
                <select
                  value={studentPageSize}
                  onChange={(e) => {
                    setStudentPageSize(Number(e.target.value));
                    setStudentPage(1);
                  }}
                  className="m3-input"
                  style={{ padding: '2px 6px', fontSize: '0.75rem', width: '70px' }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={9999}>الكل</option>
                </select>
              </div>
            </div>

            {totalStudentPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  disabled={studentPage <= 1}
                  onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ padding: '3px 8px', opacity: studentPage <= 1 ? 0.5 : 1 }}
                >
                  <ChevronRight size={14} />
                  <span>السابق</span>
                </button>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  {studentPage} / {totalStudentPages}
                </span>
                <button
                  type="button"
                  disabled={studentPage >= totalStudentPages}
                  onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ padding: '3px 8px', opacity: studentPage >= totalStudentPages ? 0.5 : 1 }}
                >
                  <span>التالي</span>
                  <ChevronLeft size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

      {isAddGroupOpen && <AddGroupModal onClose={() => setIsAddGroupOpen(false)} />}
      <MultiGroupStudentEnrollModal isOpen={isEnrollModalOpen} onClose={() => setIsEnrollModalOpen(false)} />
      <MultiGroupPaymentModal isOpen={isMultiPaymentOpen} onClose={() => setIsMultiPaymentOpen(false)} />
      {renewingGroupId && (
        <RenewGroupModal
          sourceGroupId={renewingGroupId}
          onClose={() => setRenewingGroupId(null)}
        />
      )}
      {editingGroupId && (
        <EditGroupModal
          groupId={editingGroupId}
          onClose={() => setEditingGroupId(null)}
        />
      )}

      {/* Student Profile Dossier Modal */}
      {selectedStudentProfile && (
        <StudentProfileModal
          student={selectedStudentProfile.student}
          groupId={selectedStudentProfile.groupId}
          onClose={() => setSelectedStudentProfile(null)}
        />
      )}

      {/* Direct Payment / Receipt Modal */}
      {activePaymentModal && (
        <StudentPaymentModal
          student={activePaymentModal.student}
          groupId={activePaymentModal.groupId}
          onClose={() => setActivePaymentModal(null)}
        />
      )}
    </div>
  );
}

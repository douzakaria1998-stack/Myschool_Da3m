'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { StudentRecord } from '../../types';
import {
  Users,
  Search,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Phone,
  ArrowUpDown,
  Download,
  Receipt,
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles,
  DollarSign,
  IdCard,
  Printer
} from 'lucide-react';
import StudentPaymentModal from '../../components/StudentPaymentModal';
import StudentProfileModal from '../../components/StudentProfileModal';
import StudentBadgeModal from '../../components/StudentBadgeModal';
import { isSummaryRow } from '../../utils/sessionUtils';

export interface GroupEnrollment {
  groupId: string;
  groupType: string;
  subject: string;
  teacherName: string;
  isVip: boolean;
  sessionCount: number;
  student: StudentRecord;
}

export interface UnifiedStudent {
  key: string;
  name: string;
  phone: string;
  groups: GroupEnrollment[];
  totalFee: number;
  totalReceived: number;
  totalDebt: number;
  balance: number; // totalReceived - totalFee
  totalAttended: number;
  totalPossibleSessions: number;
  primaryGroupId: string;
  primaryStudentRecord: StudentRecord;
}

export default function StudentsPage() {
  const { data } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'paid' | 'multi' | 'vip'>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activePaymentStudent, setActivePaymentStudent] = useState<{ groupId: string; student: StudentRecord } | null>(null);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<{ student: StudentRecord; groupId: string } | null>(null);
  const [activeBadgeStudent, setActiveBadgeStudent] = useState<{
    student: StudentRecord;
    groupId: string;
    allGroups: string[];
  } | null>(null);

  // Consolidate students so each student can have multiple groups and an aggregate balance
  const allStudents = useMemo(() => {
    const map = new Map<string, UnifiedStudent>();

    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      gSheet.students.forEach((s) => {
        if (isSummaryRow(s, gid) || !s.name || !s.name.trim()) return;
        const cleanName = s.name.trim();
        const phone = s.phone ? s.phone.trim() : '';
        const key = cleanName.toLowerCase();

        const enrollment: GroupEnrollment = {
          groupId: gid,
          groupType: gSheet.type,
          subject: gSheet.subject,
          teacherName: gSheet.teacherName,
          isVip: gSheet.isVip,
          sessionCount: gSheet.sessionDates?.length || gSheet.sessionCount || 4,
          student: s
        };

        if (!map.has(key)) {
          map.set(key, {
            key,
            name: cleanName,
            phone,
            groups: [enrollment],
            totalFee: s.fee || 0,
            totalReceived: s.totalReceived || 0,
            totalDebt: s.debt || 0,
            balance: (s.totalReceived || 0) - (s.fee || 0),
            totalAttended: s.totalAttendance || 0,
            totalPossibleSessions: enrollment.sessionCount,
            primaryGroupId: gid,
            primaryStudentRecord: s
          });
        } else {
          const item = map.get(key)!;
          if (phone && !item.phone) item.phone = phone;
          item.groups.push(enrollment);
          item.totalFee += (s.fee || 0);
          item.totalReceived += (s.totalReceived || 0);
          item.totalDebt += (s.debt || 0);
          item.balance = item.totalReceived - item.totalFee;
          item.totalAttended += (s.totalAttendance || 0);
          item.totalPossibleSessions += enrollment.sessionCount;
        }
      });
    });

    return Array.from(map.values());
  }, [data]);

  // Statistics
  const totalStudents = allStudents.length;
  const multiGroupList = allStudents.filter((item) => item.groups.length > 1);
  const positiveBalanceList = allStudents.filter((item) => item.balance >= 0);
  const negativeBalanceList = allStudents.filter((item) => item.balance < 0);
  const vipList = allStudents.filter((item) => item.groups.some((g) => g.isVip));

  // Filtered students
  const filteredStudents = useMemo(() => {
    return allStudents.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.phone && item.phone.includes(q)) ||
        item.groups.some(
          (g) =>
            g.groupId.toLowerCase().includes(q) ||
            g.subject.toLowerCase().includes(q) ||
            g.teacherName.toLowerCase().includes(q)
        );

      const matchesGroup =
        selectedGroupFilter === 'all' ||
        item.groups.some((g) => g.groupId === selectedGroupFilter);

      if (!matchesSearch || !matchesGroup) return false;

      if (filterType === 'debt') return item.balance < 0;
      if (filterType === 'paid') return item.balance >= 0;
      if (filterType === 'multi') return item.groups.length > 1;
      if (filterType === 'vip') return item.groups.some((g) => g.isVip);
      return true;
    });
  }, [allStudents, search, selectedGroupFilter, filterType]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const paginatedStudents = useMemo(() => {
    if (pageSize >= 9999) return filteredStudents;
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page, pageSize]);

  // Export all filtered students to CSV
  const handleExportAllCsv = () => {
    const headers = [
      '#',
      'الاسم واللقب',
      'الهاتف',
      'الأفواج المسجل بها',
      'عدد الأفواج',
      'المطلوب الإجمالي (دج)',
      'المسدد الإجمالي (دج)',
      'الدين الإجمالي (دج)',
      'الرصيد المالي (دج)',
      'حالة الرصيد'
    ];
    const rows = filteredStudents.map((item, idx) => [
      idx + 1,
      `"${item.name}"`,
      `"${item.phone || ''}"`,
      `"${item.groups.map((g) => `${g.groupId} (${g.subject})`).join(' | ')}"`,
      item.groups.length,
      item.totalFee,
      item.totalReceived,
      item.totalDebt,
      item.balance,
      item.balance >= 0 ? 'موجب / مسدد' : 'سالب / دين'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل_التلاميذ_والأرصدة_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export negative balance (debt) report to CSV
  const handleExportDebtsCsv = () => {
    const headers = ['#', 'الاسم واللقب', 'الهاتف', 'الأفواج', 'المطلوب (دج)', 'المسدد (دج)', 'الرصيد السالب (دج)'];
    const rows = negativeBalanceList.map((item, idx) => [
      idx + 1,
      `"${item.name}"`,
      `"${item.phone || ''}"`,
      `"${item.groups.map((g) => g.groupId).join(', ')}"`,
      item.totalFee,
      item.totalReceived,
      item.balance
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل_الديون_والأرصدة_السالبة_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Statistics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px'
        }}
      >
        <div
          className="m3-card"
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--md-shape-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: 'var(--md-sys-color-surface-container)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              إجمالي التلاميذ
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              {totalStudents.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          className="m3-card"
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--md-shape-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: 'var(--md-sys-color-surface-container)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              في عدة أفواج
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0369a1' }}>
              {multiGroupList.length.toLocaleString()}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--md-sys-color-outline)', marginInlineStart: '4px' }}>
                ({totalStudents > 0 ? Math.round((multiGroupList.length / totalStudents) * 100) : 0}%)
              </span>
            </div>
          </div>
        </div>

        <div
          className="m3-card"
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--md-shape-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: 'var(--md-sys-color-surface-container)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              رصيد موجب / مسدد (≥ 0)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d' }}>
              {positiveBalanceList.length.toLocaleString()}
            </div>
          </div>
        </div>

        <div
          className="m3-card"
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--md-shape-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            backgroundColor: 'var(--md-sys-color-surface-container)'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 600 }}>
              رصيد سالب / ديون (&lt; 0)
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b91c1c' }}>
              {negativeBalanceList.length.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', width: '280px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث بالاسم، الهاتف، الفوج أو المادة..."
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

          {/* Group Filter */}
          <select
            value={selectedGroupFilter}
            onChange={(e) => {
              setSelectedGroupFilter(e.target.value);
              setPage(1);
            }}
            className="m3-input"
            style={{ width: '210px', paddingBlock: '8px', fontSize: '0.85rem' }}
          >
            <option value="all">كل الأفواج ({data.groups.length})</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                فوج {g.id} {g.isVip ? '★ VIP' : ''} ({g.subject})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Filter Chips */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              padding: '3px',
              flexWrap: 'wrap',
              gap: '4px'
            }}
          >
            {[
              { id: 'all', label: `الكل (${totalStudents})` },
              { id: 'debt', label: `رصيد سالب (${negativeBalanceList.length})` },
              { id: 'paid', label: `رصيد موجب (${positiveBalanceList.length})` },
              { id: 'multi', label: `في عدة أفواج (${multiGroupList.length})` },
              { id: 'vip', label: 'أفواج VIP ★' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id as any);
                  setPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--md-shape-full)',
                  border: 'none',
                  backgroundColor: filterType === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                  color: filterType === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportAllCsv}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
            title="تصدير جميع التلاميذ إلى ملف CSV"
          >
            <Download size={14} />
            <span>تصدير CSV</span>
          </button>
          <button
            onClick={handleExportDebtsCsv}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '6px 12px' }}
            title="تصدير قائمة ديون التلاميذ فقط"
          >
            <Download size={14} />
            <span>تصدير الديون</span>
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="m3-table-container">
        <table className="m3-table">
          <thead>
            <tr>
              <th style={{ width: '36px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 4px' }}>#</th>
              <th style={{ minWidth: '150px', whiteSpace: 'nowrap', padding: '8px 8px' }}>اسم ولقب التلميذ</th>
              <th style={{ minWidth: '95px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>رقم الهاتف</th>
              <th style={{ minWidth: '220px', whiteSpace: 'nowrap', padding: '8px 8px' }}>الأفواج المسجل بها</th>
              <th style={{ minWidth: '85px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>المطلوب الإجمالي</th>
              <th style={{ minWidth: '85px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>المسدد الإجمالي</th>
              <th style={{ minWidth: '85px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>الدين الإجمالي</th>
              <th style={{ minWidth: '110px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 8px' }}>الرصيد المالي</th>
              <th style={{ minWidth: '80px', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>نسبة الحضور</th>
              <th
                style={{
                  width: '120px',
                  minWidth: '120px',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                  padding: '8px 8px',
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
                <td colSpan={10} style={{ textAlign: 'center', padding: '36px', color: 'var(--md-sys-color-outline)' }}>
                  لا يوجد تلاميذ مطابقون للتصفية الحالية.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((item, idx) => {
                const absIdx = (page - 1) * pageSize + idx + 1;
                const isPositive = item.balance >= 0;
                const attendanceRate =
                  item.totalPossibleSessions > 0
                    ? Math.round((item.totalAttended / item.totalPossibleSessions) * 100)
                    : 0;

                return (
                  <tr
                    key={item.key}
                    onClick={() =>
                      setSelectedProfileStudent({
                        student: item.primaryStudentRecord,
                        groupId: item.primaryGroupId
                      })
                    }
                    style={{
                      cursor: 'pointer',
                      backgroundColor: idx % 2 === 1 ? 'var(--md-sys-color-surface-container-lowest)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                    className="clickable-student-row"
                    title="اضغط على أي مكان في السطر لفتح الملف الشامل للتلميذ"
                  >
                    <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', whiteSpace: 'nowrap', padding: '8px 4px', fontSize: '0.8rem' }}>
                      {absIdx}
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--md-sys-color-primary)', whiteSpace: 'nowrap', padding: '8px 8px', fontSize: '0.86rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{item.name}</span>
                        {item.groups.length > 1 && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              backgroundColor: '#e0f2fe',
                              color: '#0369a1',
                              padding: '1px 6px',
                              borderRadius: 'var(--md-shape-full)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                            title={`مسجل في ${item.groups.length} أفواج`}
                          >
                            <Layers size={10} />
                            <span>{item.groups.length}</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>
                      {item.phone ? (
                        <a
                          href={`tel:${item.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'inherit', textDecoration: 'none', direction: 'ltr', display: 'inline-block' }}
                        >
                          {item.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    {/* Groups enrolled */}
                    <td style={{ padding: '8px 8px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        {item.groups.map((g) => (
                          <span
                            key={g.groupId}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProfileStudent({
                                student: g.student,
                                groupId: g.groupId
                              });
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 700,
                              fontSize: '0.74rem',
                              whiteSpace: 'nowrap',
                              color: g.isVip ? '#b45309' : 'var(--md-sys-color-primary)',
                              backgroundColor: g.isVip ? '#fef3c7' : 'var(--md-sys-color-primary-container)',
                              padding: '2px 8px',
                              borderRadius: 'var(--md-shape-full)',
                              border: g.isVip ? '1px solid #fde68a' : '1px solid var(--md-sys-color-outline-variant)',
                              cursor: 'pointer'
                            }}
                            title={`فوج ${g.groupId}: ${g.subject} (${g.teacherName}) - اضغط للمعاينة`}
                          >
                            <strong>{g.groupId}</strong>
                            <span>•</span>
                            <span>{g.subject}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Total Expected Fee */}
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', padding: '8px 6px' }}>
                      {item.totalFee.toLocaleString()} دج
                    </td>
                    {/* Total Received Paid */}
                    <td style={{ textAlign: 'center', color: '#15803d', fontWeight: 700, fontSize: '0.84rem', whiteSpace: 'nowrap', padding: '8px 6px' }}>
                      {item.totalReceived.toLocaleString()} دج
                    </td>
                    {/* Total Debt */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 6px' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.84rem',
                          color: item.totalDebt > 0 ? '#b91c1c' : '#15803d'
                        }}
                      >
                        {item.totalDebt > 0 ? `${item.totalDebt.toLocaleString()} دج` : '0 دج'}
                      </span>
                    </td>
                    {/* Balance: GREEN when >= 0, RED when < 0 */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '8px 8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          padding: '3px 10px',
                          borderRadius: 'var(--md-shape-full)',
                          backgroundColor: isPositive ? '#dcfce7' : '#fee2e2',
                          color: isPositive ? '#15803d' : '#b91c1c',
                          border: isPositive ? '1px solid #86efac' : '1px solid #fca5a5'
                        }}
                        title={isPositive ? 'رصيد موجب أو مسدد بالكامل (لا توجد ديون)' : 'رصيد سالب (مستحقات غير مسددة)'}
                      >
                        {isPositive ? '✓' : '✕'}
                        <span>
                          {isPositive && item.balance > 0 ? `+${item.balance.toLocaleString()}` : item.balance.toLocaleString()} دج
                        </span>
                      </span>
                    </td>
                    {/* Attendance */}
                    <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', whiteSpace: 'nowrap', padding: '8px 6px' }}>
                      <span style={{ color: attendanceRate >= 75 ? '#15803d' : attendanceRate >= 50 ? '#d97706' : '#b91c1c' }}>
                        {item.totalAttended} / {item.totalPossibleSessions}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-outline)', marginInlineStart: '3px' }}>
                        ({attendanceRate}%)
                      </span>
                    </td>
                    {/* Actions */}
                    <td
                      style={{
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        padding: '6px 8px',
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
                            setSelectedProfileStudent({
                              student: item.primaryStudentRecord,
                              groupId: item.primaryGroupId
                            });
                          }}
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                          title="عرض الملف الشامل وجميع الأفواج المسجل بها"
                        >
                          <FileText size={13} />
                          <span>الملف</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveBadgeStudent({
                              student: item.primaryStudentRecord,
                              groupId: item.primaryGroupId,
                              allGroups: item.groups.map((g) => g.groupId)
                            });
                          }}
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            whiteSpace: 'nowrap',
                            color: '#4f46e5',
                            borderColor: '#a5b4fc'
                          }}
                          title="طباعة بطاقة وشارة التلميذ PVC (85.6mm × 54mm)"
                        >
                          <IdCard size={13} />
                          <span>الشارة</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // If user has multiple groups, default to first or open payment modal
                            setActivePaymentStudent({
                              groupId: item.primaryGroupId,
                              student: item.primaryStudentRecord
                            });
                          }}
                          className="m3-btn m3-btn-primary m3-btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                          title="تسجيل دفعة جديدة"
                        >
                          <Receipt size={13} />
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
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
          <span>
            عرض <strong>{filteredStudents.length > 0 ? (page - 1) * pageSize + 1 : 0}</strong> إلى{' '}
            <strong>{Math.min(page * pageSize, filteredStudents.length)}</strong> من أصل{' '}
            <strong>{filteredStudents.length}</strong> تلميذ
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem' }}>عدد الأسطر:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
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

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ padding: '3px 8px', opacity: page <= 1 ? 0.5 : 1 }}
            >
              <ChevronRight size={14} />
              <span>السابق</span>
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ padding: '3px 8px', opacity: page >= totalPages ? 0.5 : 1 }}
            >
              <span>التالي</span>
              <ChevronLeft size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {activePaymentStudent && (
        <StudentPaymentModal
          groupId={activePaymentStudent.groupId}
          student={activePaymentStudent.student}
          onClose={() => setActivePaymentStudent(null)}
        />
      )}

      {/* Student Profile Modal */}
      {selectedProfileStudent && (
        <StudentProfileModal
          student={selectedProfileStudent.student}
          groupId={selectedProfileStudent.groupId}
          onClose={() => setSelectedProfileStudent(null)}
        />
      )}

      {/* PVC Badge Modal */}
      {activeBadgeStudent && (
        <StudentBadgeModal
          student={activeBadgeStudent.student}
          groupId={activeBadgeStudent.groupId}
          allGroups={activeBadgeStudent.allGroups}
          onClose={() => setActiveBadgeStudent(null)}
        />
      )}
    </div>
  );
}

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
  ChevronRight
} from 'lucide-react';
import StudentPaymentModal from '../../components/StudentPaymentModal';
import StudentProfileModal from '../../components/StudentProfileModal';
import { isSummaryRow } from '../../utils/sessionUtils';

interface FlatStudent {
  groupId: string;
  groupType: string;
  subject: string;
  teacherName: string;
  isVip: boolean;
  sessionCount: number;
  student: StudentRecord;
}

export default function StudentsPage() {
  const { data } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'paid' | 'exempt' | 'vip'>('all');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeStudentModal, setActiveStudentModal] = useState<{ groupId: string; student: StudentRecord } | null>(null);
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<{ student: StudentRecord; groupId: string } | null>(null);

  // Flatten all students across all groups
  const allStudents = useMemo(() => {
    const list: FlatStudent[] = [];
    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      gSheet.students.forEach((s) => {
        if (isSummaryRow(s, gid)) return;
        list.push({
          groupId: gid,
          groupType: gSheet.type,
          subject: gSheet.subject,
          teacherName: gSheet.teacherName,
          isVip: gSheet.isVip,
          sessionCount: gSheet.sessionDates?.length || gSheet.sessionCount || 4,
          student: s
        });
      });
    });
    return list;
  }, [data]);

  // Statistics
  const totalStudents = allStudents.length;
  const debtorsList = allStudents.filter((item) => item.student.debt > 0);
  const paidList = allStudents.filter((item) => item.student.debt === 0 && item.student.fee > 0);
  const exemptList = allStudents.filter((item) => item.student.discount === '0');

  // Filtered students
  const filteredStudents = useMemo(() => {
    return allStudents.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.student.name.toLowerCase().includes(q) ||
        (item.student.phone && item.student.phone.includes(q)) ||
        item.groupId.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q);

      const matchesGroup = selectedGroupFilter === 'all' || item.groupId === selectedGroupFilter;

      if (!matchesSearch || !matchesGroup) return false;

      if (filterType === 'debt') return item.student.debt > 0;
      if (filterType === 'paid') return item.student.debt === 0 && item.student.fee > 0;
      if (filterType === 'exempt') return item.student.discount === '0';
      if (filterType === 'vip') return item.isVip;
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

  // Export debt report to CSV
  const handleExportDebtsCsv = () => {
    const headers = ['#', 'الاسم واللقب', 'الهاتف', 'الفوج', 'المادة', 'الأستاذ', 'المطلوب (دج)', 'المسدد (دج)', 'الدين المتبقي (دج)'];
    const rows = debtorsList.map((item, idx) => [
      idx + 1,
      `"${item.student.name}"`,
      `"${item.student.phone || ''}"`,
      item.groupId,
      item.subject,
      `"${item.teacherName}"`,
      item.student.fee,
      item.student.totalReceived,
      item.student.debt
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل_ديون_الطلبة_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
              placeholder="ابحث بالاسم، الهاتف أو الفوج..."
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
            style={{ width: '190px', paddingBlock: '8px', fontSize: '0.85rem' }}
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
              { id: 'debt', label: `عليهم دين (${debtorsList.length})` },
              { id: 'paid', label: `مسدد بالكامل (${paidList.length})` },
              { id: 'exempt', label: `معفى (${exemptList.length})` },
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
              <th style={{ width: '40px', textAlign: 'center' }}>#</th>
              <th>اسم ولقب التلميذ</th>
              <th>رقم الهاتف</th>
              <th>الفوج</th>
              <th>المادة والأستاذ</th>
              <th style={{ textAlign: 'center' }}>نوع التسجيل</th>
              <th style={{ textAlign: 'center' }}>المطلوب</th>
              <th style={{ textAlign: 'center' }}>المسدد</th>
              <th style={{ textAlign: 'center' }}>الدين المتبقي</th>
              <th style={{ textAlign: 'center' }}>سجل الحصص</th>
              <th style={{ textAlign: 'center' }}>نسبة الحضور</th>
              <th style={{ textAlign: 'center', width: '130px' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '36px', color: 'var(--md-sys-color-outline)' }}>
                  لا يوجد تلاميذ مطابقون للتصفية الحالية.
                </td>
              </tr>
            ) : (
              paginatedStudents.map((item, idx) => {
                const absIdx = (page - 1) * pageSize + idx + 1;
                const maxSessions = item.sessionCount || 4;

                return (
                  <tr key={`${item.groupId}-${item.student.rowId}`}>
                    <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)' }}>{absIdx}</td>
                    <td style={{ fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedProfileStudent({
                            student: item.student,
                            groupId: item.groupId
                          })
                        }
                        className="m3-btn-text"
                        style={{
                          padding: 0,
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: 'var(--md-sys-color-primary)',
                          textAlign: 'right',
                          cursor: 'pointer'
                        }}
                        title="عرض الملف الشامل للتلميذ"
                      >
                        {item.student.name}
                      </button>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {item.student.phone ? (
                        <a href={`tel:${item.student.phone}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                          {item.student.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          color: item.isVip ? 'var(--status-vip)' : 'var(--md-sys-color-primary)'
                        }}
                      >
                        {item.groupId} {item.isVip ? '★' : ''}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      {item.subject} ({item.teacherName})
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
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
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {item.student.fee.toLocaleString()} دج
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--status-present)', fontWeight: 700 }}>
                      {item.student.totalReceived.toLocaleString()} دج
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          color: item.student.debt > 0 ? 'var(--status-absent)' : 'var(--status-present)'
                        }}
                      >
                        {item.student.debt > 0 ? `${item.student.debt.toLocaleString()} دج` : 'مسدد ✓'}
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
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {item.student.totalAttendance} / {item.sessionCount}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedProfileStudent({
                              student: item.student,
                              groupId: item.groupId
                            })
                          }
                          className="m3-btn m3-btn-outlined m3-btn-sm"
                          style={{ padding: '2px 7px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          title="عرض الملف الشامل وسجل الحضور"
                        >
                          <FileText size={13} />
                          <span>الملف</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveStudentModal({
                              groupId: item.groupId,
                              student: item.student
                            })
                          }
                          className="m3-btn m3-btn-primary m3-btn-sm"
                          style={{ padding: '2px 7px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                          title="تسجيل دفعة أو طباعة وصل"
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
            <strong>{filteredStudents.length}</strong> سجل
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
      {activeStudentModal && (
        <StudentPaymentModal
          groupId={activeStudentModal.groupId}
          student={activeStudentModal.student}
          onClose={() => setActiveStudentModal(null)}
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
    </div>
  );
}

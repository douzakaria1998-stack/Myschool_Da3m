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
  FileText
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
  const [filterType, setFilterType] = useState<'all' | 'debt' | 'paid' | 'exempt'>('debt');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
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
          sessionCount: gSheet.sessionDates?.length || gSheet.sessionCount || 8,
          student: s
        });
      });
    });
    return list;
  }, [data]);

  // Statistics
  const totalStudents = allStudents.length;
  const debtorsList = allStudents.filter((item) => item.student.debt > 0);
  const totalDebtAmount = debtorsList.reduce((sum, item) => sum + item.student.debt, 0);
  const totalPaidAmount = allStudents.reduce((sum, item) => sum + item.student.totalReceived, 0);

  // Filtered students
  const filteredStudents = allStudents.filter((item) => {
    const matchesSearch =
      item.student.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.student.phone && item.student.phone.includes(search)) ||
      item.groupId.toLowerCase().includes(search.toLowerCase());

    const matchesGroup = selectedGroupFilter === 'all' || item.groupId === selectedGroupFilter;

    if (!matchesSearch || !matchesGroup) return false;

    if (filterType === 'debt') return item.student.debt > 0;
    if (filterType === 'paid') return item.student.debt === 0 && item.student.fee > 0;
    if (filterType === 'exempt') return item.student.discount === '0';
    return true;
  });

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
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
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            دليل الطلبة وسجل الديون ({totalStudents} تلميذ)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            متابعة شاملة لجميع التلاميذ المسجلين في المركز، المبالغ المسددة، والديون غير المستوفاة
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportDebtsCsv}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} />
            <span>تصدير قائمة الديون CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="m3-grid-stats">
        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '6px' }}>
            إجمالي التلاميذ
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{totalStudents} تلميذ</div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--status-absent)', marginBottom: '6px' }}>
            الطلبة المدينون (عليهم دين)
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-absent)' }}>
            {debtorsList.length} تلميذ
          </div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--status-absent)', marginBottom: '6px' }}>
            إجمالي الديون المتبقية
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-absent)' }}>
            {totalDebtAmount.toLocaleString()} دج
          </div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--status-present)', marginBottom: '6px' }}>
            إجمالي المبالغ المحصلة
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--status-present)' }}>
            {totalPaidAmount.toLocaleString()} دج
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
              onChange={(e) => setSearch(e.target.value)}
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
            onChange={(e) => setSelectedGroupFilter(e.target.value)}
            className="m3-input"
            style={{ width: '180px', paddingBlock: '8px', fontSize: '0.85rem' }}
          >
            <option value="all">كل الأفواج ({data.groups.length})</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                فوج {g.id} {g.isVip ? '★ VIP' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Segmented Filter */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: 'var(--md-shape-full)',
            padding: '3px'
          }}
        >
          {[
            { id: 'debt', label: `عليهم دين (${debtorsList.length})` },
            { id: 'paid', label: 'مسدد بالكامل' },
            { id: 'exempt', label: 'معفى' },
            { id: 'all', label: 'جميع الطلبة' }
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
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
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
              <th style={{ textAlign: 'center' }}>نسبة الحضور</th>
              <th style={{ textAlign: 'center', width: '130px' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--md-sys-color-outline)' }}>
                  لا يوجد تلاميذ مطابقون للتصفية الحالية.
                </td>
              </tr>
            ) : (
              filteredStudents.map((item, idx) => (
                <tr key={`${item.groupId}-${item.student.rowId}`}>
                  <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)' }}>{idx + 1}</td>
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
              ))
            )}
          </tbody>
        </table>
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

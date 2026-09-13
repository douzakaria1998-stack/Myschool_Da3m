'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import TeacherPaymentModal from '../../components/TeacherPaymentModal';
import { isSummaryRow } from '../../utils/sessionUtils';
import {
  GraduationCap,
  Search,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Plus,
  Banknote,
  Download,
  Receipt,
  AlertCircle,
  Check,
  Users
} from 'lucide-react';

export default function TeachersPage() {
  const { data, setSelectedGroup, addTeacher } = useApp();
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'paid' | 'no-groups'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherSubject, setNewTeacherSubject] = useState('رياضيات');
  const [newTeacherPhone, setNewTeacherPhone] = useState('');

  // Selected teacher for paying
  const [payingTeacher, setPayingTeacher] = useState<any | null>(null);

  // Compute teacher statistics
  const teacherStats = data.teachers.map((teacher) => {
    // Find all groups assigned to this teacher
    const teacherGroups = data.groups.filter((g) => g.teacherName === teacher.name || g.teacherId === teacher.id);
    let totalStudents = 0;
    let totalTeacherPay = 0;
    let totalCollectedInGroups = 0;

    teacherGroups.forEach((g) => {
      const gSheet = data.groupData[g.id];
      if (gSheet && gSheet.students) {
        const realStudents = gSheet.students.filter((s) => !isSummaryRow(s, g.id));
        totalStudents += realStudents.length;
        realStudents.forEach((s) => {
          totalTeacherPay += s.teacherPay || 0;
          totalCollectedInGroups += s.totalReceived || 0;
        });
      }
    });

    const paidAmount = teacher.paidAmount || 0;
    const remainingDue = Math.max(0, totalTeacherPay - paidAmount);

    let paymentStatus: 'paid' | 'partial' | 'unpaid' | 'none';
    if (totalTeacherPay === 0) {
      paymentStatus = 'none';
    } else if (remainingDue <= 0) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    } else {
      paymentStatus = 'unpaid';
    }

    return {
      teacher,
      groups: teacherGroups,
      totalStudents,
      totalTeacherPay,
      totalCollectedInGroups,
      paidAmount,
      remainingDue,
      paymentStatus
    };
  });

  // Global KPIs across all teachers
  const totalAllTeacherPay = teacherStats.reduce((sum, t) => sum + t.totalTeacherPay, 0);
  const totalAllPaid = teacherStats.reduce((sum, t) => sum + t.paidAmount, 0);
  const totalAllRemaining = teacherStats.reduce((sum, t) => sum + t.remainingDue, 0);
  const totalAllStudents = teacherStats.reduce((sum, t) => sum + t.totalStudents, 0);

  // Filtering
  const filteredTeachers = teacherStats.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      t.teacher.name.toLowerCase().includes(q) ||
      t.teacher.subject.toLowerCase().includes(q) ||
      t.teacher.id.toLowerCase().includes(q) ||
      t.groups.some((g) => g.id.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterTab === 'pending') return t.remainingDue > 0 && t.totalTeacherPay > 0;
    if (filterTab === 'paid') return t.remainingDue === 0 && t.totalTeacherPay > 0;
    if (filterTab === 'no-groups') return t.groups.length === 0;
    return true;
  });

  // Export CSV
  const handleExportTeachersCsv = () => {
    let csv = '\uFEFFالرقم,المعرف,اسم الأستاذ,المادة,الهاتف,عدد الأفواج,الأفواج,إجمالي التلاميذ,المستحقات المحسوبة (دج),المسدد (دج),المتبقي (دج),حالة التسوية\n';
    filteredTeachers.forEach((item, idx) => {
      const gNames = item.groups.map((g) => g.id).join(' - ');
      const statusText =
        item.paymentStatus === 'paid'
          ? 'مسدد بالكامل'
          : item.paymentStatus === 'partial'
          ? 'تسديد جزئي'
          : item.paymentStatus === 'unpaid'
          ? 'غير مسدد'
          : 'بدون أفواج';
      csv += `"${idx + 1}","${item.teacher.id}","${item.teacher.name}","${item.teacher.subject}","${item.teacher.phone || ''}","${item.groups.length}","${gNames}","${item.totalStudents}","${item.totalTeacherPay}","${item.paidAmount}","${item.remainingDue}","${statusText}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `جدول_مستحقات_الأساتذة_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherName.trim()) return;

    const nextId = `D${(data.teachers.length + 1).toString().padStart(2, '0')}`;
    addTeacher({
      id: nextId,
      name: newTeacherName.trim(),
      subject: newTeacherSubject.trim(),
      phone: newTeacherPhone.trim(),
      paidAmount: 0,
      paymentHistory: []
    });

    setNewTeacherName('');
    setNewTeacherPhone('');
    setIsAddModalOpen(false);
  };

  // Re-sync active teacher in modal if data changes
  const currentPayingTeacherItem = payingTeacher
    ? teacherStats.find((t) => t.teacher.id === payingTeacher.teacher.id) || payingTeacher
    : null;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              جدول مستحقات وأجور الأساتذة ({data.teachers.length} أستاذ)
            </h2>
            <span
              style={{
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                padding: '3px 10px',
                borderRadius: 'var(--md-shape-full)',
                fontSize: '0.8rem',
                fontWeight: 700
              }}
            >
              متابعة مالية دقيقة
            </span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '4px' }}>
            كشف منظم لحساب أتعاب الأساتذة، تسجيل التسديدات الفردية، واستخراج وصولات الدفع الرسمية
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleExportTeachersCsv}
            className="m3-btn m3-btn-outlined m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={16} />
            <span>تصدير الجدول CSV</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="m3-btn m3-btn-primary m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>إضافة أستاذ جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Summary Row */}
      <div className="m3-grid-stats">
        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '4px' }}>
            إجمالي هيئة التدريس
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{data.teachers.length} أستاذ</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginTop: '4px' }}>
            مشرفون على {data.groups.length} فوج • {totalAllStudents} تلميذ
          </div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-primary)', marginBottom: '4px' }}>
            إجمالي الأتعاب المحسوبة
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
            {totalAllTeacherPay.toLocaleString()} <span style={{ fontSize: '0.85rem' }}>دج</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginTop: '4px' }}>
            حسب نسب التقاسم المحددة لكل فوج
          </div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--status-present)', marginBottom: '4px' }}>
            إجمالي المبالغ المسددة فعلياً
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-present)' }}>
            {totalAllPaid.toLocaleString()} <span style={{ fontSize: '0.85rem' }}>دج</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--status-present)', marginTop: '4px', fontWeight: 600 }}>
            {totalAllTeacherPay > 0
              ? `نسبة التسديد: ${Math.round((totalAllPaid / totalAllTeacherPay) * 100)}%`
              : '0%'}
          </div>
        </div>

        <div className="m3-card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--status-absent)', marginBottom: '4px' }}>
            إجمالي المستحقات المتبقية بذمتنا
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--status-absent)' }}>
            {totalAllRemaining.toLocaleString()} <span style={{ fontSize: '0.85rem' }}>دج</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--status-absent)', marginTop: '4px', fontWeight: 600 }}>
            {teacherStats.filter((t) => t.remainingDue > 0).length} أستاذ بانتظار استيفاء مستحقاتهم
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '340px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الأستاذ، المادة، أو رمز الفوج..."
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

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '4px',
            borderRadius: 'var(--md-shape-full)',
            gap: '4px',
            flexWrap: 'wrap'
          }}
        >
          {[
            { id: 'all', label: `الكل (${teacherStats.length})` },
            {
              id: 'pending',
              label: `عليهم متبقي (${teacherStats.filter((t) => t.remainingDue > 0 && t.totalTeacherPay > 0).length})`
            },
            {
              id: 'paid',
              label: `مسدد بالكامل (${teacherStats.filter((t) => t.remainingDue === 0 && t.totalTeacherPay > 0).length})`
            },
            {
              id: 'no-groups',
              label: `بدون أفواج (${teacherStats.filter((t) => t.groups.length === 0).length})`
            }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--md-shape-full)',
                border: 'none',
                backgroundColor: filterTab === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                color: filterTab === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Teachers Table (Replacing Cards Layout) */}
      <div className="m3-table-container" style={{ boxShadow: 'var(--md-elevation-1)' }}>
        <table className="m3-table">
          <thead>
            <tr>
              <th style={{ width: '45px', textAlign: 'center' }}>#</th>
              <th>الأستاذ (المعرف والتخصص)</th>
              <th>الأفواج المسندة</th>
              <th style={{ textAlign: 'center', width: '95px' }}>التلاميذ</th>
              <th style={{ textAlign: 'center', minWidth: '130px' }}>المستحقات (الأتعاب)</th>
              <th style={{ textAlign: 'center', minWidth: '120px' }}>المسدد للأستاذ</th>
              <th style={{ textAlign: 'center', minWidth: '120px' }}>المتبقي بذمتنا</th>
              <th style={{ textAlign: 'center', width: '120px' }}>حالة التسوية</th>
              <th style={{ textAlign: 'center', width: '190px' }}>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '48px', color: 'var(--md-sys-color-outline)' }}>
                  <GraduationCap size={40} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <div>لا يوجد أساتذة مطابقون لمعايير البحث الحالية.</div>
                </td>
              </tr>
            ) : (
              filteredTeachers.map((item, idx) => {
                const isFullyPaid = item.totalTeacherPay > 0 && item.remainingDue === 0;
                const isPartiallyPaid = item.paidAmount > 0 && item.remainingDue > 0;
                const isUnpaid = item.totalTeacherPay > 0 && item.paidAmount === 0;

                return (
                  <tr key={item.teacher.id} style={{ transition: 'background-color 0.15s ease' }}>
                    {/* Index */}
                    <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                      {idx + 1}
                    </td>

                    {/* Teacher Name & Subject */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--md-sys-color-primary-container)',
                            color: 'var(--md-sys-color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            flexShrink: 0
                          }}
                        >
                          <GraduationCap size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--md-sys-color-on-surface)' }}>
                              {item.teacher.name}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                                padding: '1px 6px',
                                borderRadius: 'var(--md-shape-xs)'
                              }}
                            >
                              {item.teacher.id}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                            {item.teacher.subject} {item.teacher.phone ? `• ${item.teacher.phone}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Assigned Groups with Clickable Badges */}
                    <td>
                      {item.groups.length === 0 ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-outline)' }}>لا توجد أفواج</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: 'var(--md-sys-color-on-surface-variant)',
                              marginInlineEnd: '4px'
                            }}
                          >
                            ({item.groups.length}):
                          </span>
                          {item.groups.map((g) => (
                            <Link
                              key={g.id}
                              href="/attendance"
                              onClick={() => setSelectedGroup(g.id)}
                              className="m3-chip"
                              style={{
                                textDecoration: 'none',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                backgroundColor: g.isVip
                                  ? 'var(--status-vip-container)'
                                  : 'var(--md-sys-color-surface-container)',
                                color: g.isVip ? 'var(--status-vip)' : 'var(--md-sys-color-on-surface)'
                              }}
                              title={`فتح كشف الحضور لفوج ${g.id}`}
                            >
                              {g.id} {g.isVip ? '★' : ''} ({g.day1})
                            </Link>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Total Students */}
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      <span
                        style={{
                          backgroundColor: 'var(--md-sys-color-surface-container)',
                          padding: '3px 8px',
                          borderRadius: 'var(--md-shape-sm)',
                          fontSize: '0.85rem'
                        }}
                      >
                        {item.totalStudents} تلميذ
                      </span>
                    </td>

                    {/* Total Calculated Teacher Pay */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '1rem',
                          fontWeight: 800,
                          color: 'var(--md-sys-color-primary)'
                        }}
                      >
                        {item.totalTeacherPay.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginInlineStart: '3px' }}>
                        دج
                      </span>
                    </td>

                    {/* Paid to Teacher */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: item.paidAmount > 0 ? 'var(--status-present)' : 'var(--md-sys-color-outline)'
                        }}
                      >
                        {item.paidAmount.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginInlineStart: '3px' }}>
                        دج
                      </span>
                    </td>

                    {/* Remaining Due */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 800,
                          color: item.remainingDue > 0 ? 'var(--status-absent)' : 'var(--status-present)'
                        }}
                      >
                        {item.remainingDue.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', marginInlineStart: '3px' }}>
                        دج
                      </span>
                    </td>

                    {/* Payment Status Badge */}
                    <td style={{ textAlign: 'center' }}>
                      {item.totalTeacherPay === 0 ? (
                        <span
                          className="m3-chip"
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--md-sys-color-surface-container)',
                            color: 'var(--md-sys-color-outline)'
                          }}
                        >
                          بدون مستحقات
                        </span>
                      ) : isFullyPaid ? (
                        <span
                          className="m3-chip"
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--status-present-container)',
                            color: 'var(--status-present)',
                            fontWeight: 700
                          }}
                        >
                          <Check size={12} />
                          <span>مسدد بالكامل</span>
                        </span>
                      ) : isPartiallyPaid ? (
                        <span
                          className="m3-chip"
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--status-makeup-container)',
                            color: 'var(--status-makeup)',
                            fontWeight: 700
                          }}
                        >
                          <Clock size={12} />
                          <span>تسديد جزئي</span>
                        </span>
                      ) : (
                        <span
                          className="m3-chip"
                          style={{
                            fontSize: '0.75rem',
                            backgroundColor: 'var(--status-absent-container)',
                            color: 'var(--status-absent)',
                            fontWeight: 700
                          }}
                        >
                          <AlertCircle size={12} />
                          <span>غير مسدد</span>
                        </span>
                      )}
                    </td>

                    {/* Actions: Pay Teacher Button & Attendance Shortcut */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                        {/* PAY TEACHER BUTTON (Requested by User) */}
                        <button
                          type="button"
                          onClick={() => setPayingTeacher(item)}
                          className="m3-btn m3-btn-sm"
                          style={{
                            backgroundColor: item.remainingDue > 0 ? 'var(--status-present)' : 'var(--md-sys-color-primary)',
                            color: '#ffffff',
                            fontWeight: 700,
                            padding: '6px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: 'var(--md-elevation-1)'
                          }}
                          title={`تسديد مستحقات الأستاذ ${item.teacher.name}`}
                        >
                          <Banknote size={15} />
                          <span>دفع للأستاذ</span>
                        </button>

                        {/* View Attendance or Voucher link */}
                        {item.groups.length > 0 && (
                          <Link
                            href="/attendance"
                            onClick={() => setSelectedGroup(item.groups[0].id)}
                            className="m3-btn m3-btn-outlined m3-btn-sm"
                            style={{ padding: '6px 8px' }}
                            title={`فتح كشف الحضور لفوج ${item.groups[0].id}`}
                          >
                            <ArrowUpRight size={15} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Totals Footer Row */}
          {filteredTeachers.length > 0 && (
            <tfoot style={{ backgroundColor: 'var(--md-sys-color-surface-container)', fontWeight: 800 }}>
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', padding: '12px 14px' }}>
                  المجموع الكلي للأساتذة المعروضين ({filteredTeachers.length} أستاذ):
                </td>
                <td style={{ textAlign: 'center' }}>
                  {filteredTeachers.reduce((s, t) => s + t.groups.length, 0)} فوج
                </td>
                <td style={{ textAlign: 'center' }}>
                  {filteredTeachers.reduce((s, t) => s + t.totalStudents, 0)} تلميذ
                </td>
                <td style={{ textAlign: 'center', color: 'var(--md-sys-color-primary)', fontSize: '1.05rem' }}>
                  {filteredTeachers.reduce((s, t) => s + t.totalTeacherPay, 0).toLocaleString()} دج
                </td>
                <td style={{ textAlign: 'center', color: 'var(--status-present)', fontSize: '1rem' }}>
                  {filteredTeachers.reduce((s, t) => s + t.paidAmount, 0).toLocaleString()} دج
                </td>
                <td style={{ textAlign: 'center', color: 'var(--status-absent)', fontSize: '1rem' }}>
                  {filteredTeachers.reduce((s, t) => s + t.remainingDue, 0).toLocaleString()} دج
                </td>
                <td colSpan={2} style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={handleExportTeachersCsv}
                    className="m3-btn m3-btn-text m3-btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    تصدير التقرير 📄
                  </button>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pay Teacher Modal */}
      {currentPayingTeacherItem && (
        <TeacherPaymentModal
          teacher={currentPayingTeacherItem.teacher}
          stats={{
            totalStudents: currentPayingTeacherItem.totalStudents,
            totalTeacherPay: currentPayingTeacherItem.totalTeacherPay,
            totalCollectedInGroups: currentPayingTeacherItem.totalCollectedInGroups,
            groups: currentPayingTeacherItem.groups.map((g: any) => data.groupData[g.id] || g)
          }}
          onClose={() => setPayingTeacher(null)}
        />
      )}

      {/* Add Teacher Modal */}
      {isAddModalOpen && (
        <div className="m3-dialog-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px' }}>إضافة أستاذ جديد</h3>
            <form onSubmit={handleAddTeacher} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  اسم ولقب الأستاذ *
                </label>
                <input
                  type="text"
                  value={newTeacherName}
                  onChange={(e) => setNewTeacherName(e.target.value)}
                  placeholder="مثال: د. محمد بن سعيد"
                  className="m3-input"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  المادة المدرسة
                </label>
                <input
                  type="text"
                  value={newTeacherSubject}
                  onChange={(e) => setNewTeacherSubject(e.target.value)}
                  placeholder="رياضيات، فيزياء، علوم..."
                  className="m3-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                  رقم الهاتف
                </label>
                <input
                  type="text"
                  value={newTeacherPhone}
                  onChange={(e) => setNewTeacherPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="m3-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="m3-btn m3-btn-text">
                  إلغاء
                </button>
                <button type="submit" className="m3-btn m3-btn-primary">
                  إضافة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

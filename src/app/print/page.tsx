'use client';

import React from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import GroupSearchSelect from '../../components/GroupSearchSelect';
import { isSummaryRow, formatToYYYYMMDD } from '../../utils/sessionUtils';
import { sanitizePrintTitle, triggerPrintWithDocumentTitle } from '../../utils/printTitleUtils';

export default function PrintPage() {
  const { data, selectedGroup, setSelectedGroup } = useApp();
  const group = data.groupData[selectedGroup] || Object.values(data.groupData)[0];
  const realStudents = React.useMemo(() => {
    return (group?.students || []).filter((s) => !isSummaryRow(s, group?.groupId));
  }, [group?.students, group?.groupId]);

  const printTitle = React.useMemo(() => {
    if (!group) return 'كشف الحضور';
    const teacherPart = group.teacherName ? `${group.teacherName.trim()} - ` : '';
    const groupPart = group.groupId || '';
    return sanitizePrintTitle(`${teacherPart}${groupPart}`) || 'كشف الحضور';
  }, [group]);

  React.useEffect(() => {
    if (!printTitle) return;
    const prevTitle = document.title;
    document.title = printTitle;
    return () => {
      document.title = prevTitle;
    };
  }, [printTitle]);

  const handlePrint = () => {
    triggerPrintWithDocumentTitle(printTitle, () => {
      window.print();
    });
  };

  if (!group) return <div>لا يوجد فوج محدد.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Toolbar (Hidden on print) */}
      <div
        className="m3-card no-print"
        style={{
          padding: '16px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/attendance" className="m3-btn-text" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowRight size={18} />
            <span>العودة لكشف الحضور</span>
          </Link>

          <GroupSearchSelect
            selectedGroupId={group.groupId}
            onSelectGroup={(newGroupId) => setSelectedGroup(newGroupId)}
            label=""
            placeholder="ابحث عن فوج لطباعته..."
            width="280px"
          />
        </div>

        <button onClick={handlePrint} className="m3-btn m3-btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={18} />
          <span>طباعة هذا الكشف (A4)</span>
        </button>
      </div>

      {/* Printable Sheet Wrapper */}
      <div
        id="printable-roster"
        style={{
          backgroundColor: '#ffffff',
          color: '#000000',
          padding: '24px 32px',
          borderRadius: 'var(--md-shape-md)',
          boxShadow: 'var(--md-elevation-1)',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Official Header */}
        <div
          style={{
            borderBottom: '2px solid #000000',
            paddingBottom: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img
              src="/logo.svg"
              alt="شعار المؤسسة"
              style={{ height: '52px', width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '4px' }}>
                {data.centerName}
              </h1>
              <p style={{ fontSize: '0.9rem', color: '#444' }}>
                دروس الدعم والتقوية | {data.cycle} | الموسم الدراسي: {data.academicYear}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'left', fontSize: '0.85rem' }}>
            <div suppressHydrationWarning>تاريخ الاستخراج: <strong>{new Date().toLocaleDateString('ar-DZ')}</strong></div>
            <div>الفوج: <strong style={{ fontSize: '1.1rem' }}>{group.groupId} {group.isVip ? '(VIP)' : ''}</strong></div>
          </div>
        </div>

        {/* Group Info Metadata Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            padding: '10px 14px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '0.9rem'
          }}
        >
          <div>
            <strong>الأستاذ:</strong> {group.teacherName}
          </div>
          <div>
            <strong>المادة:</strong> {group.subject}
          </div>
          <div>
            <strong>الموعد:</strong> {group.day1} ({group.time1 || 'صباحاً'})
          </div>
          <div>
            <strong>إجمالي الطلبة:</strong> {realStudents.length} تلميذ
          </div>
        </div>

        {/* Attendance Roster Table */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '10pt',
            textAlign: 'right'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <th style={{ border: '1px solid #333', padding: '6px 4px', textAlign: 'center', width: '35px' }}>#</th>
              <th style={{ border: '1px solid #333', padding: '6px 8px', minWidth: '180px' }}>الاسم واللقب</th>
              <th style={{ border: '1px solid #333', padding: '6px 8px', minWidth: '100px' }}>الهاتف</th>
              {group.sessionDates.map((date, idx) => (
                <th
                  key={idx}
                  style={{
                    border: '1px solid #333',
                    padding: '4px',
                    textAlign: 'center',
                    minWidth: '55px',
                    backgroundColor: '#e2e8f0'
                  }}
                >
                  <div style={{ fontSize: '8pt', fontWeight: 800 }}>حصة {idx + 1}</div>
                  <div style={{ fontSize: '6.8pt', color: '#475569', direction: 'ltr', unicodeBidi: 'plaintext', fontFamily: 'monospace' }}>
                    {formatToYYYYMMDD(date)}
                  </div>
                </th>
              ))}
              <th style={{ border: '1px solid #333', padding: '6px 8px', textAlign: 'center', width: '80px' }}>
                ملاحظات
              </th>
            </tr>
          </thead>
          <tbody>
            {realStudents.map((student, sIdx) => (
              <tr key={student.rowId} style={{ pageBreakInside: 'avoid' }}>
                <td style={{ border: '1px solid #333', textAlign: 'center', padding: '5px' }}>
                  {sIdx + 1}
                </td>
                <td style={{ border: '1px solid #333', padding: '5px 8px', fontWeight: 700 }}>
                  {student.name}
                </td>
                <td style={{ border: '1px solid #333', padding: '5px 8px', fontSize: '9pt' }}>
                  {student.phone || '—'}
                </td>
                {Array.from({ length: group.sessionDates.length }).map((_, sessionIdx) => {
                  const status = student.attendance[sessionIdx] || '';
                  return (
                    <td
                      key={sessionIdx}
                      style={{
                        border: '1px solid #333',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '9pt',
                        backgroundColor:
                          status === 'P' ? '#ecfdf5' : status === 'A' ? '#fef2f2' : status === 'M' ? '#fffbeb' : '#fff'
                      }}
                    >
                      {status || ''}
                    </td>
                  );
                })}
                <td style={{ border: '1px solid #333', padding: '5px', textAlign: 'center', fontSize: '8pt' }}>
                  {student.discount === '0' ? 'معفى' : student.debt > 0 ? `دين: ${student.debt}` : 'خالص ✓'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature & Validation Footer */}
        <div
          style={{
            marginTop: '28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            fontSize: '0.9rem',
            paddingTop: '12px',
            borderTop: '1px dashed #94a3b8'
          }}
        >
          <div>
            <p><strong>توقيع أستاذ المادة:</strong> .....................................</p>
          </div>
          <div>
            <p><strong>مراقبة الإدارة والختم:</strong> .....................................</p>
          </div>
        </div>
      </div>
    </div>
  );
}

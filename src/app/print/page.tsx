'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Printer, ArrowRight, Layers } from 'lucide-react';
import Link from 'next/link';
import GroupSearchSelect from '../../components/GroupSearchSelect';
import { isSummaryRow, formatToYYYYMMDD, formatGroupTime } from '../../utils/sessionUtils';
import { sanitizePrintTitle, triggerPrintWithDocumentTitle } from '../../utils/printTitleUtils';
import { StudentRecord } from '../../types';

const STUDENTS_PER_PAGE = 76;
const STUDENTS_PER_TABLE = 38;

export default function PrintPage() {
  const { data, selectedGroup, setSelectedGroup } = useApp();
  const group = data.groupData[selectedGroup] || Object.values(data.groupData)[0];

  // Cycle offset in case group has 8 sessions (e.g. VIP groups): 0 = sessions 1-4, 4 = sessions 5-8
  const [sessionCycleOffset, setSessionCycleOffset] = useState<number>(0);

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

  // Group students into pages of 76 (2 tables of 38 students each)
  const pages = React.useMemo(() => {
    const totalStudents = realStudents.length;
    const pageCount = Math.max(1, Math.ceil(totalStudents / STUDENTS_PER_PAGE));
    const pagesList = [];

    for (let p = 0; p < pageCount; p++) {
      const pageStart = p * STUDENTS_PER_PAGE;
      const table1: { student?: StudentRecord; studentIndex: number }[] = [];
      const table2: { student?: StudentRecord; studentIndex: number }[] = [];

      // Right table (Rows 1 to 38 of this page)
      for (let i = 0; i < STUDENTS_PER_TABLE; i++) {
        const studentIdx = pageStart + i;
        table1.push({
          student: realStudents[studentIdx],
          studentIndex: studentIdx + 1
        });
      }

      // Left table (Rows 39 to 76 of this page)
      for (let i = 0; i < STUDENTS_PER_TABLE; i++) {
        const studentIdx = pageStart + STUDENTS_PER_TABLE + i;
        table2.push({
          student: realStudents[studentIdx],
          studentIndex: studentIdx + 1
        });
      }

      pagesList.push({
        pageIndex: p,
        pageNumber: p + 1,
        table1,
        table2,
        startIdx: pageStart + 1,
        endIdx: Math.min(pageStart + STUDENTS_PER_PAGE, totalStudents)
      });
    }

    return pagesList;
  }, [realStudents]);

  if (!group) return <div>لا يوجد فوج محدد.</div>;

  // Active 4 sessions based on cycle
  const current4Sessions = [0, 1, 2, 3].map((offset) => sessionCycleOffset + offset);

  // Render a single table (38 rows)
  const renderHalfTable = (
    items: { student?: StudentRecord; studentIndex: number }[],
    tableId: string
  ) => {
    return (
      <table
        className="print-roster-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '8.5pt',
          textAlign: 'right',
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f1f5f9', height: '30px' }}>
            <th
              style={{
                border: '1.5px solid #000000',
                padding: '3px 1px',
                textAlign: 'center',
                width: '26px',
                fontWeight: 800,
                fontSize: '8pt'
              }}
            >
              #
            </th>
            <th
              style={{
                border: '1.5px solid #000000',
                padding: '3px 6px',
                fontWeight: 800,
                fontSize: '8.8pt'
              }}
            >
              الاسم واللقب
            </th>
            {current4Sessions.map((sIdx, num) => {
              const rawDate = group.sessionDates?.[sIdx];
              const formattedDate = rawDate ? formatToYYYYMMDD(rawDate) : '';
              const shortDate = formattedDate ? formattedDate.slice(5) : ''; // e.g. 09/19

              return (
                <th
                  key={sIdx}
                  style={{
                    border: '1.5px solid #000000',
                    padding: '2px 1px',
                    textAlign: 'center',
                    width: '30px',
                    backgroundColor: '#e2e8f0'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '7.5pt', lineHeight: 1.1 }}>
                    حصة {num + 1}
                  </div>
                  {shortDate && (
                    <div
                      style={{
                        fontSize: '6.2pt',
                        color: '#475569',
                        fontFamily: 'monospace',
                        marginTop: '2px',
                        lineHeight: 1,
                        direction: 'ltr'
                      }}
                    >
                      {shortDate}
                    </div>
                  )}
                </th>
              );
            })}
            <th
              style={{
                border: '1.5px solid #000000',
                padding: '3px 2px',
                textAlign: 'center',
                width: '48px',
                fontWeight: 800,
                fontSize: '8.2pt'
              }}
            >
              المسدد
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ student, studentIndex }) => {
            const hasStudent = !!student;
            const paidText = hasStudent
              ? student.discount === '0'
                ? 'معفى'
                : student.totalReceived > 0
                ? student.totalReceived.toLocaleString()
                : '0'
              : '';

            return (
              <tr
                key={`${tableId}-${studentIndex}`}
                style={{
                  height: '22.5px',
                  minHeight: '22.5px',
                  lineHeight: 1.2
                }}
              >
                <td
                  style={{
                    border: '1px solid #000000',
                    textAlign: 'center',
                    padding: '2px 1px',
                    fontWeight: 800,
                    fontSize: '8pt',
                    color: hasStudent ? '#000000' : '#94a3b8'
                  }}
                >
                  {studentIndex}
                </td>
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '2px 6px',
                    fontWeight: 800,
                    fontSize: '8.8pt',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={student?.name}
                >
                  {student?.name || <span style={{ visibility: 'hidden' }}>—</span>}
                </td>
                {current4Sessions.map((sIdx) => {
                  const status = student?.attendance?.[sIdx] || '';
                  return (
                    <td
                      key={sIdx}
                      style={{
                        border: '1px solid #000000',
                        textAlign: 'center',
                        fontWeight: 800,
                        fontSize: '8.8pt',
                        padding: '2px 0',
                        backgroundColor:
                          status === 'P'
                            ? '#ecfdf5'
                            : status === 'A'
                            ? '#fef2f2'
                            : status === 'M'
                            ? '#fffbeb'
                            : '#ffffff'
                      }}
                    >
                      {status}
                    </td>
                  );
                })}
                <td
                  style={{
                    border: '1px solid #000000',
                    padding: '2px 2px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '8.2pt',
                    color: hasStudent && student.totalReceived > 0 ? '#0f766e' : '#000000'
                  }}
                >
                  {paidText || <span style={{ visibility: 'hidden' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Toolbar (Hidden on print) */}
      <div
        className="m3-card no-print"
        style={{
          padding: '14px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <Link
            href="/attendance"
            className="m3-btn-text"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowRight size={18} />
            <span>العودة لكشف الحضور</span>
          </Link>

          <GroupSearchSelect
            selectedGroupId={group.groupId}
            onSelectGroup={(newGroupId) => setSelectedGroup(newGroupId)}
            label=""
            placeholder="ابحث عن فوج لطباعته..."
            width="260px"
          />

          {/* If group has 8 sessions, allow toggling cycle 1 vs 2 */}
          {(group.sessionDates?.length || 0) > 4 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-outline)' }}>الدورة:</span>
              <button
                type="button"
                onClick={() => setSessionCycleOffset(0)}
                className={`m3-btn m3-btn-sm ${sessionCycleOffset === 0 ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
              >
                حصص 1 - 4
              </button>
              <button
                type="button"
                onClick={() => setSessionCycleOffset(4)}
                className={`m3-btn m3-btn-sm ${sessionCycleOffset === 4 ? 'm3-btn-primary' : 'm3-btn-outlined'}`}
              >
                حصص 5 - 8
              </button>
            </div>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              fontWeight: 700,
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              padding: '4px 12px',
              borderRadius: '20px'
            }}
          >
            <Layers size={15} color="var(--md-sys-color-primary)" />
            <span>كشف مزدوج: 76 تلميذ / صفحة ({pages.length} صفحة)</span>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="m3-btn m3-btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 99, 155, 0.3)',
            fontWeight: 700
          }}
        >
          <Printer size={18} />
          <span>طباعة هذا الكشف (A4)</span>
        </button>
      </div>

      {/* Pages Container */}
      <div id="printable-roster" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {pages.map((page) => (
          <div
            key={page.pageIndex}
            className="print-page-wrapper"
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              padding: '24px 28px',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              maxWidth: '1100px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            {/* Top Container: Header + Group Info + 2 Tables */}
            <div>
              {/* Official Header */}
              <div
                style={{
                  borderBottom: '2px solid #000000',
                  paddingBottom: '8px',
                  marginBottom: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img
                    src="/logo.svg"
                    alt="شعار المؤسسة"
                    style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
                  />
                  <div>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, lineHeight: 1.2 }}>
                      {data.centerName}
                    </h1>
                    <p style={{ fontSize: '0.8rem', color: '#333333', margin: '2px 0 0 0', fontWeight: 600 }}>
                      دروس الدعم والتقوية | {data.cycle} | الموسم الدراسي: {data.academicYear}
                    </p>
                  </div>
                </div>

                <div style={{ textAlign: 'left', fontSize: '0.85rem', lineHeight: 1.4 }}>
                  <div suppressHydrationWarning>
                    تاريخ الاستخراج: <strong>{new Date().toLocaleDateString('ar-DZ')}</strong>
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    الفوج: <strong style={{ fontSize: '1.05rem' }}>{group.groupId} {group.isVip ? '(VIP)' : ''}</strong>
                    {pages.length > 1 && (
                      <span style={{ marginInlineStart: '8px', fontWeight: 800, color: '#00639b', fontSize: '0.85rem' }}>
                        (صفحة {page.pageNumber} من {pages.length})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Group Info Metadata Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1.5px solid #cbd5e1',
                  padding: '7px 14px',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  fontSize: '0.88rem'
                }}
              >
                <div>
                  <strong>الأستاذ:</strong> {group.teacherName}
                </div>
                <div>
                  <strong>المادة:</strong> {group.subject}
                </div>
                <div>
                  <strong>الموعد:</strong> {group.day1} ({formatGroupTime(group.time1) || 'صباحاً'}
                  {group.day2 ? ` • ${group.day2} (${formatGroupTime(group.time2)})` : ''})
                </div>
                <div>
                  <strong>إجمالي الطلبة:</strong> {realStudents.length} تلميذ
                  {pages.length > 1 && (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginInlineStart: '4px' }}>
                      [{page.startIdx} - {page.endIdx}]
                    </span>
                  )}
                </div>
              </div>

              {/* 2 Tables Side-by-Side (38 students each = 76 students per page) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  alignItems: 'start'
                }}
              >
                {/* Right Table: Rows 1 to 38 */}
                <div>{renderHalfTable(page.table1, `p${page.pageIndex}-t1`)}</div>

                {/* Left Table: Rows 39 to 76 */}
                <div>{renderHalfTable(page.table2, `p${page.pageIndex}-t2`)}</div>
              </div>
            </div>

            {/* Signature & Validation Footer */}
            <div
              style={{
                marginTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.8rem',
                paddingTop: '8px',
                borderTop: '1px dashed #94a3b8'
              }}
            >
              <div>
                <strong>توقيع أستاذ المادة:</strong> .....................................
              </div>
              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>
                نظام مؤسسة دعم للدروس الخصوصية والتعليمية • {group.groupId} • صفحة {page.pageNumber}/{pages.length}
              </div>
              <div>
                <strong>مراقبة الإدارة والختم:</strong> .....................................
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm 8mm 10mm !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .main-layout-container {
            padding: 0 !important;
            margin: 0 !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .print-page-wrapper {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-height: 278mm !important;
            height: 278mm !important;
            page-break-after: always !important;
            break-after: page !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .print-page-wrapper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>
    </div>
  );
}

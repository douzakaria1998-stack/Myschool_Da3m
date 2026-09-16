'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  IdCard,
  CheckSquare,
  Square,
  Search
} from 'lucide-react';
import { StudentRecord } from '../types';
import { useApp } from '../context/AppContext';
import StudentCardView from './StudentCardView';
import { printCardHtml } from '../utils/printCardUtils';

interface Props {
  groupId: string;
  students: StudentRecord[];
  onClose: () => void;
}

export default function GroupBadgesModal({ groupId, students, onClose }: Props) {
  const { data } = useApp();

  const [printLayout, setPrintLayout] = useState<'a4_sheet' | 'cr80'>('a4_sheet');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(
    () => new Set(students.map((s) => s.rowId))
  );

  const groupMeta = data.groups?.find((g) => g.id === groupId);
  const groupSubject = groupMeta?.subject || data.groupData[groupId]?.subject || '';
  const groupTeacher = groupMeta?.teacherName || data.groupData[groupId]?.teacherName || '';

  // Filter students by search term
  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const term = searchTerm.toLowerCase().trim();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.phone && s.phone.includes(term)) ||
        (s.barcode && s.barcode.toLowerCase().includes(term))
    );
  }, [students, searchTerm]);

  // Students selected for printing
  const printStudents = useMemo(() => {
    return students.filter((s) => selectedRowIds.has(s.rowId));
  }, [students, selectedRowIds]);

  const toggleStudent = (rowId: number) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedRowIds(new Set(students.map((s) => s.rowId)));
  };

  const deselectAll = () => {
    setSelectedRowIds(new Set());
  };

  const handlePrint = () => {
    const container = document.getElementById('batch-badges-cards-source');
    if (!container) return;
    const cardNodes = container.querySelectorAll('.pvc-card');
    const cardHtmlList = Array.from(cardNodes).map((node) => node.outerHTML);

    printCardHtml(
      cardHtmlList,
      printLayout,
      `بطاقات الفوج ${groupId} (${cardHtmlList.length} بطاقة)`
    );
  };

  // Group into pages of 10 for A4 page calculation
  const pagesOfTen = useMemo(() => {
    const pages: StudentRecord[][] = [];
    for (let i = 0; i < printStudents.length; i += 10) {
      pages.push(printStudents.slice(i, i + 10));
    }
    return pages;
  }, [printStudents]);

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '94vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: 'var(--md-sys-color-surface)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)'
        }}
      >
        {/* Modal Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c'
              }}
            >
              <IdCard size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                  طباعة شارات وبطاقات الفوج ({groupId})
                </h3>
                <span
                  style={{
                    backgroundColor: '#fff7ed',
                    color: '#c2410c',
                    border: '1px solid #fed7aa',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '0.78rem',
                    fontWeight: 800
                  }}
                >
                  {groupSubject ? `${groupSubject}` : 'الفوج المعتمد'} {groupTeacher ? `— ${groupTeacher}` : ''}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--md-sys-color-outline)' }}>
                طباعة بطاقات جميع تلاميذ الفوج ({students.length} تلميذ) لمدرسة ماي سكول لتعليم اللغات
              </p>
            </div>
          </div>

          <button onClick={onClose} className="m3-btn-icon" title="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Layout Mode & Selection Options */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            padding: '10px 14px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: '12px'
          }}
        >
          {/* Print Layout Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
              طريقة الطباعة:
            </span>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#ffffff', padding: '3px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setPrintLayout('a4_sheet')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: printLayout === 'a4_sheet' ? '#ea580c' : 'transparent',
                  color: printLayout === 'a4_sheet' ? '#ffffff' : 'var(--md-sys-color-on-surface)'
                }}
              >
                كشف A4 (10 بطاقات بالصفحة — جاهز للقص)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('cr80')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: printLayout === 'cr80' ? '#ea580c' : 'transparent',
                  color: printLayout === 'cr80' ? '#ffffff' : 'var(--md-sys-color-on-surface)'
                }}
              >
                طابعة بطاقات بلاستيكية CR80 PVC
              </button>
            </div>
          </div>

          {/* Quick Selection Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={selectAll}
              className="m3-btn m3-btn-outlined m3-btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              تحديد الكل ({students.length})
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="m3-btn m3-btn-text m3-btn-sm"
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              إلغاء التحديد
            </button>
          </div>
        </div>

        {/* Student Checklist Filter */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              التلاميذ المحددون للطباعة: ({printStudents.length} من أصل {students.length})
              {printLayout === 'a4_sheet' && (
                <span style={{ marginRight: '8px', color: '#c2410c', fontSize: '0.8rem' }}>
                  ({pagesOfTen.length} صفحات A4)
                </span>
              )}
            </span>

            {/* Quick Search */}
            <div style={{ position: 'relative', width: '220px' }}>
              <input
                type="text"
                placeholder="تصفية حسب الاسم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '4px 10px 4px 28px',
                  borderRadius: '6px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  fontSize: '0.78rem',
                  outline: 'none'
                }}
              />
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  insetInlineEnd: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
            </div>
          </div>

          {/* Compact Chips / Checkbox List */}
          <div
            style={{
              maxHeight: '120px',
              overflowY: 'auto',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              padding: '8px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRadius: '8px',
              border: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            {filteredStudents.map((s) => {
              const isSelected = selectedRowIds.has(s.rowId);
              return (
                <button
                  key={s.rowId}
                  type="button"
                  onClick={() => toggleStudent(s.rowId)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: isSelected ? '1px solid #fdba74' : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: isSelected ? '#fff7ed' : 'var(--md-sys-color-surface)',
                    color: isSelected ? '#ea580c' : 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  {isSelected ? <CheckSquare size={13} color="#ea580c" /> : <Square size={13} color="#94a3b8" />}
                  <span>{s.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview of Selected Cards */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px', color: 'var(--md-sys-color-on-surface)' }}>
            معاينة البطاقات قبل الطباعة:
          </div>
          <div
            style={{
              display: 'flex',
              gap: '14px',
              overflowX: 'auto',
              padding: '16px',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px dashed #fed7aa',
              minHeight: '220px',
              alignItems: 'center'
            }}
          >
            {printStudents.slice(0, 6).map((student) => (
              <div key={student.rowId} style={{ flexShrink: 0, transform: 'scale(0.95)', transformOrigin: 'top center' }}>
                <StudentCardView
                  student={student}
                  academicYear={data.academicYear || '2026/2027'}
                  centerName="مدرسة ماي سكول لتعليم اللغات"
                  isSinglePrint={true}
                />
              </div>
            ))}
            {printStudents.length > 6 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '120px',
                  height: '54mm',
                  borderRadius: '8px',
                  backgroundColor: '#fff7ed',
                  border: '1px dashed #fdba74',
                  color: '#c2410c',
                  fontWeight: 800,
                  fontSize: '0.85rem'
                }}
              >
                <span>+{printStudents.length - 6} بطاقة أخرى</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#9a3412', marginTop: '4px' }}>
                  جاهزة للطباعة
                </span>
              </div>
            )}
            {printStudents.length === 0 && (
              <div style={{ margin: 'auto', color: 'var(--md-sys-color-outline)', fontSize: '0.9rem' }}>
                لم تقم بتحديد أي تلميذ بعد. اضغط "تحديد الكل" بالأعلى.
              </div>
            )}
          </div>
        </div>

        {/* Hidden Container with all selected cards rendered for print collection */}
        <div id="batch-badges-cards-source" style={{ display: 'none' }}>
          {printStudents.map((s) => (
            <StudentCardView
              key={s.rowId}
              student={s}
              academicYear={data.academicYear || '2026/2027'}
              centerName="مدرسة ماي سكول لتعليم اللغات"
              isSinglePrint={false}
            />
          ))}
        </div>

        {/* Modal Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            paddingTop: '14px'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: 'var(--md-sys-color-outline)' }}>
            جاهز لطباعة <strong style={{ color: '#ea580c' }}>{printStudents.length}</strong> بطاقة
            {printLayout === 'a4_sheet' && ` (${pagesOfTen.length} ورقة A4)`}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
              إلغاء
            </button>

            <button
              type="button"
              disabled={printStudents.length === 0}
              onClick={handlePrint}
              className="m3-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontWeight: 800,
                backgroundColor: printStudents.length === 0 ? '#cbd5e1' : '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--md-shape-full)',
                boxShadow: printStudents.length === 0 ? 'none' : '0 4px 14px rgba(234, 88, 12, 0.35)',
                cursor: printStudents.length === 0 ? 'not-allowed' : 'pointer'
              }}
            >
              <Printer size={18} />
              <span>
                طباعة {printStudents.length} بطاقة
                {printLayout === 'a4_sheet' ? ` (${pagesOfTen.length} صفحات A4)` : ' (CR80 PVC)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

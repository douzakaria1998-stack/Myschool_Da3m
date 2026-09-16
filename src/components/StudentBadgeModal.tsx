'use client';

import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  IdCard,
  Download
} from 'lucide-react';
import { StudentRecord } from '../types';
import { useApp } from '../context/AppContext';
import StudentCardView from './StudentCardView';
import { printCardHtml } from '../utils/printCardUtils';

interface Props {
  student: StudentRecord;
  groupId?: string;
  allGroups?: string[];
  onClose: () => void;
}

export default function StudentBadgeModal({ student, groupId, allGroups = [], onClose }: Props) {
  const { data } = useApp();
  const cardRef = useRef<HTMLDivElement>(null);

  const [previewScale, setPreviewScale] = useState<number>(1.35); // 135% default for comfortable viewing
  const [printLayout, setPrintLayout] = useState<'cr80' | 'a4_sheet'>('cr80');

  // Compute resolved barcode (using STU-27 for BAC 2027)
  const rawBarcode =
    student.barcode?.trim() ||
    Object.values(data.groupData || {})
      .flatMap((g) => g.students || [])
      .find((s) => s.name.trim().toLowerCase() === student.name.trim().toLowerCase() && s.barcode?.trim())
      ?.barcode?.trim() ||
    `STU-2700${student.rowId.toString().padStart(4, '0')}`;

  const barcodeValue = rawBarcode.startsWith('STU-26')
    ? rawBarcode.replace(/^STU-26/, 'STU-27')
    : rawBarcode;

  const handlePrint = () => {
    if (!cardRef.current) return;
    const cardHtml = cardRef.current.outerHTML;

    if (printLayout === 'cr80') {
      // Exactly 1 single card on CR80 PVC (1 page only)
      printCardHtml([cardHtml], 'cr80', `بطاقة التلميذ - ${student.name}`);
    } else {
      // 10 copies filling an A4 sheet (1 page of 10 cards)
      const tenCopies = Array.from({ length: 10 }).map(() => cardHtml);
      printCardHtml(tenCopies, 'a4_sheet', `كشف بطاقة التلميذ A4 - ${student.name}`);
    }
  };

  const enrolledGroupsList = allGroups.length > 0 ? allGroups : groupId ? [groupId] : [];

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '720px',
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
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ea580c'
              }}
            >
              <IdCard size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
                  بطاقة التلميذ المعتمدة (Student Card)
                </h3>
                <span
                  style={{
                    backgroundColor: '#fff7ed',
                    color: '#c2410c',
                    border: '1px solid #fed7aa',
                    padding: '1px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}
                >
                  تصميم My School 2026/2027
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--md-sys-color-outline)' }}>
                معيار CR80 القياسي (85.6mm × 54mm) لمدرسة ماي سكول لتعليم اللغات — طباعة فورية دقيقة
              </p>
            </div>
          </div>

          <button onClick={onClose} className="m3-btn-icon" title="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* Toolbar: Scale & Layout Selector */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            marginBottom: '14px',
            padding: '8px 12px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: '10px'
          }}
        >
          {/* Print Layout Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
              وضع الطباعة:
            </span>
            <div style={{ display: 'flex', gap: '4px', backgroundColor: '#ffffff', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setPrintLayout('cr80')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: printLayout === 'cr80' ? '#ea580c' : 'transparent',
                  color: printLayout === 'cr80' ? '#ffffff' : 'var(--md-sys-color-on-surface)'
                }}
              >
                طابعة بطاقات PVC (CR80)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout('a4_sheet')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: printLayout === 'a4_sheet' ? '#ea580c' : 'transparent',
                  color: printLayout === 'a4_sheet' ? '#ffffff' : 'var(--md-sys-color-on-surface)'
                }}
              >
                كشف A4 (10 بطاقات بالصفحة)
              </button>
            </div>
          </div>

          {/* Zoom scale for preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--md-sys-color-outline)' }}>
              حجم المعاينة:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[
                { label: '100%', val: 1 },
                { label: '135%', val: 1.35 },
                { label: '175%', val: 1.75 }
              ].map((z) => (
                <button
                  key={z.val}
                  type="button"
                  onClick={() => setPreviewScale(z.val)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: previewScale === z.val ? 800 : 500,
                    borderRadius: '4px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: previewScale === z.val ? 'var(--md-sys-color-primary-container)' : 'transparent',
                    color: previewScale === z.val ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)',
                    cursor: 'pointer'
                  }}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Card Interactive Preview Stage */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '30px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px dashed #fed7aa',
            marginBottom: '18px',
            overflow: 'auto',
            minHeight: '220px'
          }}
        >
          <div
            style={{
              transform: `scale(${previewScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.15s ease'
            }}
          >
            <StudentCardView
              ref={cardRef}
              student={student}
              academicYear={data.academicYear || '2026/2027'}
              centerName="مدرسة ماي سكول لتعليم اللغات"
              isSinglePrint={true}
            />
          </div>
        </div>

        {/* Specifications & Live Information Cards */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}
        >
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600, fontSize: '0.78rem' }}>
              رمز الباركود المشفر:
            </span>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#c2410c', fontSize: '0.95rem' }}>
              {barcodeValue}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600, fontSize: '0.78rem' }}>
              معيار البطاقة:
            </span>
            <div style={{ fontWeight: 800, color: 'var(--md-sys-color-on-surface)', fontSize: '0.9rem' }}>
              CR80 PVC (85.6mm × 54mm)
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600, fontSize: '0.78rem' }}>
              الأفواج المسجلة:
            </span>
            <div style={{ fontWeight: 800, color: '#0369a1', fontSize: '0.9rem' }}>
              {enrolledGroupsList.join(' ، ') || 'فوج غير محدد'}
            </div>
          </div>
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600, fontSize: '0.78rem' }}>
              حالة التلميذ:
            </span>
            <div style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.9rem' }}>
              مفعل وجاهز للمسح الضوئي ⚡
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <a
            href="/student_card1.pdf"
            download="Student_Card_Template.pdf"
            className="m3-btn m3-btn-outlined"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.82rem',
              color: '#ea580c',
              borderColor: '#fdba74'
            }}
            title="تحميل ملف تصميم البطاقة الأصلي بصيغة PDF"
          >
            <Download size={15} />
            <span>تحميل قالب PDF الأصلي</span>
          </a>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
              إغلاق
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="m3-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                fontWeight: 800,
                backgroundColor: '#ea580c',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--md-shape-full)',
                boxShadow: '0 4px 14px rgba(234, 88, 12, 0.35)',
                cursor: 'pointer'
              }}
            >
              <Printer size={18} />
              <span>
                {printLayout === 'cr80' ? 'طباعة بطاقة CR80 PVC (صفحة 1)' : 'طباعة كشف A4 (صفحة 1 - 10 بطاقات)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

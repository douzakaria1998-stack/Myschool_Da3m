'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { X, Printer, IdCard, Sparkles, Phone, Users, ShieldCheck } from 'lucide-react';
import { StudentRecord } from '../types';
import { useApp } from '../context/AppContext';

interface Props {
  student: StudentRecord;
  groupId?: string;
  allGroups?: string[];
  onClose: () => void;
}

export default function StudentBadgeModal({ student, groupId, allGroups = [], onClose }: Props) {
  const { data } = useApp();
  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  const barcodeValue =
    student.barcode?.trim() ||
    (groupId ? `${groupId}-${student.rowId}` : `STU-2600${student.rowId.toString().padStart(4, '0')}`);

  useEffect(() => {
    if (barcodeSvgRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.6,
          height: 42,
          displayValue: true,
          font: 'monospace',
          fontSize: 11,
          textMargin: 2,
          margin: 2,
          lineColor: '#0f172a'
        });
      } catch (err) {
        console.error('JsBarcode rendering failed:', err);
      }
    }
  }, [barcodeValue]);

  const handlePrint = () => {
    window.print();
  };

  const currentGroupMeta = groupId ? data.groups.find((g) => g.id === groupId) : null;
  const groupSubject = currentGroupMeta?.subject || (groupId ? data.groupData[groupId]?.subject : '');
  const groupTeacher = currentGroupMeta?.teacherName || (groupId ? data.groupData[groupId]?.teacherName : '');

  const enrolledGroupsList = allGroups.length > 0 ? allGroups : groupId ? [groupId] : [];

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '580px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '16px',
          backgroundColor: 'var(--md-sys-color-surface)'
        }}
      >
        {/* Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4f46e5'
              }}
            >
              <IdCard size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                بطاقة وشارة التلميذ (PVC Badge)
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--md-sys-color-outline)' }}>
                معيار CR80 القياسي (85.6mm × 54mm) مجهزة بطباعة الباركود المشفر
              </p>
            </div>
          </div>
          <button onClick={onClose} className="m3-btn-icon" title="إغلاق">
            <X size={20} />
          </button>
        </div>

        {/* PVC Card Preview Box */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px 12px',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            borderRadius: '12px',
            border: '1px dashed var(--md-sys-color-outline-variant)',
            marginBottom: '20px'
          }}
        >
          {/* Printable PVC Badge Container (Exact CR80 Dimensions: 85.6mm x 54mm) */}
          <div
            id="pvc-card-to-print"
            className="pvc-card"
            style={{
              width: '85.6mm',
              height: '54mm',
              minWidth: '85.6mm',
              minHeight: '54mm',
              boxSizing: 'border-box',
              borderRadius: '3.18mm', // standard rounded corners on PVC cards
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #eef2ff 100%)',
              border: '1px solid #cbd5e1',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: '3mm 4mm',
              direction: 'rtl',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              color: '#0f172a'
            }}
          >
            {/* Top Security Gradient Accent Line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2.5mm',
                background: 'linear-gradient(90deg, #4f46e5 0%, #06b6d4 50%, #10b981 100%)'
              }}
            />

            {/* Card Header: School Logo & Title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '1mm',
                borderBottom: '0.5px solid #e2e8f0',
                paddingBottom: '1.5mm'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '2mm' }}>
                <img
                  src="/logo.svg"
                  alt="Logo"
                  style={{ height: '7mm', width: 'auto', maxHeight: '28px', objectFit: 'contain' }}
                />
                <div>
                  <div style={{ fontSize: '7.5pt', fontWeight: 900, color: '#1e1b4b', lineHeight: 1.1 }}>
                    {data.centerName || 'مؤسسة دعم للدروس الخصوصية'}
                  </div>
                  <div style={{ fontSize: '5.5pt', color: '#64748b', fontWeight: 600 }}>
                    بطاقة التلميذ المعتمدة | {data.academicYear || '2026/2027'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontSize: '5.5pt',
                  fontWeight: 800,
                  padding: '1mm 2mm',
                  borderRadius: '1.5mm',
                  letterSpacing: '0.2px'
                }}
              >
                بطاقة الحضور
              </div>
            </div>

            {/* Student Info Body */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1mm 0' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '6pt', color: '#64748b', fontWeight: 700 }}>اسم ولقب التلميذ:</div>
                <div
                  style={{
                    fontSize: '10.5pt',
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.2,
                    marginBottom: '1mm'
                  }}
                >
                  {student.name}
                </div>

                <div style={{ display: 'flex', gap: '3mm', flexWrap: 'wrap', fontSize: '6pt', color: '#334155' }}>
                  {student.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1mm' }}>
                      <span style={{ fontWeight: 700 }}>الهاتف:</span>
                      <span style={{ fontFamily: 'monospace', direction: 'ltr' }}>{student.phone}</span>
                    </div>
                  )}

                  {enrolledGroupsList.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1mm' }}>
                      <span style={{ fontWeight: 700 }}>الأفواج:</span>
                      <span
                        style={{
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          fontWeight: 800,
                          padding: '0.3mm 1.5mm',
                          borderRadius: '1mm'
                        }}
                      >
                        {enrolledGroupsList.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {groupSubject && (
                  <div style={{ fontSize: '5.5pt', color: '#475569', marginTop: '0.8mm' }}>
                    المادة: <strong>{groupSubject}</strong> {groupTeacher ? `| الأستاذ: ${groupTeacher}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Barcode Section (Bottom) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                border: '0.5px solid #e2e8f0',
                borderRadius: '1.5mm',
                padding: '1mm 2mm',
                marginTop: '0.5mm'
              }}
            >
              <svg
                ref={barcodeSvgRef}
                style={{
                  width: '100%',
                  maxHeight: '16mm',
                  display: 'block'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card Details Summary */}
        <div
          style={{
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.85rem',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px'
          }}
        >
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>رمز الباركود:</span>{' '}
            <strong style={{ fontFamily: 'monospace', color: 'var(--md-sys-color-primary)' }}>{barcodeValue}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>معيار البطاقة:</span>{' '}
            <strong>CR80 PVC (85.6mm × 54mm)</strong>
          </div>
          <div>
            <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>حالة الطالب:</span>{' '}
            <span style={{ color: '#16a34a', fontWeight: 700 }}>نشط ومفعل للمسح ⚡</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
            إغلاق
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="m3-btn m3-btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Printer size={18} />
            <span>طباعة بطاقة التلميذ (PVC Card)</span>
          </button>
        </div>

        {/* Print Styles for Direct PVC Card Printing */}
        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #pvc-card-to-print,
            #pvc-card-to-print * {
              visibility: visible !important;
            }
            #pvc-card-to-print {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              width: 85.6mm !important;
              height: 54mm !important;
              min-width: 85.6mm !important;
              min-height: 54mm !important;
              page-break-after: always;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page {
              size: 85.6mm 54mm;
              margin: 0;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

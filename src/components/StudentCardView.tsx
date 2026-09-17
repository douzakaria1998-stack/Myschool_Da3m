'use client';

import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { ShieldCheck } from 'lucide-react';
import { StudentRecord } from '../types';

interface StudentCardViewProps {
  student: StudentRecord;
  academicYear?: string;
  centerName?: string;
  id?: string;
  isSinglePrint?: boolean;
}

const StudentCardView = React.forwardRef<HTMLDivElement, StudentCardViewProps>(function StudentCardView(
  {
    student,
    academicYear = '2026/2027',
    centerName,
    id,
    isSinglePrint = false
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null);

  let barcodeValue =
    student.barcode?.trim() ||
    `STU-2700${student.rowId.toString().padStart(4, '0')}`;

  if (barcodeValue.startsWith('STU-627')) {
    barcodeValue = 'STU-27' + barcodeValue.slice(7);
  } else if (barcodeValue.startsWith('STU-626')) {
    barcodeValue = 'STU-26' + barcodeValue.slice(7);
  } else if (barcodeValue.startsWith('STU-26')) {
    barcodeValue = barcodeValue.replace(/^STU-26/, 'STU-27');
  }

  useEffect(() => {
    if (svgRef.current && barcodeValue) {
      try {
        JsBarcode(svgRef.current, barcodeValue, {
          format: 'CODE128',
          width: 1.55,
          height: 38,
          displayValue: true,
          font: 'monospace',
          fontSize: 9.5,
          textMargin: 2.5,
          margin: 1,
          lineColor: '#000000',
          background: 'transparent'
        });
      } catch (err) {
        console.error('JsBarcode rendering failed:', err);
      }
    }
  }, [barcodeValue]);

  return (
    <div
      ref={ref}
      id={id}
      className="pvc-card my-school-card"
      style={{
        width: '85.6mm',
        height: '54mm',
        minWidth: '85.6mm',
        minHeight: '54mm',
        maxWidth: '85.6mm',
        maxHeight: '54mm',
        boxSizing: 'border-box',
        borderRadius: '3.18mm', // Standard CR80 corner radius
        backgroundColor: '#fffdfa',
        backgroundImage: 'radial-gradient(circle at 90% 10%, #fff7ed 0%, #fffdfa 70%)',
        border: '1px solid #fed7aa',
        boxShadow: isSinglePrint ? '0 10px 30px rgba(242, 99, 34, 0.15), 0 2px 6px rgba(0, 0, 0, 0.06)' : 'none',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3mm 3.8mm 2.8mm 3.8mm',
        direction: 'rtl',
        fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif",
        color: '#0f172a',
        userSelect: 'none'
      }}
    >
      {/* 1. Header Accent Banner with Concentric Ripple Rings (Full Orange Banner across top) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '24mm',
          overflow: 'hidden',
          zIndex: 0,
          pointerEvents: 'none'
        }}
      >
        <svg
          viewBox="0 0 324 90"
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            <linearGradient id="cardOrangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff7a18" />
              <stop offset="45%" stopColor="#f26322" />
              <stop offset="100%" stopColor="#d94b08" />
            </linearGradient>
          </defs>
          {/* Full-width header banner with smooth curved bottom */}
          <path
            d="M0,0 L324,0 L324,82 Q162,90 0,82 Z"
            fill="url(#cardOrangeGrad)"
          />
          {/* Concentric Circle Ripple Lines in Top Right */}
          <circle cx="295" cy="8" r="14" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.2" />
          <circle cx="295" cy="8" r="26" fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="1.2" />
          <circle cx="295" cy="8" r="39" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.2" />
          <circle cx="295" cy="8" r="53" fill="none" stroke="rgba(255,255,255,0.20)" strokeWidth="1.2" />
          <circle cx="295" cy="8" r="68" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
          <circle cx="295" cy="8" r="84" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.2" />
        </svg>
      </div>

      {/* 2. Top Header Content (All inside orange zone, all pure white!) */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          paddingTop: '0.4mm'
        }}
      >
        {/* Brand Logo in Pure White */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.6mm' }}>
          <img
            src="/my_school_logo_white.svg"
            alt="My School - Live the Future"
            style={{
              height: '7.8mm',
              width: 'auto',
              maxHeight: '32px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25))'
            }}
          />
        </div>

        {/* Institution Name in Pure White on Orange Banner */}
        <div
          style={{
            fontSize: '8.4pt',
            fontWeight: 900,
            color: '#ffffff',
            lineHeight: 1.15,
            letterSpacing: '-0.1px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)'
          }}
        >
          مدرسة ماي سكول لتعليم اللغات
        </div>

        {/* Academic Year & Card Type in Pure White, solidly inside orange zone */}
        <div
          style={{
            fontSize: '5.8pt',
            color: '#ffffff',
            fontWeight: 800,
            marginTop: '0.5mm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
            opacity: 0.95
          }}
        >
          <span>بطاقة التلميذ المعتمدة</span>
          <span style={{ opacity: 0.75 }}>|</span>
          <span>{academicYear || '2026/2027'}</span>
        </div>
      </div>

      {/* 3. Floating Crisp White Card Container (Shifted UP, clean, spacious & uncluttered) */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          backgroundColor: '#ffffff',
          borderRadius: '2.8mm',
          border: '1px solid #fed7aa',
          boxShadow: '0 3px 10px rgba(242, 99, 34, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04)',
          padding: '2.5mm 3.5mm 1.8mm 3.5mm',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '25.5mm',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Info: Student Name on right & Verified Chip on left */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: '11.5pt',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '56mm'
            }}
          >
            {student.name}
          </div>

          <span
            style={{
              fontSize: '5pt',
              fontWeight: 800,
              color: '#c2410c',
              backgroundColor: '#fff7ed',
              border: '0.5px solid #fed7aa',
              padding: '0.4mm 1.5mm',
              borderRadius: '1.2mm',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
              whiteSpace: 'nowrap'
            }}
          >
            <ShieldCheck size={7.5} color="#ea580c" />
            <span>معتمد ✓</span>
          </span>
        </div>

        {/* Bottom: Barcode Rendered Crisp & High-Contrast (No redundant groups/ID labels) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '0.2mm',
            backgroundColor: '#ffffff'
          }}
        >
          <svg
            ref={svgRef}
            style={{
              width: '100%',
              maxHeight: '14mm',
              display: 'block'
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default StudentCardView;

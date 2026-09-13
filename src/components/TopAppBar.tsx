'use client';

import React from 'react';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Download, GraduationCap, School } from 'lucide-react';

export default function TopAppBar() {
  const { data, theme, toggleTheme, lang, toggleLang, exportDataJson } = useApp();

  return (
    <header
      className="no-print"
      style={{
        height: '64px',
        backgroundColor: 'var(--md-sys-color-surface-container)',
        borderBottom: '1px solid var(--md-sys-color-outline-variant)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        boxSizing: 'border-box'
      }}
    >
      {/* Brand & Center Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src="/logo.svg"
          alt={data.centerName || 'شعار المدرسة'}
          style={{
            height: '44px',
            width: 'auto',
            maxWidth: '120px',
            objectFit: 'contain',
            display: 'block'
          }}
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              {data.centerName || 'مؤسسة دعم'}
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                padding: '2px 8px',
                borderRadius: 'var(--md-shape-full)'
              }}
            >
              {data.cycle || 'الدورة الحالية'}
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            {data.academicYear} | نظام إدارة الحضور، الأفواج والمالية
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Quick Export Backup */}
        <button
          onClick={exportDataJson}
          className="m3-btn m3-btn-outlined m3-btn-sm"
          title="تصدير نسخة احتياطية (JSON)"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Download size={16} />
          <span>{lang === 'ar' ? 'تصدير نسخة' : 'Export'}</span>
        </button>

        {/* Language Toggle */}
        <button
          onClick={toggleLang}
          className="m3-btn m3-btn-tonal m3-btn-sm"
          title="تبديل اللغة"
          style={{ minWidth: '42px', fontWeight: 700 }}
        >
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="m3-btn m3-btn-tonal m3-btn-sm"
          title={theme === 'light' ? 'الوضع الليلي' : 'الوضع النهاري'}
          style={{ width: '40px', height: '40px', padding: 0 }}
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>
    </header>
  );
}

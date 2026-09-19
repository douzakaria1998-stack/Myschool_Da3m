'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import { Sun, Moon, Download, GraduationCap, School, CloudCheck, CloudOff, RefreshCw, Scan, Clock } from 'lucide-react';
import HourlyPaymentFilterModal from './HourlyPaymentFilterModal';

export default function TopAppBar() {
  const {
    data,
    selectedGroup,
    theme,
    toggleTheme,
    lang,
    toggleLang,
    exportDataJson,
    cloudSyncStatus,
    lastSyncedAt,
    syncNow
  } = useApp();

  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isHourlyFilterOpen, setIsHourlyFilterOpen] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncNow();
    } finally {
      setTimeout(() => setIsManualSyncing(false), 500);
    }
  };

  const isSyncing = cloudSyncStatus === 'syncing' || isManualSyncing;

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
        {/* Hourly Income / Payments Filter Button */}
        <button
          onClick={() => setIsHourlyFilterOpen(true)}
          className="m3-btn m3-btn-sm"
          title={lang === 'ar' ? 'تصفية المداخيل حسب الساعات واليوم' : 'Hourly Income & Payments Filter'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--md-shape-full)',
            border: '1px solid #6ee7b7',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 700
          }}
        >
          <Clock size={14} />
          <span>{lang === 'ar' ? 'مداخيل الساعات 🕒' : 'Hourly Income'}</span>
        </button>

        {/* Cloud Sync Status & Manual Sync Button */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="m3-btn m3-btn-sm"
          title={
            cloudSyncStatus === 'synced'
              ? (lang === 'ar'
                  ? `متزامن سحابياً مع Supabase ${lastSyncedAt ? `(آخر حفظ: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})` : ''} - اضغط للمزامنة الفورية`
                  : 'Synced with Supabase - Click to sync now')
              : isSyncing
              ? (lang === 'ar' ? 'جاري المزامنة مع السحابة...' : 'Syncing with Supabase...')
              : (lang === 'ar' ? 'غير متصل بالسحابة (محلي) - اضغط لإعادة المحاولة' : 'Cloud offline - Click to retry')
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: 'var(--md-shape-full)',
            border: cloudSyncStatus === 'error'
              ? '1px solid #ef4444'
              : cloudSyncStatus === 'offline'
              ? '1px solid #f59e0b'
              : '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: isSyncing
              ? 'var(--md-sys-color-primary-container)'
              : cloudSyncStatus === 'error'
              ? '#fee2e2'
              : cloudSyncStatus === 'offline'
              ? '#fef3c7'
              : 'var(--md-sys-color-surface-container-high)',
            color: isSyncing
              ? 'var(--md-sys-color-on-primary-container)'
              : cloudSyncStatus === 'error'
              ? '#991b1b'
              : cloudSyncStatus === 'offline'
              ? '#92400e'
              : 'var(--md-sys-color-on-surface)',
            cursor: isSyncing ? 'default' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
        >
          {isSyncing ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>{lang === 'ar' ? 'جاري الحفظ...' : 'Syncing...'}</span>
            </>
          ) : cloudSyncStatus === 'synced' ? (
            <>
              <CloudCheck size={16} style={{ color: '#16a34a' }} />
              <span>{lang === 'ar' ? 'سحابي متزامن' : 'Synced'}</span>
            </>
          ) : (
            <>
              <CloudOff size={15} style={{ color: cloudSyncStatus === 'error' ? '#ef4444' : '#d97706' }} />
              <span>{cloudSyncStatus === 'error' ? (lang === 'ar' ? 'خطأ مزامنة' : 'Sync Error') : (lang === 'ar' ? 'وضع محلي' : 'Offline')}</span>
            </>
          )}
        </button>

        {/* Fast Barcode / Card Scanner Screen Link */}
        <Link
          href="/scanner"
          className="m3-btn m3-btn-sm"
          title={lang === 'ar' ? 'الانتقال إلى محطة مسح الباركود' : 'Go to Barcode Scanner Station'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#ffffff',
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.35)',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 12px',
            borderRadius: 'var(--md-shape-full)',
            textDecoration: 'none'
          }}
        >
          <Scan size={15} />
          <span>{lang === 'ar' ? 'قارئ الباركود ⚡' : 'Scan ⚡'}</span>
        </Link>

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

      {isHourlyFilterOpen && (
        <HourlyPaymentFilterModal
          isOpen={isHourlyFilterOpen}
          onClose={() => setIsHourlyFilterOpen(false)}
          initialGroupId={selectedGroup}
        />
      )}
    </header>
  );
}

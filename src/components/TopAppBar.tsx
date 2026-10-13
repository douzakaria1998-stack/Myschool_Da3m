'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Sun, Moon, Download, GraduationCap, School, CloudCheck, CloudOff, RefreshCw, Scan, Clock, Trash2, FolderOpen, LogIn, LogOut, Shield, Globe, User as UserIcon } from 'lucide-react';
import HourlyPaymentFilterModal from './HourlyPaymentFilterModal';
import RecycleBinModal from './RecycleBinModal';
import { openReceiptsFolder } from '../utils/receiptSaveUtils';

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
  const { user, isSuperAdmin, isAdmin, isAuthenticated, logout } = useAuth();

  const [isMounted, setIsMounted] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isHourlyFilterOpen, setIsHourlyFilterOpen] = useState(false);
  const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveTheme = isMounted ? theme : 'light';
  const effectiveLang = isMounted ? lang : 'ar';
  const deletedCount = isMounted ? (data.deletedStudents?.length || 0) : 0;

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
        padding: '0 16px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        boxSizing: 'border-box',
        gap: '12px'
      }}
    >
      {/* Brand & Center Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, minWidth: 0 }}>
        <img
          src="/logo.svg"
          alt={data.centerName || 'شعار المدرسة'}
          style={{
            height: '38px',
            width: 'auto',
            maxWidth: '110px',
            objectFit: 'contain',
            display: 'block'
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.2 }}>
              {data.centerName || 'مؤسسة دعم'}
            </h1>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                padding: '2px 8px',
                borderRadius: 'var(--md-shape-full)',
                whiteSpace: 'nowrap'
              }}
            >
              {data.cycle || 'بكالوريا 2027'}
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', whiteSpace: 'nowrap', margin: 0, lineHeight: 1.2 }}>
            {data.academicYear} | نظام إدارة الحضور، الأفواج والمالية
          </p>
        </div>
      </div>

      {/* Action Buttons - Icon Only */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, flexWrap: 'nowrap' }}>
        {/* Hourly Income / Payments Filter Button */}
        <button
          onClick={() => setIsHourlyFilterOpen(true)}
          className="m3-btn"
          title={effectiveLang === 'ar' ? 'مداخيل الساعات واليوم' : 'Hourly Income & Payments'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: effectiveTheme === 'dark' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid #6ee7b7',
            backgroundColor: effectiveTheme === 'dark' ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5',
            color: effectiveTheme === 'dark' ? '#6ee7b7' : '#065f46',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Clock size={16} />
        </button>

        {/* Recycle Bin / Restored Students */}
        <button
          onClick={() => setIsRecycleBinOpen(true)}
          className="m3-btn"
          title={
            effectiveLang === 'ar'
              ? `سلة المحذوفات واسترجاع الطلبة المحذوفين (${deletedCount})`
              : `Recycle Bin & Restored Students (${deletedCount})`
          }
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            position: 'relative',
            border: deletedCount > 0
              ? (effectiveTheme === 'dark' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid #f87171')
              : '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: deletedCount > 0
              ? (effectiveTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fef2f2')
              : 'var(--md-sys-color-surface-container-high)',
            color: deletedCount > 0
              ? (effectiveTheme === 'dark' ? '#f87171' : '#b91c1c')
              : 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Trash2 size={16} />
          {deletedCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '0.62rem',
                fontWeight: 800,
                borderRadius: 'var(--md-shape-full)',
                minWidth: '16px',
                height: '16px',
                padding: '0 3px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1
              }}
            >
              {deletedCount > 99 ? '99+' : deletedCount}
            </span>
          )}
        </button>

        {/* Cloud Sync Status & Manual Sync Button */}
        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="m3-btn"
          title={
            cloudSyncStatus === 'synced'
              ? (effectiveLang === 'ar'
                  ? `متزامن سحابياً مع Supabase ${isMounted && lastSyncedAt ? `(آخر حفظ: ${lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})` : ''} - اضغط للمزامنة الفورية`
                  : 'Synced with Supabase - Click to sync now')
              : isSyncing
              ? (effectiveLang === 'ar' ? 'جاري المزامنة مع السحابة...' : 'Syncing with Supabase...')
              : (effectiveLang === 'ar' ? 'غير متصل بالسحابة (محلي) - اضغط لإعادة المحاولة' : 'Cloud offline - Click to retry')
          }
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: cloudSyncStatus === 'error'
              ? '1px solid #ef4444'
              : cloudSyncStatus === 'offline'
              ? '1px solid #f59e0b'
              : '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: isSyncing
              ? 'var(--md-sys-color-primary-container)'
              : cloudSyncStatus === 'error'
              ? (effectiveTheme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2')
              : cloudSyncStatus === 'offline'
              ? (effectiveTheme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7')
              : 'var(--md-sys-color-surface-container-high)',
            color: isSyncing
              ? 'var(--md-sys-color-on-primary-container)'
              : cloudSyncStatus === 'error'
              ? (effectiveTheme === 'dark' ? '#fca5a5' : '#991b1b')
              : cloudSyncStatus === 'offline'
              ? (effectiveTheme === 'dark' ? '#fcd34d' : '#92400e')
              : 'var(--md-sys-color-on-surface)',
            cursor: isSyncing ? 'default' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'all 0.2s ease'
          }}
        >
          {isSyncing ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : cloudSyncStatus === 'synced' ? (
            <CloudCheck size={18} style={{ color: '#16a34a' }} />
          ) : (
            <CloudOff size={16} style={{ color: cloudSyncStatus === 'error' ? '#ef4444' : '#d97706' }} />
          )}
        </button>

        {/* Fast Barcode / Card Scanner Screen Link */}
        <Link
          href="/scanner"
          className="m3-btn"
          title={lang === 'ar' ? 'قارئ الباركود ومحطة المسح السريع' : 'Barcode Scanner'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Scan size={16} />
        </Link>

        {/* Quick Export Backup */}
        <button
          onClick={exportDataJson}
          className="m3-btn"
          title={effectiveLang === 'ar' ? 'تصدير نسخة احتياطية (JSON)' : 'Export Backup (JSON)'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Download size={16} />
        </button>

        {/* Saved Receipts Folder Button */}
        <button
          onClick={() => openReceiptsFolder()}
          className="m3-btn"
          title={effectiveLang === 'ar' ? 'فتح مجلد وصولات PDF على الكمبيوتر' : 'Open Saved Receipts Folder'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <FolderOpen size={16} />
        </button>

        {/* Language Toggle Button */}
        <button
          onClick={toggleLang}
          className="m3-btn"
          title={effectiveLang === 'ar' ? 'تبديل اللغة (English)' : 'تبديل اللغة (العربية)'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Globe size={16} />
        </button>

        {/* User Auth Status & Action */}
        {isAuthenticated && user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Link
              href={isSuperAdmin ? '/admin/users' : '/admin'}
              title={`المستخدم الحالي: ${user.name || user.username} (${isSuperAdmin ? 'Super Admin' : 'Admin'})`}
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                borderRadius: 'var(--md-shape-full)',
                textDecoration: 'none',
                backgroundColor: isSuperAdmin
                  ? 'rgba(147, 51, 234, 0.15)'
                  : 'rgba(59, 130, 246, 0.15)',
                color: isSuperAdmin ? '#9333ea' : '#2563eb',
                border: isSuperAdmin
                  ? '1px solid rgba(147, 51, 234, 0.35)'
                  : '1px solid rgba(59, 130, 246, 0.35)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Shield size={16} />
            </Link>

            <button
              onClick={() => logout()}
              title="تسجيل الخروج"
              className="m3-btn"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                borderRadius: 'var(--md-shape-full)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="m3-btn"
            title="تسجيل الدخول"
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: 'var(--md-shape-full)',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <LogIn size={16} />
          </Link>
        )}

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="m3-btn"
          title={effectiveTheme === 'light' ? 'الوضع الليلي' : 'الوضع النهاري'}
          style={{
            width: '36px',
            height: '36px',
            padding: 0,
            borderRadius: 'var(--md-shape-full)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            color: 'var(--md-sys-color-on-surface)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {effectiveTheme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>

      {isHourlyFilterOpen && (
        <HourlyPaymentFilterModal
          isOpen={isHourlyFilterOpen}
          onClose={() => setIsHourlyFilterOpen(false)}
          initialGroupId={selectedGroup}
        />
      )}

      {isRecycleBinOpen && (
        <RecycleBinModal onClose={() => setIsRecycleBinOpen(false)} />
      )}
    </header>
  );
}

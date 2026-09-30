'use client';

import React, { useState, useEffect } from 'react';
import { FolderOpen, CheckCircle, X, FileText } from 'lucide-react';
import { ReceiptSaveEventDetail, openReceiptsFolder } from '../utils/receiptSaveUtils';

export default function ReceiptSavedNotification() {
  const [notification, setNotification] = useState<{
    count: number;
    filename?: string;
    folder?: string;
  } | null>(null);

  useEffect(() => {
    const handleSaved = (e: Event) => {
      const customEvent = e as CustomEvent<ReceiptSaveEventDetail>;
      if (customEvent.detail && customEvent.detail.success) {
        setNotification({
          count: customEvent.detail.count || 1,
          filename: customEvent.detail.filename,
          folder: customEvent.detail.folder,
        });
      }
    };

    window.addEventListener('da3m-receipt-saved', handleSaved);
    return () => window.removeEventListener('da3m-receipt-saved', handleSaved);
  }, []);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [notification]);

  if (!notification) return null;

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        zIndex: 9999,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: '460px',
        border: '1px solid #334155',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        direction: 'rtl',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: '#16a34a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <CheckCircle size={20} color="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#fff', marginBottom: '2px' }}>
          {notification.count > 1
            ? `✓ تم حفظ ${notification.count} وصولات كـ PDF على الحاسوب`
            : '✓ تم حفظ نسخة الوصل (PDF) على الحاسوب'}
        </div>
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          سطح المكتب \ الوصولات
        </div>
      </div>

      <button
        onClick={() => openReceiptsFolder()}
        className="m3-btn"
        style={{
          backgroundColor: '#0284c7',
          color: '#fff',
          border: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0369a1')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0284c7')}
      >
        <FolderOpen size={14} />
        <span>فتح المجلد</span>
      </button>

      <button
        onClick={() => setNotification(null)}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="إغلاق"
      >
        <X size={16} />
      </button>
    </div>
  );
}

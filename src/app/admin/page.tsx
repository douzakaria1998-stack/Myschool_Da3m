'use client';

import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  ShieldAlert,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  Lock,
  Save,
  Tag
} from 'lucide-react';
import { PricingTier } from '../../types';

export default function AdminPage() {
  const { data, updatePricingTier, exportDataJson, importDataJson, resetToDefault } = useApp();

  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Unlock Admin
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === data.credentials.adminPass || pinInput === data.credentials.userPass) {
      setIsAdminUnlocked(true);
      setPinError('');
    } else {
      setPinError('كلمة المرور غير صحيحة. كلمة مرور الإدارة الافتراضية هي 777');
    }
  };

  // Pricing tier edit handler
  const handleTierChange = (tierId: string, field: keyof PricingTier, value: number | string) => {
    updatePricingTier(tierId, { [field]: Number(value) });
  };

  // Import JSON file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importDataJson(content);
        if (success) {
          setSuccessMessage('تم استرجاع قاعدة البيانات بنجاح!');
          setTimeout(() => setSuccessMessage(''), 4000);
        } else {
          alert('الملف غير صالح أو تالف');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div
        className="m3-card"
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            إدارة الأسعار والإعدادات العامة
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            تعديل تسعيرة الحصص، نسب تقاسم الأرباح مع الأساتذة، والنسخ الاحتياطي
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: isAdminUnlocked
                ? 'var(--status-present-container)'
                : 'var(--md-sys-color-surface-container-high)',
              color: isAdminUnlocked ? 'var(--status-present)' : 'var(--md-sys-color-outline)'
            }}
          >
            {isAdminUnlocked ? 'وضع المسؤول مفعّل ✓' : 'وضع القراءة فقط 🔒'}
          </span>
        </div>
      </div>

      {/* PIN Unlock Card if locked */}
      {!isAdminUnlocked && (
        <div
          className="m3-card"
          style={{
            padding: '24px',
            backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
            textAlign: 'center',
            maxWidth: '440px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px'
            }}
          >
            <Lock size={24} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>تسجيل دخول المسؤول</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
            أدخل كلمة مرور المسؤول (Admin Pass) لتعديل الأسعار والنسب
          </p>

          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="كلمة المرور (الافتراضية: 777)"
              className="m3-input"
              style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '1.1rem' }}
              autoFocus
            />
            {pinError && (
              <div style={{ color: 'var(--md-sys-color-error)', fontSize: '0.8rem' }}>{pinError}</div>
            )}
            <button type="submit" className="m3-btn m3-btn-primary">
              تأكيد الدخول
            </button>
          </form>
        </div>
      )}

      {/* Pricing Tiers Table */}
      <div className="m3-card" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>خطط التسعير ونسب اقتسام الأرباح</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              تغيير هذه القيم يُعاد احتسابه تلقائياً في كافة كشوف الحضور والمالية
            </p>
          </div>
          <Tag size={20} color="var(--md-sys-color-primary)" />
        </div>

        <div className="m3-table-container">
          <table className="m3-table">
            <thead>
              <tr>
                <th>رمز الخطة</th>
                <th>اسم الخطة</th>
                <th style={{ textAlign: 'center' }}>الحصص</th>
                <th style={{ textAlign: 'center' }}>المبلغ الإجمالي (دج)</th>
                <th style={{ textAlign: 'center' }}>حصة الأستاذ (دج)</th>
                <th style={{ textAlign: 'center' }}>حصة المركز (دج)</th>
                <th style={{ textAlign: 'center' }}>نسبة الأستاذ</th>
              </tr>
            </thead>
            <tbody>
              {data.pricingTiers.map((tier) => {
                const teacherPercentage = tier.price > 0 ? Math.round((tier.teacherRate / tier.price) * 100) : 0;

                return (
                  <tr key={tier.id}>
                    <td style={{ fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>{tier.id}</td>
                    <td style={{ fontWeight: 600 }}>{tier.name}</td>
                    <td style={{ textAlign: 'center' }}>{tier.sessions}</td>

                    {/* Price Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.price}
                          onChange={(e) => handleTierChange(tier.id, 'price', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <strong>{tier.price} دج</strong>
                      )}
                    </td>

                    {/* Teacher Rate Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.teacherRate}
                          onChange={(e) => handleTierChange(tier.id, 'teacherRate', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-secondary)' }}>{tier.teacherRate} دج</span>
                      )}
                    </td>

                    {/* School Rate Input */}
                    <td style={{ textAlign: 'center' }}>
                      {isAdminUnlocked ? (
                        <input
                          type="number"
                          value={tier.schoolRate}
                          onChange={(e) => handleTierChange(tier.id, 'schoolRate', e.target.value)}
                          className="m3-input"
                          style={{ width: '90px', padding: '4px 6px', textAlign: 'center' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>
                          {tier.schoolRate} دج
                        </span>
                      )}
                    </td>

                    {/* Percentage */}
                    <td style={{ textAlign: 'center' }}>
                      <span className="m3-chip" style={{ backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                        %{teacherPercentage} للأستاذ
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Backup & Data Management */}
      <div className="m3-card" style={{ padding: '24px', backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
          النسخ الاحتياطي وإدارة البيانات
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '16px' }}>
          يمكنك تصدير نسخة كاملة من البيانات لحفظها في حاسوبك أو استرجاع نسخة سابقة في أي وقت
        </p>

        {successMessage && (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-sm)',
              fontWeight: 700,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={exportDataJson}
            className="m3-btn m3-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={18} />
            <span>تصدير نسخة احتياطية (Download JSON)</span>
          </button>

          <label
            className="m3-btn m3-btn-outlined"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Upload size={18} />
            <span>استيراد نسخة سابقة (Import JSON)</span>
            <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>

          <button
            onClick={() => {
              if (
                confirm(
                  'تحذير: هل أنت متأكد من رغبتك في إعادة ضبط النظام إلى بيانات ملفات Excel الأصلية؟ سيتم إلغاء أي تعديلات محلية جديدة.'
                )
              ) {
                resetToDefault();
                setSuccessMessage('تم استرجاع البيانات الأصلية من ملفات Excel بنجاح!');
                setTimeout(() => setSuccessMessage(''), 3000);
              }
            }}
            className="m3-btn m3-btn-danger m3-btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginInlineStart: 'auto' }}
          >
            <RotateCcw size={16} />
            <span>إعادة ضبط لقاعدة بيانات Excel الأصلية</span>
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Lock, User, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await login(username.trim(), password.trim());
      if (res.success) {
        router.push(redirectPath);
      } else {
        setErrorMessage(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء تسجيل الدخول');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        className="m3-card"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px 32px',
          backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          borderRadius: '24px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.08)',
          border: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        {/* Brand Icon & Heading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}
          >
            <ShieldCheck size={32} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)', marginBottom: '6px' }}>
            تسجيل الدخول للنظام
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            مؤسسة دعم للدروس الخصوصية والتعليمية
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid #ef4444',
              color: '#dc2626',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                marginBottom: '8px'
              }}
            >
              اسم المستخدم أو رقم PIN
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="superadmin أو admin1 أو PIN"
                required
                className="m3-input"
                style={{
                  width: '100%',
                  paddingInlineStart: '40px',
                  height: '46px',
                  fontSize: '0.95rem'
                }}
                autoFocus
              />
              <User
                size={18}
                style={{
                  position: 'absolute',
                  top: '14px',
                  insetInlineStart: '14px',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                marginBottom: '8px'
              }}
            >
              كلمة المرور
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور (777 أو 123)"
                required
                className="m3-input"
                style={{
                  width: '100%',
                  paddingInlineStart: '40px',
                  height: '46px',
                  fontSize: '0.95rem'
                }}
              />
              <Lock
                size={18}
                style={{
                  position: 'absolute',
                  top: '14px',
                  insetInlineStart: '14px',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="m3-btn"
            style={{
              height: '48px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              borderRadius: 'var(--md-shape-full)',
              fontWeight: 800,
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: isLoading ? 'default' : 'pointer',
              marginTop: '8px'
            }}
          >
            {isLoading ? (
              <span>جاري التحقق...</span>
            ) : (
              <>
                <span>دخول</span>
                <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </>
            )}
          </button>
        </form>

        {/* Quick Credentials Info Box for Ease of Use */}
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            border: '1px dashed var(--md-sys-color-outline-variant)'
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '10px' }}>
            الحسابات الافتراضية للنظام:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleQuickLogin('superadmin', '777')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              <span>المسؤول الرئيسي (Super Admin): <strong>superadmin</strong> / <strong>777</strong></span>
              <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>تعبئة</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin('admin1', '123')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--md-sys-color-on-surface)'
              }}
            >
              <span>مسؤول عادي (Admin): <strong>admin1</strong> / <strong>123</strong></span>
              <span style={{ color: 'var(--md-sys-color-primary)', fontWeight: 700 }}>تعبئة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '50px' }}>جاري التحميل...</div>}>
      <LoginForm />
    </Suspense>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, Check, X, AlertCircle, Delete, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SecurityPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  expectedPin?: string;
}

export default function SecurityPinModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'تأكيد رمز الأمان',
  description = 'يرجى إدخال رمز الأمان لعرض الإحصائيات العامة والمالية',
  expectedPin = '1234'
}: SecurityPinModalProps) {
  const { data } = useApp();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setShowPin(false);
      setIsShaking(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVerify = (codeToVerify?: string) => {
    const entered = (codeToVerify !== undefined ? codeToVerify : pin).trim();
    
    // Check against expected PIN (1234) or center admin password
    const adminPass = data?.credentials?.adminPass;
    const isMatch = entered === expectedPin || entered === '1234' || (adminPass && entered === adminPass);

    if (isMatch) {
      setError('');
      setPin('');
      onSuccess();
      onClose();
    } else {
      setError('رمز الأمان غير صحيح! يرجى إدخال الرمز الصحيح (1234)');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      setPin('');
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleVerify();
  };

  const handleKeypadPress = (val: string) => {
    setError('');
    if (val === 'clear') {
      setPin('');
      inputRef.current?.focus();
    } else if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
      inputRef.current?.focus();
    } else {
      const nextPin = pin + val;
      setPin(nextPin);
      inputRef.current?.focus();
      // Auto-verify when 4 digits are entered if desired
      if (nextPin.length === 4) {
        handleVerify(nextPin);
      }
    }
  };

  return (
    <div
      className="m3-dialog-backdrop"
      onClick={onClose}
      style={{
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '380px',
          width: '100%',
          padding: '24px',
          borderRadius: '24px',
          backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          animation: isShaking ? 'shake 0.4s ease-in-out' : 'slideUp 0.2s cubic-bezier(0.2, 0, 0, 1)'
        }}
      >
        {/* Header with Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="m3-btn-text"
            style={{
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--md-sys-color-on-surface-variant)'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Lock Icon and Title */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px',
              boxShadow: '0 4px 12px rgba(0, 99, 155, 0.2)'
            }}
          >
            <Lock size={26} />
          </div>
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 800,
              color: 'var(--md-sys-color-on-surface)',
              marginBottom: '6px'
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--md-sys-color-on-surface-variant)',
              lineHeight: 1.4
            }}
          >
            {description}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* PIN Input with visibility toggle */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <input
              ref={inputRef}
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              placeholder="••••"
              className="m3-input"
              style={{
                width: '100%',
                textAlign: 'center',
                letterSpacing: showPin ? '6px' : '10px',
                fontSize: '1.6rem',
                fontWeight: 800,
                padding: '12px 42px',
                borderRadius: '16px',
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                border: error ? '2px solid var(--md-sys-color-error)' : '2px solid var(--md-sys-color-outline-variant)',
                boxSizing: 'border-box'
              }}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              tabIndex={-1}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--md-sys-color-on-surface-variant)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px'
              }}
              title={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
            >
              {showPin ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
                color: 'var(--md-sys-color-error)',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '12px',
                backgroundColor: 'var(--md-sys-color-error-container)',
                padding: '8px 12px',
                borderRadius: '10px'
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Onscreen Number Pad */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '16px'
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleKeypadPress(digit)}
                className="m3-btn m3-btn-tonal"
                style={{
                  height: '44px',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleKeypadPress('clear')}
              className="m3-btn m3-btn-tonal"
              style={{
                height: '44px',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '12px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--md-sys-color-error)'
              }}
            >
              مسح
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="m3-btn m3-btn-tonal"
              style={{
                height: '44px',
                fontSize: '1.2rem',
                fontWeight: 700,
                borderRadius: '12px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('backspace')}
              className="m3-btn m3-btn-tonal"
              style={{
                height: '44px',
                borderRadius: '12px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="حذف"
            >
              <Delete size={18} />
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="m3-btn m3-btn-outlined"
              style={{
                flex: 1,
                padding: '10px',
                fontWeight: 600,
                borderRadius: '12px'
              }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="m3-btn m3-btn-primary"
              style={{
                flex: 2,
                padding: '10px',
                fontWeight: 700,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'var(--status-present)',
                color: '#ffffff'
              }}
            >
              <Check size={18} />
              <span>تأكيد وإظهار</span>
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

'use client';

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, UserPlus, CheckCircle2 } from 'lucide-react';
import { DiscountType } from '../types';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function AddStudentModal({ groupId, onClose }: Props) {
  const { addStudent, data } = useApp();
  const group = data.groupData[groupId];

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [discount, setDiscount] = useState<DiscountType>('1');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم ولقب التلميذ');
      return;
    }

    addStudent(groupId, {
      name: name.trim(),
      phone: phone.trim(),
      discount
    });

    onClose();
  };

  const handleSaveAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('يرجى إدخال اسم ولقب التلميذ');
      nameInputRef.current?.focus();
      return;
    }

    const savedName = name.trim();
    addStudent(groupId, {
      name: savedName,
      phone: phone.trim(),
      discount
    });

    // Reset inputs for next student
    setName('');
    setPhone('');
    setError('');
    setSuccessMsg(`تمت إضافة "${savedName}" بنجاح! يمكنك إدخال التلميذ التالي الآن.`);

    // Re-focus the name input immediately
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 50);

    // Auto dismiss success message
    setTimeout(() => {
      setSuccessMsg('');
    }, 3500);
  };

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '14px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              تسجيل تلميذ جديد في فوج {groupId}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              الاسم واللقب <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
                if (successMsg) setSuccessMsg('');
              }}
              placeholder="مثال: محمد بن علي"
              className="m3-input"
              autoFocus
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              رقم الهاتف (ولي الأمر / التلميذ)
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06XXXXXXXX / 07XXXXXXXX"
              className="m3-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              نوع التسجيل / التخفيض
            </label>
            <select
              value={discount}
              onChange={(e) => setDiscount(e.target.value as DiscountType)}
              className="m3-input"
              style={{ cursor: 'pointer' }}
            >
              <option value="1">تسعيرة عادية 100% ({group?.type === '4-10000' ? '10000 دج' : '2500 دج'})</option>
              <option value="0.8">تخفيض 20% (دفع 80%)</option>
              <option value="0">إعفاء كامل (معفى 0 دج)</option>
              <option value="تعويض">تعويض حصص</option>
            </select>
          </div>

          {error && (
            <div
              style={{
                color: 'var(--md-sys-color-error)',
                backgroundColor: 'var(--md-sys-color-error-container)',
                padding: '8px 12px',
                borderRadius: 'var(--md-shape-sm)',
                fontSize: '0.85rem'
              }}
            >
              {error}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                color: '#047857',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                padding: '8px 12px',
                borderRadius: 'var(--md-shape-sm)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <CheckCircle2 size={16} color="#059669" />
              <span>{successMsg}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleSaveAndAddAnother}
              className="m3-btn m3-btn-outlined"
              style={{
                borderColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700
              }}
              title="حفظ بيانات هذا التلميذ ومتابعة إضافة تلميذ آخر دون إغلاق النافذة"
            >
              <UserPlus size={16} />
              <span>حفظ وإضافة تلميذ آخر</span>
            </button>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
              إلغاء
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              إضافة التلميذ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

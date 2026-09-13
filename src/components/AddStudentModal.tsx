'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, UserPlus } from 'lucide-react';
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

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
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
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
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

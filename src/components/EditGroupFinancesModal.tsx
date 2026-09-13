'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Coins, CheckCircle, AlertTriangle } from 'lucide-react';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function EditGroupFinancesModal({ groupId, onClose }: Props) {
  const { data, updateGroupFinances } = useApp();
  const group = data.groupData[groupId];
  const groupMeta = data.groups.find((g) => g.id === groupId);

  const tier = data.pricingTiers.find((t) => t.id === (group?.type || groupMeta?.type));

  const initialFee = group?.studentFee ?? groupMeta?.studentFee ?? tier?.price ?? (group?.type?.includes('10000') ? 10000 : 2500);
  const initialTeacherPay = group?.teacherPayPerStudent ?? groupMeta?.teacherPayPerStudent ?? tier?.teacherRate ?? (group?.type?.includes('10000') ? 7500 : 1500);
  const initialSchoolShare = group?.schoolSharePerStudent ?? groupMeta?.schoolSharePerStudent ?? tier?.schoolRate ?? (initialFee - initialTeacherPay);

  const [studentFee, setStudentFee] = useState<number>(initialFee);
  const [teacherPay, setTeacherPay] = useState<number>(initialTeacherPay);
  const [schoolShare, setSchoolShare] = useState<number>(initialSchoolShare);
  const [isSaved, setIsSaved] = useState(false);

  if (!group && !groupMeta) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateGroupFinances(groupId, {
      studentFee: Number(studentFee) || 0,
      teacherPayPerStudent: Number(teacherPay) || 0,
      schoolSharePerStudent: Number(schoolShare) || 0
    });
    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const isBalanced = teacherPay + schoolShare === studentFee;

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              تعديل المستحقات المالية: فوج {groupId}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '34px', height: '34px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '14px' }}>
          حدد مبلغ الاشتراك الواجب دفعه من كل تلميذ، وحصة الأستاذ، والباقي المتبقي للمدرسة. سيتم إعادة احتساب جميع التلاميذ تلقائياً.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {/* 1. Payment amount for each student */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                padding: '10px',
                borderRadius: 'var(--md-shape-sm)',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: 'var(--md-sys-color-primary)',
                  marginBottom: '4px'
                }}
              >
                اشتراك التلميذ *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={studentFee}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setStudentFee(val);
                  setSchoolShare(Math.max(0, val - teacherPay));
                }}
                className="m3-input"
                style={{
                  padding: '6px 8px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  color: 'var(--md-sys-color-primary)'
                }}
                placeholder="2500"
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginTop: '4px', textAlign: 'center' }}>
                المطلوب من التلميذ
              </span>
            </div>

            {/* 2. Teacher payment for each student */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                padding: '10px',
                borderRadius: 'var(--md-shape-sm)',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: 'var(--status-present)',
                  marginBottom: '4px'
                }}
              >
                حصة الأستاذ *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={teacherPay}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setTeacherPay(val);
                  setSchoolShare(Math.max(0, studentFee - val));
                }}
                className="m3-input"
                style={{
                  padding: '6px 8px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  color: 'var(--status-present)'
                }}
                placeholder="1500"
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginTop: '4px', textAlign: 'center' }}>
                أتعاب الأستاذ
              </span>
            </div>

            {/* 3. Rest of the amount for the school */}
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                padding: '10px',
                borderRadius: 'var(--md-shape-sm)',
                border: '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  color: 'var(--status-vip)',
                  marginBottom: '4px'
                }}
              >
                الباقي للمدرسة *
              </label>
              <input
                type="number"
                min={0}
                step={50}
                value={schoolShare}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  setSchoolShare(val);
                  setTeacherPay(Math.max(0, studentFee - val));
                }}
                className="m3-input"
                style={{
                  padding: '6px 8px',
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  color: 'var(--status-vip)'
                }}
                placeholder="1000"
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginTop: '4px', textAlign: 'center' }}>
                مستحقات المؤسسة
              </span>
            </div>
          </div>

          {/* Formula breakdown and balance check */}
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--md-shape-sm)',
              backgroundColor: isBalanced ? 'var(--md-sys-color-surface-container)' : 'var(--status-absent-container)',
              fontSize: '0.8rem'
            }}
          >
            {isBalanced ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} color="var(--status-present)" />
                <span style={{ color: 'var(--status-present)', fontWeight: 700 }}>التوزيع متوازن:</span>
                <span>
                  الأستاذ (<strong>{teacherPay.toLocaleString()} دج</strong>) + المدرسة (<strong>{schoolShare.toLocaleString()} دج</strong>) = الإجمالي (<strong>{studentFee.toLocaleString()} دج</strong>)
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--status-absent)' }}>
                  <AlertTriangle size={15} />
                  <span style={{ fontWeight: 700 }}>
                    غير متوازن ({teacherPay + schoolShare} دج ≠ {studentFee} دج)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSchoolShare(Math.max(0, studentFee - teacherPay))}
                  style={{
                    backgroundColor: 'var(--status-absent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--md-shape-sm)',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  موازنة الباقي للمدرسة
                </button>
              </div>
            )}
          </div>

          {isSaved && (
            <div
              style={{
                backgroundColor: 'var(--status-present-container)',
                color: 'var(--status-present)',
                padding: '8px',
                borderRadius: 'var(--md-shape-sm)',
                fontSize: '0.85rem',
                fontWeight: 700,
                textAlign: 'center'
              }}
            >
              تم حفظ وتحديث المستحقات بنجاح!
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
              إلغاء
            </button>
            <button type="submit" className="m3-btn m3-btn-primary">
              تحديث المستحقات
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

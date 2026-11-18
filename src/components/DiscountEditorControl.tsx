'use client';

import React from 'react';
import { DiscountType, DiscountDuration } from '../types';

interface DiscountEditorControlProps {
  discount: DiscountType;
  customDiscountFee?: number;
  discountDuration?: DiscountDuration;
  baseGroupPrice?: number;
  onChange: (next: {
    discount: DiscountType;
    customDiscountFee?: number;
    discountDuration?: DiscountDuration;
  }) => void;
  compact?: boolean;
}

export function formatDiscountLabel(
  discount: DiscountType,
  customDiscountFee?: number,
  discountDuration?: DiscountDuration
): string {
  let base = 'عادي (100%)';
  if (discount === '0') base = 'معفى (0 دج)';
  else if (discount === '0.8') base = 'تخفيض 20%';
  else if (discount === 'custom' && typeof customDiscountFee === 'number') {
    base = `مبلغ مخصص: ${customDiscountFee.toLocaleString()} دج`;
  } else if (discount === 'تعويض') base = 'تعويض';

  if (discount === '1' || !discount) return base;
  if (!discountDuration) return base;

  let durText = '';
  if (discountDuration === 'only_this_id') durText = 'هذا الفوج فقط';
  else if (discountDuration === 'always') durText = 'دائماً';
  else if (typeof discountDuration === 'number') durText = `${discountDuration} دورات`;

  return durText ? `${base} • ${durText}` : base;
}

export default function DiscountEditorControl({
  discount,
  customDiscountFee,
  discountDuration,
  baseGroupPrice = 2500,
  onChange,
  compact = false
}: DiscountEditorControlProps) {
  const hasDiscount = discount === '0' || discount === '0.8' || discount === 'custom';
  const effectiveDuration: DiscountDuration = discountDuration ?? 'only_this_id';

  const handleModeChange = (mode: DiscountType) => {
    if (mode === '1') {
      onChange({ discount: '1', customDiscountFee: undefined, discountDuration: undefined });
    } else if (mode === 'custom') {
      onChange({
        discount: 'custom',
        customDiscountFee: typeof customDiscountFee === 'number' ? customDiscountFee : Math.round(baseGroupPrice * 0.5),
        discountDuration: effectiveDuration
      });
    } else {
      onChange({
        discount: mode,
        customDiscountFee: undefined,
        discountDuration: effectiveDuration
      });
    }
  };

  const handleDurationSelect = (val: string) => {
    if (val === 'only_this_id' || val === 'always') {
      onChange({ discount, customDiscountFee, discountDuration: val });
    } else {
      const n = Math.max(2, parseInt(val, 10) || 2);
      onChange({ discount, customDiscountFee, discountDuration: n });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '6px' : '8px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={discount === 'custom' ? 'custom' : discount === '0' ? '0' : discount === '0.8' ? '0.8' : '1'}
          onChange={(e) => handleModeChange(e.target.value)}
          className="m3-input"
          style={{
            flex: '1 1 150px',
            fontSize: compact ? '0.78rem' : '0.85rem',
            padding: compact ? '5px 8px' : '7px 10px',
            fontWeight: 700
          }}
        >
          <option value="1">عادي (100% — يدفع كامل الرسوم)</option>
          <option value="custom">مبلغ مخصص (تحديد المبلغ الذي يدفعه التلميذ)</option>
          <option value="0.8">تخفيض 20% (يدفع 80%)</option>
          <option value="0">معفى (0 دج — مجاني)</option>
        </select>

        {discount === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
            <input
              type="number"
              min={0}
              step={50}
              value={customDiscountFee ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                const val = raw === '' ? 0 : Math.max(0, Number(raw));
                onChange({
                  discount: 'custom',
                  customDiscountFee: val,
                  discountDuration: effectiveDuration
                });
              }}
              placeholder="المبلغ (دج)"
              className="m3-input"
              style={{
                width: '105px',
                fontWeight: 900,
                fontSize: compact ? '0.82rem' : '0.9rem',
                padding: compact ? '5px 8px' : '7px 10px',
                textAlign: 'center',
                borderColor: '#0284c7',
                color: '#0369a1'
              }}
            />
            <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>دج</span>
          </div>
        )}
      </div>

      {hasDiscount && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: compact ? '5px 8px' : '6px 10px'
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', whiteSpace: 'nowrap' }}>
            مدة التخفيض:
          </span>
          <select
            value={typeof effectiveDuration === 'number' ? String(effectiveDuration) : effectiveDuration}
            onChange={(e) => handleDurationSelect(e.target.value)}
            className="m3-input"
            style={{
              flex: '1 1 160px',
              fontSize: compact ? '0.76rem' : '0.82rem',
              padding: compact ? '4px 8px' : '5px 8px',
              fontWeight: 700
            }}
          >
            <option value="only_this_id">هذا الفوج فقط (Only this ID)</option>
            <option value="always">دائماً (Always — كل الدورات القادمة)</option>
            {[2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map((num) => (
              <option key={num} value={String(num)}>
                لمدة {num} دورات ({num} Cycles)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

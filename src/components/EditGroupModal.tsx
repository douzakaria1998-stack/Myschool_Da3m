'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Edit3, Coins, CheckCircle, AlertTriangle, Trash2, Calendar, Clock, GraduationCap } from 'lucide-react';
import { GroupMeta, EducationalLevel } from '../types';
import { formatGroupTime, getGroupStatus, isValidGroupId, getGroupLevelFromId, EDUCATIONAL_LEVELS } from '../utils/sessionUtils';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function EditGroupModal({ groupId, onClose }: Props) {
  const { data, updateGroup, deleteGroup, renameGroup } = useApp();
  const group = data.groupData[groupId];
  const groupMeta = data.groups.find((g) => g.id === groupId);

  const tier = data.pricingTiers.find((t) => t.id === (group?.type || groupMeta?.type));

  const initialFee = group?.studentFee ?? groupMeta?.studentFee ?? tier?.price ?? (group?.type?.includes('10000') ? 10000 : 2500);
  const initialTeacherPay = group?.teacherPayPerStudent ?? groupMeta?.teacherPayPerStudent ?? tier?.teacherRate ?? (group?.type?.includes('10000') ? 7500 : 1500);
  const initialSchoolShare = group?.schoolSharePerStudent ?? groupMeta?.schoolSharePerStudent ?? tier?.schoolRate ?? (initialFee - initialTeacherPay);
  const initialSessions = group?.sessionCount || groupMeta?.sessionCount || group?.sessionDates?.length || 8;

  const [level, setLevel] = useState<EducationalLevel>(() => groupMeta?.level || (group as any)?.level || getGroupLevelFromId(groupId));
  const [teacherName, setTeacherName] = useState(group?.teacherName || groupMeta?.teacherName || '');
  const [subject, setSubject] = useState(group?.subject || groupMeta?.subject || 'رياضيات');
  const [day1, setDay1] = useState(group?.day1 || groupMeta?.day1 || 'السبت');
  const [time1, setTime1] = useState(formatGroupTime(group?.time1 || groupMeta?.time1) || '08:00');
  const [day2, setDay2] = useState(group?.day2 || groupMeta?.day2 || '');
  const [time2, setTime2] = useState(formatGroupTime(group?.time2 || groupMeta?.time2) || '');
  const [type, setType] = useState(group?.type || groupMeta?.type || '4-2500');
  const [isVip, setIsVip] = useState(Boolean(group?.isVip ?? groupMeta?.isVip));
  const [sessionCount, setSessionCount] = useState<number>(initialSessions);

  // Always default to the first option: 'auto' (تلقائي حسب الحصص) as requested by user
  const [manualStatus, setManualStatus] = useState<'auto' | 'active' | 'inactive'>('auto');

  const statusInfo = groupMeta ? getGroupStatus(groupMeta, group, data.pricingTiers) : null;

  const [studentFee, setStudentFee] = useState<number>(initialFee);
  const [teacherPay, setTeacherPay] = useState<number>(initialTeacherPay);
  const [schoolShare, setSchoolShare] = useState<number>(initialSchoolShare);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [groupIdInput, setGroupIdInput] = useState(groupId);
  const [idError, setIdError] = useState('');

  const daysList = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  if (!group && !groupMeta) return null;

  const handleTierChange = (selectedTierId: string) => {
    setType(selectedTierId);
    const isVipTier = selectedTierId.includes('10000') || selectedTierId.includes('7000');
    setIsVip(isVipTier);
    const foundTier = data.pricingTiers.find((t) => t.id === selectedTierId);
    if (foundTier) {
      if (foundTier.sessions) {
        setSessionCount(foundTier.sessions);
      }
      setStudentFee(foundTier.price);
      setTeacherPay(foundTier.teacherRate);
      setSchoolShare(foundTier.schoolRate);
    }
  };

  const handleVipToggle = (checked: boolean) => {
    setIsVip(checked);
    if (checked && !type.includes('10000') && !type.includes('7000')) {
      const vipTier = data.pricingTiers.find((t) => t.id.includes('10000')) || data.pricingTiers.find((t) => t.id.includes('7000'));
      if (vipTier) {
        setType(vipTier.id);
        if (vipTier.sessions) setSessionCount(vipTier.sessions);
        setStudentFee(vipTier.price);
        setTeacherPay(vipTier.teacherRate);
        setSchoolShare(vipTier.schoolRate);
      }
    } else if (!checked && (type.includes('10000') || type.includes('7000'))) {
      const regTier = data.pricingTiers.find((t) => t.id === '4-2500') || data.pricingTiers[0];
      if (regTier) {
        setType(regTier.id);
        if (regTier.sessions) setSessionCount(regTier.sessions);
        setStudentFee(regTier.price);
        setTeacherPay(regTier.teacherRate);
        setSchoolShare(regTier.schoolRate);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanNewId = groupIdInput.trim().toUpperCase();

    if (cleanNewId !== groupId) {
      const validation = isValidGroupId(cleanNewId);
      if (!validation.isValid) {
        setIdError(validation.error || 'رمز الفوج غير صالح');
        return;
      }
      if (data.groupData[cleanNewId] || data.groups.some((g) => g.id.toUpperCase() === cleanNewId)) {
        setIdError(`رمز الفوج "${cleanNewId}" مستخدم مسبقاً!`);
        return;
      }
    }

    const selectedTeacher = data.teachers.find((t) => t.name === teacherName);

    const updatedFields: Partial<GroupMeta> = {
      level,
      teacherId: selectedTeacher?.id || groupMeta?.teacherId || '',
      teacherName: teacherName.trim() || 'أستاذ المادة',
      subject: subject.trim() || 'مادة تعليمية',
      day1,
      time1: time1.trim(),
      day2: day2.trim() || undefined,
      time2: time2.trim() || undefined,
      type,
      isVip,
      sessionCount: Number(sessionCount) || 8,
      studentFee: Number(studentFee) || 0,
      teacherPayPerStudent: Number(teacherPay) || 0,
      schoolSharePerStudent: Number(schoolShare) || 0,
      status: manualStatus === 'auto' ? undefined : manualStatus
    };

    // Apply updates to the group first
    updateGroup(groupId, updatedFields);

    // If group ID was renamed, perform rename
    if (cleanNewId !== groupId) {
      renameGroup(groupId, cleanNewId);
    }

    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleDelete = () => {
    deleteGroup(groupId);
    onClose();
  };

  const isBalanced = teacherPay + schoolShare === studentFee;

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}
      >
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
            <Edit3 size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
              تعديل بيانات الفوج: <span style={{ color: 'var(--md-sys-color-primary)' }}>{groupIdInput || groupId}</span>
            </h2>
            {isVip && <span className="m3-chip m3-chip-vip">VIP</span>}
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '34px', height: '34px', padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Group ID editing field */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              رمز الفوج (GroupID)
            </label>
            <input
              type="text"
              value={groupIdInput}
              onChange={(e) => {
                setGroupIdInput(e.target.value.toUpperCase());
                setIdError('');
              }}
              className="m3-input"
              style={{ fontWeight: 800, letterSpacing: '0.5px' }}
              placeholder={isVip ? 'مثال: BACV10' : 'مثال: BAC10'}
            />
            {idError && (
              <span style={{ color: 'var(--md-sys-color-error)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                {idError}
              </span>
            )}
          </div>

          {/* Teacher and Subject */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                الأستاذ
              </label>
              <select
                value={teacherName}
                onChange={(e) => {
                  setTeacherName(e.target.value);
                  const found = data.teachers.find((t) => t.name === e.target.value);
                  if (found && found.subject) setSubject(found.subject);
                }}
                className="m3-input"
              >
                <option value="">اختر الأستاذ</option>
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name} ({t.subject})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                المادة
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="رياضيات، فيزياء..."
                className="m3-input"
              />
            </div>
          </div>

          {/* Section to choose Educational Level (المستوى الدراسي) */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '12px 14px',
              borderRadius: 'var(--md-shape-sm)',
              border: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap size={18} color="var(--md-sys-color-primary)" />
                <label style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--md-sys-color-on-surface)' }}>
                  المستوى الدراسي (Educational Level)
                </label>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  padding: '2px 8px',
                  borderRadius: 'var(--md-shape-full)'
                }}
              >
                الطور: {EDUCATIONAL_LEVELS.find((l) => l.key === level)?.label || level} ({level})
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {EDUCATIONAL_LEVELS.map((lvl) => {
                const isSelected = level === lvl.key;
                return (
                  <button
                    key={lvl.key}
                    type="button"
                    onClick={() => {
                      setLevel(lvl.key);
                      // If the group ID starts with one of the standard prefixes, offer to update prefix smoothly
                      const match = groupIdInput.match(/^(?:BACV|SECV|BEMV|BAC|SEC|BEM)(\d+)$/i);
                      if (match) {
                        const num = match[1];
                        const newPfx = isVip ? lvl.vipPrefix : lvl.prefix;
                        setGroupIdInput(`${newPfx}${num}`);
                        setIdError('');
                      }
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '8px 6px',
                      borderRadius: 'var(--md-shape-sm)',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease-in-out',
                      textAlign: 'center',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface)',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      boxShadow: isSelected ? '0 2px 8px rgba(0, 99, 155, 0.15)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)',
                          color: isSelected ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {lvl.badge}
                      </span>
                      <span
                        style={{
                          fontSize: '0.86rem',
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'
                        }}
                      >
                        {lvl.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.67rem',
                        color: isSelected ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                        opacity: 0.9,
                        lineHeight: 1.2
                      }}
                    >
                      {lvl.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primary Schedule (Day 1 & Time 1) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                اليوم الأساسي
              </label>
              <select value={day1} onChange={(e) => setDay1(e.target.value)} className="m3-input">
                {daysList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                التوقيت الأساسي
              </label>
              <input
                type="text"
                value={time1}
                onChange={(e) => setTime1(e.target.value)}
                placeholder="08:00 أو 08:00 - 10:00"
                className="m3-input"
              />
            </div>
          </div>

          {/* Secondary Schedule (Day 2 & Time 2 - Optional) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                اليوم الثاني (اختياري)
              </label>
              <select value={day2} onChange={(e) => setDay2(e.target.value)} className="m3-input">
                <option value="">بدون يوم إضافي</option>
                {daysList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                توقيت اليوم الثاني
              </label>
              <input
                type="text"
                value={time2}
                onChange={(e) => setTime2(e.target.value)}
                placeholder="14:00 - 16:00"
                className="m3-input"
                disabled={!day2}
              />
            </div>
          </div>

          {/* Pricing tier & VIP */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                نوع التسعيرة / الاشتراك
              </label>
              <select
                value={type}
                onChange={(e) => handleTierChange(e.target.value)}
                className="m3-input"
              >
                {data.pricingTiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '24px' }}>
              <input
                type="checkbox"
                id="vipCheckEdit"
                checked={isVip}
                onChange={(e) => handleVipToggle(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="vipCheckEdit" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                فوج خاص VIP
              </label>
            </div>
          </div>

          {/* Dynamic Session Count */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '12px',
              borderRadius: 'var(--md-shape-sm)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                عدد حصص الفوج (ديناميكي)
              </label>
              <span
                style={{
                  fontSize: '0.8rem',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  padding: '2px 8px',
                  borderRadius: 'var(--md-shape-sm)',
                  fontWeight: 700
                }}
              >
                {sessionCount} حصص
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              {[4, 6, 8, 10, 12, 16].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setSessionCount(cnt)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--md-shape-full)',
                    border: sessionCount === cnt ? '2px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: sessionCount === cnt ? 'var(--md-sys-color-primary)' : 'transparent',
                    color: sessionCount === cnt ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    cursor: 'pointer'
                  }}
                >
                  {cnt} حصص
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>أو أدخل رقماً مخصصاً:</span>
              <input
                type="number"
                min={1}
                max={30}
                value={sessionCount}
                onChange={(e) => setSessionCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                className="m3-input"
                style={{ padding: '6px 10px', fontSize: '0.85rem', width: '90px' }}
              />
            </div>
          </div>

          {/* Group Status (Active / Inactive) */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '12px 14px',
              borderRadius: 'var(--md-shape-sm)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)' }}>
                حالة الفوج (نشط / غير نشط)
              </label>
              {statusInfo && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 'var(--md-shape-full)',
                    backgroundColor: statusInfo.status === 'active' ? '#ecfdf5' : '#f3f4f6',
                    color: statusInfo.status === 'active' ? '#047857' : '#4b5563',
                    border: `1px solid ${statusInfo.status === 'active' ? '#a7f3d0' : '#d1d5db'}`
                  }}
                >
                  {statusInfo.status === 'active'
                    ? `نشط (${statusInfo.currentSession}/${statusInfo.totalSessions})`
                    : `غير نشط • مكتمل (${statusInfo.currentSession}/${statusInfo.totalSessions})`}
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)', margin: 0, lineHeight: 1.4 }}>
              تلقائياً: يُصبح الفوج <strong>غير نشط</strong> عند بلوغ الحصة الأخيرة ({statusInfo?.totalSessions || sessionCount}/{statusInfo?.totalSessions || sessionCount}) ويُخفى تلقائياً من نافذة تسجيل التلاميذ الجدد.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              {[
                { id: 'auto', label: 'تلقائي (حسب الحصص)' },
                { id: 'active', label: 'نشط دائماً' },
                { id: 'inactive', label: 'غير نشط دائماً' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setManualStatus(opt.id as 'auto' | 'active' | 'inactive')}
                  style={{
                    flex: 1,
                    padding: '6px 8px',
                    borderRadius: 'var(--md-shape-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: manualStatus === opt.id ? '2px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: manualStatus === opt.id ? 'var(--md-sys-color-primary-container)' : 'transparent',
                    color: manualStatus === opt.id ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                    cursor: 'pointer'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Financial Breakdown Section */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '14px',
              borderRadius: 'var(--md-shape-sm)',
              border: '1px solid var(--md-sys-color-outline-variant)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Coins size={18} color="var(--md-sys-color-primary)" />
                <label style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--md-sys-color-on-surface)' }}>
                  المستحقات المالية لكل تلميذ (دج)
                </label>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  padding: '2px 8px',
                  borderRadius: 'var(--md-shape-sm)'
                }}
              >
                تلقائي ومخصص
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              {/* 1. Payment amount for each student */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface)',
                  padding: '10px',
                  borderRadius: 'var(--md-shape-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.76rem',
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
                  المجموع من التلميذ
                </span>
              </div>

              {/* 2. Teacher payment for each student */}
              <div
                style={{
                  backgroundColor: 'var(--md-sys-color-surface)',
                  padding: '10px',
                  borderRadius: 'var(--md-shape-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.76rem',
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
                  backgroundColor: 'var(--md-sys-color-surface)',
                  padding: '10px',
                  borderRadius: 'var(--md-shape-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)'
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontWeight: 700,
                    fontSize: '0.76rem',
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
                  عائد المؤسسة
                </span>
              </div>
            </div>

            {/* Formula breakdown and balance check */}
            <div
              style={{
                marginTop: '10px',
                padding: '6px 10px',
                borderRadius: 'var(--md-shape-sm)',
                backgroundColor: isBalanced ? 'var(--md-sys-color-surface-container)' : 'var(--status-absent-container)',
                fontSize: '0.78rem'
              }}
            >
              {isBalanced ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--md-sys-color-on-surface)' }}>
                  <CheckCircle size={15} color="var(--status-present)" />
                  <span style={{ color: 'var(--status-present)', fontWeight: 800 }}>✓ متوازن:</span>
                  <span>
                    الأستاذ (<strong>{teacherPay.toLocaleString()} دج</strong>{studentFee > 0 ? ` • ${((teacherPay / studentFee) * 100).toFixed(0)}%` : ''})
                    {' + '}
                    المدرسة (<strong>{schoolShare.toLocaleString()} دج</strong>{studentFee > 0 ? ` • ${((schoolShare / studentFee) * 100).toFixed(0)}%` : ''})
                    {' = '}
                    الإجمالي (<strong>{studentFee.toLocaleString()} دج</strong>)
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
              تم حفظ وتحديث بيانات الفوج بالكامل بنجاح!
            </div>
          )}

          {/* Delete Confirmation or Actions */}
          {isConfirmingDelete ? (
            <div
              style={{
                backgroundColor: 'var(--status-absent-container)',
                padding: '12px',
                borderRadius: 'var(--md-shape-sm)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--status-absent)' }}>
                هل أنت متأكد من حذف هذا الفوج وجميع بياناته؟
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="m3-btn-text"
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="m3-btn"
                  style={{
                    backgroundColor: 'var(--md-sys-color-error)',
                    color: '#ffffff',
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}
                >
                  نعم، حذف
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="m3-btn-text"
                style={{
                  color: 'var(--md-sys-color-error)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem'
                }}
              >
                <Trash2 size={16} />
                <span>حذف الفوج</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={onClose} className="m3-btn m3-btn-text">
                  إلغاء
                </button>
                <button type="submit" className="m3-btn m3-btn-primary">
                  حفظ التعديلات
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

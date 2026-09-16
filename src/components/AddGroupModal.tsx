'use client';

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, FolderPlus, Coins, Sparkles, Calendar } from 'lucide-react';
import { GroupMeta } from '../types';
import { getNextGroupId, isValidGroupId, getSuggestedGroupIds, getUpcomingSessionDate, formatToYYYYMMDD } from '../utils/sessionUtils';

interface Props {
  onClose: () => void;
}

export default function AddGroupModal({ onClose }: Props) {
  const { addGroup, data } = useApp();

  const [isVip, setIsVip] = useState(false);
  const [groupId, setGroupId] = useState(() => getNextGroupId(false, data.groups));
  const [teacherName, setTeacherName] = useState('');
  const [subject, setSubject] = useState('رياضيات');
  const [day1, setDay1] = useState('السبت');
  const [time1, setTime1] = useState('08:00');
  const [day2, setDay2] = useState('');
  const [time2, setTime2] = useState('');
  const [startDate, setStartDate] = useState<string>(() => {
    return formatToYYYYMMDD(getUpcomingSessionDate('السبت', new Date(), false));
  });
  const [type, setType] = useState('4-2500');
  const [sessionCount, setSessionCount] = useState<number>(8);
  const [studentFee, setStudentFee] = useState<number>(2500);
  const [teacherPay, setTeacherPay] = useState<number>(1500);
  const [schoolShare, setSchoolShare] = useState<number>(1000);
  const [error, setError] = useState('');

  const daysList = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  const handleDay1Change = (newDay: string) => {
    setDay1(newDay);
    setStartDate(formatToYYYYMMDD(getUpcomingSessionDate(newDay, new Date(), false)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = groupId.trim().toUpperCase();
    if (!cleanId) {
      setError(isVip ? 'يرجى كتابة رمز الفوج الخاص (مثال: BACV05)' : 'يرجى كتابة رمز الفوج (مثال: BAC10)');
      return;
    }

    const validation = isValidGroupId(cleanId);
    if (!validation.isValid) {
      setError(validation.error || 'رمز الفوج غير صالح');
      return;
    }

    if (data.groupData[cleanId] || data.groups.some((g) => g.id.toUpperCase() === cleanId)) {
      setError(`رمز الفوج "${cleanId}" مستخدم مسبقاً! يرجى اختيار رمز آخر.`);
      return;
    }

    const selectedTeacher = data.teachers.find((t) => t.name === teacherName);

    const newGroup: GroupMeta = {
      id: groupId.trim().toUpperCase(),
      teacherId: selectedTeacher?.id || '',
      teacherName: teacherName || selectedTeacher?.name || 'أستاذ المادة',
      subject,
      day1,
      time1,
      day2: day2 || undefined,
      time2: time2 || undefined,
      type,
      isVip,
      customStart: startDate,
      sessionCount: Number(sessionCount) || 8,
      studentFee: Number(studentFee) || 0,
      teacherPayPerStudent: Number(teacherPay) || 0,
      schoolSharePerStudent: Number(schoolShare) || 0
    };

    addGroup(newGroup);
    onClose();
  };

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div className="m3-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
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
            <FolderPlus size={20} color="var(--md-sys-color-primary)" />
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              إنشاء فوج دراسي جديد
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              رمز الفوج (GroupID) <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder={isVip ? 'مثال: BACV05' : 'مثال: BAC10'}
              className="m3-input"
              style={{ fontWeight: 800, letterSpacing: '0.5px' }}
              autoFocus
            />
            {/* Ascending ID Suggestions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.73rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Sparkles size={12} color="var(--md-sys-color-primary)" />
                اقتراحات تصاعدية:
              </span>
              {getSuggestedGroupIds(isVip, data.groups, 3).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => {
                    setGroupId(sug);
                    setError('');
                  }}
                  className="m3-chip"
                  style={{
                    padding: '2px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: groupId.toUpperCase() === sug ? '1px solid var(--md-sys-color-primary)' : '1px dashed var(--md-sys-color-outline)',
                    backgroundColor: groupId.toUpperCase() === sug ? 'var(--md-sys-color-primary-container)' : 'transparent',
                    color: groupId.toUpperCase() === sug ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  {sug}
                </button>
              ))}
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginTop: '4px' }}>
              {isVip
                ? 'رمز الفوج الخاص يبدأ دائماً بـ BACV متبوعاً بأرقام تصاعدية (مثل BACV01, BACV02...)'
                : 'رمز الفوج العادي يبدأ دائماً بـ BAC متبوعاً بأرقام تصاعدية (مثل BAC01, BAC02, BAC10...)'}
            </span>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                اليوم الأساسي
              </label>
              <select value={day1} onChange={(e) => handleDay1Change(e.target.value)} className="m3-input">
                {daysList.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                التوقيت
              </label>
              <input
                type="text"
                value={time1}
                onChange={(e) => setTime1(e.target.value)}
                placeholder="08:00 - 10:00"
                className="m3-input"
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                <Calendar size={13} color="var(--md-sys-color-primary)" />
                <span>تاريخ الحصة 1</span>
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="YYYY/MM/DD"
                className="m3-input"
                style={{ textAlign: 'center', fontWeight: 700 }}
                title="تاريخ انطلاق الحصة الأولى للفوج (افتراضياً: أقرب موعد قادم)"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                نوع التسعيرة / الاشتراك
              </label>
              <select
                value={type}
                onChange={(e) => {
                  const val = e.target.value;
                  setType(val);
                  const isVipTier = val.includes('10000') || val.includes('7000');
                  setIsVip(isVipTier);
                  const tier = data.pricingTiers.find((t) => t.id === val);
                  if (tier) {
                    if (tier.sessions) {
                      setSessionCount(tier.sessions);
                    }
                    setStudentFee(tier.price);
                    setTeacherPay(tier.teacherRate);
                    setSchoolShare(tier.schoolRate);
                  }
                }}
                className="m3-input"
              >
                {data.pricingTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '24px' }}>
              <input
                type="checkbox"
                id="vipCheck"
                checked={isVip}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsVip(checked);
                  // Automatically switch the proposed Group ID to the next ascending ID for this type
                  setGroupId(getNextGroupId(checked, data.groups));
                  setError('');
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
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="vipCheck" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                فوج خاص VIP
              </label>
            </div>
          </div>

          {/* New Financial Section: مبلغ الاشتراك وحصة الأستاذ والباقي للمدرسة لكل تلميذ */}
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
                  مبلغ اشتراك التلميذ *
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={studentFee}
                  onChange={(e) => {
                    const newFee = Math.max(0, Number(e.target.value) || 0);
                    setStudentFee(newFee);
                    setSchoolShare(Math.max(0, newFee - teacherPay));
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
                  حصة الأستاذ من التلميذ *
                </label>
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={teacherPay}
                  onChange={(e) => {
                    const newTeacher = Math.max(0, Number(e.target.value) || 0);
                    setTeacherPay(newTeacher);
                    setSchoolShare(Math.max(0, studentFee - newTeacher));
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

              {/* 3. Rest of amount for the school */}
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
                    const newSchool = Math.max(0, Number(e.target.value) || 0);
                    setSchoolShare(newSchool);
                    setTeacherPay(Math.max(0, studentFee - newSchool));
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
                  فائدة المؤسسة
                </span>
              </div>
            </div>

            {/* Formula & Live Balance Indicator */}
            <div
              style={{
                marginTop: '10px',
                padding: '6px 10px',
                borderRadius: 'var(--md-shape-sm)',
                backgroundColor:
                  teacherPay + schoolShare === studentFee
                    ? 'var(--md-sys-color-surface-container)'
                    : 'var(--status-absent-container)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '0.78rem'
              }}
            >
              {teacherPay + schoolShare === studentFee ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--md-sys-color-on-surface)' }}>
                  <span style={{ color: 'var(--status-present)', fontWeight: 800 }}>✓ توزيع متوازن:</span>
                  <span>
                    الأستاذ (<strong>{teacherPay.toLocaleString()} دج</strong>{studentFee > 0 ? ` • ${((teacherPay / studentFee) * 100).toFixed(0)}%` : ''})
                    {' + '}
                    المدرسة (<strong>{schoolShare.toLocaleString()} دج</strong>{studentFee > 0 ? ` • ${((schoolShare / studentFee) * 100).toFixed(0)}%` : ''})
                    {' = '}
                    الإجمالي (<strong>{studentFee.toLocaleString()} دج</strong>)
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '6px' }}>
                  <span style={{ color: 'var(--status-absent)', fontWeight: 700 }}>
                    ⚠️ غير متوازن: ({teacherPay} + {schoolShare} = {teacherPay + schoolShare} دج ≠ {studentFee} دج)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSchoolShare(Math.max(0, studentFee - teacherPay))}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: 'var(--md-shape-sm)',
                      backgroundColor: 'var(--status-absent)',
                      color: '#ffffff',
                      border: 'none',
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

          {/* Dynamic Session Count Configuration */}
          <div style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)', padding: '12px', borderRadius: 'var(--md-shape-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                عدد حصص الفوج (ديناميكي) <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
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

            {/* Quick Presets */}
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
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {cnt} حصص
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', whiteSpace: 'nowrap' }}>أو أدخل رقماً مخصصاً:</span>
              <input
                type="number"
                min={1}
                max={30}
                value={sessionCount}
                onChange={(e) => setSessionCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                placeholder="عدد الحصص"
                className="m3-input"
                style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100px' }}
              />
            </div>
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
              إنشاء الفوج
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

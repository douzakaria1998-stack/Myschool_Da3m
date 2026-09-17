'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  UserPlus,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Phone,
  UserCheck,
  Printer,
  IdCard
} from 'lucide-react';
import { DiscountType, StudentRecord } from '../types';
import { isSummaryRow } from '../utils/sessionUtils';
import StudentBadgeModal from './StudentBadgeModal';
import { normalizeScannedBarcode } from '../utils/barcodeUtils';

interface Props {
  groupId: string;
  onClose: () => void;
}

export default function AddStudentModal({ groupId, onClose }: Props) {
  const { addStudent, data } = useApp();
  const group = data.groupData[groupId];

  // Mode: 'new' = New student, 'existing' = Old student already in student list
  const [studentType, setStudentType] = useState<'new' | 'existing'>('new');

  // New Student fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Existing Student fields
  const [existingSearch, setExistingSearch] = useState('');
  const [selectedExistingStudent, setSelectedExistingStudent] = useState<{
    name: string;
    phone: string;
    groups: string[];
    alreadyInCurrentGroup: boolean;
  } | null>(null);

  // Discount & Status
  const [discount, setDiscount] = useState<DiscountType>('1');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [duplicateWarningStudent, setDuplicateWarningStudent] = useState<{
    name: string;
    phone: string;
    groups: string[];
  } | null>(null);
  const [lastSavedStudent, setLastSavedStudent] = useState<StudentRecord | null>(null);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique existing students across all groups in the center
  const existingStudents = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; barcode?: string; groups: string[]; alreadyInCurrentGroup: boolean }
    >();

    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      gSheet.students.forEach((s) => {
        if (isSummaryRow(s, gid) || !s.name || !s.name.trim()) return;
        const cleanName = s.name.trim();
        const phone = s.phone ? s.phone.trim() : '';
        const barcode = s.barcode ? s.barcode.trim() : '';
        const key = cleanName.toLowerCase();

        if (!map.has(key)) {
          map.set(key, {
            name: cleanName,
            phone,
            barcode,
            groups: [gid],
            alreadyInCurrentGroup: gid === groupId
          });
        } else {
          const item = map.get(key)!;
          if (phone && !item.phone) item.phone = phone;
          if (barcode && !item.barcode) item.barcode = barcode;
          if (!item.groups.includes(gid)) item.groups.push(gid);
          if (gid === groupId) item.alreadyInCurrentGroup = true;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [data.groupData, groupId]);

  // Filter existing students by search term
  const filteredExisting = useMemo(() => {
    const rawQ = existingSearch.trim();
    if (!rawQ) {
      // Return first 10 students not already in this group
      return existingStudents.slice(0, 10);
    }
    const q = rawQ.toLowerCase();
    const normalizedScan = normalizeScannedBarcode(rawQ).toLowerCase();
    return existingStudents
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          (s.barcode && (s.barcode.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(normalizedScan))) ||
          s.groups.some((g) => g.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [existingStudents, existingSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (studentType === 'new') {
      const cleanName = name.trim();
      if (!cleanName) {
        setError('يرجى إدخال اسم ولقب التلميذ');
        nameInputRef.current?.focus();
        return;
      }

      // 1. Name Duplication Check: Check against database / all center students
      const existingMatch = existingStudents.find(
        (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (existingMatch) {
        setDuplicateWarningStudent({
          name: existingMatch.name,
          phone: existingMatch.phone,
          groups: existingMatch.groups
        });
        setError(
          `تنبيه تكرار الاسم: يوجد تلميذ مسجل سابقاً بنفس الاسم "${existingMatch.name}". يرجى إضافة تمييز للاسم (مثال: "${existingMatch.name} 2" أو تحديد الحي/الفرع) لتفادي الخلط في البطاقات والحضور.`
        );
        return;
      }

      const created = addStudent(groupId, {
        name: cleanName,
        phone: phone.trim(),
        discount
      });

      if (created) {
        setLastSavedStudent(created);
        setIsBadgeModalOpen(true);
      } else {
        onClose();
      }
    } else {
      if (!selectedExistingStudent) {
        setError('يرجى اختيار تلميذ مسجل سابقاً من القائمة');
        searchInputRef.current?.focus();
        return;
      }

      if (selectedExistingStudent.alreadyInCurrentGroup) {
        setError(`التلميذ "${selectedExistingStudent.name}" مسجل بالفعل في فوج ${groupId}!`);
        return;
      }

      const created = addStudent(groupId, {
        name: selectedExistingStudent.name,
        phone: selectedExistingStudent.phone,
        discount
      });

      if (created) {
        setLastSavedStudent(created);
        setIsBadgeModalOpen(true);
      } else {
        onClose();
      }
    }
  };

  const handleSaveAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();

    if (studentType === 'new') {
      const cleanName = name.trim();
      if (!cleanName) {
        setError('يرجى إدخال اسم ولقب التلميذ');
        nameInputRef.current?.focus();
        return;
      }

      // 1. Name Duplication Check: Check against database
      const existingMatch = existingStudents.find(
        (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (existingMatch) {
        setDuplicateWarningStudent({
          name: existingMatch.name,
          phone: existingMatch.phone,
          groups: existingMatch.groups
        });
        setError(
          `تنبيه تكرار الاسم: يوجد تلميذ مسجل سابقاً بنفس الاسم "${existingMatch.name}". يرجى إضافة تمييز للاسم (مثال: "${existingMatch.name} 2" أو تحديد الحي/الفرع).`
        );
        return;
      }

      const created = addStudent(groupId, {
        name: cleanName,
        phone: phone.trim(),
        discount
      });

      setLastSavedStudent(created);
      setName('');
      setPhone('');
      setDuplicateWarningStudent(null);
      setError('');
      setSuccessMsg(
        `تمت إضافة "${cleanName}" بنجاح! تم توليد الباركود (${created?.barcode || 'STU'}). يمكنك طباعة الشارة أو إدخال التلميذ التالي.`
      );

      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    } else {
      if (!selectedExistingStudent) {
        setError('يرجى اختيار تلميذ مسجل سابقاً من القائمة');
        searchInputRef.current?.focus();
        return;
      }

      if (selectedExistingStudent.alreadyInCurrentGroup) {
        setError(`التلميذ "${selectedExistingStudent.name}" مسجل بالفعل في فوج ${groupId}!`);
        return;
      }

      const savedName = selectedExistingStudent.name;
      const created = addStudent(groupId, {
        name: savedName,
        phone: selectedExistingStudent.phone,
        discount
      });

      setLastSavedStudent(created);
      setSelectedExistingStudent(null);
      setExistingSearch('');
      setError('');
      setSuccessMsg(`تمت إضافة "${savedName}" إلى الفوج بنجاح! يمكنك اختيار التلميذ التالي.`);

      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }

    // Auto dismiss success message
    setTimeout(() => {
      setSuccessMsg('');
    }, 6000);
  };

  return (
    <div className="m3-dialog-backdrop" onClick={onClose}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '100%', padding: '24px' }}
      >
        {/* Header */}
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
            {studentType === 'new' ? (
              <UserPlus size={22} color="var(--md-sys-color-primary)" />
            ) : (
              <Users size={22} color="var(--md-sys-color-primary)" />
            )}
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              تسجيل تلميذ في فوج {groupId}
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

        {/* 2 Types Toggle: New Student vs Old / Existing Student */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            padding: '4px',
            borderRadius: 'var(--md-shape-full)',
            gap: '6px',
            marginBottom: '18px'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setStudentType('new');
              setSelectedExistingStudent(null);
              setError('');
            }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 'var(--md-shape-full)',
              border: 'none',
              backgroundColor: studentType === 'new' ? 'var(--md-sys-color-primary)' : 'transparent',
              color: studentType === 'new' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <UserPlus size={16} />
            <span>تلميذ جديد (أول مرة)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStudentType('existing');
              setError('');
            }}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 'var(--md-shape-full)',
              border: 'none',
              backgroundColor: studentType === 'existing' ? 'var(--md-sys-color-primary)' : 'transparent',
              color: studentType === 'existing' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
              fontWeight: 700,
              fontSize: '0.84rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={16} />
            <span>تلميذ مسجل سابقاً ({existingStudents.length})</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TYPE 1: NEW STUDENT FORM */}
          {studentType === 'new' ? (
            <>
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
            </>
          ) : (
            /* TYPE 2: OLD / EXISTING STUDENT SELECTION */
            <>
              {!selectedExistingStudent ? (
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
                    اختر التلميذ من قائمة المسجلين بالمؤسسة <span style={{ color: 'var(--md-sys-color-error)' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', marginBottom: '8px' }}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={existingSearch}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => {
                        const cleanVal = normalizeScannedBarcode(e.target.value);
                        setExistingSearch(cleanVal);
                        setError('');
                        if (/^(?:STU[-_]?\d+|(?:BAC|BACV)[-_]?\d+[-_]?\d*)$/i.test(cleanVal)) {
                          setTimeout(() => {
                            searchInputRef.current?.select();
                          }, 50);
                        }
                      }}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text');
                        const cleanVal = normalizeScannedBarcode(pasted);
                        if (cleanVal !== pasted) {
                          e.preventDefault();
                          setExistingSearch(cleanVal);
                          setError('');
                          setTimeout(() => {
                            searchInputRef.current?.select();
                          }, 50);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).select();
                        }
                      }}
                      placeholder="ابحث بالاسم، المعرّف (ID / Barcode) أو الهاتف..."
                      className="m3-input"
                      style={{
                        paddingInlineStart: '36px',
                        paddingInlineEnd: existingSearch ? '32px' : '10px',
                        direction: /^[a-zA-Z0-9\-_]/.test(existingSearch) ? 'ltr' : 'rtl',
                        textAlign: /^[a-zA-Z0-9\-_]/.test(existingSearch) ? 'left' : 'right'
                      }}
                      autoFocus
                    />
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        insetInlineStart: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--md-sys-color-outline)',
                        pointerEvents: 'none'
                      }}
                    />
                    {existingSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setExistingSearch('');
                          setError('');
                          searchInputRef.current?.focus();
                        }}
                        style={{
                          position: 'absolute',
                          insetInlineEnd: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--md-sys-color-on-surface-variant)',
                          borderRadius: '50%'
                        }}
                        title="مسح البحث"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Results list */}
                  <div
                    style={{
                      maxHeight: '185px',
                      overflowY: 'auto',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: 'var(--md-shape-md)',
                      backgroundColor: 'var(--md-sys-color-surface-container-lowest)'
                    }}
                  >
                    {filteredExisting.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--md-sys-color-outline)', fontSize: '0.85rem' }}>
                        لا يوجد تلميذ مطابق للبحث.
                      </div>
                    ) : (
                      filteredExisting.map((item) => (
                        <div
                          key={item.name}
                          onClick={() => {
                            setSelectedExistingStudent(item);
                            setError('');
                          }}
                          style={{
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease',
                            backgroundColor: item.alreadyInCurrentGroup ? 'rgba(0,0,0,0.02)' : 'transparent',
                            opacity: item.alreadyInCurrentGroup ? 0.75 : 1
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--md-sys-color-surface-container)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = item.alreadyInCurrentGroup ? 'rgba(0,0,0,0.02)' : 'transparent';
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--md-sys-color-on-surface)' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                              {item.phone || 'بدون هاتف'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            {item.alreadyInCurrentGroup ? (
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  backgroundColor: '#fee2e2',
                                  color: '#b91c1c',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--md-shape-sm)'
                                }}
                              >
                                مسجل بالفعل بهذا الفوج
                              </span>
                            ) : (
                              item.groups.map((gid) => (
                                <span
                                  key={gid}
                                  style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    backgroundColor: 'var(--md-sys-color-surface-container-high)',
                                    color: 'var(--md-sys-color-primary)',
                                    padding: '1px 6px',
                                    borderRadius: 'var(--md-shape-sm)'
                                  }}
                                >
                                  {gid}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                /* Selected Student Card */
                <div
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    border: '1px solid var(--md-sys-color-primary)',
                    padding: '12px 16px',
                    borderRadius: 'var(--md-shape-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--md-sys-color-primary)',
                        color: 'var(--md-sys-color-on-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--md-sys-color-on-primary-container)' }}>
                        {selectedExistingStudent.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-primary-container)', opacity: 0.9 }}>
                        {selectedExistingStudent.phone || 'بدون هاتف'} • مسجل في:{' '}
                        {selectedExistingStudent.groups.join(', ')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedExistingStudent(null)}
                    className="m3-btn m3-btn-outlined m3-btn-sm"
                    style={{
                      fontSize: '0.75rem',
                      padding: '4px 8px',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      borderColor: 'var(--md-sys-color-primary)'
                    }}
                  >
                    تغيير التلميذ
                  </button>
                </div>
              )}
            </>
          )}

          {/* Discount / Pricing Tier Selection */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px' }}>
              نوع التسجيل / التخفيض في الفوج
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

          {/* Error Banner */}
          {error && (
            <div
              style={{
                color: 'var(--md-sys-color-error)',
                backgroundColor: 'var(--md-sys-color-error-container)',
                padding: '8px 12px',
                borderRadius: 'var(--md-shape-sm)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
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

          {/* Duplicate Name Warning Box */}
          {duplicateWarningStudent && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                border: '1.5px solid #ef4444',
                borderRadius: '10px',
                color: '#991b1b',
                fontSize: '0.86rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span>تنبيه: التلميذ &quot;{duplicateWarningStudent.name}&quot; مسجل مسبقاً!</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f1d1d' }}>
                يوجد تلميذ مسجل في المؤسسة بهذا الاسم في الفوج ({duplicateWarningStudent.groups.join(', ')}).
                يرجى إضافة تمييز للاسم مثل: &quot;{duplicateWarningStudent.name} 2&quot; أو تحديد الحي/الفرع.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setName(`${name.trim()} 2`);
                    setDuplicateWarningStudent(null);
                    setError('');
                    nameInputRef.current?.focus();
                  }}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  إضافة رقم (2) للاسم تلقائياً ✏️
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentType('existing');
                    const found = existingStudents.find((s) => s.name === duplicateWarningStudent.name);
                    if (found) setSelectedExistingStudent(found);
                    setDuplicateWarningStudent(null);
                    setError('');
                  }}
                  style={{
                    padding: '5px 12px',
                    backgroundColor: '#ffffff',
                    color: '#b91c1c',
                    borderRadius: '6px',
                    border: '1px solid #ef4444',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  اختياره كتلميذ مسجل سابقاً 👥
                </button>
              </div>
            </div>
          )}

          {/* Last Saved Student with Immediate Badge Print Button */}
          {lastSavedStudent && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(79, 70, 229, 0.08)',
                border: '1.5px solid #4f46e5',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}
            >
              <div>
                <div style={{ fontWeight: 800, color: '#4f46e5', fontSize: '0.9rem' }}>
                  تم حفظ التلميذ بنجاح! 🪪
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  الاسم: <strong>{lastSavedStudent.name}</strong> | الباركود: <strong style={{ fontFamily: 'monospace' }}>{lastSavedStudent.barcode}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBadgeModalOpen(true)}
                className="m3-btn m3-btn-primary m3-btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 800,
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                }}
              >
                <Printer size={15} />
                <span>طباعة الشارة (PVC Badge) 🖨️</span>
              </button>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
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
              حفظ وطباعة الشارة
            </button>
          </div>
        </form>
      </div>

      {/* PVC Card Badge Modal */}
      {isBadgeModalOpen && lastSavedStudent && (
        <StudentBadgeModal
          student={lastSavedStudent}
          groupId={groupId}
          onClose={() => {
            setIsBadgeModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

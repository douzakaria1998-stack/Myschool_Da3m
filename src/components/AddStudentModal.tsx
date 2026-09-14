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
  UserCheck
} from 'lucide-react';
import { DiscountType } from '../types';
import { isSummaryRow } from '../utils/sessionUtils';

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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Extract all unique existing students across all groups in the center
  const existingStudents = useMemo(() => {
    const map = new Map<
      string,
      { name: string; phone: string; groups: string[]; alreadyInCurrentGroup: boolean }
    >();

    Object.entries(data.groupData).forEach(([gid, gSheet]) => {
      gSheet.students.forEach((s) => {
        if (isSummaryRow(s, gid) || !s.name || !s.name.trim()) return;
        const cleanName = s.name.trim();
        const phone = s.phone ? s.phone.trim() : '';
        const key = cleanName.toLowerCase();

        if (!map.has(key)) {
          map.set(key, {
            name: cleanName,
            phone,
            groups: [gid],
            alreadyInCurrentGroup: gid === groupId
          });
        } else {
          const item = map.get(key)!;
          if (phone && !item.phone) item.phone = phone;
          if (!item.groups.includes(gid)) item.groups.push(gid);
          if (gid === groupId) item.alreadyInCurrentGroup = true;
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [data.groupData, groupId]);

  // Filter existing students by search term
  const filteredExisting = useMemo(() => {
    const q = existingSearch.trim().toLowerCase();
    if (!q) {
      // Return first 10 students not already in this group
      return existingStudents.slice(0, 10);
    }
    return existingStudents
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.phone.includes(q) ||
          s.groups.some((g) => g.toLowerCase().includes(q))
      )
      .slice(0, 15);
  }, [existingStudents, existingSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (studentType === 'new') {
      if (!name.trim()) {
        setError('يرجى إدخال اسم ولقب التلميذ');
        nameInputRef.current?.focus();
        return;
      }

      addStudent(groupId, {
        name: name.trim(),
        phone: phone.trim(),
        discount
      });
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

      addStudent(groupId, {
        name: selectedExistingStudent.name,
        phone: selectedExistingStudent.phone,
        discount
      });
    }

    onClose();
  };

  const handleSaveAndAddAnother = (e: React.MouseEvent) => {
    e.preventDefault();

    if (studentType === 'new') {
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

      setName('');
      setPhone('');
      setError('');
      setSuccessMsg(`تمت إضافة "${savedName}" بنجاح! يمكنك إدخال التلميذ التالي الآن.`);

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
      addStudent(groupId, {
        name: savedName,
        phone: selectedExistingStudent.phone,
        discount
      });

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
    }, 4000);
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
                      onChange={(e) => {
                        setExistingSearch(e.target.value);
                        setError('');
                      }}
                      placeholder="ابحث بالاسم، الهاتف أو الفوج السابق..."
                      className="m3-input"
                      style={{ paddingInlineStart: '36px' }}
                      autoFocus
                    />
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        insetInlineStart: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--md-sys-color-outline)'
                      }}
                    />
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
              إضافة التلميذ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

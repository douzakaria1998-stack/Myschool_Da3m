'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { StudentRecord } from '../types';
import { isSummaryRow, isVipGroupId, isValidGroupId, getNextGroupId, getSuggestedGroupIds } from '../utils/sessionUtils';
import { X, RotateCw, Check, Users, Search, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  sourceGroupId: string;
  onClose: () => void;
  onCreated?: (newGroupId: string) => void;
}

export default function RenewGroupModal({ sourceGroupId, onClose, onCreated }: Props) {
  const { data, renewGroupWithStudents } = useApp();
  const sourceGroup = data.groupData[sourceGroupId];
  const sourceMeta = data.groups.find((g) => g.id === sourceGroupId);

  const isVip = sourceMeta?.isVip ?? sourceGroup?.isVip ?? isVipGroupId(sourceGroupId);

  // Filter genuine students from source group
  const realStudents = useMemo(() => {
    return (sourceGroup?.students || []).filter((s) => !isSummaryRow(s, sourceGroupId));
  }, [sourceGroup?.students, sourceGroupId]);

  // Check if student attended session 1 (Priority rule from user)
  const hasAttendedSession1 = (s: StudentRecord): boolean => {
    if (!s.attendance || s.attendance.length === 0) return false;
    const a0 = s.attendance[0];
    if (typeof a0 !== 'string') return false;
    const clean = a0.trim().toUpperCase();
    return clean === 'P' || clean === 'M' || clean === 'ح' || clean === 'م';
  };

  const session1Attendees = useMemo(() => {
    return realStudents.filter(hasAttendedSession1);
  }, [realStudents]);

  // Generate smart ascending sequential ID suggestions (e.g. BAC10, BAC11 or BACV05, BACV10)
  const suggestions = useMemo(() => {
    return getSuggestedGroupIds(isVip, data.groups, 3);
  }, [isVip, data.groups]);

  // New Group ID state - defaults to the next available ascending ID
  const [newGroupId, setNewGroupId] = useState<string>(() => getNextGroupId(isVip, data.groups));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'session1' | 'all' | 'custom'>('session1');

  // Selected students state - BY DEFAULT: strictly students who attended the first session
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    realStudents.forEach((s) => {
      if (hasAttendedSession1(s)) {
        ids.add(s.rowId);
      }
    });
    return ids;
  });

  if (!sourceGroup) return null;

  // Validation
  const trimmedNewId = newGroupId.trim().toUpperCase();
  const isIdEmpty = trimmedNewId.length === 0;
  const isIdDuplicate = data.groups.some((g) => g.id.toUpperCase() === trimmedNewId);
  const formatValidation = isValidGroupId(trimmedNewId);
  const isValid = !isIdEmpty && !isIdDuplicate && formatValidation.isValid && selectedRowIds.size > 0;

  // Toggle student selection
  const handleToggleStudent = (rowId: number) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
    setFilterMode('custom');
  };

  const handleSelectSession1Only = () => {
    const ids = new Set<number>();
    session1Attendees.forEach((s) => ids.add(s.rowId));
    setSelectedRowIds(ids);
    setFilterMode('session1');
  };

  const handleSelectAll = () => {
    const ids = new Set<number>(realStudents.map((s) => s.rowId));
    setSelectedRowIds(ids);
    setFilterMode('all');
  };

  const handleDeselectAll = () => {
    setSelectedRowIds(new Set());
    setFilterMode('custom');
  };

  // Filter students displayed in table
  const displayedStudents = realStudents.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.phone && s.phone.includes(searchQuery));
    return matchesSearch;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    renewGroupWithStudents(sourceGroupId, trimmedNewId, Array.from(selectedRowIds));
    if (onCreated) {
      onCreated(trimmedNewId);
    }
    onClose();
  };

  const sessionCount = sourceGroup.sessionCount || sourceGroup.sessionDates?.length || 4;

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ padding: '12px' }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '780px',
          width: '95%',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '14px 16px',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '8px',
            marginBottom: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCw size={16} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                فتح دورة جديدة للفوج: <span style={{ color: 'var(--md-sys-color-primary)' }}>{sourceGroupId}</span>
              </h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)', margin: '1px 0 0 0' }}>
                إنشاء معرّف جديد ونقل التلاميذ الذين حضروا الحصة الأولى تلقائياً للدورة الجديدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '28px', height: '28px', padding: 0 }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Group ID Input & Suggestions Container */}
          <div
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              padding: '8px 12px',
              borderRadius: 'var(--md-shape-sm)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              marginBottom: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface)' }}>
                معرّف الفوج الجديد (New Group ID) *
              </label>
              {isIdDuplicate ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--status-absent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={12} />
                  هذا المعرّف مستخدم مسبقاً!
                </span>
              ) : !formatValidation.isValid && trimmedNewId ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--status-absent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={12} />
                  {formatValidation.error}
                </span>
              ) : null}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <input
                type="text"
                value={newGroupId}
                onChange={(e) => setNewGroupId(e.target.value.toUpperCase())}
                placeholder={isVip ? 'مثال: BACV05' : 'مثال: BAC10'}
                className="m3-input"
                style={{
                  padding: '5px 10px',
                  fontSize: '0.9rem',
                  fontWeight: 800,
                  color: isIdDuplicate || (!formatValidation.isValid && trimmedNewId) ? 'var(--status-absent)' : 'var(--md-sys-color-primary)',
                  borderColor: isIdDuplicate || (!formatValidation.isValid && trimmedNewId) ? 'var(--status-absent)' : undefined,
                  letterSpacing: '0.5px'
                }}
                required
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {isVip
                  ? 'أفواج VIP الخاصة تبدأ دائماً بـ BACV بأرقام تصاعدية (01, 02...)'
                  : 'الأفواج العادية تبدأ دائماً بـ BAC بأرقام تصاعدية (01, 02...)'}
              </span>
            </div>

            {/* Suggestions Chips */}
            {suggestions.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Sparkles size={11} color="var(--md-sys-color-primary)" />
                  اقتراحات سريعة:
                </span>
                {suggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setNewGroupId(sug)}
                    className="m3-chip"
                    style={{
                      padding: '1px 7px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: newGroupId === sug ? '1px solid var(--md-sys-color-primary)' : '1px dashed var(--md-sys-color-outline)',
                      backgroundColor: newGroupId === sug ? 'var(--md-sys-color-primary-container)' : 'transparent',
                      color: newGroupId === sug ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                    }}
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Group Details Preview Container */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              padding: '6px 10px',
              borderRadius: 'var(--md-shape-sm)',
              marginBottom: '8px',
              fontSize: '0.75rem'
            }}
          >
            <div>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>المادة والأستاذ:</span>
              <strong>{sourceGroup.subject} • {sourceGroup.teacherName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>الموعد:</span>
              <strong>{sourceGroup.day1} ({sourceGroup.time1 || '08:00'})</strong>
            </div>
            <div>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>الاشتراك:</span>
              <strong style={{ color: 'var(--md-sys-color-primary)' }}>{(sourceGroup.studentFee || 2500).toLocaleString()} دج</strong>
            </div>
            <div>
              <span style={{ color: 'var(--md-sys-color-on-surface-variant)', display: 'block' }}>الدورة الجديدة:</span>
              <strong>{sessionCount} حصص</strong>
            </div>
          </div>

          {/* Student Selection Controls */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', flexWrap: 'wrap', gap: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Users size={15} color="var(--md-sys-color-primary)" />
                <span style={{ fontWeight: 800, fontSize: '0.82rem' }}>
                  تحديد التلاميذ للانتقال إلى الفوج الجديد ({selectedRowIds.size}/{realStudents.length}):
                </span>
              </div>

              {/* Filter mode chips */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={handleSelectSession1Only}
                  className="m3-chip"
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: filterMode === 'session1' ? 'var(--status-present-container)' : 'var(--md-sys-color-surface-container)',
                    color: filterMode === 'session1' ? 'var(--status-present)' : 'var(--md-sys-color-on-surface)',
                    border: filterMode === 'session1' ? '1px solid var(--status-present)' : '1px solid transparent'
                  }}
                  title="الوضع الافتراضي: تحديد من حضر الحصة الأولى فقط"
                >
                  حضروا الحصة 1 فقط ({session1Attendees.length}) ★
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="m3-chip"
                  style={{
                    padding: '2px 7px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    backgroundColor: filterMode === 'all' ? 'var(--md-sys-color-primary-container)' : 'transparent',
                    color: filterMode === 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'
                  }}
                >
                  الكل ({realStudents.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="m3-chip"
                  style={{ padding: '2px 7px', fontSize: '0.7rem', cursor: 'pointer', color: 'var(--md-sys-color-outline)' }}
                >
                  إلغاء
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم التلميذ أو رقم الهاتف..."
                className="m3-input"
                style={{ paddingInlineStart: '30px', paddingBlock: '4px', fontSize: '0.75rem' }}
              />
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  insetInlineStart: '9px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--md-sys-color-outline)'
                }}
              />
            </div>
          </div>

          {/* Students Table */}
          <div
            className="m3-table-container"
            style={{
              flex: '1 1 auto',
              minHeight: '340px',
              maxHeight: '520px',
              overflowY: 'auto',
              border: '1px solid var(--md-sys-color-outline-variant)',
              borderRadius: 'var(--md-shape-sm)',
              marginBottom: '8px'
            }}
          >
            <table className="m3-table" style={{ fontSize: '0.8rem', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 4, backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                <tr>
                  <th style={{ width: '32px', textAlign: 'center', padding: '8px 4px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>
                    <input
                      type="checkbox"
                      checked={displayedStudents.length > 0 && displayedStudents.every((s) => selectedRowIds.has(s.rowId))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            displayedStudents.forEach((s) => next.add(s.rowId));
                            return next;
                          });
                        } else {
                          setSelectedRowIds((prev) => {
                            const next = new Set(prev);
                            displayedStudents.forEach((s) => next.delete(s.rowId));
                            return next;
                          });
                        }
                        setFilterMode('custom');
                      }}
                      style={{ cursor: 'pointer' }}
                      title="تحديد الكل المعروضين"
                    />
                  </th>
                  <th style={{ width: '30px', textAlign: 'center', padding: '8px 4px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>#</th>
                  <th style={{ padding: '8px 8px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>اسم ولقب التلميذ</th>
                  <th style={{ padding: '8px 8px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>الهاتف</th>
                  <th style={{ textAlign: 'center', padding: '8px 8px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>حضور الحصة 1</th>
                  <th style={{ textAlign: 'center', padding: '8px 8px', backgroundColor: 'var(--md-sys-color-surface-container)' }}>حضور الدورة السابقة</th>
                </tr>
              </thead>
              <tbody>
                {displayedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--md-sys-color-outline)' }}>
                      لا يوجد تلاميذ مطابقين لبحثك.
                    </td>
                  </tr>
                ) : (
                  displayedStudents.map((student, idx) => {
                    const isSelected = selectedRowIds.has(student.rowId);
                    const isAtt1 = hasAttendedSession1(student);

                    return (
                      <tr
                        key={student.rowId}
                        onClick={() => handleToggleStudent(student.rowId)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected
                            ? 'rgba(16, 185, 129, 0.08)'
                            : idx % 2 === 1
                            ? 'var(--md-sys-color-surface-container-lowest)'
                            : 'transparent'
                        }}
                      >
                        <td
                          style={{ textAlign: 'center', padding: '6px 4px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleStudent(student.rowId)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--md-sys-color-outline)', padding: '6px 4px' }}>
                          {idx + 1}
                        </td>
                        <td style={{ fontWeight: isSelected ? 800 : 500, color: 'var(--md-sys-color-on-surface)', padding: '6px 8px' }}>
                          {student.name}
                        </td>
                        <td style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.75rem', padding: '6px 8px' }}>
                          {student.phone || '—'}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px' }}>
                          {isAtt1 ? (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                backgroundColor: 'var(--status-present-container)',
                                color: 'var(--status-present)',
                                padding: '2px 8px',
                                borderRadius: 'var(--md-shape-full)',
                                border: '1px solid var(--status-present)'
                              }}
                            >
                              حضر الحصة 1 ✓
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--md-sys-color-outline)',
                                backgroundColor: 'var(--md-sys-color-surface-container)',
                                padding: '2px 8px',
                                borderRadius: 'var(--md-shape-full)'
                              }}
                            >
                              غائب ✕
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', padding: '6px 6px', fontSize: '0.75rem', fontWeight: 700 }}>
                          {student.totalAttendance || 0}/{sessionCount}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Action Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--md-sys-color-outline-variant)',
              paddingTop: '8px'
            }}
          >
            <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              سيتم نقل <strong>{selectedRowIds.size}</strong> تلميذ إلى الفوج <strong>{trimmedNewId || '...'}</strong> بسجلات جديدة.
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="m3-btn m3-btn-outlined m3-btn-sm"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={!isValid}
                className="m3-btn m3-btn-primary m3-btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isValid ? 1 : 0.6,
                  cursor: isValid ? 'pointer' : 'not-allowed'
                }}
              >
                <Check size={16} />
                <span>تأكيد فتح الفوج {trimmedNewId} ({selectedRowIds.size} تلميذ)</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Trash2, RotateCcw, X, Search, AlertCircle, Check, Users, Clock } from 'lucide-react';
import { DeletedStudentArchiveItem } from '../types';

interface Props {
  onClose: () => void;
}

export default function RecycleBinModal({ onClose }: Props) {
  const { data, restoreStudent, clearRecycleBin } = useApp();
  const [search, setSearch] = useState('');
  const [restoredMsg, setRestoredMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const deletedList: DeletedStudentArchiveItem[] = useMemo(() => {
    return data.deletedStudents || [];
  }, [data.deletedStudents]);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deletedList;
    return deletedList.filter((item) => {
      const name = item.student?.name?.toLowerCase() || '';
      const gid = item.groupId?.toLowerCase() || '';
      const subj = item.groupSubject?.toLowerCase() || '';
      const teacher = item.teacherName?.toLowerCase() || '';
      return name.includes(q) || gid.includes(q) || subj.includes(q) || teacher.includes(q);
    });
  }, [deletedList, search]);

  const handleRestore = (item: DeletedStudentArchiveItem) => {
    const success = restoreStudent(item.id);
    if (success) {
      setRestoredMsg(`تمت استعادة التلميذ "${item.student.name}" بنجاح إلى فوج ${item.groupId}!`);
      setTimeout(() => setRestoredMsg(''), 4000);
    } else {
      alert('تعذرت استعادة التلميذ. تأكد من وجود الفوج الأصلي.');
    }
  };

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearRecycleBin();
    setConfirmClear(false);
  };

  return (
    <div className="m3-dialog-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="m3-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          width: '95%',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 24px',
          borderRadius: 'var(--md-shape-lg)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            paddingBottom: '12px',
            marginBottom: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444'
              }}
            >
              <Trash2 size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                سلة المحذوفات والأرشيف المسترجع
              </h2>
              <p style={{ fontSize: '0.78rem', margin: '2px 0 0', color: 'var(--md-sys-color-on-surface-variant)' }}>
                سجل آمن لجميع الطلبة المحذوفين مع إمكانية الاستعادة الفورية بنقرة زر واحدة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="m3-btn-text"
            style={{ borderRadius: '50%', width: '32px', height: '32px', padding: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Message */}
        {restoredMsg && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--status-present-container)',
              color: 'var(--status-present)',
              borderRadius: 'var(--md-shape-xs)',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '12px'
            }}
          >
            <Check size={16} />
            <span>{restoredMsg}</span>
          </div>
        )}

        {/* Toolbar: Search + Clear */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '14px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
            />
            <input
              type="text"
              placeholder="بحث في المحذوفات بالاسم، الفوج، المادة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="m3-input"
              style={{ paddingRight: '34px', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)' }}>
              العدد: {filteredList.length}
            </span>

            {deletedList.length > 0 && (
              <button
                onClick={handleClearAll}
                className={`m3-btn ${confirmClear ? 'm3-btn-destructive' : 'm3-btn-text'} m3-btn-sm`}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                title="إفراغ المحذوفات نهائياً"
              >
                {confirmClear ? 'تأكيد إفراغ السلة نهائياً؟' : 'إفراغ السلة'}
              </button>
            )}
          </div>
        </div>

        {/* List of deleted items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid var(--md-sys-color-outline-variant)',
            borderRadius: 'var(--md-shape-sm)',
            maxHeight: '440px'
          }}
        >
          {filteredList.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--md-sys-color-on-surface-variant)',
                fontSize: '0.9rem'
              }}
            >
              <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontWeight: 700 }}>سلة المحذوفات فارغة حالياً</p>
              <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '4px 0 0' }}>
                أي تلميذ يتم حذفه مستقبلاً سيظهر هنا فوراً مع كافة بياناته ومبالغه ليتمكن المشرف من استعادته
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredList.map((item, idx) => {
                const s = item.student;
                return (
                  <div
                    key={item.id || idx}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      backgroundColor: idx % 2 === 0 ? 'var(--md-sys-color-surface)' : 'var(--md-sys-color-surface-container-lowest)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--md-sys-color-on-surface)' }}>
                          {s.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 'var(--md-shape-xs)',
                            backgroundColor: 'var(--md-sys-color-primary-container)',
                            color: 'var(--md-sys-color-on-primary-container)'
                          }}
                        >
                          فوج {item.groupId}
                        </span>
                        {item.groupSubject && (
                          <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>({item.groupSubject})</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                        {item.teacherName && <span>الأستاذ: {item.teacherName}</span>}
                        {s.phone && <span>الهاتف: {s.phone}</span>}
                        <span>المسدد: {(s.totalReceived || 0).toLocaleString()} دج</span>
                        {(s.debt || 0) > 0 && <span style={{ color: '#ef4444', fontWeight: 700 }}>دين: {s.debt.toLocaleString()} دج</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', opacity: 0.65, marginTop: '2px' }}>
                        <Clock size={11} />
                        <span>حذف في: {item.deletedAtStr || new Date(item.deletedAt).toLocaleString('ar-DZ')}</span>
                        {item.reason && <span>• السبب: {item.reason}</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleRestore(item)}
                      className="m3-btn m3-btn-tonal m3-btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 800,
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>استرجاع للفوج</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
          <button onClick={onClose} className="m3-btn m3-btn-filled m3-btn-sm" style={{ padding: '6px 20px' }}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApp } from '../../context/AppContext';
import {
  Users,
  Search,
  FolderPlus,
  ArrowUpRight,
  Printer,
  Calendar,
  Clock,
  GraduationCap,
  School,
  BookOpen,
  X,
  Coins,
  Edit3,
  RotateCw,
  User
} from 'lucide-react';
import AddGroupModal from '../../components/AddGroupModal';
import EditGroupModal from '../../components/EditGroupModal';
import RenewGroupModal from '../../components/RenewGroupModal';
import {
  isGroupToday,
  getTodayArabicDayName,
  formatGroupTime,
  getGroupStatus,
  isGroupActive,
  sortGroupsActiveFirstOldToNew,
  getGroupLevelFromId,
  getLevelDisplayName,
  EDUCATIONAL_LEVELS
} from '../../utils/sessionUtils';
import { normalizeArabicName } from '../../utils/barcodeUtils';

export default function GroupsPage() {
  const { data, setSelectedGroup, getGroupStats } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'today' | 'regular' | 'vip'>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [renewingGroupId, setRenewingGroupId] = useState<string | null>(null);

  const todayDayName = getTodayArabicDayName();
  const todayGroupsCount = data.groups.filter((g) => isGroupToday(g, data.groupData[g.id])).length;
  const activeGroupsCount = data.groups.filter((g) => isGroupActive(g, data.groupData[g.id], data.pricingTiers)).length;
  const inactiveGroupsCount = data.groups.length - activeGroupsCount;

  // Canonical days of the week in standard Algerian order
  const CANONICAL_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  // Day options with group counts
  const dayOptions = useMemo(() => {
    return CANONICAL_DAYS.map((day) => {
      const normDay = normalizeArabicName(day);
      const count = data.groups.filter((g) => {
        const d1Norm = g.day1 ? normalizeArabicName(g.day1) : '';
        const d2Norm = g.day2 ? normalizeArabicName(g.day2) : '';
        return d1Norm === normDay || d2Norm === normDay;
      }).length;
      return { day, count };
    }).filter((item) => item.count > 0);
  }, [data.groups]);

  // Unique teachers with group counts
  const teacherOptions = useMemo(() => {
    const map = new Map<string, { original: string; count: number }>();
    data.groups.forEach((g) => {
      if (!g.teacherName || !g.teacherName.trim()) return;
      const clean = g.teacherName.trim();
      const norm = normalizeArabicName(clean);
      if (!map.has(norm)) {
        map.set(norm, { original: clean, count: 1 });
      } else {
        map.get(norm)!.count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.original.localeCompare(b.original, 'ar'));
  }, [data.groups]);

  // Unique subjects with group counts
  const subjectOptions = useMemo(() => {
    const map = new Map<string, { original: string; count: number }>();
    data.groups.forEach((g) => {
      if (!g.subject || !g.subject.trim()) return;
      const clean = g.subject.trim();
      const norm = normalizeArabicName(clean);
      if (!map.has(norm)) {
        map.set(norm, { original: clean, count: 1 });
      } else {
        map.get(norm)!.count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => a.original.localeCompare(b.original, 'ar'));
  }, [data.groups]);

  // Filter and sort groups: ALWAYS start with active groups from oldest to newest ID
  const filteredGroups = useMemo(() => {
    const matched = data.groups.filter((g) => {
      // 1. Text Search match
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch =
          g.id.toLowerCase().includes(q) ||
          g.subject.toLowerCase().includes(q) ||
          g.teacherName.toLowerCase().includes(q) ||
          (g.day1 && g.day1.toLowerCase().includes(q)) ||
          (g.day2 && g.day2.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Status Pill match
      if (filterType === 'active' && !isGroupActive(g, data.groupData[g.id], data.pricingTiers)) return false;
      if (filterType === 'inactive' && isGroupActive(g, data.groupData[g.id], data.pricingTiers)) return false;
      if (filterType === 'today' && !isGroupToday(g, data.groupData[g.id])) return false;
      if (filterType === 'regular' && g.isVip) return false;
      if (filterType === 'vip' && !g.isVip) return false;

      // 3. Educational level match
      if (selectedLevel !== 'all') {
        const groupLvl = g.level || getGroupLevelFromId(g.id);
        if (groupLvl !== selectedLevel) return false;
      }

      // 4. Day match (checks both day1 and day2)
      if (selectedDay !== 'all') {
        const normSelectedDay = normalizeArabicName(selectedDay);
        const day1Norm = g.day1 ? normalizeArabicName(g.day1) : '';
        const day2Norm = g.day2 ? normalizeArabicName(g.day2) : '';
        if (day1Norm !== normSelectedDay && day2Norm !== normSelectedDay) {
          return false;
        }
      }

      // 5. Teacher match
      if (selectedTeacher !== 'all') {
        const normSelectedTeacher = normalizeArabicName(selectedTeacher);
        const groupTeacherNorm = g.teacherName ? normalizeArabicName(g.teacherName) : '';
        if (groupTeacherNorm !== normSelectedTeacher) {
          return false;
        }
      }

      // 6. Subject match
      if (selectedSubject !== 'all') {
        const normSelectedSubject = normalizeArabicName(selectedSubject);
        const groupSubjectNorm = g.subject ? normalizeArabicName(g.subject) : '';
        if (groupSubjectNorm !== normSelectedSubject) {
          return false;
        }
      }

      return true;
    });

    return sortGroupsActiveFirstOldToNew(matched, data.groupData, data.pricingTiers);
  }, [data.groups, data.groupData, data.pricingTiers, search, filterType, selectedLevel, selectedDay, selectedTeacher, selectedSubject]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div
        className="m3-card"
        style={{
          padding: '20px 24px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--md-sys-color-on-surface)' }}>
            الأفواج الدراسية والحصص ({data.groups.length} فوج)
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            تنظيم وتوزيع الطلبة، مواعيد الحصص الأسبوعية وخطط التسعير
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsAddGroupOpen(true)}
            className="m3-btn m3-btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderPlus size={18} />
            <span>إنشاء فوج جديد</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        {/* Right Section: Search & Dropdown Filters (Day, Teacher, Subject) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px', minWidth: '170px' }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن فوج، أستاذ أو مادة..."
              className="m3-input"
              style={{ paddingInlineStart: '34px', paddingInlineEnd: search ? '28px' : '10px', paddingBlock: '7px', fontSize: '0.84rem' }}
            />
            <Search
              size={15}
              style={{
                position: 'absolute',
                insetInlineStart: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--md-sys-color-outline)'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  insetInlineEnd: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--md-sys-color-outline)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px'
                }}
                title="مسح البحث"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter by Level (المستوى الدراسي) */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: selectedLevel !== 'all' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              border: selectedLevel !== 'all' ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
              padding: '2px 8px 2px 10px',
              transition: 'all 0.2s ease',
              boxShadow: selectedLevel !== 'all' ? '0 1px 4px rgba(0, 99, 155, 0.2)' : 'none'
            }}
          >
            <School
              size={14}
              style={{
                color: selectedLevel !== 'all' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                marginInlineEnd: '4px',
                flexShrink: 0
              }}
            />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.82rem',
                fontWeight: selectedLevel !== 'all' ? 800 : 600,
                color: selectedLevel !== 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                paddingBlock: '5px'
              }}
              title="تصفية حسب المستوى الدراسي"
            >
              <option value="all">المستوى: جميع المستويات</option>
              {EDUCATIONAL_LEVELS.map((lvl) => {
                const count = data.groups.filter((g) => (g.level || getGroupLevelFromId(g.id)) === lvl.key).length;
                return (
                  <option key={lvl.key} value={lvl.key}>
                    {lvl.label} ({lvl.badge}) ({count})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Filter by Day (اليوم) */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: selectedDay !== 'all' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              border: selectedDay !== 'all' ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
              padding: '2px 8px 2px 10px',
              transition: 'all 0.2s ease',
              boxShadow: selectedDay !== 'all' ? '0 1px 4px rgba(0, 99, 155, 0.2)' : 'none'
            }}
          >
            <Calendar
              size={14}
              style={{
                color: selectedDay !== 'all' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                marginInlineEnd: '4px',
                flexShrink: 0
              }}
            />
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.82rem',
                fontWeight: selectedDay !== 'all' ? 800 : 600,
                color: selectedDay !== 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                paddingBlock: '5px'
              }}
              title="تصفية حسب يوم الحصة"
            >
              <option value="all">اليوم: كل الأيام</option>
              {dayOptions.map((opt) => (
                <option key={opt.day} value={opt.day}>
                  {opt.day} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Teacher (الأستاذ) */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: selectedTeacher !== 'all' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              border: selectedTeacher !== 'all' ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
              padding: '2px 8px 2px 10px',
              transition: 'all 0.2s ease',
              boxShadow: selectedTeacher !== 'all' ? '0 1px 4px rgba(0, 99, 155, 0.2)' : 'none'
            }}
          >
            <User
              size={14}
              style={{
                color: selectedTeacher !== 'all' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                marginInlineEnd: '4px',
                flexShrink: 0
              }}
            />
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.82rem',
                fontWeight: selectedTeacher !== 'all' ? 800 : 600,
                color: selectedTeacher !== 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                paddingBlock: '5px',
                maxWidth: '150px'
              }}
              title="تصفية حسب الأستاذ"
            >
              <option value="all">الأستاذ: كل الأساتذة</option>
              {teacherOptions.map((opt) => (
                <option key={opt.original} value={opt.original}>
                  {opt.original} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Subject (المادة) */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: selectedSubject !== 'all' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
              borderRadius: 'var(--md-shape-full)',
              border: selectedSubject !== 'all' ? '1.5px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
              padding: '2px 8px 2px 10px',
              transition: 'all 0.2s ease',
              boxShadow: selectedSubject !== 'all' ? '0 1px 4px rgba(0, 99, 155, 0.2)' : 'none'
            }}
          >
            <BookOpen
              size={14}
              style={{
                color: selectedSubject !== 'all' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)',
                marginInlineEnd: '4px',
                flexShrink: 0
              }}
            />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.82rem',
                fontWeight: selectedSubject !== 'all' ? 800 : 600,
                color: selectedSubject !== 'all' ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                paddingBlock: '5px',
                maxWidth: '130px'
              }}
              title="تصفية حسب المادة"
            >
              <option value="all">المادة: كل المواد</option>
              {subjectOptions.map((opt) => (
                <option key={opt.original} value={opt.original}>
                  {opt.original} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {(selectedLevel !== 'all' || selectedDay !== 'all' || selectedTeacher !== 'all' || selectedSubject !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSelectedLevel('all');
                setSelectedDay('all');
                setSelectedTeacher('all');
                setSelectedSubject('all');
              }}
              className="m3-btn m3-btn-text m3-btn-sm"
              style={{
                color: '#dc2626',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                fontSize: '0.78rem',
                fontWeight: 700
              }}
              title="مسح فلاتر المستوى، اليوم، الأستاذ والمادة"
            >
              <X size={13} />
              <span>مسح الفلاتر</span>
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: 'var(--md-shape-full)',
            padding: '3px',
            gap: '2px',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'all', label: 'جميع الأفواج' },
            { id: 'active', label: 'النشطة', count: activeGroupsCount },
            { id: 'inactive', label: 'المكتملة (غير النشطة)', count: inactiveGroupsCount },
            { id: 'today', label: `أفواج اليوم (${todayDayName})`, count: todayGroupsCount },
            { id: 'regular', label: 'الأفواج العادية' },
            { id: 'vip', label: 'أفواج VIP الخاصة' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--md-shape-full)',
                border: 'none',
                backgroundColor: filterType === tab.id ? 'var(--md-sys-color-primary)' : 'transparent',
                color: filterType === tab.id ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                transition: 'var(--transition-standard)'
              }}
            >
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  style={{
                    backgroundColor: filterType === tab.id
                      ? 'rgba(255, 255, 255, 0.28)'
                      : tab.id === 'inactive'
                      ? 'var(--md-sys-color-surface-container-high)'
                      : 'var(--status-present-container)',
                    color: filterType === tab.id
                      ? '#ffffff'
                      : tab.id === 'inactive'
                      ? 'var(--md-sys-color-outline)'
                      : 'var(--status-present)',
                    borderRadius: 'var(--md-shape-full)',
                    padding: '1px 7px',
                    fontSize: '0.72rem',
                    fontWeight: 800
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Groups Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '18px',
          alignItems: 'start'
        }}
      >
        {filteredGroups.map((group) => {
          const stats = getGroupStats(group.id);
          const groupSheet = data.groupData[group.id];
          const isToday = isGroupToday(group, groupSheet);
          const statusInfo = getGroupStatus(group, groupSheet, data.pricingTiers);

          return (
            <div
              key={group.id}
              className="m3-card"
              style={{
                padding: '16px',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                opacity: statusInfo.status === 'inactive' ? 0.94 : 1,
                border: isToday
                  ? '2px solid var(--md-sys-color-primary)'
                  : group.isVip
                  ? '2px solid var(--status-vip)'
                  : statusInfo.status === 'inactive'
                  ? '1px dashed var(--md-sys-color-outline-variant)'
                  : '1px solid var(--md-sys-color-outline-variant)'
              }}
            >
              {/* Header Row: Group ID + Status on right, Edit on left (strictly one line) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                {/* Right side: Group ID + Status Badge + Today/VIP */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap', overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-primary)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                    {group.id}
                  </span>

                  {/* Educational Level Badge */}
                  <span
                    className="m3-chip"
                    style={{
                      backgroundColor:
                        (group.level || getGroupLevelFromId(group.id)) === 'BAC'
                          ? 'var(--md-sys-color-primary-container)'
                          : (group.level || getGroupLevelFromId(group.id)) === 'SEC'
                          ? 'var(--md-sys-color-secondary-container)'
                          : 'var(--status-vip-container, #fef3c7)',
                      color:
                        (group.level || getGroupLevelFromId(group.id)) === 'BAC'
                          ? 'var(--md-sys-color-on-primary-container)'
                          : (group.level || getGroupLevelFromId(group.id)) === 'SEC'
                          ? 'var(--md-sys-color-on-secondary-container)'
                          : 'var(--status-vip, #b45309)',
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      padding: '2px 7px',
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.2px'
                    }}
                    title={`المستوى: ${getLevelDisplayName(group.level || getGroupLevelFromId(group.id))}`}
                  >
                    {getLevelDisplayName(group.level || getGroupLevelFromId(group.id))}
                  </span>

                  {/* Status Badge directly next to group ID */}
                  {statusInfo.status === 'active' ? (
                    <span
                      className="m3-chip"
                      style={{
                        backgroundColor: 'var(--status-present-container)',
                        color: 'var(--status-present)',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                      title={`فوج نشط - أنجز ${statusInfo.currentSession} من أصل ${statusInfo.totalSessions} حصص`}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-present)' }} />
                      <span>نشط ({statusInfo.currentSession}/{statusInfo.totalSessions})</span>
                    </span>
                  ) : (
                    <span
                      className="m3-chip"
                      style={{
                        backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                        color: 'var(--md-sys-color-outline)',
                        fontWeight: 800,
                        fontSize: '0.7rem',
                        padding: '2px 7px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                      title={`فوج غير نشط - بلغ آخر حصة (${statusInfo.totalSessions}/${statusInfo.totalSessions})`}
                    >
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                      <span>غير نشط ({statusInfo.totalSessions}/{statusInfo.totalSessions})</span>
                    </span>
                  )}

                  {isToday && (
                    <span
                      className="m3-chip"
                      style={{
                        backgroundColor: 'var(--status-present-container)',
                        color: 'var(--status-present)',
                        fontWeight: 800,
                        border: '1px solid var(--status-present)',
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      اليوم ★
                    </span>
                  )}
                  {group.isVip && (
                    <span
                      className="m3-chip m3-chip-vip"
                      style={{
                        whiteSpace: 'nowrap',
                        fontSize: '0.7rem',
                        padding: '2px 7px'
                      }}
                    >
                      VIP خاص
                    </span>
                  )}
                </div>

                {/* Left side: Edit button aligned to the left */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setEditingGroupId(group.id)}
                    className="m3-btn-text"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: 'var(--md-shape-sm)',
                      backgroundColor: 'var(--md-sys-color-surface-container-high)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      color: 'var(--md-sys-color-primary)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'var(--transition-standard)',
                      whiteSpace: 'nowrap'
                    }}
                    title="تعديل جميع معلومات الفوج"
                  >
                    <Edit3 size={12} />
                    <span>تعديل</span>
                  </button>
                </div>
              </div>

              {/* Rollover / New ID Button: Placed below, sized to the whole space (width: 100%) */}
              {statusInfo.status === 'inactive' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenewingGroupId(group.id);
                  }}
                  className="m3-btn-text"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    borderRadius: 'var(--md-shape-sm)',
                    backgroundColor: 'var(--md-sys-color-primary-container)',
                    color: 'var(--md-sys-color-on-primary-container)',
                    border: '1px solid var(--md-sys-color-primary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'var(--transition-standard)'
                  }}
                  title="فتح دورة جديدة ونقل التلاميذ الذين حضروا الحصة الأولى"
                >
                  <RotateCw size={13} />
                  <span>دورة جديدة 🔁</span>
                </button>
              )}

              {/* Teacher name first, then subject, after that time in ONE line */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  backgroundColor: isToday ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
                  border: isToday ? '1px solid var(--md-sys-color-primary)' : '1px solid var(--md-sys-color-outline-variant)',
                  padding: '7px 10px',
                  borderRadius: 'var(--md-shape-sm)',
                  fontSize: '0.82rem'
                }}
              >
                {/* 1. Teacher name first */}
                <span style={{ color: isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)' }}>
                  الأستاذ: <strong>{group.teacherName}</strong>
                </span>

                <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>•</span>

                {/* 2. Then subject */}
                <strong style={{ color: 'var(--md-sys-color-primary)', fontWeight: 800, fontSize: '0.86rem' }}>
                  {group.subject}
                </strong>

                <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>•</span>

                {/* 3. After that time */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)' }}>
                  <Calendar size={13} color={isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-primary)'} />
                  <span>
                    {group.day1} ({formatGroupTime(group.time1) || 'صباحاً'})
                    {group.day2 ? ` • ${group.day2} (${formatGroupTime(group.time2)})` : ''}
                  </span>
                  {isToday && <span style={{ fontWeight: 800, color: 'var(--status-present)', marginInlineStart: '4px' }}>★ موعد اليوم</span>}
                </div>
              </div>

              {/* Financial breakdown per student */}
              {(() => {
                const tier = data.pricingTiers.find((t) => t.id === group.type);
                const fee = groupSheet?.studentFee ?? group.studentFee ?? tier?.price ?? (group.type.includes('10000') ? 10000 : 2500);
                const teacherRate = groupSheet?.teacherPayPerStudent ?? group.teacherPayPerStudent ?? tier?.teacherRate ?? (group.type.includes('10000') ? 7500 : 1500);
                const schoolRate = groupSheet?.schoolSharePerStudent ?? group.schoolSharePerStudent ?? tier?.schoolRate ?? (fee - teacherRate);

                return (
                  <div
                    style={{
                      backgroundColor: 'var(--md-sys-color-surface-container-low)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      borderRadius: 'var(--md-shape-sm)',
                      padding: '8px 10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Coins size={14} color="var(--md-sys-color-primary)" />
                        <span>المستحقات لكل تلميذ:</span>
                      </span>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          backgroundColor: 'var(--md-sys-color-primary-container)',
                          color: 'var(--md-sys-color-on-primary-container)',
                          padding: '2px 8px',
                          borderRadius: 'var(--md-shape-sm)',
                          direction: 'ltr',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {group.type}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
                      <div style={{ backgroundColor: 'var(--md-sys-color-surface)', padding: '4px 2px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.66rem', color: 'var(--md-sys-color-on-surface-variant)' }}>الاشتراك</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>{fee.toLocaleString()} دج</div>
                      </div>
                      <div style={{ backgroundColor: 'var(--md-sys-color-surface)', padding: '4px 2px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.66rem', color: 'var(--md-sys-color-on-surface-variant)' }}>الأستاذ</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--status-present)' }}>{teacherRate.toLocaleString()} دج</div>
                      </div>
                      <div style={{ backgroundColor: 'var(--md-sys-color-surface)', padding: '4px 2px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '0.66rem', color: 'var(--md-sys-color-on-surface-variant)' }}>المدرسة</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--status-vip)' }}>{schoolRate.toLocaleString()} دج</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Financial overview */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    padding: '8px 4px',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    borderRadius: 'var(--md-shape-sm)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>التلاميذ</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800 }}>{stats.studentCount}</div>
                </div>

                <div
                  style={{
                    padding: '8px 4px',
                    backgroundColor: 'var(--status-present-container)',
                    borderRadius: 'var(--md-shape-sm)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--status-present)' }}>المحصل</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--status-present)' }}>
                    {stats.totalReceived.toLocaleString()}
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 4px',
                    backgroundColor: stats.totalDebt > 0 ? 'var(--status-absent-container)' : 'var(--md-sys-color-surface-container-low)',
                    borderRadius: 'var(--md-shape-sm)'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: stats.totalDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface-variant)' }}>
                    الديون
                  </div>
                  <div
                    style={{
                      fontSize: '0.95rem',
                      fontWeight: 800,
                      color: stats.totalDebt > 0 ? 'var(--status-absent)' : 'var(--md-sys-color-on-surface)'
                    }}
                  >
                    {stats.totalDebt.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  href={`/attendance?group=${group.id}`}
                  onClick={() => setSelectedGroup(group.id)}
                  className="m3-btn m3-btn-primary m3-btn-sm"
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  <span>كشف الحضور والمالية</span>
                  <ArrowUpRight size={16} />
                </Link>
                <Link
                  href={`/print?group=${group.id}`}
                  onClick={() => setSelectedGroup(group.id)}
                  className="m3-btn m3-btn-outlined m3-btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  <Printer size={16} />
                  <span>طباعة</span>
                </Link>
              </div>
            </div>
          );
        })}

        {filteredGroups.length === 0 && (
          <div
            className="m3-card"
            style={{
              gridColumn: '1 / -1',
              padding: '48px 24px',
              textAlign: 'center',
              color: 'var(--md-sys-color-outline)'
            }}
          >
            <Calendar size={40} style={{ margin: '0 auto 12px', color: 'var(--md-sys-color-primary)' }} />
            <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', marginBottom: '6px' }}>
              لا توجد أفواج مطابقة لمعايير البحث والتصفية الحالية
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '14px' }}>
              {filterType === 'today'
                ? 'لا توجد أفواج مبرمجة لليوم بالمعايير المختارة.'
                : 'يرجى تجربة تغيير اليوم، الأستاذ أو المادة، أو مسح كلمات البحث.'}
            </p>
            {(search || selectedDay !== 'all' || selectedTeacher !== 'all' || selectedSubject !== 'all' || filterType !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedDay('all');
                  setSelectedTeacher('all');
                  setSelectedSubject('all');
                  setFilterType('all');
                }}
                className="m3-btn m3-btn-primary m3-btn-sm"
                style={{ margin: '0 auto' }}
              >
                إعادة ضبط جميع الفلاتر
              </button>
            )}
          </div>
        )}
      </div>

      {isAddGroupOpen && <AddGroupModal onClose={() => setIsAddGroupOpen(false)} />}
      {editingGroupId && <EditGroupModal groupId={editingGroupId} onClose={() => setEditingGroupId(null)} />}
      {renewingGroupId && (
        <RenewGroupModal
          sourceGroupId={renewingGroupId}
          onClose={() => setRenewingGroupId(null)}
        />
      )}
    </div>
  );
}

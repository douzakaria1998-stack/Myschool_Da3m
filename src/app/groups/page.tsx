'use client';

import React, { useState } from 'react';
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
  Coins,
  Edit3,
  RotateCw
} from 'lucide-react';
import AddGroupModal from '../../components/AddGroupModal';
import EditGroupModal from '../../components/EditGroupModal';
import RenewGroupModal from '../../components/RenewGroupModal';
import { isGroupToday, getTodayArabicDayName, formatGroupTime, getGroupStatus, isGroupActive } from '../../utils/sessionUtils';

export default function GroupsPage() {
  const { data, setSelectedGroup, getGroupStats } = useApp();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'today' | 'regular' | 'vip'>('all');
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [renewingGroupId, setRenewingGroupId] = useState<string | null>(null);

  const todayDayName = getTodayArabicDayName();
  const todayGroupsCount = data.groups.filter((g) => isGroupToday(g, data.groupData[g.id])).length;
  const activeGroupsCount = data.groups.filter((g) => isGroupActive(g, data.groupData[g.id], data.pricingTiers)).length;
  const inactiveGroupsCount = data.groups.length - activeGroupsCount;

  const filteredGroups = data.groups.filter((g) => {
    const matchesSearch =
      g.id.toLowerCase().includes(search.toLowerCase()) ||
      g.subject.toLowerCase().includes(search.toLowerCase()) ||
      g.teacherName.toLowerCase().includes(search.toLowerCase());

    if (filterType === 'active') return matchesSearch && isGroupActive(g, data.groupData[g.id], data.pricingTiers);
    if (filterType === 'inactive') return matchesSearch && !isGroupActive(g, data.groupData[g.id], data.pricingTiers);
    if (filterType === 'today') return matchesSearch && isGroupToday(g, data.groupData[g.id]);
    if (filterType === 'regular') return matchesSearch && !g.isVip;
    if (filterType === 'vip') return matchesSearch && g.isVip;
    return matchesSearch;
  });

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
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث عن فوج، أستاذ أو مادة..."
            className="m3-input"
            style={{ paddingInlineStart: '36px', paddingBlock: '8px', fontSize: '0.85rem' }}
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
          gap: '18px'
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
                padding: '20px',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
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
              <div>
                {/* Header Row: Group ID + Status on right, Edit + Tier on left */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: statusInfo.status === 'inactive' ? '8px' : '10px', gap: '8px' }}>
                  {/* Right side: Group ID + Status Badge + Today/VIP */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--md-sys-color-primary)', whiteSpace: 'nowrap', lineHeight: 1 }}>
                      {group.id}
                    </span>

                    {/* Status Badge directly next to group ID */}
                    {statusInfo.status === 'active' ? (
                      <span
                        className="m3-chip"
                        style={{
                          backgroundColor: 'var(--status-present-container)',
                          color: 'var(--status-present)',
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
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
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          border: '1px solid var(--md-sys-color-outline-variant)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          whiteSpace: 'nowrap'
                        }}
                        title={`فوج غير نشط - بلغ آخر حصة (${statusInfo.totalSessions}/${statusInfo.totalSessions})`}
                      >
                        <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--md-sys-color-outline)' }} />
                        <span>غير نشط • مكتمل ({statusInfo.totalSessions}/{statusInfo.totalSessions})</span>
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
                          padding: '2px 8px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        اليوم ★
                      </span>
                    )}
                    {group.isVip && <span className="m3-chip m3-chip-vip" style={{ whiteSpace: 'nowrap' }}>VIP خاص</span>}
                  </div>

                  {/* Left side: The 2 buttons (Edit + Pricing Tier) aligned to the left */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'var(--transition-standard)',
                        whiteSpace: 'nowrap'
                      }}
                      title="تعديل جميع معلومات الفوج"
                    >
                      <Edit3 size={13} />
                      <span>تعديل</span>
                    </button>

                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        backgroundColor: 'var(--md-sys-color-primary-container)',
                        color: 'var(--md-sys-color-on-primary-container)',
                        padding: '3px 8px',
                        borderRadius: 'var(--md-shape-sm)',
                        whiteSpace: 'nowrap',
                        direction: 'ltr',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        letterSpacing: '0.5px'
                      }}
                    >
                      {group.type}
                    </span>
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
                      marginBottom: '10px',
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
                    padding: '8px 12px',
                    borderRadius: 'var(--md-shape-sm)',
                    marginBottom: '14px',
                    fontSize: '0.85rem'
                  }}
                >
                  {/* 1. Teacher name first */}
                  <span style={{ color: isToday ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)' }}>
                    الأستاذ: <strong>{group.teacherName}</strong>
                  </span>

                  <span style={{ color: 'var(--md-sys-color-outline)', fontWeight: 700 }}>•</span>

                  {/* 2. Then subject */}
                  <strong style={{ color: 'var(--md-sys-color-primary)', fontWeight: 800, fontSize: '0.9rem' }}>
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
                        padding: '8px 10px',
                        marginBottom: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Coins size={14} color="var(--md-sys-color-primary)" />
                          <span>المستحقات لكل تلميذ:</span>
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
                    textAlign: 'center',
                    marginBottom: '16px'
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
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <Link
                  href="/attendance"
                  onClick={() => setSelectedGroup(group.id)}
                  className="m3-btn m3-btn-primary m3-btn-sm"
                  style={{ flex: 1, textDecoration: 'none' }}
                >
                  <span>كشف الحضور والمالية</span>
                  <ArrowUpRight size={16} />
                </Link>
                <Link
                  href="/print"
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
              {filterType === 'today' ? `لا توجد أفواج مبرمجة لليوم (${todayDayName})` : 'لا توجد أفواج مطابقة للبحث'}
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              {filterType === 'today'
                ? 'يمكنك الاطلاع على جدول باقي أيام الأسبوع باختيار "جميع الأفواج" أعلاه.'
                : 'تأكد من كتابة اسم الفوج أو الأستاذ أو المادة بشكل صحيح.'}
            </p>
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

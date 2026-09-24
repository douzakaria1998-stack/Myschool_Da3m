'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CalendarCheck,
  ScanBarcode,
  Users,
  GraduationCap,
  IdCard,
  Printer,
  Settings,
  Sparkles
} from 'lucide-react';

export default function NavRail() {
  const pathname = usePathname();
  const { lang, data, selectedGroup } = useApp();

  const navItems = [
    {
      basePath: '/',
      href: '/',
      icon: LayoutDashboard,
      labelAr: 'لوحة التحكم',
      labelEn: 'Dashboard'
    },
    {
      basePath: '/attendance',
      href: selectedGroup ? `/attendance?group=${selectedGroup}` : '/attendance',
      icon: CalendarCheck,
      labelAr: 'كشف الحضور',
      labelEn: 'Attendance'
    },
    {
      basePath: '/scanner',
      href: '/scanner',
      icon: ScanBarcode,
      labelAr: 'مسح الباركود',
      labelEn: 'Barcode'
    },
    {
      basePath: '/groups',
      href: '/groups',
      icon: Users,
      labelAr: 'الأفواج',
      labelEn: 'Groups'
    },
    {
      basePath: '/teachers',
      href: '/teachers',
      icon: GraduationCap,
      labelAr: 'الأساتذة',
      labelEn: 'Teachers'
    },
    {
      basePath: '/students',
      href: '/students',
      icon: IdCard,
      labelAr: 'سجل التلاميذ',
      labelEn: 'Students'
    },
    {
      basePath: '/print',
      href: selectedGroup ? `/print?group=${selectedGroup}` : '/print',
      icon: Printer,
      labelAr: 'طباعة الكشوف',
      labelEn: 'Print'
    },
    {
      basePath: '/admin',
      href: '/admin',
      icon: Settings,
      labelAr: 'الإعدادات',
      labelEn: 'Settings'
    }
  ];

  const isRtl = lang === 'ar';

  return (
    <aside
      className="no-print"
      style={{
        width: '88px',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 4px',
        position: 'fixed',
        top: '64px',
        bottom: 0,
        right: isRtl ? 0 : 'auto',
        left: isRtl ? 'auto' : 0,
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        flexShrink: 0,
        zIndex: 40,
        boxSizing: 'border-box'
      }}
    >
      {/* Navigation Items (Icon above title) */}
      <nav style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', width: '100%' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.basePath;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={lang === 'ar' ? item.labelAr : item.labelEn}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '78px',
                padding: '4px 0 6px 0',
                borderRadius: '12px',
                textDecoration: 'none',
                transition: 'var(--transition-standard)',
                cursor: 'pointer'
              }}
            >
              {/* M3 Active Indicator Pill */}
              <div
                style={{
                  width: '52px',
                  height: '30px',
                  borderRadius: 'var(--md-shape-full)',
                  backgroundColor: isActive
                    ? 'var(--md-sys-color-primary-container)'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'var(--transition-standard)'
                }}
              >
                <Icon
                  size={20}
                  color={
                    isActive
                      ? 'var(--md-sys-color-on-primary-container)'
                      : 'var(--md-sys-color-on-surface-variant)'
                  }
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
              </div>

              {/* Title Directly Under Icon (1 or 2 words) */}
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-on-surface-variant)',
                  marginTop: '3px',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.2px'
                }}
              >
                {lang === 'ar' ? item.labelAr : item.labelEn}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Quick Stats Mini Badge */}
      <div
        className="m3-card"
        title={
          lang === 'ar'
            ? `إحصائيات سريعة:\nالأفواج: ${data.groups.length} فوج\nالأساتذة: ${data.teachers.length} أستاذ\nفئات الاشتراكات: ${data.pricingTiers.length}`
            : `Quick Stats:\nGroups: ${data.groups.length}\nTeachers: ${data.teachers.length}\nPricing Tiers: ${data.pricingTiers.length}`
        }
        style={{
          width: '76px',
          padding: '8px 4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2px',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: '12px',
          textAlign: 'center',
          cursor: 'default',
          marginTop: '10px'
        }}
      >
        <Sparkles size={14} color="var(--md-sys-color-primary)" />
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--md-sys-color-primary)', whiteSpace: 'nowrap' }}>
          {data.groups.length} فوج
        </span>
        <span style={{ fontSize: '0.62rem', color: 'var(--md-sys-color-on-surface-variant)', whiteSpace: 'nowrap' }}>
          {data.teachers.length} أستاذ
        </span>
      </div>
    </aside>
  );
}

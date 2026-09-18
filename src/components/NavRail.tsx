'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CalendarCheck,
  Scan,
  Users,
  GraduationCap,
  CreditCard,
  Printer,
  Settings,
  Sparkles
} from 'lucide-react';

export default function NavRail() {
  const pathname = usePathname();
  const { lang, data } = useApp();

  const navItems = [
    {
      href: '/',
      icon: LayoutDashboard,
      labelAr: 'لوحة التحكم',
      labelEn: 'Dashboard'
    },
    {
      href: '/attendance',
      icon: CalendarCheck,
      labelAr: 'كشف الحضور والمالية',
      labelEn: 'Attendance & Finance'
    },
    {
      href: '/scanner',
      icon: Scan,
      labelAr: 'محطة مسح الباركود',
      labelEn: 'Scanner Station'
    },
    {
      href: '/groups',
      icon: Users,
      labelAr: 'الأفواج والدروس',
      labelEn: 'Groups'
    },
    {
      href: '/teachers',
      icon: GraduationCap,
      labelAr: 'الأساتذة والمستحقات',
      labelEn: 'Teachers'
    },
    {
      href: '/students',
      icon: Users,
      labelAr: 'سجل وبيانات جميع التلاميذ',
      labelEn: 'All Student Records'
    },
    {
      href: '/print',
      icon: Printer,
      labelAr: 'طباعة كشوف الحضور',
      labelEn: 'Print Rosters'
    },
    {
      href: '/admin',
      icon: Settings,
      labelAr: 'الإعدادات والأسعار',
      labelEn: 'Settings'
    }
  ];

  const isRtl = lang === 'ar';

  return (
    <aside
      className="no-print"
      style={{
        width: '260px',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        borderInlineEnd: '1px solid var(--md-sys-color-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 10px',
        position: 'fixed',
        top: '64px',
        bottom: 0,
        right: isRtl ? 0 : 'auto',
        left: isRtl ? 'auto' : 0,
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        flexShrink: 0,
        zIndex: 40,
        boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 12px',
                borderRadius: 'var(--md-shape-full)',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.84rem',
                whiteSpace: 'nowrap',
                color: isActive
                  ? 'var(--md-sys-color-on-primary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
                backgroundColor: isActive
                  ? 'var(--md-sys-color-primary-container)'
                  : 'transparent',
                transition: 'var(--transition-standard)'
              }}
            >
              <Icon size={18} color={isActive ? 'var(--md-sys-color-primary)' : 'currentColor'} />
              <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            </Link>
          );
        })}
      </div>

      {/* Center Snapshot Card */}
      <div
        className="m3-card"
        style={{
          padding: '10px 12px',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: 'var(--md-shape-md)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Sparkles size={14} color="var(--md-sys-color-primary)" />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
            {lang === 'ar' ? 'إحصائيات سريعة' : 'Quick Stats'}
          </span>
        </div>
        <div style={{ fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.5 }}>
          <div>الأفواج: <strong>{data.groups.length} فوج</strong></div>
          <div>الأساتذة: <strong>{data.teachers.length} أستاذ</strong></div>
          <div>الاشتراكات: <strong>{data.pricingTiers.length} فئات</strong></div>
        </div>
      </div>
    </aside>
  );
}

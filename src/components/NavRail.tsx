'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  CalendarCheck,
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
      icon: CreditCard,
      labelAr: 'الطلبة وسجل الديون',
      labelEn: 'Students & Debt'
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

  return (
    <aside
      className="no-print"
      style={{
        width: '260px',
        backgroundColor: 'var(--md-sys-color-surface-container-low)',
        borderLeft: '1px solid var(--md-sys-color-outline-variant)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px 12px',
        minHeight: 'calc(100vh - 64px)'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px 12px 12px',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            marginBottom: '6px'
          }}
        >
          <img
            src="/logo.svg"
            alt={data.centerName}
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
        </div>
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
                gap: '12px',
                padding: '12px 16px',
                borderRadius: 'var(--md-shape-full)',
                textDecoration: 'none',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.95rem',
                color: isActive
                  ? 'var(--md-sys-color-on-primary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
                backgroundColor: isActive
                  ? 'var(--md-sys-color-primary-container)'
                  : 'transparent',
                transition: 'var(--transition-standard)'
              }}
            >
              <Icon size={20} color={isActive ? 'var(--md-sys-color-primary)' : 'currentColor'} />
              <span>{lang === 'ar' ? item.labelAr : item.labelEn}</span>
            </Link>
          );
        })}
      </div>

      {/* Center Snapshot Card */}
      <div
        className="m3-card"
        style={{
          padding: '14px',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          border: '1px solid var(--md-sys-color-outline-variant)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Sparkles size={16} color="var(--md-sys-color-primary)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
            {lang === 'ar' ? 'إحصائيات سريعة' : 'Quick Stats'}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', lineHeight: 1.6 }}>
          <div>الأفواج: <strong>{data.groups.length} فوج</strong></div>
          <div>الأساتذة: <strong>{data.teachers.length} أستاذ</strong></div>
          <div>الاشتراكات: <strong>{data.pricingTiers.length} فئات</strong></div>
        </div>
      </div>
    </aside>
  );
}

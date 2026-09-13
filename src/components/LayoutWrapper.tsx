'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import TopAppBar from './TopAppBar';
import NavRail from './NavRail';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { theme, lang } = useApp();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      data-theme={mounted ? theme : 'light'}
      dir={mounted ? (lang === 'ar' ? 'rtl' : 'ltr') : 'rtl'}
      suppressHydrationWarning
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--md-sys-color-background)',
        color: 'var(--md-sys-color-on-background)',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <TopAppBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 64px)' }}>
        <NavRail />
        <main
          style={{
            flex: 1,
            padding: '24px',
            maxWidth: '1600px',
            margin: '0 auto',
            width: '100%',
            overflowY: 'auto'
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

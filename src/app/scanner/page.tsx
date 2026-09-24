'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

const BarcodeScannerModal = dynamic(() => import('../../components/BarcodeScannerModal'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        padding: '48px',
        textAlign: 'center',
        fontWeight: 800,
        color: 'var(--md-sys-color-on-surface-variant)'
      }}
    >
      جاري تحميل محطة مسح الباركود...
    </div>
  )
});

function ScannerScreenContent() {
  const searchParams = useSearchParams();
  const groupId = searchParams?.get('groupId') || undefined;

  return <BarcodeScannerModal initialGroupId={groupId} isScreen={true} />;
}

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            fontWeight: 800,
            color: 'var(--md-sys-color-on-surface-variant)'
          }}
        >
          جاري تحميل محطة مسح الباركود...
        </div>
      }
    >
      <ScannerScreenContent />
    </Suspense>
  );
}

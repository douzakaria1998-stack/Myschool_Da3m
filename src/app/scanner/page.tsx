'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';

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

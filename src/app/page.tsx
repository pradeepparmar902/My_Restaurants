import React from 'react';
import { TadkaProvider } from '@/context/TadkaContext';
import { TadkaShell } from '@/components/TadkaShell';

export default function HomePage() {
  return (
    <TadkaProvider>
      <TadkaShell />
    </TadkaProvider>
  );
}

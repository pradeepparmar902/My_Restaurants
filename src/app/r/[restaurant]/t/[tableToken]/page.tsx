import React from 'react';
import { TadkaProvider } from '@/context/TadkaContext';
import { TadkaShell } from '@/components/TadkaShell';
import { INITIAL_TABLES } from '@/lib/constants';

export function generateStaticParams() {
  return INITIAL_TABLES.map((t) => ({
    restaurant: 'tadka-truck',
    tableToken: t.token,
  }));
}

export default async function TableQrLandingPage({
  params,
}: {
  params: Promise<{ restaurant: string; tableToken: string }>;
}) {
  const { tableToken } = await params;
  const matchedTable = INITIAL_TABLES.find(
    (t) =>
      t.token === tableToken ||
      `t${t.id}` === tableToken.toLowerCase() ||
      String(t.id) === tableToken
  );

  if (!matchedTable) {
    return (
      <div id="app">
        <div
          className="hero"
          style={{ background: 'linear-gradient(135deg,#ff5c8a,#ff8a4c)' }}
        >
          <h1>Unknown table</h1>
          <p>Unknown table, please ask the staff for a valid QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <TadkaProvider initialTableId={matchedTable.id}>
      <TadkaShell />
    </TadkaProvider>
  );
}

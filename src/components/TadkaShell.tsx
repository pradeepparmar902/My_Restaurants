'use client';

import React from 'react';
import { useTadka } from '@/context/TadkaContext';
import { CustomerTab } from '@/types/tadka';
import { isSessionGated } from '@/lib/helpers';
import {
  BillReadyBanner,
  LoginBar,
  LoginScreen,
  PendingCounterBanner,
  RoleBar,
  StarsStrip,
} from '@/components/SharedWidgets';
import {
  BillTabView,
  MenuTabView,
  OrderTabView,
  RewardsTabView,
} from '@/components/CustomerPortal';
import {
  AdminPortalView,
  ChefPortalView,
  OwnerPortalView,
  SuperAdminPortalView,
  WaiterPortalView,
} from '@/components/StaffPortals';

export function TadkaShell() {
  const { S, setTab, cnt, say } = useTadka();
  const gated = isSessionGated(S);
  const draftCount = cnt();

  const tabs: [CustomerTab, string, string][] = [
    ['menu', '🍽️', 'Menu'],
    ['order', '🧾', 'Order'],
    ['reward', '🎁', 'Rewards'],
    ['bill', '💳', 'Bill'],
  ];

  return (
    <div id="app">
      {S.toast && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => say('')}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              color: '#0f172a',
              borderRadius: '24px',
              padding: '26px 22px 20px',
              width: '100%',
              maxWidth: '310px',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                background:
                  S.toast.includes('🟢') || S.toast.includes('Activated') || S.toast.includes('✓') || S.toast.includes('🎉')
                    ? '#dcfce7'
                    : S.toast.includes('🔒') || S.toast.includes('Locked') || S.toast.includes('not activated')
                    ? '#fee2e2'
                    : '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              }}
            >
              {S.toast.includes('🔒') || S.toast.includes('not activated') || S.toast.includes('Locked')
                ? '🔒'
                : S.toast.includes('🟢') || S.toast.includes('Activated') || S.toast.includes('🎉')
                ? '🟢'
                : S.toast.includes('🛒') || S.toast.includes('Order')
                ? '🛒'
                : '🔔'}
            </div>

            <div style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a', lineHeight: 1.25 }}>
              {S.toast.includes('🔒') || S.toast.includes('not activated') || S.toast.includes('Locked')
                ? 'Table Locked'
                : S.toast.includes('🟢') || S.toast.includes('Activated') || S.toast.includes('🎉')
                ? 'Table Activated'
                : 'Notice'}
            </div>

            <div
              style={{
                fontSize: '13.5px',
                color: '#475569',
                lineHeight: 1.5,
                fontWeight: 500,
                wordBreak: 'break-word',
              }}
            >
              {S.toast}
            </div>

            <button
              type="button"
              onClick={() => say('')}
              style={{
                marginTop: '6px',
                width: '100%',
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '11px 16px',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
              }}
            >
              Understood / OK
            </button>
          </div>
        </div>
      )}

      <LoginBar />
      <RoleBar />

      {S.role === 'c' ? (
        gated || S.showLogin ? (
          <LoginScreen />
        ) : (
          <>
            <StarsStrip />
            <PendingCounterBanner />
            <BillReadyBanner />
            {S.tab === 'menu' && <MenuTabView />}
            {S.tab === 'order' && <OrderTabView />}
            {S.tab === 'reward' && <RewardsTabView />}
            {S.tab === 'bill' && <BillTabView />}
          </>
        )
      ) : S.role === 'k' ? (
        <ChefPortalView />
      ) : S.role === 'w' ? (
        <WaiterPortalView />
      ) : S.role === 'a' ? (
        <AdminPortalView />
      ) : S.role === 'sa' ? (
        <SuperAdminPortalView />
      ) : (
        <OwnerPortalView />
      )}

      {S.role === 'c' && !gated && !S.showLogin && (
        <nav>
          {tabs.map(([k, icon, label]) => (
            <button
              key={k}
              className={S.tab === k ? 'on' : ''}
              onClick={() => setTab(k)}
            >
              <span>{icon}</span>
              {label}
              {k === 'menu' && draftCount > 0 ? ` (${draftCount})` : ''}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

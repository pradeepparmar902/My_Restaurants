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
  WaiterPortalView,
} from '@/components/StaffPortals';

export function TadkaShell() {
  const { S, setTab, cnt } = useTadka();
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
        <div className="toast" role="status">
          {S.toast}
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

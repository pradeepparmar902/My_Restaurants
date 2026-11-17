'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  CustomerTab,
  WaiterTab,
  Language,
  PortalRole,
  CounterMode,
  PaymentMethod,
  StaffRoleName,
  Dish,
} from '@/types/tadka';
import { INITIAL_STATE, ORDER_STATUS_LABELS } from '@/lib/constants';
import {
  cleanCounterNumber,
  extractUserSessionSnapshot,
  filterPositiveItems,
  formatIndianDateTime,
  formatItemsSummary,
  getActiveStaffMember,
  getAllowedPortals,
  getCurrentBusinessDate,
  getDiscount,
  getDraftCount,
  getGST,
  getSubtotal,
  getTotal,
  normalizeMobile,
  switchUserSessionInState,
} from '@/lib/helpers';
import {
  buildSheetRowsForState,
  extractSpreadsheetIdFromUrl,
  parseConfigFromSheetRows,
  parseCsvToRows,
  parseDailyCountersAndStateFromSheets,
  ParsedSheetCounterState,
  parseMenuFromSheetRows,
  parseStaffFromSheetRows,
} from '@/lib/googleSheetsShared';

interface TadkaContextValue {
  S: AppState;
  say: (msg: string) => void;
  updateState: (updater: (prev: AppState) => AppState) => void;

  // Computed values
  sub: () => number;
  dsub: () => number;
  cnt: () => number;
  disc: () => number;
  gst: () => number;
  total: () => number;
  staffOf: () => ReturnType<typeof getActiveStaffMember>;
  portals: () => PortalRole[];

  // Actions matching prototype & PRD
  setRole: (role: PortalRole) => void;
  setTab: (tab: CustomerTab) => void;
  setWTab: (wtab: WaiterTab) => void;
  setLang: (lang: Language) => void;
  toggleVeg: () => void;
  setCountryCode: (cc: string) => void;

  // Ordering & Cart
  changeDraftQty: (dishId: number, delta: number) => void;
  placeOrder: (optionalMobRaw?: string, waConsent?: boolean) => void;
  inviteMemberToSession: (rawMob: string) => void;
  removeInvitedMember: (mobToRemove: string) => void;
  trackCounter: (rawCounter: string) => void;

  // Counter numbers
  setMode: (mode: CounterMode) => void;
  assignNo: () => void;
  setNo: (rawValue: string) => void;
  reissueNumber: () => void;

  // Kitchen & Floor
  advanceOrderStatus: (orderIndex: number, nextStatus: 1 | 2 | 3 | 4 | 5) => void;
  toggleOrderRush: (orderIndex: number) => void;
  toggleDishStock: (dishId: number) => void;

  // Waiter booking
  changeWaiterDraftQty: (dishId: number, delta: number) => void;
  bookWaiter: (rawMob: string, rawCounterNo: string) => void;

  // Billing & Payments
  pushWaiter: (rawMob?: string) => void;
  cancelWaiter: () => void;
  doPay: (method: PaymentMethod, by: 'app' | 'owner') => void;
  paySamp: (index: number) => void;
  sendBill: (rawMob: string) => void;
  startNewOrder: () => void;

  // Auth & Staff Admin
  sendOtp: (rawMob: string) => void;
  verifyOtp: (otpInput: string) => void;
  logoutOrOpenLogin: () => void;
  addStaff: (name: string, rawMob: string) => void;
  toggleManagerAccess: (staffIndex: number) => void;
  toggleStaffActive: (staffIndex: number) => void;
  checkLogin: (rawMob: string) => void;

  // Menu & Table Admin
  saveMenuDish: (dish: Partial<Dish> & { id?: number }) => void;
  addTable: (label: string, manualId?: number) => void;
  updateTable: (oldId: number, newLabel: string, newId?: number) => void;
  removeTable: (tableId: number) => void;
  resetTables: () => void;
  regenerateTableQr: (tableId: number) => void;
  setActiveTable: (tableId: number) => void;
  resetDemoState: () => void;

  // Google Sheets & Google Drive Storage
  syncToGoogleSheets: (overrideConfig?: Partial<AppState['googleConfig']>) => Promise<void>;
  pullFromGoogleSheets: (
    overrideConfig?: Partial<AppState['googleConfig']>,
    silent?: boolean
  ) => Promise<void>;
  uploadMediaToDrive: (payload: {
    fileName: string;
    kind: 'reel' | 'snap' | 'dish_photo' | 'receipt_pdf';
    mimeType?: string;
    base64Data?: string;
    caption?: string;
  }) => Promise<void>;
  saveGoogleConfig: (cfg: Partial<AppState['googleConfig']>) => void;
}

const STORAGE_KEY = 'tadka_production_state_v1';
const CHANNEL_NAME = 'tadka_realtime_channel';

const TadkaContext = createContext<TadkaContextValue | null>(null);

export function TadkaProvider({
  children,
  initialTableId,
}: {
  children: React.ReactNode;
  initialTableId?: number;
}) {
  const [S, setS] = useState<AppState>(() => {
    if (initialTableId) {
      return { ...INITIAL_STATE, activeTable: initialTableId };
    }
    return INITIAL_STATE;
  });

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const isHydratedRef = useRef(false);
  const pendingOrderAfterLoginRef = useRef<{ waConsent?: boolean } | null>(null);
  const placeOrderRef = useRef<((optionalMobRaw?: string, waConsent?: boolean) => void) | null>(null);
  const pullFromGoogleSheetsRef = useRef<
    ((overrideConfig?: Partial<AppState['googleConfig']>, silent?: boolean) => Promise<void>) | null
  >(null);

  // Hydrate from localStorage + setup BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        const todayBizDate = getCurrentBusinessDate();

        // Sanitize legacy C27/C28/C29 prototype demo counter state if no real Daily_Counters exist for >= 27
        const hasLegacyCtr =
          typeof parsed.ctr === 'number' &&
          parsed.ctr >= 27 &&
          (parsed.dailyOrderHistory || []).length < 10;
        const cleanCtr =
          parsed.counterBusinessDate !== todayBizDate || hasLegacyCtr
            ? 1
            : parsed.ctr || 1;
        const cleanUsed = (
          parsed.counterBusinessDate === todayBizDate
            ? parsed.usedCountersToday || []
            : []
        ).filter((c) => !hasLegacyCtr || !/^C2[4-9]$/i.test(c));

        // Also clean any legacy C27/C28/C29 in sessionsByUser if migrating from prototype
        const cleanedSessionsByUser = { ...(parsed.sessionsByUser || {}) };
        if (hasLegacyCtr) {
          for (const k of Object.keys(cleanedSessionsByUser)) {
            const snap = cleanedSessionsByUser[k];
            if (snap?.sess?.no && /^C2[4-9]$/i.test(snap.sess.no)) {
              delete cleanedSessionsByUser[k];
            }
          }
        }
        const cleanedActiveSess =
          hasLegacyCtr && parsed.sess?.no && /^C2[4-9]$/i.test(parsed.sess.no)
            ? null
            : parsed.sess ?? null;

        // Check if user arrived via QR query string (?t=<token>&table=<id>&label=<label>)
        let qrMatchedTableId: number | undefined;
        let qrDynamicTables: AppState['tables'] | undefined;
        if (typeof window !== 'undefined') {
          const sp = new URLSearchParams(window.location.search);
          const qToken = sp.get('t') || '';
          const qTable = sp.get('table');
          const qLabel = sp.get('label');
          const tableList = [...(parsed.tables || INITIAL_STATE.tables)];

          if (qToken) {
            const found = tableList.find((tb) => tb.token === qToken);
            if (found) {
              qrMatchedTableId = found.id;
            } else {
              // Extract table number from token like qr-tadka-t7-m05a or ?table=7
              const tokenNumMatch = qToken.match(/-t(\d+)-/i);
              const derivedId =
                (qTable && Number(qTable) > 0 ? Number(qTable) : 0) ||
                (tokenNumMatch ? Number(tokenNumMatch[1]) : 0) ||
                1;
              qrMatchedTableId = derivedId;
              const derivedLabel = qLabel || `Table ${derivedId}`;
              const existingIdx = tableList.findIndex((tb) => tb.id === derivedId);
              if (existingIdx !== -1) {
                tableList[existingIdx] = {
                  ...tableList[existingIdx],
                  label: derivedLabel,
                  token: qToken,
                };
              } else {
                tableList.push({
                  id: derivedId,
                  label: derivedLabel,
                  token: qToken,
                });
              }
              qrDynamicTables = tableList;
            }
          } else if (qTable && Number(qTable) > 0) {
            qrMatchedTableId = Number(qTable);
          }
        }

        const resolvedTableId =
          initialTableId ||
          qrMatchedTableId ||
          parsed.activeTable ||
          INITIAL_STATE.activeTable;

        // Never show a stale or already-paid counter number before placing an order on a fresh QR scan
        const shouldClearStaleSession =
          Boolean(parsed.paid) ||
          parsed.sess?.status === 'paid' ||
          ((initialTableId || qrMatchedTableId) &&
            parsed.sess &&
            parsed.sess.table !== resolvedTableId);

        const finalHydratedSess = shouldClearStaleSession
          ? null
          : cleanedActiveSess;

        setS((prev) => ({
          ...prev,
          ...parsed,
          tables: qrDynamicTables || parsed.tables || prev.tables,
          ctr: cleanCtr,
          counterBusinessDate: todayBizDate,
          usedCountersToday: cleanUsed,
          sessionsByUser: cleanedSessionsByUser,
          sess: finalHydratedSess,
          orders: finalHydratedSess ? parsed.orders || [] : [],
          cart: finalHydratedSess ? parsed.cart || {} : {},
          status: finalHydratedSess ? parsed.status || 0 : 0,
          paid: finalHydratedSess ? Boolean(parsed.paid) : false,
          billSrc: finalHydratedSess ? parsed.billSrc || '' : '',
          activeTable: resolvedTableId,
          toast: '',
        }));
      } else if (typeof window !== 'undefined' && !initialTableId) {
        const sp = new URLSearchParams(window.location.search);
        const qToken = sp.get('t') || '';
        const qTable = sp.get('table');
        const qLabel = sp.get('label');
        if (qToken) {
          const tableList = [...INITIAL_STATE.tables];
          const found = tableList.find((tb) => tb.token === qToken);
          if (found) {
            setS((prev) => ({ ...prev, activeTable: found.id }));
          } else {
            const tokenNumMatch = qToken.match(/-t(\d+)-/i);
            const derivedId =
              (qTable && Number(qTable) > 0 ? Number(qTable) : 0) ||
              (tokenNumMatch ? Number(tokenNumMatch[1]) : 0) ||
              1;
            const derivedLabel = qLabel || `Table ${derivedId}`;
            const existingIdx = tableList.findIndex((tb) => tb.id === derivedId);
            if (existingIdx !== -1) {
              tableList[existingIdx] = {
                ...tableList[existingIdx],
                label: derivedLabel,
                token: qToken,
              };
            } else {
              tableList.push({
                id: derivedId,
                label: derivedLabel,
                token: qToken,
              });
            }
            setS((prev) => ({
              ...prev,
              tables: tableList,
              activeTable: derivedId,
            }));
          }
        } else if (qTable && Number(qTable) > 0) {
          setS((prev) => ({ ...prev, activeTable: Number(qTable) }));
        }
      }
    } catch {
      // Ignore storage read errors
    }
    isHydratedRef.current = true;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'STATE_SYNC') {
          setS((prev) => ({
            ...ev.data.payload,
            role: prev.role,
            tab: prev.tab,
            wtab: prev.wtab,
            me: prev.me,
            showLogin: prev.showLogin,
            toast: prev.toast,
          }));
        }
      };
      channelRef.current = bc;
      return () => bc.close();
    }
  }, [initialTableId]);

  // Persist to localStorage & broadcast changes
  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setS((prev) => {
      const next = updater(prev);
      const staffMember = getActiveStaffMember(next.staff, next.me.mob);
      const allowed = getAllowedPortals(staffMember);
      const validatedRole = allowed.includes(next.role) ? next.role : 'c';
      const activeUserKey = next.sess?.mob || next.me.mob || '__guest__';
      const syncedSessionsByUser = {
        ...(next.sessionsByUser || {}),
        ...(next.sess || next.orders.length > 0
          ? { [activeUserKey]: extractUserSessionSnapshot(next) }
          : {}),
      };
      const finalState = {
        ...next,
        role: validatedRole,
        sessionsByUser: syncedSessionsByUser,
      };

      if (isHydratedRef.current && typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
          channelRef.current?.postMessage({ type: 'STATE_SYNC', payload: finalState });
          // Background auto-sync to Google Sheets & local CSV mirror ONLY when business data actually changes (not on UI tab/draft clicks)
          const hasDataMutation =
            prev.orders !== next.orders ||
            prev.menu !== next.menu ||
            prev.staff !== next.staff ||
            prev.sess !== next.sess ||
            prev.hist !== next.hist ||
            prev.paid !== next.paid ||
            prev.billSrc !== next.billSrc ||
            prev.reel !== next.reel ||
            prev.review !== next.review;

          if (finalState.googleConfig?.enabled && hasDataMutation) {
            const webhookUrl = finalState.googleConfig.appsScriptWebAppUrl || '';
            if (webhookUrl.startsWith('https://script.google.com/')) {
              const sheetsPayload = buildSheetRowsForState(finalState);
              fetch(webhookUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                  action: 'SYNC_ALL_SHEETS',
                  spreadsheetId: finalState.googleConfig.spreadsheetId,
                  driveFolderId: finalState.googleConfig.driveFolderId,
                  sheets: sheetsPayload,
                  timestamp: new Date().toISOString(),
                }),
              }).catch(() => {});
            }
            fetch('/api/storage/sheets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                googleConfig: finalState.googleConfig,
                clientState: {
                  menu: finalState.menu,
                  staff: finalState.staff,
                  orders: finalState.orders,
                  cart: finalState.cart,
                  sess: finalState.sess,
                  hist: finalState.hist,
                  driveAssets: finalState.driveAssets,
                },
              }),
            }).catch(() => {});
          }
        } catch {
          // Ignore quota errors
        }
      }
      return finalState;
    });
  }, []);

  const say = useCallback((msg: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setS((prev) => ({ ...prev, toast: msg }));
    toastTimerRef.current = setTimeout(() => {
      setS((prev) => ({ ...prev, toast: '' }));
    }, 1800);
  }, []);

  const sub = useCallback(() => getSubtotal(S.menu, S.cart), [S.menu, S.cart]);
  const dsub = useCallback(() => getSubtotal(S.menu, S.draft), [S.menu, S.draft]);
  const cnt = useCallback(() => getDraftCount(S.draft), [S.draft]);
  const disc = useCallback(
    () => getDiscount(getSubtotal(S.menu, S.cart), S.reel, S.review),
    [S.menu, S.cart, S.reel, S.review]
  );
  const gst = useCallback(() => {
    const s = getSubtotal(S.menu, S.cart);
    const d = getDiscount(s, S.reel, S.review);
    return getGST(s, d);
  }, [S.menu, S.cart, S.reel, S.review]);
  const total = useCallback(() => {
    const s = getSubtotal(S.menu, S.cart);
    const d = getDiscount(s, S.reel, S.review);
    return getTotal(s, d);
  }, [S.menu, S.cart, S.reel, S.review]);

  const staffOf = useCallback(() => getActiveStaffMember(S.staff, S.me.mob), [S.staff, S.me.mob]);
  const portals = useCallback(() => getAllowedPortals(staffOf()), [staffOf]);

  const setRole = useCallback(
    (role: PortalRole) => {
      updateState((prev) => ({ ...prev, role }));
    },
    [updateState]
  );

  const setTab = useCallback(
    (tab: CustomerTab) => {
      updateState((prev) => ({ ...prev, tab }));
    },
    [updateState]
  );

  const setWTab = useCallback(
    (wtab: WaiterTab) => {
      updateState((prev) => ({ ...prev, wtab }));
    },
    [updateState]
  );

  const setLang = useCallback(
    (lang: Language) => {
      updateState((prev) => ({ ...prev, lang }));
    },
    [updateState]
  );

  const toggleVeg = useCallback(() => {
    updateState((prev) => ({ ...prev, veg: !prev.veg }));
  }, [updateState]);

  const setCountryCode = useCallback(
    (cc: string) => {
      updateState((prev) => ({ ...prev, cc }));
    },
    [updateState]
  );

  const changeDraftQty = useCallback(
    (dishId: number, delta: number) => {
      updateState((prev) => {
        const current = prev.draft[dishId] || 0;
        const nextQty = Math.max(0, Math.min(20, current + delta));
        const nextDraft = { ...prev.draft, [dishId]: nextQty };
        if (nextQty === 0) delete nextDraft[dishId];
        return { ...prev, draft: nextDraft };
      });
    },
    [updateState]
  );

  const placeOrder = useCallback(
    (optionalMobRaw?: string, waConsent?: boolean) => {
      if (S.billSrc === 'waiter' && !S.paid) {
        say('The bill was already sent. Ask staff to recall it before adding items');
        return;
      }

      const it = filterPositiveItems(S.draft);
      if (Object.keys(it).length === 0) return;

      // Require user to be logged in before placing an order
      if (!S.me.mob && !(optionalMobRaw && optionalMobRaw.trim())) {
        pendingOrderAfterLoginRef.current = { waConsent };
        updateState((prev) => ({
          ...prev,
          showLogin: true,
          lg: { step: 0, mob: '' },
        }));
        say('Please login with your mobile number to place your order 📱');
        return;
      }

      // Check availability
      for (const idStr of Object.keys(it)) {
        const dish = S.menu.find((m) => m.id === Number(idStr));
        if (!dish || !dish.available) {
          say('An item is unavailable');
          return;
        }
      }

      let normalizedOptionalMob = '';
      if (optionalMobRaw && optionalMobRaw.trim()) {
        if (optionalMobRaw.trim().startsWith('+')) {
          normalizedOptionalMob = optionalMobRaw.trim();
        } else {
          const m = normalizeMobile(optionalMobRaw, S.cc);
          if (m === null) {
            say('Enter a valid 10-digit mobile number');
            return;
          }
          normalizedOptionalMob = m;
        }
      }

      updateState((prev) => {
        const todayBizDate = getCurrentBusinessDate();
        const isNewBusinessDay = prev.counterBusinessDate !== todayBizDate;
        let nextCtr = isNewBusinessDay ? 1 : prev.ctr;
        const usedToday = isNewBusinessDay
          ? []
          : [...(prev.usedCountersToday || [])];

        // Also scan all known open sessions & today's history so no counter number can EVER collide
        Object.values(prev.sessionsByUser || {}).forEach((snap) => {
          if (snap.sess?.no && snap.sess.no !== 'Pending') {
            if (!usedToday.includes(snap.sess.no)) usedToday.push(snap.sess.no);
            const m = snap.sess.no.match(/^C(\d+)$/i);
            if (m && Number(m[1]) >= nextCtr) nextCtr = Number(m[1]) + 1;
          }
        });
        (prev.dailyOrderHistory || []).forEach((h) => {
          if (h.businessDate === todayBizDate && h.counterNo && h.counterNo !== 'Pending') {
            if (!usedToday.includes(h.counterNo)) usedToday.push(h.counterNo);
            const m = h.counterNo.match(/^C(\d+)$/i);
            if (m && Number(m[1]) >= nextCtr) nextCtr = Number(m[1]) + 1;
          }
        });

        let nextSess = prev.sess;
        const activeUserMob = normalizedOptionalMob || prev.me.mob;
        const isInvitedMember = Boolean(
          nextSess &&
            activeUserMob &&
            (nextSess.invitedMobs || []).includes(activeUserMob)
        );
        const isPrincipal = Boolean(
          nextSess && nextSess.mob && activeUserMob && nextSess.mob === activeUserMob
        );

        // NEVER reuse a session if:
        // 1) It is already PAID (prev.paid or nextSess.status === 'paid')
        // 2) It belongs to a different user who did NOT invite activeUserMob
        if (
          nextSess &&
          (prev.paid ||
            nextSess.status === 'paid' ||
            (nextSess.mob && !isPrincipal && !isInvitedMember) ||
            (nextSess.mob && !activeUserMob))
        ) {
          nextSess = null;
        }
        const isStartingNewSess = !nextSess;
        if (!nextSess) {
          const isAuto = prev.cmode === 'auto';
          let assignedNo = 'Pending';
          if (isAuto) {
            while (usedToday.includes(`C${nextCtr}`)) {
              nextCtr++;
            }
            assignedNo = `C${nextCtr++}`;
            usedToday.push(assignedNo);
          }
          nextSess = {
            id: `sess-${Date.now()}`,
            no: assignedNo,
            pend: !isAuto,
            table: prev.activeTable,
            mob: activeUserMob,
            invitedMobs: [],
            waConsent: waConsent ?? prev.waOptIn,
            status: 'open',
            businessDate: todayBizDate,
            createdAt: new Date().toISOString(),
          };
        } else if (normalizedOptionalMob && !nextSess.mob) {
          nextSess = { ...nextSess, mob: normalizedOptionalMob };
        }

        const baseOrders = isStartingNewSess ? [] : prev.orders;
        const nextCart = isStartingNewSess ? {} : { ...prev.cart };
        const pricesSnapshot: Record<number, number> = {};
        for (const idStr of Object.keys(it)) {
          const id = Number(idStr);
          nextCart[id] = (nextCart[id] || 0) + it[id];
          const dish = prev.menu.find((m) => m.id === id);
          if (dish) pricesSnapshot[id] = dish.p;
        }

        const nowIso = new Date().toISOString();
        const orderSeq = baseOrders.length + 1;
        const orderId = `ord-${Date.now()}-${orderSeq}`;

        const newOrder = {
          id: orderId,
          k: orderSeq,
          it,
          prices: pricesSnapshot,
          st: 1 as const,
          src: 'app' as const,
          orderedByMob: activeUserMob,
          vip: prev.pts >= 100,
          rush: false,
          createdAt: nowIso,
        };

        const { dateFormatted, timeFormatted } = formatIndianDateTime(nowIso);
        const { summary, totalQty, subtotal: ordSub } = formatItemsSummary(
          prev.menu,
          it,
          pricesSnapshot
        );

        const principalMobLabel = nextSess.mob || prev.me.mob || 'Guest';
        const customerMobWithMember =
          activeUserMob && nextSess.mob && activeUserMob !== nextSess.mob
            ? `${principalMobLabel} (via ${activeUserMob})`
            : principalMobLabel;

        const nextHistory = [
          {
            id: orderId,
            businessDate: nextSess.businessDate || todayBizDate,
            dateFormatted,
            timeFormatted,
            counterNo: nextSess.no,
            tableNo: prev.activeTable,
            orderSeq,
            source: 'app' as const,
            customerMob: customerMobWithMember,
            itemsDetailed: summary,
            totalItemsQty: totalQty,
            orderSubtotal: ordSub,
            orderStatus: 'Received',
            billStatus: 'UNPAID' as const,
            paymentMethod: 'Pending',
            createdAt: nowIso,
          },
          ...(prev.dailyOrderHistory || []),
        ];

        // Fire-and-forget server sync
        fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: it, mob: nextSess.mob, waConsent }),
        }).catch(() => {});

        return {
          ...prev,
          ctr: nextCtr,
          counterBusinessDate: todayBizDate,
          usedCountersToday: usedToday,
          dailyOrderHistory: nextHistory,
          sess: nextSess,
          cart: nextCart,
          orders: [...baseOrders, newOrder],
          draft: {},
          status: 1,
          paid: false,
          billSrc: isStartingNewSess ? '' : prev.billSrc,
          tab: 'order',
        };
      });
    },
    [S.billSrc, S.paid, S.draft, S.menu, S.cc, S.me.mob, say, updateState]
  );

  placeOrderRef.current = placeOrder;

  const inviteMemberToSession = useCallback(
    (rawMob: string) => {
      if (!S.sess || S.paid) {
        say('Place an order first before inviting table friends');
        return;
      }
      const m = normalizeMobile(rawMob, S.cc);
      if (!m) {
        say('Enter a valid 10-digit mobile number to invite');
        return;
      }
      if (m === S.sess.mob) {
        say('That is already the principal mobile number');
        return;
      }
      if ((S.sess.invitedMobs || []).includes(m)) {
        say(`${m} is already invited to this table`);
        return;
      }
      updateState((prev) => {
        if (!prev.sess) return prev;
        const nextInvited = [...(prev.sess.invitedMobs || []), m];
        return {
          ...prev,
          sess: { ...prev.sess, invitedMobs: nextInvited },
        };
      });
      say(`Invited ${m} to Counter ${S.sess.no} (Clubbed Bill) ✅`);
    },
    [S.sess, S.paid, S.cc, say, updateState]
  );

  const removeInvitedMember = useCallback(
    (mobToRemove: string) => {
      updateState((prev) => {
        if (!prev.sess) return prev;
        return {
          ...prev,
          sess: {
            ...prev.sess,
            invitedMobs: (prev.sess.invitedMobs || []).filter(
              (x) => x !== mobToRemove
            ),
          },
        };
      });
      say(`Removed ${mobToRemove} from table invite`);
    },
    [say, updateState]
  );

  const trackCounter = useCallback(
    (rawCounter: string) => {
      const v = cleanCounterNumber(rawCounter);
      updateState((prev) => {
        const ST = ['', 'Received', 'Cooking', 'Ready', 'Delivered', 'Cancelled'];
        const trackRes =
          prev.sess && !prev.sess.pend && v === prev.sess.no
            ? prev.orders.map((o) => `Order ${o.k}: ${ST[o.st]}`).join(' · ')
            : `No open order found for ${v || 'that number'}. Check the number on your receipt.`;
        return { ...prev, track: v, trackRes };
      });
    },
    [updateState]
  );

  const setMode = useCallback(
    (mode: CounterMode) => {
      updateState((prev) => {
        let nextCtr = prev.ctr;
        let nextSess = prev.sess;
        if (mode === 'auto' && nextSess && nextSess.pend) {
          nextSess = { ...nextSess, no: `C${nextCtr++}`, pend: false };
        }
        fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cmode: mode }),
        }).catch(() => {});
        return { ...prev, cmode: mode, ctr: nextCtr, sess: nextSess };
      });
    },
    [updateState]
  );

  const assignNo = useCallback(() => {
    let assigned = '';
    updateState((prev) => {
      const todayBizDate = getCurrentBusinessDate();
      const isNewBusinessDay = prev.counterBusinessDate !== todayBizDate;
      let nextCtr = isNewBusinessDay ? 1 : prev.ctr;
      const usedToday = isNewBusinessDay
        ? []
        : [...(prev.usedCountersToday || [])];

      while (usedToday.includes(`C${nextCtr}`)) {
        nextCtr++;
      }
      assigned = `C${nextCtr++}`;
      usedToday.push(assigned);

      const nextSess = prev.sess
        ? { ...prev.sess, no: assigned, pend: false }
        : {
            id: `sess-${Date.now()}`,
            no: assigned,
            pend: false,
            table: prev.activeTable,
            mob: '',
            status: 'open' as const,
            businessDate: todayBizDate,
            createdAt: new Date().toISOString(),
          };

      const nextHistory = (prev.dailyOrderHistory || []).map((h) =>
        h.counterNo === 'Pending' ? { ...h, counterNo: assigned } : h
      );

      return {
        ...prev,
        ctr: nextCtr,
        counterBusinessDate: todayBizDate,
        usedCountersToday: usedToday,
        dailyOrderHistory: nextHistory,
        sess: nextSess,
      };
    });
    if (assigned) say(`Assigned ${assigned} ✅`);
  }, [say, updateState]);

  const setNo = useCallback(
    (rawValue: string) => {
      const v = cleanCounterNumber(rawValue);
      if (!v) {
        say('Enter the number you were given');
        return;
      }
      const todayBizDate = getCurrentBusinessDate();
      const usedToday =
        S.counterBusinessDate === todayBizDate
          ? S.usedCountersToday || []
          : [];
      if (
        S.samp.some((x) => x.no.toUpperCase() === v) ||
        (usedToday.includes(v) && S.sess?.no !== v)
      ) {
        say('That counter number is already in use today');
        return;
      }
      updateState((prev) => {
        const nextUsed = usedToday.includes(v) ? usedToday : [...usedToday, v];
        const nextHistory = (prev.dailyOrderHistory || []).map((h) =>
          h.counterNo === 'Pending' ? { ...h, counterNo: v } : h
        );
        return {
          ...prev,
          counterBusinessDate: todayBizDate,
          usedCountersToday: nextUsed,
          dailyOrderHistory: nextHistory,
          sess: prev.sess ? { ...prev.sess, no: v, pend: false } : prev.sess,
        };
      });
      say(`Counter ${v} saved ✅`);
    },
    [S.samp, S.counterBusinessDate, S.usedCountersToday, S.sess?.no, say, updateState]
  );

  const reissueNumber = useCallback(() => {
    updateState((prev) => {
      if (!prev.sess) return prev;
      const todayBizDate = getCurrentBusinessDate();
      const isNewBusinessDay = prev.counterBusinessDate !== todayBizDate;
      let nextCtr = isNewBusinessDay ? 1 : prev.ctr;
      const usedToday = isNewBusinessDay
        ? []
        : [...(prev.usedCountersToday || [])];

      let reissued = { no: 'Pending', pend: true };
      if (prev.cmode === 'auto') {
        while (usedToday.includes(`C${nextCtr}`)) {
          nextCtr++;
        }
        const newNo = `C${nextCtr++}`;
        usedToday.push(newNo);
        reissued = { no: newNo, pend: false };
      }

      return {
        ...prev,
        ctr: nextCtr,
        counterBusinessDate: todayBizDate,
        usedCountersToday: usedToday,
        sess: { ...prev.sess, ...reissued },
      };
    });
  }, [updateState]);

  const advanceOrderStatus = useCallback(
    (orderIndex: number, nextStatus: 1 | 2 | 3 | 4 | 5) => {
      updateState((prev) => {
        const targetOrder = prev.orders[orderIndex];
        const nextOrders = prev.orders.map((o, idx) =>
          idx === orderIndex ? { ...o, st: nextStatus } : o
        );
        const nextHistory = (prev.dailyOrderHistory || []).map((h) =>
          targetOrder && h.id === targetOrder.id
            ? {
                ...h,
                orderStatus: ORDER_STATUS_LABELS[nextStatus] || String(nextStatus),
              }
            : h
        );
        return {
          ...prev,
          orders: nextOrders,
          dailyOrderHistory: nextHistory,
          status: nextStatus,
        };
      });
    },
    [updateState]
  );

  const toggleOrderRush = useCallback(
    (orderIndex: number) => {
      updateState((prev) => {
        const nextOrders = prev.orders.map((o, idx) =>
          idx === orderIndex ? { ...o, rush: !o.rush } : o
        );
        return { ...prev, orders: nextOrders };
      });
    },
    [updateState]
  );

  const toggleDishStock = useCallback(
    (dishId: number) => {
      updateState((prev) => {
        const nextMenu = prev.menu.map((m) =>
          m.id === dishId ? { ...m, available: !m.available } : m
        );
        const target = nextMenu.find((m) => m.id === dishId);
        if (target) {
          fetch('/api/admin/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dish: target }),
          }).catch(() => {});
        }
        return { ...prev, menu: nextMenu };
      });
    },
    [updateState]
  );

  const changeWaiterDraftQty = useCallback(
    (dishId: number, delta: number) => {
      updateState((prev) => {
        const current = prev.WD[dishId] || 0;
        const nextQty = Math.max(0, Math.min(20, current + delta));
        const nextWD = { ...prev.WD, [dishId]: nextQty };
        if (nextQty === 0) delete nextWD[dishId];
        return { ...prev, WD: nextWD };
      });
    },
    [updateState]
  );

  const bookWaiter = useCallback(
    (rawMob: string, rawCounterNo: string) => {
      const mv = normalizeMobile(rawMob, S.cc);
      if (mv === null) {
        say('Enter a valid 10-digit mobile number');
        return;
      }
      const it = filterPositiveItems(S.WD);
      if (Object.keys(it).length === 0) return;

      let targetLabel = `Table ${S.activeTable}`;
      updateState((prev) => {
        const todayBizDate = getCurrentBusinessDate();
        const isNewBusinessDay = prev.counterBusinessDate !== todayBizDate;
        let nextCtr = isNewBusinessDay ? 1 : prev.ctr;
        const usedToday = isNewBusinessDay
          ? []
          : [...(prev.usedCountersToday || [])];

        // Also scan all known open sessions & today's history so no counter number can EVER collide
        Object.values(prev.sessionsByUser || {}).forEach((snap) => {
          if (snap.sess?.no && snap.sess.no !== 'Pending') {
            if (!usedToday.includes(snap.sess.no)) usedToday.push(snap.sess.no);
            const m = snap.sess.no.match(/^C(\d+)$/i);
            if (m && Number(m[1]) >= nextCtr) nextCtr = Number(m[1]) + 1;
          }
        });
        (prev.dailyOrderHistory || []).forEach((h) => {
          if (h.businessDate === todayBizDate && h.counterNo && h.counterNo !== 'Pending') {
            if (!usedToday.includes(h.counterNo)) usedToday.push(h.counterNo);
            const m = h.counterNo.match(/^C(\d+)$/i);
            if (m && Number(m[1]) >= nextCtr) nextCtr = Number(m[1]) + 1;
          }
        });

        let nextSess = prev.sess;
        if (!nextSess) {
          if (prev.cmode === 'auto') {
            while (usedToday.includes(`C${nextCtr}`)) {
              nextCtr++;
            }
            const assignedNo = `C${nextCtr++}`;
            usedToday.push(assignedNo);
            nextSess = {
              id: `sess-${Date.now()}`,
              no: assignedNo,
              pend: false,
              table: prev.activeTable,
              mob: mv || '',
              staff: true,
              status: 'open',
              businessDate: todayBizDate,
              createdAt: new Date().toISOString(),
            };
          } else {
            const v = cleanCounterNumber(rawCounterNo);
            if (v && !usedToday.includes(v)) {
              usedToday.push(v);
            }
            nextSess = {
              id: `sess-${Date.now()}`,
              no: v || 'Pending',
              pend: !v,
              table: prev.activeTable,
              mob: mv || '',
              staff: true,
              status: 'open',
              businessDate: todayBizDate,
              createdAt: new Date().toISOString(),
            };
          }
        } else if (mv && !nextSess.mob) {
          nextSess = { ...nextSess, mob: mv };
        }

        targetLabel = nextSess.pend ? `Table ${prev.activeTable}` : nextSess.no;

        const nextCart = { ...prev.cart };
        const pricesSnapshot: Record<number, number> = {};
        for (const idStr of Object.keys(it)) {
          const id = Number(idStr);
          nextCart[id] = (nextCart[id] || 0) + it[id];
          const dish = prev.menu.find((m) => m.id === id);
          if (dish) pricesSnapshot[id] = dish.p;
        }

        const nowIso = new Date().toISOString();
        const orderSeq = prev.orders.length + 1;
        const orderId = `ord-${Date.now()}-${orderSeq}`;

        const newOrder = {
          id: orderId,
          k: orderSeq,
          it,
          prices: pricesSnapshot,
          st: 1 as const,
          src: 'waiter' as const,
          vip: prev.pts >= 100,
          rush: false,
          createdAt: nowIso,
        };

        const { dateFormatted, timeFormatted } = formatIndianDateTime(nowIso);
        const { summary, totalQty, subtotal: ordSub } = formatItemsSummary(
          prev.menu,
          it,
          pricesSnapshot
        );

        const nextHistory = [
          {
            id: orderId,
            businessDate: nextSess.businessDate || todayBizDate,
            dateFormatted,
            timeFormatted,
            counterNo: nextSess.no,
            tableNo: prev.activeTable,
            orderSeq,
            source: 'waiter' as const,
            customerMob: nextSess.mob || prev.me.mob || 'Guest',
            itemsDetailed: summary,
            totalItemsQty: totalQty,
            orderSubtotal: ordSub,
            orderStatus: 'Received',
            billStatus: 'UNPAID' as const,
            paymentMethod: 'Pending',
            createdAt: nowIso,
          },
          ...(prev.dailyOrderHistory || []),
        ];

        fetch('/api/waiter/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: it, counterNo: rawCounterNo, mob: mv }),
        }).catch(() => {});

        return {
          ...prev,
          ctr: nextCtr,
          counterBusinessDate: todayBizDate,
          usedCountersToday: usedToday,
          dailyOrderHistory: nextHistory,
          sess: nextSess,
          cart: nextCart,
          orders: [...prev.orders, newOrder],
          WD: {},
          status: 1,
          wtab: 'serve',
        };
      });

      say(`Order booked for ${targetLabel} 🍳`);
    },
    [S.cc, S.WD, S.activeTable, say, updateState]
  );

  const pushWaiter = useCallback(
    (rawMob?: string) => {
      let mv = '';
      if (rawMob !== undefined) {
        const parsed = normalizeMobile(rawMob, S.cc);
        if (parsed === null) {
          say('Enter a valid 10-digit mobile number');
          return;
        }
        mv = parsed;
      }
      if (!S.sess) return;

      updateState((prev) => {
        if (!prev.sess) return prev;
        const nextSess = mv && !prev.sess.mob ? { ...prev.sess, mob: mv, status: 'billed' as const } : { ...prev.sess, status: 'billed' as const };
        fetch('/api/bills/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mob: mv }),
        }).catch(() => {});
        return {
          ...prev,
          sess: nextSess,
          billSrc: 'waiter',
          paid: false,
          cashReq: false,
          split: 1,
        };
      });
    },
    [S.cc, S.sess, say, updateState]
  );

  const cancelWaiter = useCallback(() => {
    updateState((prev) => {
      fetch('/api/bills/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recall: true }),
      }).catch(() => {});
      return {
        ...prev,
        billSrc: '',
        cashReq: false,
        sess: prev.sess ? { ...prev.sess, status: 'open' } : null,
      };
    });
  }, [updateState]);

  const doPay = useCallback(
    (method: PaymentMethod, by: 'app' | 'owner') => {
      updateState((prev) => {
        const s = getSubtotal(prev.menu, prev.cart);
        const d = getDiscount(s, prev.reel, prev.review);
        const g = getGST(s, d);
        const t = getTotal(s, d);
        const { summary } = formatItemsSummary(prev.menu, prev.cart);
        const todayBizDate =
          prev.sess?.businessDate ||
          prev.counterBusinessDate ||
          getCurrentBusinessDate();

        const nextHist = [
          {
            id: `hist-${Date.now()}`,
            a: t,
            subtotal: s,
            discount: d,
            gst: g,
            m: method,
            o: by,
            counterNo: prev.sess?.no || 'C1',
            table: prev.activeTable,
            customerMob: prev.sess?.mob || prev.me.mob || 'Guest',
            itemsSummary: summary,
            businessDate: todayBizDate,
            paidAt: new Date().toISOString(),
          },
          ...prev.hist,
        ];

        const activeOrderIds = new Set(prev.orders.map((o) => o.id));
        const nextDailyHistory = (prev.dailyOrderHistory || []).map((h) =>
          activeOrderIds.has(h.id) ||
          (prev.sess?.no && h.counterNo === prev.sess.no && h.billStatus === 'UNPAID')
            ? {
                ...h,
                billStatus: 'PAID' as const,
                paymentMethod: `${method} (${by === 'owner' ? 'Staff Tagged' : 'Online'})`,
              }
            : h
        );

        fetch(by === 'owner' ? '/api/payments/tag-offline' : '/api/payments/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method }),
        }).catch(() => {});
        return {
          ...prev,
          pm: method,
          paid: true,
          pts: prev.pts + Math.floor(t / 10),
          stars: Math.min(5, prev.stars + 1),
          newStar: true,
          hist: nextHist,
          dailyOrderHistory: nextDailyHistory,
          sess: prev.sess ? { ...prev.sess, status: 'paid' } : null,
        };
      });
    },
    [updateState]
  );

  const paySamp = useCallback(
    (index: number) => {
      updateState((prev) => {
        const nextSamp = [...prev.samp];
        const removed = nextSamp.splice(index, 1)[0];
        if (!removed) return prev;
        return {
          ...prev,
          samp: nextSamp,
          spaid: prev.spaid + removed.a,
        };
      });
    },
    [updateState]
  );

  const sendBill = useCallback(
    (rawMob: string) => {
      const v = normalizeMobile(rawMob, S.cc);
      if (!v) {
        say('Enter a valid WhatsApp number');
        return;
      }
      updateState((prev) => ({
        ...prev,
        sess: prev.sess ? { ...prev.sess, mob: v } : prev.sess,
      }));
      say(`Bill sent to ${v} ✅`);
    },
    [S.cc, say, updateState]
  );

  const startNewOrder = useCallback(() => {
    updateState((prev) => {
      const userKey = prev.me.mob || '__guest__';
      const nextSessionsByUser = { ...(prev.sessionsByUser || {}) };
      delete nextSessionsByUser[userKey];
      return {
        ...prev,
        paid: false,
        status: 0,
        cart: {},
        reel: null,
        reelCaption: '',
        review: false,
        rating: 0,
        newStar: false,
        media: null,
        shared: false,
        billSrc: '',
        M: {},
        cashReq: false,
        reviewed: false,
        sess: null,
        orders: [],
        draft: {},
        track: '',
        trackRes: '',
        sessionsByUser: nextSessionsByUser,
        tab: 'menu',
      };
    });
  }, [updateState]);

  const sendOtp = useCallback(
    (rawMob: string) => {
      const v = normalizeMobile(rawMob, S.cc);
      if (!v) {
        say('Enter a valid 10-digit mobile number');
        return;
      }
      updateState((prev) => ({
        ...prev,
        lg: { step: 1, mob: v },
      }));
    },
    [S.cc, say, updateState]
  );

  const verifyOtp = useCallback(
    (otpInput: string) => {
      const o = otpInput.trim();
      if (o !== '1234') {
        say('Wrong OTP. Demo OTP is 1234');
        return;
      }
      const mob = S.lg.mob;
      const staffMember = getActiveStaffMember(S.staff, mob);
      const allowed = getAllowedPortals(staffMember);
      const landingRole = allowed[1] || 'c';
      const hasExistingOrder = Boolean(
        S.sessionsByUser?.[mob]?.sess || (S.sess && S.sess.mob === mob)
      );

      updateState((prev) => switchUserSessionInState(prev, mob, landingRole));
      // Also pull latest counter sequence from Google Sheet so a second browser/incognito tab never reuses a counter number
      pullFromGoogleSheetsRef.current?.(undefined, true);

      const pendingOrder = pendingOrderAfterLoginRef.current;
      if (pendingOrder && Object.keys(S.draft).length > 0) {
        pendingOrderAfterLoginRef.current = null;
        setTimeout(() => {
          placeOrderRef.current?.(mob, pendingOrder.waConsent);
        }, 60);
        say(`Logged in & placing your order ✅`);
        return;
      }

      if (staffMember) {
        say(`Logged in as ${staffMember.r} ✅`);
      } else if (hasExistingOrder) {
        say('Welcome back. Your order is here ✅');
      } else {
        say('Logged in ✅ Place a new order to get your counter number');
      }
    },
    [S.lg.mob, S.staff, S.sessionsByUser, S.sess, S.draft, say, updateState, placeOrder]
  );

  const logoutOrOpenLogin = useCallback(() => {
    updateState((prev) => {
      if (prev.me.mob) {
        // Logging out: save current user's session under their mobile and switch to a clean Guest view
        return switchUserSessionInState(prev, '', 'c');
      }
      return {
        ...prev,
        showLogin: true,
      };
    });
  }, [updateState]);

  const addStaff = useCallback(
    (name: string, rawMob: string) => {
      const cleanName = name.trim().replace(/[<>&"']/g, '');
      const m = normalizeMobile(rawMob, S.cc);
      if (!cleanName || !m) {
        say('Enter a name and a valid mobile number');
        return;
      }
      if (S.staff.some((x) => x.ph === m)) {
        say('That number already has access');
        return;
      }
      const roleToAssign: StaffRoleName = S.sf;
      updateState((prev) => ({
        ...prev,
        staff: [
          ...prev.staff,
          {
            id: `st-${Date.now()}`,
            n: cleanName,
            ph: m,
            r: roleToAssign,
            mg: false,
            on: 1,
          },
        ],
      }));
      say(`${cleanName} can now log in as ${roleToAssign} ✅`);
    },
    [S.cc, S.staff, S.sf, say, updateState]
  );

  const toggleManagerAccess = useCallback(
    (staffIndex: number) => {
      updateState((prev) => {
        const nextStaff = prev.staff.map((st, i) =>
          i === staffIndex ? { ...st, mg: !st.mg } : st
        );
        return { ...prev, staff: nextStaff };
      });
    },
    [updateState]
  );

  const toggleStaffActive = useCallback(
    (staffIndex: number) => {
      const target = S.staff[staffIndex];
      if (!target) return;
      if (target.r === 'Admin' && target.on === 1) {
        const activeAdmins = S.staff.filter((s) => s.r === 'Admin' && s.on === 1);
        if (activeAdmins.length <= 1) {
          say('A restaurant must keep at least one active admin');
          return;
        }
      }
      updateState((prev) => {
        const nextStaff = prev.staff.map((st, i) =>
          i === staffIndex ? { ...st, on: st.on ? 0 : 1 } : st
        );
        return { ...prev, staff: nextStaff };
      });
    },
    [S.staff, say, updateState]
  );

  const checkLogin = useCallback(
    (rawMob: string) => {
      const m = normalizeMobile(rawMob, S.cc);
      if (!m) {
        say('Enter a valid mobile number');
        return;
      }
      const x = S.staff.find((s) => s.ph === m && s.on === 1);
      const alr = x
        ? `${m} opens the ${x.r} portal. They can switch to the customer view anytime.`
        : `${m} has no staff access, so it opens the Customer portal.`;
      updateState((prev) => ({ ...prev, alr }));
    },
    [S.cc, S.staff, say, updateState]
  );

  const saveMenuDish = useCallback(
    (dish: Partial<Dish> & { id?: number }) => {
      updateState((prev) => {
        let nextMenu = [...prev.menu];
        if (dish.id) {
          nextMenu = nextMenu.map((m) => (m.id === dish.id ? { ...m, ...dish } : m));
        } else if (dish.n && typeof dish.p === 'number') {
          const nextId = Math.max(0, ...nextMenu.map((m) => m.id)) + 1;
          nextMenu.push({
            id: nextId,
            e: dish.e || '🍲',
            p: dish.p,
            v: dish.v ?? 1,
            jain: dish.jain ?? false,
            available: dish.available ?? true,
            n: dish.n,
          });
        }
        return { ...prev, menu: nextMenu };
      });
      say('Menu updated ✅');
    },
    [say, updateState]
  );

  const addTable = useCallback(
    (label: string, manualId?: number) => {
      const cleanLabel = label.trim().replace(/[<>&"']/g, '');
      const hasManualId = typeof manualId === 'number' && manualId > 0;
      if (!cleanLabel && !hasManualId) {
        say('Enter a table number or name (e.g. 10 or Patio 1)');
        return;
      }
      if (hasManualId && S.tables.some((t) => t.id === manualId)) {
        say(`Table #${manualId} already exists. Edit or remove it first.`);
        return;
      }
      let createdLabel = '';
      updateState((prev) => {
        const nextId = hasManualId
          ? manualId!
          : Math.max(0, ...prev.tables.map((t) => t.id)) + 1;
        createdLabel = cleanLabel || `Table ${nextId}`;
        const token = `qr-tadka-t${nextId}-${Math.random().toString(36).slice(2, 6)}`;
        return {
          ...prev,
          tables: [...prev.tables, { id: nextId, label: createdLabel, token }],
        };
      });
      say(`Added ${createdLabel} with QR code ✅`);
    },
    [S.tables, say, updateState]
  );

  const updateTable = useCallback(
    (oldId: number, newLabel: string, newId?: number) => {
      const cleanLabel = newLabel.trim().replace(/[<>&"']/g, '');
      const targetId =
        typeof newId === 'number' && newId > 0 ? newId : oldId;
      if (targetId !== oldId && S.tables.some((t) => t.id === targetId)) {
        say(`Table #${targetId} already exists`);
        return;
      }
      updateState((prev) => {
        const nextTables = prev.tables.map((t) =>
          t.id === oldId
            ? {
                ...t,
                id: targetId,
                label: cleanLabel || `Table ${targetId}`,
                token:
                  targetId !== oldId
                    ? `qr-tadka-t${targetId}-${Math.random().toString(36).slice(2, 6)}`
                    : t.token,
              }
            : t
        );
        return {
          ...prev,
          tables: nextTables,
          activeTable: prev.activeTable === oldId ? targetId : prev.activeTable,
        };
      });
      say(`Updated Table #${targetId} ✅`);
    },
    [S.tables, say, updateState]
  );

  const resetTables = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      tables: INITIAL_STATE.tables,
      activeTable: 1,
    }));
    say('Tables reset to default (Table 1–6) ✅');
  }, [say, updateState]);

  const removeTable = useCallback(
    (tableId: number) => {
      if (S.tables.length <= 1) {
        say('Keep at least one table');
        return;
      }
      updateState((prev) => {
        const nextTables = prev.tables.filter((t) => t.id !== tableId);
        const nextActive =
          prev.activeTable === tableId
            ? nextTables[0]?.id || 1
            : prev.activeTable;
        return {
          ...prev,
          tables: nextTables,
          activeTable: nextActive,
        };
      });
      say('Table removed');
    },
    [S.tables.length, say, updateState]
  );

  const regenerateTableQr = useCallback(
    (tableId: number) => {
      updateState((prev) => {
        const nextTables = prev.tables.map((t) =>
          t.id === tableId
            ? { ...t, token: `qr-tadka-t${t.id}-${Math.random().toString(36).slice(2, 6)}` }
            : t
        );
        return { ...prev, tables: nextTables };
      });
      say(`Table ${tableId} QR regenerated ✅`);
    },
    [say, updateState]
  );

  const setActiveTable = useCallback(
    (tableId: number) => {
      updateState((prev) => ({ ...prev, activeTable: tableId }));
      say(`Switched to Table ${tableId}`);
    },
    [say, updateState]
  );

  const resetDemoState = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setS(INITIAL_STATE);
    say('Reset to fresh demo state ✅');
  }, [say]);

  const syncToGoogleSheets = useCallback(
    async (overrideConfig?: Partial<AppState['googleConfig']>) => {
      const mergedConfig = {
        ...S.googleConfig,
        ...(overrideConfig || {}),
        enabled: true,
      };
      updateState((prev) => ({
        ...prev,
        googleConfig: { ...mergedConfig, lastSyncStatus: 'syncing' },
      }));
      try {
        const res = await fetch('/api/storage/sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleConfig: mergedConfig,
            clientState: {
              menu: S.menu,
              staff: S.staff,
              orders: S.orders,
              cart: S.cart,
              sess: S.sess,
              hist: S.hist,
              driveAssets: S.driveAssets,
            },
          }),
        });
        const data = await res.json();
        updateState((prev) => ({
          ...prev,
          googleConfig: {
            ...mergedConfig,
            lastSyncedAt: data.lastSyncedAt || new Date().toISOString(),
            lastSyncStatus: data.ok ? 'synced' : 'error',
            lastSyncError: data.error,
          },
        }));
        if (!data.ok) {
          say(`Google Sync Error: ${data.error || 'Check URL'}`);
        } else {
          say(
            data.mode === 'google_cloud_webhook'
              ? 'Synced all 9 sheets to Google Sheets ✅'
              : 'Synced to local CSV (Paste Apps Script URL above to push to Google)'
          );
        }
      } catch {
        // Fallback when deployed to static hosting (GitHub Pages) where /api routes are absent
        const isWebhookSet = mergedConfig.appsScriptWebAppUrl?.startsWith(
          'https://script.google.com/'
        );
        updateState((prev) => ({
          ...prev,
          googleConfig: {
            ...mergedConfig,
            lastSyncedAt: new Date().toISOString(),
            lastSyncStatus: 'synced',
            lastSyncError: undefined,
          },
        }));
        say(
          isWebhookSet
            ? 'Synced all 9 sheets to Google Sheets ✅'
            : 'Saved in browser storage (Paste Apps Script URL to sync to Google Sheet)'
        );
      }
    },
    [S, say, updateState]
  );

  const uploadMediaToDrive = useCallback(
    async (payload: {
      fileName: string;
      kind: 'reel' | 'snap' | 'dish_photo' | 'receipt_pdf';
      mimeType?: string;
      base64Data?: string;
      caption?: string;
    }) => {
      try {
        const res = await fetch('/api/storage/drive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            counterNo: S.sess?.no || 'C27',
            uploadedBy: S.me.mob || S.sess?.mob || 'Customer',
          }),
        });
        const data = await res.json();
        if (data.ok && data.asset) {
          updateState((prev) => ({
            ...prev,
            driveAssets: [data.asset, ...(prev.driveAssets || [])],
            googleConfig: {
              ...prev.googleConfig,
              lastSyncedAt: new Date().toISOString(),
              lastSyncStatus: 'synced',
            },
          }));
          say(`Saved ${payload.kind} to Google Drive ✅`);
        }
      } catch {
        // Fallback for static hosting (GitHub Pages): create Drive asset client-side & push directly if webhook is configured
        const fallbackAsset = {
          id: `drv-${Date.now()}`,
          name: payload.fileName,
          kind: payload.kind,
          mimeType: payload.mimeType || 'video/mp4',
          sizeBytes: payload.base64Data
            ? Math.round((payload.base64Data.length * 3) / 4)
            : 1024 * 450,
          driveFileId: `1Drv_${Date.now().toString(36)}`,
          driveViewUrl: `https://drive.google.com/drive/my-drive`,
          caption: payload.caption,
          counterNo: S.sess?.no || 'C27',
          uploadedBy: S.me.mob || S.sess?.mob || 'Customer',
          createdAt: new Date().toISOString(),
        };
        if (S.googleConfig?.appsScriptWebAppUrl?.startsWith('https://script.google.com/')) {
          fetch(S.googleConfig.appsScriptWebAppUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'UPLOAD_DRIVE_FILE',
              driveFolderId: S.googleConfig.driveFolderId,
              fileName: payload.fileName,
              mimeType: payload.mimeType || 'video/mp4',
              base64Data: payload.base64Data || '',
              caption: payload.caption || '',
              counterNo: S.sess?.no || 'C27',
            }),
          }).catch(() => {});
        }
        updateState((prev) => ({
          ...prev,
          driveAssets: [fallbackAsset, ...(prev.driveAssets || [])],
        }));
        say(`Saved ${payload.kind} to Google Drive ✅`);
      }
    },
    [S.sess, S.me.mob, say, updateState]
  );

  const saveGoogleConfig = useCallback(
    (cfg: Partial<AppState['googleConfig']>) => {
      updateState((prev) => ({
        ...prev,
        googleConfig: { ...prev.googleConfig, ...cfg },
      }));
      say('Google Drive & Sheets config saved ✅');
    },
    [say, updateState]
  );

  const pullFromGoogleSheets = useCallback(
    async (
      overrideConfig?: Partial<AppState['googleConfig']>,
      silent = false
    ) => {
      const mergedConfig = {
        ...S.googleConfig,
        ...(overrideConfig || {}),
      };
      const webhookUrl = (mergedConfig.appsScriptWebAppUrl || '').trim();
      const cleanSheetId = extractSpreadsheetIdFromUrl(
        mergedConfig.spreadsheetId || ''
      );

      if (!webhookUrl.startsWith('https://script.google.com/') && !cleanSheetId) {
        if (!silent) {
          say('Paste your Google Apps Script URL or Spreadsheet link first');
        }
        return;
      }

      if (!silent) {
        say('⏳ Pulling latest Menu & Staff from Google Sheet…');
      }

      let pulledMenu: Dish[] | null = null;
      let pulledStaff: AppState['staff'] | null = null;
      let pulledConfig: Partial<AppState['googleConfig']> | null = null;
      let pulledCounters: ParsedSheetCounterState | null = null;

      // 1. Try Server Proxy (/api/storage/sheets?pull=1) — avoids all browser CORS redirect issues on localhost
      try {
        const params = new URLSearchParams({
          pull: '1',
          appsScriptUrl: webhookUrl,
          spreadsheetId: cleanSheetId,
        });
        const apiRes = await fetch(`/api/storage/sheets?${params.toString()}`, {
          cache: 'no-store',
        });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.ok && apiData.sheets) {
            pulledMenu = parseMenuFromSheetRows(apiData.sheets.Menu_Items || []);
            pulledStaff = parseStaffFromSheetRows(
              apiData.sheets.Staff_Access || []
            );
            pulledConfig = parseConfigFromSheetRows(
              apiData.sheets.Restaurant_Config || []
            );
            pulledCounters = parseDailyCountersAndStateFromSheets(
              apiData.sheets.Restaurant_Config,
              apiData.sheets.Daily_Counters
            );
          }
        }
      } catch {
        // Ignore if running on static GitHub Pages without /api
      }

      // 2. Fallback: Browser JSONP <script> injection to Google Sheet gviz API (works on GitHub Pages & localhost with zero CORS restriction!)
      if (!pulledMenu && cleanSheetId && typeof window !== 'undefined') {
        const gvizFetchTab = (tabName: string) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new Promise<any[][] | null>((resolve) => {
            const cbName = `__tadkaGviz_${tabName}_${Date.now()}`;
            const script = document.createElement('script');
            const timer = setTimeout(() => {
              cleanup();
              resolve(null);
            }, 5000);

            function cleanup() {
              clearTimeout(timer);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              delete (window as any)[cbName];
              script.remove();
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any)[cbName] = (resp: any) => {
              cleanup();
              try {
                if (resp && resp.table && Array.isArray(resp.table.rows)) {
                  const header = (resp.table.cols || []).map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (c: any, idx: number) => c.label || `Col${idx}`
                  );
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const dataRows = resp.table.rows.map((r: any) =>
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (r.c || []).map((cell: any) =>
                      cell ? (cell.f ?? cell.v ?? '') : ''
                    )
                  );
                  resolve([header, ...dataRows]);
                  return;
                }
              } catch {
                // ignore
              }
              resolve(null);
            };

            script.src = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?sheet=${encodeURIComponent(
              tabName
            )}&headers=1&tqx=responseHandler:${cbName}`;
            script.onerror = () => {
              cleanup();
              resolve(null);
            };
            document.body.appendChild(script);
          });

        const [menuRows, cfgRows, dailyCounterRows] = await Promise.all([
          gvizFetchTab('Menu_Items'),
          gvizFetchTab('Restaurant_Config'),
          gvizFetchTab('Daily_Counters'),
        ]);
        if (menuRows) pulledMenu = parseMenuFromSheetRows(menuRows);
        if (cfgRows) pulledConfig = parseConfigFromSheetRows(cfgRows);
        if (cfgRows || dailyCounterRows) {
          pulledCounters = parseDailyCountersAndStateFromSheets(
            cfgRows || undefined,
            dailyCounterRows || undefined
          );
        }
      }

      // 3. Fallback: Browser JSONP <script> injection to Apps Script Web App URL (bypasses CORS on GitHub Pages!)
      if (
        !pulledMenu &&
        webhookUrl.startsWith('https://script.google.com/') &&
        typeof window !== 'undefined'
      ) {
        const jsonpResult = await new Promise<{
          menu: Dish[] | null;
          staff: AppState['staff'] | null;
          config: Partial<AppState['googleConfig']> | null;
          counters: ParsedSheetCounterState | null;
        }>((resolve) => {
          const cbName = `__tadkaScriptCb_${Date.now()}`;
          const script = document.createElement('script');
          const timer = setTimeout(() => {
            cleanup();
            resolve({ menu: null, staff: null, config: null, counters: null });
          }, 6000);

          function cleanup() {
            clearTimeout(timer);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (window as any)[cbName];
            script.remove();
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any)[cbName] = (data: any) => {
            cleanup();
            if (data && data.ok && data.sheets) {
              resolve({
                menu: parseMenuFromSheetRows(data.sheets.Menu_Items || []),
                staff: parseStaffFromSheetRows(data.sheets.Staff_Access || []),
                config: parseConfigFromSheetRows(
                  data.sheets.Restaurant_Config || []
                ),
                counters: parseDailyCountersAndStateFromSheets(
                  data.sheets.Restaurant_Config,
                  data.sheets.Daily_Counters
                ),
              });
            } else {
              resolve({ menu: null, staff: null, config: null, counters: null });
            }
          };

          const sep = webhookUrl.includes('?') ? '&' : '?';
          script.src = `${webhookUrl}${sep}callback=${cbName}&spreadsheetId=${encodeURIComponent(
            cleanSheetId
          )}&t=${Date.now()}`;
          script.onerror = () => {
            cleanup();
            resolve({ menu: null, staff: null, config: null, counters: null });
          };
          document.body.appendChild(script);
        });
        if (jsonpResult.menu) pulledMenu = jsonpResult.menu;
        if (jsonpResult.staff) pulledStaff = jsonpResult.staff;
        if (jsonpResult.config) pulledConfig = jsonpResult.config;
        if (jsonpResult.counters) pulledCounters = jsonpResult.counters;
      }

      // 4. Fallback: Direct Apps Script GET / POST from browser
      if (!pulledMenu && webhookUrl.startsWith('https://script.google.com/')) {
        try {
          const query = cleanSheetId
            ? `?spreadsheetId=${encodeURIComponent(cleanSheetId)}&t=${Date.now()}`
            : `?t=${Date.now()}`;
          const res = await fetch(`${webhookUrl}${query}`, {
            method: 'GET',
            redirect: 'follow',
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.ok && data.sheets) {
              pulledMenu = parseMenuFromSheetRows(data.sheets.Menu_Items || []);
              pulledStaff = parseStaffFromSheetRows(
                data.sheets.Staff_Access || []
              );
            }
          }
        } catch {
          // Try POST PULL_ALL_SHEETS
          try {
            const postRes = await fetch(webhookUrl, {
              method: 'POST',
              redirect: 'follow',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify({
                action: 'PULL_ALL_SHEETS',
                spreadsheetId: cleanSheetId,
              }),
            });
            if (postRes.ok) {
              const data = await postRes.json();
              if (data && data.ok && data.sheets) {
                pulledMenu = parseMenuFromSheetRows(
                  data.sheets.Menu_Items || []
                );
                pulledStaff = parseStaffFromSheetRows(
                  data.sheets.Staff_Access || []
                );
              }
            }
          } catch {
            // ignore
          }
        }
      }

      if ((pulledMenu && pulledMenu.length > 0) || pulledConfig || pulledCounters) {
        setS((prev) => {
          const todayBizDate = getCurrentBusinessDate();
          const mergedUsed = Array.from(
            new Set([
              ...(prev.counterBusinessDate === todayBizDate
                ? prev.usedCountersToday || []
                : []),
              ...(pulledCounters?.usedCountersToday || []),
            ])
          );
          const highestCtr = Math.max(
            prev.counterBusinessDate === todayBizDate ? prev.ctr : 1,
            pulledCounters?.nextCtr || 1
          );

          const nextState: AppState = {
            ...prev,
            menu: pulledMenu && pulledMenu.length > 0 ? pulledMenu : prev.menu,
            staff: pulledStaff || prev.staff,
            counterBusinessDate: todayBizDate,
            ctr: highestCtr,
            usedCountersToday: mergedUsed,
            googleConfig: {
              ...prev.googleConfig,
              ...mergedConfig,
              ...(pulledConfig || {}),
              spreadsheetId:
                pulledConfig?.spreadsheetId ||
                cleanSheetId ||
                prev.googleConfig.spreadsheetId,
              lastSyncedAt: new Date().toISOString(),
              lastSyncStatus: 'synced',
              lastSyncError: undefined,
            },
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
            channelRef.current?.postMessage({
              type: 'STATE_SYNC',
              payload: nextState,
            });
          } catch {
            // ignore
          }
          return nextState;
        });

        if (!silent) {
          say(
            `Pulled ${
              pulledMenu ? pulledMenu.length : S.menu.length
            } menu items & counter sequence from Google Sheet ✅`
          );
        }
      } else if (!silent) {
        say(
          'To pull from Sheet: either paste your Google Sheet link/ID & set Share -> "Anyone with link", OR redeploy Apps Script as a New Version'
        );
      }
    },
    [S.googleConfig, S.menu.length, say]
  );

  pullFromGoogleSheetsRef.current = pullFromGoogleSheets;

  // Commercial Multi-Tenant Startup Loader:
  // On any new browser/device, load config from /config/restaurants.json (or NEXT_PUBLIC_REMOTE_CONFIG_JSON_URL),
  // then auto-pull Menu, Staff & Restaurant_Config from that restaurant's Google Sheet!
  useEffect(() => {
    let cancelled = false;
    async function bootstrapTenantConfig() {
      let tenantCfg: Partial<AppState['googleConfig']> = {};
      const slug =
        process.env.NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG || 'tadka-truck';

      // Check both root path and GitHub Pages basePath
      const candidateUrls = [
        process.env.NEXT_PUBLIC_REMOTE_CONFIG_JSON_URL || '',
        '/config/restaurants.json',
        '/My_Restaurants/config/restaurants.json',
      ].filter(Boolean);

      for (const url of candidateUrls) {
        try {
          const res = await fetch(`${url}?t=${Date.now()}`, {
            cache: 'no-store',
          });
          if (res.ok) {
            const data = await res.json();
            const entry =
              data?.restaurants?.[slug] ||
              data?.restaurants?.[data?.defaultRestaurant] ||
              data;
            if (entry) {
              tenantCfg = {
                appsScriptWebAppUrl: entry.appsScriptWebAppUrl || '',
                spreadsheetId: entry.spreadsheetId || '',
                driveFolderId: entry.driveFolderId || '',
              };
              break;
            }
          }
        } catch {
          // try next candidate
        }
      }

      if (cancelled) return;

      // Merge non-empty config fields from restaurants.json if current browser has blank fields
      setS((prev) => {
        const mergedCfg = {
          ...prev.googleConfig,
          appsScriptWebAppUrl:
            prev.googleConfig.appsScriptWebAppUrl ||
            tenantCfg.appsScriptWebAppUrl ||
            '',
          spreadsheetId:
            prev.googleConfig.spreadsheetId || tenantCfg.spreadsheetId || '',
          driveFolderId:
            prev.googleConfig.driveFolderId || tenantCfg.driveFolderId || '',
        };
        const next = { ...prev, googleConfig: mergedCfg };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });

      // Now auto-pull live Menu, Staff, and Restaurant_Config from the Google Sheet
      await pullFromGoogleSheets(
        {
          appsScriptWebAppUrl:
            S.googleConfig.appsScriptWebAppUrl ||
            tenantCfg.appsScriptWebAppUrl ||
            '',
          spreadsheetId:
            S.googleConfig.spreadsheetId || tenantCfg.spreadsheetId || '',
          driveFolderId:
            S.googleConfig.driveFolderId || tenantCfg.driveFolderId || '',
        },
        true
      );
    }

    bootstrapTenantConfig();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TadkaContext.Provider
      value={{
        S,
        say,
        updateState,
        sub,
        dsub,
        cnt,
        disc,
        gst,
        total,
        staffOf,
        portals,
        setRole,
        setTab,
        setWTab,
        setLang,
        toggleVeg,
        setCountryCode,
        changeDraftQty,
        placeOrder,
        inviteMemberToSession,
        removeInvitedMember,
        trackCounter,
        setMode,
        assignNo,
        setNo,
        reissueNumber,
        advanceOrderStatus,
        toggleOrderRush,
        toggleDishStock,
        changeWaiterDraftQty,
        bookWaiter,
        pushWaiter,
        cancelWaiter,
        doPay,
        paySamp,
        sendBill,
        startNewOrder,
        sendOtp,
        verifyOtp,
        logoutOrOpenLogin,
        addStaff,
        toggleManagerAccess,
        toggleStaffActive,
        checkLogin,
        saveMenuDish,
        addTable,
        updateTable,
        removeTable,
        resetTables,
        regenerateTableQr,
        setActiveTable,
        resetDemoState,
        syncToGoogleSheets,
        pullFromGoogleSheets,
        uploadMediaToDrive,
        saveGoogleConfig,
      }}
    >
      {children}
    </TadkaContext.Provider>
  );
}

export function useTadka() {
  const ctx = useContext(TadkaContext);
  if (!ctx) {
    throw new Error('useTadka must be used within a TadkaProvider');
  }
  return ctx;
}

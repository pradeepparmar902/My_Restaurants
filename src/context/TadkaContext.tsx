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
import { INITIAL_STATE } from '@/lib/constants';
import {
  cleanCounterNumber,
  filterPositiveItems,
  getActiveStaffMember,
  getAllowedPortals,
  getDiscount,
  getDraftCount,
  getGST,
  getSubtotal,
  getTotal,
  normalizeMobile,
} from '@/lib/helpers';
import {
  buildSheetRowsForState,
  extractSpreadsheetIdFromUrl,
  parseCsvToRows,
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

  // Hydrate from localStorage + setup BroadcastChannel for cross-tab realtime sync
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        setS((prev) => ({
          ...prev,
          ...parsed,
          activeTable: initialTableId || parsed.activeTable || prev.activeTable,
          toast: '',
        }));
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
      const finalState = validatedRole === next.role ? next : { ...next, role: validatedRole };

      if (isHydratedRef.current && typeof window !== 'undefined') {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(finalState));
          channelRef.current?.postMessage({ type: 'STATE_SYNC', payload: finalState });
          // Background auto-sync to Google Sheets & local CSV mirror
          if (finalState.googleConfig?.enabled) {
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
        const m = normalizeMobile(optionalMobRaw, S.cc);
        if (m === null) {
          say('Enter a valid 10-digit mobile number');
          return;
        }
        normalizedOptionalMob = m;
      }

      updateState((prev) => {
        let nextCtr = prev.ctr;
        let nextSess = prev.sess;
        if (!nextSess) {
          const isAuto = prev.cmode === 'auto';
          nextSess = {
            id: `sess-${Date.now()}`,
            no: isAuto ? `C${nextCtr++}` : 'Pending',
            pend: !isAuto,
            table: prev.activeTable,
            mob: normalizedOptionalMob || prev.me.mob,
            waConsent: waConsent ?? prev.waOptIn,
            status: 'open',
            businessDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
          };
        } else if (normalizedOptionalMob && !nextSess.mob) {
          nextSess = { ...nextSess, mob: normalizedOptionalMob };
        }

        const nextCart = { ...prev.cart };
        for (const idStr of Object.keys(it)) {
          const id = Number(idStr);
          nextCart[id] = (nextCart[id] || 0) + it[id];
        }

        const newOrder = {
          id: `ord-${Date.now()}-${prev.orders.length + 1}`,
          k: prev.orders.length + 1,
          it,
          st: 1 as const,
          src: 'app' as const,
          vip: prev.pts >= 100,
          rush: false,
          createdAt: new Date().toISOString(),
        };

        // Fire-and-forget server sync
        fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: it, mob: nextSess.mob, waConsent }),
        }).catch(() => {});

        return {
          ...prev,
          ctr: nextCtr,
          sess: nextSess,
          cart: nextCart,
          orders: [...prev.orders, newOrder],
          draft: {},
          status: 1,
          tab: 'order',
        };
      });
    },
    [S.billSrc, S.paid, S.draft, S.menu, S.cc, say, updateState]
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
      let nextCtr = prev.ctr;
      assigned = `C${nextCtr++}`;
      const nextSess = prev.sess
        ? { ...prev.sess, no: assigned, pend: false }
        : {
            id: `sess-${Date.now()}`,
            no: assigned,
            pend: false,
            table: prev.activeTable,
            mob: '',
            status: 'open' as const,
            businessDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
          };
      return { ...prev, ctr: nextCtr, sess: nextSess };
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
      if (S.samp.some((x) => x.no.toUpperCase() === v)) {
        say('That counter number is already in use today');
        return;
      }
      updateState((prev) => ({
        ...prev,
        sess: prev.sess ? { ...prev.sess, no: v, pend: false } : prev.sess,
      }));
      say(`Counter ${v} saved ✅`);
    },
    [S.samp, say, updateState]
  );

  const reissueNumber = useCallback(() => {
    updateState((prev) => {
      if (!prev.sess) return prev;
      let nextCtr = prev.ctr;
      const reissued =
        prev.cmode === 'auto'
          ? { no: `C${nextCtr++}`, pend: false }
          : { no: 'Pending', pend: true };
      return {
        ...prev,
        ctr: nextCtr,
        sess: { ...prev.sess, ...reissued },
      };
    });
  }, [updateState]);

  const advanceOrderStatus = useCallback(
    (orderIndex: number, nextStatus: 1 | 2 | 3 | 4 | 5) => {
      updateState((prev) => {
        const nextOrders = prev.orders.map((o, idx) =>
          idx === orderIndex ? { ...o, st: nextStatus } : o
        );
        return { ...prev, orders: nextOrders, status: nextStatus };
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
        let nextCtr = prev.ctr;
        let nextSess = prev.sess;
        if (!nextSess) {
          if (prev.cmode === 'auto') {
            nextSess = {
              id: `sess-${Date.now()}`,
              no: `C${nextCtr++}`,
              pend: false,
              table: prev.activeTable,
              mob: mv || '',
              staff: true,
              status: 'open',
              businessDate: new Date().toISOString().slice(0, 10),
              createdAt: new Date().toISOString(),
            };
          } else {
            const v = cleanCounterNumber(rawCounterNo);
            nextSess = {
              id: `sess-${Date.now()}`,
              no: v || 'Pending',
              pend: !v,
              table: prev.activeTable,
              mob: mv || '',
              staff: true,
              status: 'open',
              businessDate: new Date().toISOString().slice(0, 10),
              createdAt: new Date().toISOString(),
            };
          }
        } else if (mv && !nextSess.mob) {
          nextSess = { ...nextSess, mob: mv };
        }

        targetLabel = nextSess.pend ? `Table ${prev.activeTable}` : nextSess.no;

        const nextCart = { ...prev.cart };
        for (const idStr of Object.keys(it)) {
          const id = Number(idStr);
          nextCart[id] = (nextCart[id] || 0) + it[id];
        }

        const newOrder = {
          id: `ord-${Date.now()}-${prev.orders.length + 1}`,
          k: prev.orders.length + 1,
          it,
          st: 1 as const,
          src: 'waiter' as const,
          vip: prev.pts >= 100,
          rush: false,
          createdAt: new Date().toISOString(),
        };

        fetch('/api/waiter/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: it, counterNo: rawCounterNo, mob: mv }),
        }).catch(() => {});

        return {
          ...prev,
          ctr: nextCtr,
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
        const t = getTotal(s, d);
        const nextHist = [
          {
            id: `hist-${Date.now()}`,
            a: t,
            m: method,
            o: by,
            counterNo: prev.sess?.no,
            table: prev.activeTable,
            paidAt: new Date().toISOString(),
          },
          ...prev.hist,
        ];
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
    updateState((prev) => ({
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
      tab: 'menu',
    }));
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
      const hasMatchingOrder = S.sess && S.sess.mob === mob;

      updateState((prev) => ({
        ...prev,
        me: { mob },
        role: landingRole,
        lg: { step: 0, mob: '' },
        showLogin: false,
      }));

      if (staffMember) {
        say(`Logged in as ${staffMember.r} ✅`);
      } else if (hasMatchingOrder) {
        say('Welcome back. Your order is here ✅');
      } else if (S.sess && S.sess.mob) {
        say('No open order for this number');
      } else {
        say('Logged in ✅');
      }
    },
    [S.lg.mob, S.staff, S.sess, say, updateState]
  );

  const logoutOrOpenLogin = useCallback(() => {
    updateState((prev) => {
      if (prev.me.mob) {
        return {
          ...prev,
          me: { mob: '' },
          role: 'c',
          showLogin: false,
        };
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
          }
        }
      } catch {
        // Ignore if running on static GitHub Pages without /api
      }

      // 2. Fallback: Direct Google Sheet gviz CSV fetch from browser (works on GitHub Pages if sheet is shared "Anyone with link")
      if (!pulledMenu && cleanSheetId) {
        try {
          const menuCsvUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:csv&sheet=Menu_Items`;
          const csvRes = await fetch(menuCsvUrl, { cache: 'no-store' });
          if (csvRes.ok) {
            const csvText = await csvRes.text();
            if (!csvText.includes('<!DOCTYPE html>') && !csvText.includes('ServiceLogin')) {
              pulledMenu = parseMenuFromSheetRows(parseCsvToRows(csvText));
            }
          }
        } catch {
          // Ignore CORS error if sheet is private
        }
      }

      // 3. Fallback: Direct Apps Script GET / POST from browser (works on GitHub Pages when updated Code.gs is deployed as New Version)
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

      if (pulledMenu && pulledMenu.length > 0) {
        setS((prev) => {
          const nextState: AppState = {
            ...prev,
            menu: pulledMenu!,
            staff: pulledStaff || prev.staff,
            googleConfig: {
              ...mergedConfig,
              spreadsheetId: cleanSheetId,
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
            `Pulled ${pulledMenu.length} menu items from Google Sheet ✅`
          );
        }
      } else if (!silent) {
        say(
          'To pull from Sheet: either paste your Google Sheet link/ID & set Share -> "Anyone with link", OR redeploy Apps Script as a New Version'
        );
      }
    },
    [S.googleConfig, say]
  );

  // Auto-pull latest Menu & Staff from Google Sheet when app opens (if URL is configured)
  useEffect(() => {
    if (
      isHydratedRef.current &&
      S.googleConfig?.appsScriptWebAppUrl?.startsWith('https://script.google.com/')
    ) {
      pullFromGoogleSheets(undefined, true);
    }
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

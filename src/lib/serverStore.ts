import { AppState, Dish, StaffRoleName } from '@/types/tadka';
import { INITIAL_STATE } from '@/lib/constants';
import { cleanCounterNumber, getSubtotal, getDiscount, getTotal, filterPositiveItems } from '@/lib/helpers';

// Global singleton in-memory store for API routes (mirrors Supabase DB tables in local/demo mode)
export interface ServerBankInflow {
  id: string;
  source: 'Paytm' | 'GooglePay' | 'PhonePe' | 'SMS' | 'Manual';
  amount: number;
  utr: string;
  payerName: string;
  payerVpa?: string;
  time: string;
  rawPayload?: Record<string, unknown>;
  reconciledOrderId?: string;
  receivedAt: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __TADKA_STORE__: AppState | undefined;
  // eslint-disable-next-line no-var
  var __TADKA_BANK_INFLOWS__: ServerBankInflow[] | undefined;
  // eslint-disable-next-line no-var
  var __TADKA_TABLE_STATUS__: Record<string, Record<number, boolean>> | undefined;
}

export function getTableStatusMap(tenant?: string): Record<number, boolean> {
  const tKey = (tenant || 'default').trim().toLowerCase();
  if (!global.__TADKA_TABLE_STATUS__) {
    global.__TADKA_TABLE_STATUS__ = {};
  }
  if (!global.__TADKA_TABLE_STATUS__[tKey]) {
    global.__TADKA_TABLE_STATUS__[tKey] = {};
  }
  return global.__TADKA_TABLE_STATUS__[tKey];
}

export function setTableStatus(tableId: number, active: boolean, tenant?: string): Record<number, boolean> {
  const map = getTableStatusMap(tenant);
  map[tableId] = active;
  return map;
}

export function getBankInflows(): ServerBankInflow[] {
  if (!global.__TADKA_BANK_INFLOWS__) {
    global.__TADKA_BANK_INFLOWS__ = [];
  }
  return global.__TADKA_BANK_INFLOWS__;
}

export function addBankInflow(inflow: Omit<ServerBankInflow, 'id' | 'receivedAt'>): ServerBankInflow {
  const list = getBankInflows();
  const entry: ServerBankInflow = {
    ...inflow,
    id: `inflow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    receivedAt: new Date().toISOString(),
  };
  list.unshift(entry);
  if (list.length > 100) list.pop();
  return entry;
}

export function markBankInflowReconciled(inflowId: string, orderId: string): boolean {
  const list = getBankInflows();
  const item = list.find((i) => i.id === inflowId);
  if (item) {
    item.reconciledOrderId = orderId;
    return true;
  }
  return false;
}

export function getStore(): AppState {
  if (!global.__TADKA_STORE__) {
    global.__TADKA_STORE__ = structuredClone(INITIAL_STATE);
  }
  return global.__TADKA_STORE__;
}

export function updateStore(updater: (state: AppState) => void): AppState {
  const store = getStore();
  updater(store);
  return store;
}

export function resetStore(): AppState {
  global.__TADKA_STORE__ = structuredClone(INITIAL_STATE);
  return global.__TADKA_STORE__;
}

export function logAudit(who: string, action: string, what: string, details: string) {
  const store = getStore();
  store.auditLog.unshift({
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    who: who || 'Guest',
    action,
    what,
    details,
    time: new Date().toISOString(),
  });
}

export function createNewSession(store: AppState, createdByStaff = false, mob = '') {
  const isAuto = store.cmode === 'auto';
  const counterNo = isAuto ? `C${store.ctr++}` : 'Pending';
  store.sess = {
    id: `sess-${Date.now()}`,
    no: counterNo,
    pend: !isAuto,
    table: store.activeTable,
    mob: mob || store.me.mob || '',
    waConsent: store.waOptIn,
    staff: createdByStaff,
    guestToken: `gt-${Date.now()}`,
    status: 'open',
    businessDate: new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  return store.sess;
}

export function placeCustomerOrderInStore(
  draftItems: Record<number, number>,
  mob?: string,
  waConsent?: boolean
): { ok: boolean; error?: string; state: AppState } {
  const store = getStore();
  const it = filterPositiveItems(draftItems);
  const lineCount = Object.keys(it).length;
  if (lineCount === 0) {
    return { ok: false, error: 'Add at least 1 item to place an order', state: store };
  }
  if (lineCount > 40) {
    return { ok: false, error: 'Maximum 40 lines per order', state: store };
  }
  for (const [dishIdStr, qty] of Object.entries(it)) {
    if (qty > 20) {
      return { ok: false, error: 'Maximum 20 of one dish per order', state: store };
    }
    const dish = store.menu.find((m) => m.id === Number(dishIdStr));
    if (!dish || !dish.available) {
      return { ok: false, error: 'An item is unavailable', state: store };
    }
  }

  if (store.billSrc === 'waiter' && !store.paid) {
    return {
      ok: false,
      error: 'The bill was already sent. Ask staff to recall it before adding items',
      state: store,
    };
  }

  if (!store.sess) {
    createNewSession(store, false, mob || store.me.mob);
  } else if (mob && !store.sess.mob) {
    store.sess.mob = mob;
  }

  if (typeof waConsent === 'boolean' && store.sess) {
    store.sess.waConsent = waConsent;
  }

  const prices: Record<number, number> = {};
  for (const idStr of Object.keys(it)) {
    const d = store.menu.find((m) => m.id === Number(idStr));
    if (d) prices[d.id] = d.p;
    store.cart[Number(idStr)] = (store.cart[Number(idStr)] || 0) + it[Number(idStr)];
  }

  store.orders.push({
    id: `ord-${Date.now()}-${store.orders.length + 1}`,
    k: store.orders.length + 1,
    it,
    prices,
    st: 1,
    src: 'app',
    vip: store.pts >= 100,
    rush: false,
    createdAt: new Date().toISOString(),
  });

  store.draft = {};
  store.status = 1;
  store.tab = 'order';
  logAudit(store.me.mob || 'Customer', 'order.place', `Order #${store.orders.length}`, `Placed customer order`);
  return { ok: true, state: store };
}

export function bookWaiterOrderInStore(
  waiterDraft: Record<number, number>,
  manualCounterNo?: string,
  customerMob?: string
): { ok: boolean; error?: string; state: AppState } {
  const store = getStore();
  const it = filterPositiveItems(waiterDraft);
  if (Object.keys(it).length === 0) {
    return { ok: false, error: 'Select at least 1 dish to book', state: store };
  }
  if (store.billSrc === 'waiter' && !store.paid) {
    return {
      ok: false,
      error: 'The bill was already sent. Recall it before adding items',
      state: store,
    };
  }

  if (!store.sess) {
    if (store.cmode === 'auto') {
      store.sess = {
        id: `sess-${Date.now()}`,
        no: `C${store.ctr++}`,
        pend: false,
        table: store.activeTable,
        mob: customerMob || '',
        staff: true,
        status: 'open',
        businessDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
    } else {
      const cleaned = cleanCounterNumber(manualCounterNo || '');
      store.sess = {
        id: `sess-${Date.now()}`,
        no: cleaned || 'Pending',
        pend: !cleaned,
        table: store.activeTable,
        mob: customerMob || '',
        staff: true,
        status: 'open',
        businessDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
      };
    }
  } else if (customerMob && !store.sess.mob) {
    store.sess.mob = customerMob;
  }

  for (const idStr of Object.keys(it)) {
    store.cart[Number(idStr)] = (store.cart[Number(idStr)] || 0) + it[Number(idStr)];
  }

  store.orders.push({
    id: `ord-${Date.now()}-${store.orders.length + 1}`,
    k: store.orders.length + 1,
    it,
    st: 1,
    src: 'waiter',
    vip: store.pts >= 100,
    rush: false,
    createdAt: new Date().toISOString(),
  });

  store.WD = {};
  store.status = 1;
  store.wtab = 'serve';
  logAudit(store.me.mob || 'Waiter', 'orders.book', `Order #${store.orders.length}`, `Waiter booked order`);
  return { ok: true, state: store };
}

export function completePaymentInStore(method: string, by: 'app' | 'owner') {
  const store = getStore();
  const sub = getSubtotal(store.menu, store.cart);
  const disc = getDiscount(sub, store.reel, store.review);
  const t = getTotal(sub, disc);
  store.pm = method as AppState['pm'];
  store.paid = true;
  store.pts += Math.floor(t / 10);
  store.stars = Math.min(5, store.stars + 1);
  store.newStar = true;
  if (store.sess) {
    store.sess.status = 'paid';
  }
  store.hist.unshift({
    id: `hist-${Date.now()}`,
    a: t,
    m: method,
    o: by,
    counterNo: store.sess?.no,
    table: store.activeTable,
    paidAt: new Date().toISOString(),
  });
  logAudit(
    store.me.mob || (by === 'owner' ? 'Staff' : 'Customer'),
    by === 'owner' ? 'payments.tag' : 'payments.webhook',
    `Bill ₹${t}`,
    `Paid via ${method} (${by})`
  );
  return store;
}

export function addStaffMemberInStore(name: string, phone: string, role: StaffRoleName) {
  const store = getStore();
  const cleanName = name.trim().replace(/[<>&"']/g, '');
  if (!cleanName || !phone) {
    return { ok: false, error: 'Enter a name and a valid mobile number', state: store };
  }
  if (store.staff.some((x) => x.ph === phone)) {
    return { ok: false, error: 'That number already has access', state: store };
  }
  store.staff.push({
    id: `st-${Date.now()}`,
    n: cleanName,
    ph: phone,
    r: role,
    mg: false,
    on: 1,
  });
  logAudit(store.me.mob || 'Admin', 'staff.manage', cleanName, `Granted ${role} access to ${phone}`);
  return { ok: true, state: store };
}

export function updateMenuItemInStore(dish: Partial<Dish> & { id?: number }) {
  const store = getStore();
  if (dish.id) {
    const idx = store.menu.findIndex((m) => m.id === dish.id);
    if (idx !== -1) {
      store.menu[idx] = { ...store.menu[idx], ...dish };
    }
  } else if (dish.n && typeof dish.p === 'number') {
    const nextId = Math.max(0, ...store.menu.map((m) => m.id)) + 1;
    store.menu.push({
      id: nextId,
      e: dish.e || '🍲',
      p: dish.p,
      v: dish.v ?? 1,
      jain: dish.jain ?? false,
      available: dish.available ?? true,
      n: dish.n,
    });
  }
  return store;
}

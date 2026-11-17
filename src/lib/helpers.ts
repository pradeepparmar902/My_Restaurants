import {
  AppState,
  Dish,
  StaffMember,
  PortalRole,
  Permission,
  UserSessionSnapshot,
} from '@/types/tadka';
import { ROLE_DEFAULT_PERMISSIONS } from '@/lib/constants';

export function normalizeMobile(rawInput: string, countryCode: string): string | null {
  let v = (rawInput || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!v) return '';
  if (countryCode === '+91') {
    v = v.slice(-10);
  }
  const isValid = countryCode === '+91' ? v.length === 10 : v.length >= 7 && v.length <= 12;
  return isValid ? `${countryCode}${v}` : null;
}

export function cleanCounterNumber(raw: string): string {
  return (raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 8);
}

export function getSubtotal(menu: Dish[], cart: Record<number, number>): number {
  return menu.reduce((acc, m) => acc + (cart[m.id] || 0) * m.p, 0);
}

export function getDraftCount(draft: Record<number, number>): number {
  return Object.values(draft).reduce((acc, qty) => acc + qty, 0);
}

export function getDiscount(subtotal: number, reel: 'wait' | 'ok' | null, review: boolean): number {
  const reelDisc = reel === 'ok' ? Math.round(subtotal * 0.1) : 0;
  const reviewDisc = review ? 50 : 0;
  return Math.min(subtotal, reelDisc + reviewDisc);
}

export function getGST(subtotal: number, discount: number): number {
  return Math.round(Math.max(0, subtotal - discount) * 0.05);
}

export function getTotal(subtotal: number, discount: number): number {
  const net = Math.max(0, subtotal - discount);
  return Math.max(0, Math.round(net * 1.05));
}

export function getActiveStaffMember(staff: StaffMember[], mob: string): StaffMember | undefined {
  if (!mob) return undefined;
  return staff.find((s) => s.ph === mob && s.on === 1);
}

export function getAllowedPortals(staffMember?: StaffMember): PortalRole[] {
  const r = staffMember ? staffMember.r : '';
  return [
    'c',
    ...(r === 'Admin'
      ? (['a', 'o', 'k', 'w'] as PortalRole[])
      : r === 'Manager'
        ? ([...(staffMember?.mg ? (['a'] as PortalRole[]) : []), 'o', 'k', 'w'] as PortalRole[])
        : r === 'Chef'
          ? (['k'] as PortalRole[])
          : r === 'Waiter'
            ? (['w'] as PortalRole[])
            : r === 'Reception'
              ? (['o', 'w'] as PortalRole[])
              : []),
  ];
}

export function hasPermission(staffMember: StaffMember | undefined, perm: Permission): boolean {
  if (!staffMember || !staffMember.on) return false;
  if (perm === 'staff.manage' && staffMember.r === 'Manager' && staffMember.mg) {
    return true;
  }
  const defaults = ROLE_DEFAULT_PERMISSIONS[staffMember.r] || [];
  const extras = staffMember.extraPermissions || [];
  return defaults.includes(perm) || extras.includes(perm);
}

export function isSessionGated(state: AppState): boolean {
  return !!(
    state.sess &&
    state.sess.staff &&
    state.sess.mob &&
    state.sess.mob !== state.me.mob
  );
}

export function getSessionRowStatus(state: AppState): string {
  const activeOrders = state.orders.filter((x) => x.st !== 5);
  const m = activeOrders.length ? Math.min(...activeOrders.map((x) => x.st)) : 0;
  if (state.cashReq) return 'Cash at counter';
  if (state.billSrc === 'waiter') return 'Bill pushed';
  if (m === 4) return 'Delivered, bill not pushed';
  if (m === 3) return 'Ready to serve';
  return 'In kitchen';
}

export function filterPositiveItems(items: Record<number, number>): Record<number, number> {
  return Object.fromEntries(Object.entries(items).filter(([, v]) => v > 0));
}

/**
 * Computes the restaurant's current Business Date (YYYY-MM-DD) in IST (Asia/Kolkata)
 * with a 4:00 AM cutoff (so late-night orders before 4 AM belong to the previous business day, per PRD Section 7).
 */
export function getCurrentBusinessDate(now = new Date()): string {
  // Shift back by 4 hours so 00:00-03:59 belongs to previous day
  const shifted = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(shifted);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback
  }
  return shifted.toISOString().slice(0, 10);
}

export function formatIndianDateTime(isoString?: string): {
  dateFormatted: string;
  timeFormatted: string;
} {
  const dt = isoString ? new Date(isoString) : new Date();
  try {
    const dateFormatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(dt);
    const timeFormatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(dt);
    return { dateFormatted, timeFormatted };
  } catch {
    return {
      dateFormatted: dt.toISOString().slice(0, 10),
      timeFormatted: dt.toISOString().slice(11, 19),
    };
  }
}

export function formatItemsSummary(
  menu: Dish[],
  items: Record<number, number>,
  pricesSnapshot?: Record<number, number>
): { summary: string; totalQty: number; subtotal: number } {
  const parts: string[] = [];
  let totalQty = 0;
  let subtotal = 0;
  for (const [idStr, qty] of Object.entries(items)) {
    if (!qty || qty <= 0) continue;
    const id = Number(idStr);
    const dish = menu.find((m) => m.id === id);
    const price = pricesSnapshot?.[id] ?? dish?.p ?? 0;
    const lineTotal = price * qty;
    totalQty += qty;
    subtotal += lineTotal;
    parts.push(`${qty}× ${dish ? dish.n.en : `Dish #${id}`} (₹${lineTotal})`);
  }
  return {
    summary: parts.join(', '),
    totalQty,
    subtotal,
  };
}

export function extractUserSessionSnapshot(state: AppState): UserSessionSnapshot {
  return {
    sess: state.sess,
    orders: state.orders,
    cart: state.cart,
    status: state.status,
    billSrc: state.billSrc,
    paid: state.paid,
    cashReq: state.cashReq,
    reel: state.reel,
    reelCaption: state.reelCaption,
    review: state.review,
    reviewed: state.reviewed,
    rating: state.rating,
    media: state.media,
    shared: state.shared,
    split: state.split,
    pm: state.pm,
    pts: state.pts,
    stars: state.stars,
  };
}

export function getEmptyUserSessionSnapshot(): UserSessionSnapshot {
  return {
    sess: null,
    orders: [],
    cart: {},
    status: 0,
    billSrc: '',
    paid: false,
    cashReq: false,
    reel: null,
    reelCaption: '',
    review: false,
    reviewed: false,
    rating: 0,
    media: null,
    shared: false,
    split: 1,
    pm: 'UPI',
    pts: 0,
    stars: 0,
  };
}

/**
 * Switches the active session context from the current user to `nextMob` (or '' for Guest),
 * strictly isolating orders, counter numbers, bills, and loyalty stars per user login.
 */
export function switchUserSessionInState(
  prev: AppState,
  nextMob: string,
  nextRole: PortalRole
): AppState {
  const currentKey = prev.sess?.mob || prev.me.mob || '__guest__';
  const updatedMap: Record<string, UserSessionSnapshot> = {
    ...(prev.sessionsByUser || {}),
  };

  // Save current active session under its principal mobile key (or guest key)
  if (prev.sess || prev.orders.length > 0 || prev.pts > 0 || prev.stars > 0) {
    updatedMap[currentKey] = extractUserSessionSnapshot(prev);
    if (prev.sess?.mob) {
      updatedMap[prev.sess.mob] = extractUserSessionSnapshot(prev);
    }
  }

  const targetKey = nextMob || '__guest__';
  // Check if nextMob has been invited to an active (unpaid) principal table session
  const invitedGroupSnap = nextMob
    ? Object.values(updatedMap).find(
        (s) =>
          s.sess &&
          !s.paid &&
          s.sess.status !== 'paid' &&
          (s.sess.invitedMobs || []).includes(nextMob)
      )
    : undefined;

  const restored = invitedGroupSnap || updatedMap[targetKey];

  // If Guest is logging in and there was an unlinked guest session, claim it only if target has no session yet
  if (
    !restored &&
    nextMob &&
    !prev.me.mob &&
    prev.sess &&
    (!prev.sess.mob || prev.sess.mob === nextMob) &&
    !prev.sess.staff
  ) {
    const claimedSess = { ...prev.sess, mob: nextMob };
    const claimedSnap = {
      ...extractUserSessionSnapshot(prev),
      sess: claimedSess,
    };
    updatedMap[nextMob] = claimedSnap;
    delete updatedMap['__guest__'];
    return {
      ...prev,
      me: { mob: nextMob },
      role: nextRole,
      sess: claimedSess,
      sessionsByUser: updatedMap,
      lg: { step: 0, mob: '' },
      showLogin: false,
    };
  }

  const snap = restored || getEmptyUserSessionSnapshot();

  return {
    ...prev,
    me: { mob: nextMob },
    role: nextRole,
    sess: snap.sess,
    orders: snap.orders,
    cart: snap.cart,
    status: snap.status,
    billSrc: snap.billSrc,
    paid: snap.paid,
    cashReq: snap.cashReq,
    reel: snap.reel,
    reelCaption: snap.reelCaption,
    review: snap.review,
    reviewed: snap.reviewed,
    rating: snap.rating,
    media: snap.media,
    shared: snap.shared,
    split: snap.split,
    pm: snap.pm,
    pts: snap.pts,
    stars: snap.stars,
    draft: !prev.me.mob && nextMob ? prev.draft : {},
    track: '',
    trackRes: '',
    sessionsByUser: updatedMap,
    lg: { step: 0, mob: '' },
    showLogin: false,
  };
}

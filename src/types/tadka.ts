export type Language = 'en' | 'hi' | 'gu' | (string & {});
export type PortalRole = 'c' | 'k' | 'w' | 'o' | 'a' | 'sa';
export type StaffRoleName = 'Admin' | 'Manager' | 'Chef' | 'Waiter' | 'Reception';
export type CustomerTab = 'menu' | 'order' | 'reward' | 'bill';
export type WaiterTab = 'serve' | 'book' | 'prepaid';
export type CounterMode = 'auto' | 'manual';
export type PaymentMethod = 'UPI' | 'Card' | 'Net banking' | 'Cash at counter' | 'Cash' | 'Card machine' | 'UPI at counter';

export type Permission =
  | 'orders.kitchen'
  | 'orders.serve'
  | 'orders.book'
  | 'orders.cancel'
  | 'bills.push'
  | 'payments.tag'
  | 'menu.edit'
  | 'rewards.approve'
  | 'reports.view'
  | 'settings.edit'
  | 'staff.manage';

export interface Dish {
  id: number;
  e: string;
  p: number; // price in INR (stored in paise in DB: p * 100)
  v: number; // 1 = veg, 0 = non-veg
  jain?: boolean;
  available: boolean;
  gstRate?: number; // per-item GST % (optional, falls back to default gstRate)
  dietaryTags?: string[]; // optional custom dietary filter IDs
  img?: string; // Live image URL or base64 data URI
  badge?: string; // Custom ribbon badge e.g. "Pocket Friendly", "Bestseller", "Chef Special"
  rating?: number; // Custom rating e.g. 4.6
  prepTime?: string; // Custom preparation time / tagline e.g. "8-12 mins"
  desc?: string; // Optional short description or ingredients
  category?: string; // Category ID e.g. 'rolls' | 'burgers' | 'mains' | 'drinks'
  n: {
    en: string;
    hi: string;
    gu: string;
    [lang: string]: string;
  };
}

export interface OrderRound {
  id: string;
  k: number; // sequence number (Order 1, Order 2...)
  it: Record<number, number>; // dishId -> qty
  prices?: Record<number, number>; // snapshotted prices at order time
  st: 1 | 2 | 3 | 4 | 5; // 1=Received, 2=Cooking, 3=Ready, 4=Delivered, 5=Cancelled
  src: 'app' | 'waiter';
  orderedByMob?: string; // Mobile number of principal or invited member who placed this round
  vip?: boolean;
  rush?: boolean;
  createdAt: string;
  cookingAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  paidAt?: string;
  deliveredBy?: string;
  paymentPending?: boolean; // In prepaid mode: true until marked as paid
  prepaid?: boolean; // true if placed in prepaid mode
  customerPaidReported?: boolean; // true once customer taps 'I Have Paid'
  customerUtr?: string; // Optional 12-digit UPI reference number entered by customer
  paymentReportedAt?: string; // Timestamp when customer submitted payment confirmation
}

export interface SessionData {
  id: string;
  no: string; // e.g. 'C27' or 'Pending'
  pend?: boolean;
  table: number;
  mob: string; // Principal user mobile number
  invitedMobs?: string[]; // Invited group mobile numbers whose orders club into this principal session
  waConsent?: boolean;
  staff?: boolean; // true if created by staff
  guestToken?: string;
  status: 'open' | 'billed' | 'paid' | 'closed';
  businessDate: string;
  createdAt: string;
}

export interface StaffMember {
  id: string;
  n: string;
  ph: string;
  r: StaffRoleName;
  mg: boolean; // Can manage access (optional for Manager)
  extraPermissions?: Permission[];
  on: number; // 1 = active, 0 = removed
}

export interface SampleBillRow {
  id: string;
  no: string;
  t: number;
  a: number;
  s: string;
  mob?: string;
}

export interface PaidBillHistoryItem {
  id: string;
  a: number;
  subtotal?: number;
  discount?: number;
  gst?: number;
  m: string;
  o: 'app' | 'owner';
  counterNo?: string;
  table?: number;
  customerMob?: string;
  itemsSummary?: string;
  businessDate?: string;
  paidAt: string;
}

export interface DailyCounterOrderLogEntry {
  id: string;
  businessDate: string; // YYYY-MM-DD (4 AM cut-off)
  dateFormatted: string; // e.g. 16 Nov 2026
  timeFormatted: string; // e.g. 09:15:30 AM
  counterNo: string; // e.g. C27
  tableNo: number;
  orderSeq: number;
  source: 'app' | 'waiter';
  customerMob: string;
  itemsDetailed: string; // e.g. 2x Paneer Kathi Roll (₹240), 1x Pasta (₹100)
  totalItemsQty: number;
  orderSubtotal: number;
  orderStatus: string;
  billStatus: 'UNPAID' | 'PAID';
  paymentMethod: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  who: string;
  action: string;
  what: string;
  details: string;
  time: string;
}

export interface DiningTable {
  id: number;
  label: string;
  token: string;
  active?: boolean; // false = locked/inactive (anti-fake order protection), true/undefined = active
}

export interface RewardRulesConfig {
  minBillForStar: number;
  starsTarget: number;
  starFreeRewardLabel: string;
  starFreeValueInr: number;
  couponCode: string;
  couponType: 'flat' | 'percent';
  couponValue: number;
  couponMinBill: number;
  referralCode: string;
  referralDiscountInr: number;
  referralMinBill: number;
  referralBonusStars: number;
  reviewDiscountInr: number;
  reviewMinBill: number;
  reviewBonusStars: number;
  reelDiscountPercent: number;
  socialSharePoints: number;
  socialShareDiscountInr: number;
  socialShareBonusStars: number;
}

export interface MenuLanguageOption {
  code: string;
  label: string;
  enabled: boolean;
}

export interface DietaryFilterOption {
  id: string;
  label: string;
  emoji: string;
  enabled: boolean;
}

export interface WorkspaceTenantRecord {
  slug: string;
  restaurantName: string;
  appStyle?: 'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6';
  status?: 'ACTIVE' | 'TRIAL' | 'SUSPENDED';
  planName?: 'Starter' | 'Growth' | 'Pro';
  monthlyFeeInr?: number;
  ownerName: string;
  ownerMobile: string;
  spreadsheetId: string;
  driveFolderId: string;
  appsScriptWebAppUrl: string;
  createdAt: string;
}

export interface GoogleCloudStorageConfig {
  enabled: boolean;
  appStyle?: 'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6';
  workspaceSlug?: string;
  ownerName?: string;
  ownerMobile?: string;
  workspacesRegistry?: WorkspaceTenantRecord[];
  restaurantName?: string;
  restaurantTagline?: string;
  enabledLanguages?: Language[];
  menuLanguages?: MenuLanguageOption[];
  showVegFilter?: boolean;
  showJainFilter?: boolean;
  dietaryFilters?: DietaryFilterOption[];
  appsScriptWebAppUrl: string;
  spreadsheetId: string;
  driveFolderId: string;
  googleReviewUrl?: string;
  instagramHandle?: string;
  facebookUrl?: string;
  socialTag?: string;
  upiId?: string;
  upiName?: string;
  upiQrImageUrl?: string; // Optional custom physical standee / Soundbox QR photo
  billingModel?: 'prepaid' | 'postpaid'; // 'prepaid' = QSR / Food Court pay first, 'postpaid' = Dine-in pay later
  gstEnabled?: boolean;
  gstRate?: number;
  gstMode?: 'bill' | 'item';
  gstin?: string;
  rewardRules?: RewardRulesConfig;
  tablesStatusJson?: string;
  whatsappGatewayUrl?: string; // URL of the standalone Baileys WhatsApp connector (default: http://localhost:5050)
  whatsappDirectEnabled?: boolean; // When true, sends order confirmations and bills directly via background WhatsApp
  whatsappHeaderBannerUrl?: string; // Header image banner URL included with WhatsApp messages
  whatsappTemplates?: import('@/lib/whatsappTemplates').WhatsAppTemplate[];
  lastSyncedAt?: string;
  lastSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncError?: string;
}

export interface DriveMediaAsset {
  id: string;
  name: string;
  kind: 'reel' | 'snap' | 'dish_photo' | 'receipt_pdf';
  mimeType: string;
  sizeBytes: number;
  driveFileId?: string;
  driveViewUrl?: string;
  caption?: string;
  counterNo?: string;
  uploadedBy: string;
  createdAt: string;
}

export interface SocialProofSubmission {
  id: string;
  businessDate: string;
  counterNo: string;
  customerMob: string;
  kind: 'social' | 'review';
  platform: string;
  proofUrl?: string;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rewardType?: 'COUPON' | 'STAR' | 'DISCOUNT';
  rewardValue?: string;
  createdAt: string;
}

export interface UserSessionSnapshot {
  sess: SessionData | null;
  orders: OrderRound[];
  cart: Record<number, number>;
  status: number;
  billSrc: '' | 'waiter';
  paid: boolean;
  cashReq: boolean;
  reel: 'wait' | 'ok' | null;
  reelCaption: string;
  review: boolean;
  reviewed: boolean;
  rating: number;
  media: 'snap' | 'reel' | null;
  shared: boolean;
  split: number;
  pm: PaymentMethod;
  pts: number;
  stars: number;
}

export interface AppState {
  // Navigation & UI
  role: PortalRole;
  tab: CustomerTab;
  wtab: WaiterTab;
  lang: Language;
  veg: boolean;
  jainOnly: boolean;
  toast: string;

  // Menu & Tables
  menu: Dish[];
  tables: DiningTable[];
  activeTable: number;

  // Cart & Ordering
  draft: Record<number, number>;
  cart: Record<number, number>;
  orders: OrderRound[];
  sess: SessionData | null;
  status: number; // legacy overall status 0..4
  tag: string; // 'rush' | ''
  ctr: number; // next auto counter number for current businessDate
  counterBusinessDate: string; // YYYY-MM-DD business date for day-wise counter reset
  usedCountersToday: string[]; // All counter numbers used on counterBusinessDate
  dailyOrderHistory: DailyCounterOrderLogEntry[]; // Persistent day-wise log of all counter orders
  sessionsByUser: Record<string, UserSessionSnapshot>; // Per-mobile isolated session map
  cmode: CounterMode;
  track: string;
  trackRes: string;

  // Waiter Booking
  WD: Record<number, number>; // Waiter draft cart
  M: Record<number, number>;

  // Rewards, Reviews & Social
  rating: number;
  reel: 'wait' | 'ok' | null;
  reelCaption: string;
  review: boolean;
  reviewed: boolean;
  privateFeedback: string;
  pts: number;
  stars: number;
  newStar: boolean;
  media: 'snap' | 'reel' | null;
  shared: boolean;
  soc: Record<string, boolean>;
  appliedCoupon?: string;
  starClaimed?: boolean;
  scratchReward?: {
    label: string;
    code: string;
    scratched: boolean;
    bonusPts?: number;
  } | null;

  // Billing & Payments
  billSrc: '' | 'waiter';
  pm: PaymentMethod;
  split: number;
  paid: boolean;
  cashReq: boolean;
  wab: boolean; // Final bill on WhatsApp setting
  waOptIn: boolean; // Customer checkbox for WhatsApp bill
  hist: PaidBillHistoryItem[];
  samp: SampleBillRow[];
  spaid: number;

  // Identity, Auth & Staff
  cc: string;
  me: {
    mob: string;
    name?: string;
  };
  lg: {
    step: number;
    mob: string;
  };
  showLogin: boolean;
  staff: StaffMember[];
  sf: StaffRoleName; // selected role in Give Access form
  alr: string; // checkLogin result string
  auditLog: AuditLogEntry[];

  // Google Sheets & Google Drive Storage Integration
  googleConfig: GoogleCloudStorageConfig;
  driveAssets: DriveMediaAsset[];
}

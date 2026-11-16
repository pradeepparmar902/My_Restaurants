import { AppState, Dish, StaffMember, Permission, StaffRoleName, DiningTable } from '@/types/tadka';

export const INITIAL_MENU: Dish[] = [
  {
    id: 1,
    e: '🌯',
    p: 120,
    v: 1,
    jain: true,
    available: true,
    n: { en: 'Paneer Kathi Roll', hi: 'पनीर काठी रोल', gu: 'પનીર કાઠી રોલ' },
  },
  {
    id: 2,
    e: '🍔',
    p: 140,
    v: 0,
    jain: false,
    available: true,
    n: { en: 'Smash Chicken Burger', hi: 'स्मैश चिकन बर्गर', gu: 'સ્મેશ ચિકન બર્ગર' },
  },
  {
    id: 3,
    e: '🍜',
    p: 110,
    v: 1,
    jain: false,
    available: true,
    n: { en: 'Schezwan Noodles', hi: 'शेज़वान नूडल्स', gu: 'શેઝવાન નૂડલ્સ' },
  },
  {
    id: 4,
    e: '🥤',
    p: 70,
    v: 1,
    jain: true,
    available: true,
    n: { en: 'Mango Masala Cooler', hi: 'मैंगो मसाला कूलर', gu: 'મેંગો મસાલા કૂલર' },
  },
  {
    id: 5,
    e: '🍟',
    p: 90,
    v: 1,
    jain: false,
    available: true,
    n: { en: 'Peri Peri Fries', hi: 'पेरी पेरी फ्राइज़', gu: 'પેરી પેરી ફ્રાઇઝ' },
  },
  {
    id: 6,
    e: '🍮',
    p: 80,
    v: 1,
    jain: true,
    available: true,
    n: { en: 'Gulab Jamun Sizzler', hi: 'गुलाब जामुन सिज़लर', gu: 'ગુલાબ જામુન સિઝલર' },
  },
];

export const INITIAL_STAFF: StaffMember[] = [
  { id: 'st-1', n: 'Pradeep', ph: '+919800000001', r: 'Admin', mg: true, on: 1 },
  { id: 'st-2', n: 'Ravi', ph: '+919800000002', r: 'Manager', mg: false, on: 1 },
  { id: 'st-3', n: 'Sonal', ph: '+919800000003', r: 'Chef', mg: false, on: 1 },
  { id: 'st-4', n: 'Imran', ph: '+919800000004', r: 'Waiter', mg: false, on: 1 },
];

export const INITIAL_TABLES: DiningTable[] = [
  { id: 1, label: 'Table 1', token: 'qr-tadka-t1-a8f9' },
  { id: 2, label: 'Table 2', token: 'qr-tadka-t2-b4c2' },
  { id: 3, label: 'Table 3', token: 'qr-tadka-t3-c9d1' },
  { id: 4, label: 'Table 4', token: 'qr-tadka-t4-f7e3' },
  { id: 5, label: 'Table 5', token: 'qr-tadka-t5-d2a6' },
  { id: 6, label: 'Table 6', token: 'qr-tadka-t6-e5b8' },
];

export const COUNTRY_CODES: [string, string][] = [
  ['+91', 'India'],
  ['+1', 'US/CA'],
  ['+44', 'UK'],
  ['+971', 'UAE'],
  ['+65', 'Singapore'],
  ['+61', 'Australia'],
  ['+966', 'Saudi'],
];

export const ROLE_DESCRIPTIONS: Record<StaffRoleName, string> = {
  Admin: 'Everything, including access',
  Manager: 'Everything except access',
  Chef: 'Kitchen queue',
  Waiter: 'Serve and book orders',
  Reception: 'Book orders, push bills, tag payments',
};

export const ROLE_DEFAULT_PERMISSIONS: Record<StaffRoleName, Permission[]> = {
  Admin: [
    'orders.kitchen',
    'orders.serve',
    'orders.book',
    'orders.cancel',
    'bills.push',
    'payments.tag',
    'menu.edit',
    'rewards.approve',
    'reports.view',
    'settings.edit',
    'staff.manage',
  ],
  Manager: [
    'orders.kitchen',
    'orders.serve',
    'orders.book',
    'orders.cancel',
    'bills.push',
    'payments.tag',
    'menu.edit',
    'rewards.approve',
    'reports.view',
    'settings.edit',
  ],
  Chef: ['orders.kitchen'],
  Waiter: ['orders.serve', 'orders.book'],
  Reception: ['orders.book', 'bills.push', 'payments.tag'],
};

export const ORDER_STATUS_LABELS = ['', 'Received', 'Cooking', 'Ready', 'Delivered', 'Cancelled'] as const;

export const SOCIAL_PLATFORMS: [string, string][] = [
  ['Instagram', '📷'],
  ['WhatsApp Status', '💬'],
  ['Snapchat', '👻'],
  ['Facebook', '📘'],
];

export const INITIAL_STATE: AppState = {
  role: 'c',
  tab: 'menu',
  wtab: 'serve',
  lang: 'en',
  veg: false,
  jainOnly: false,
  toast: '',

  menu: INITIAL_MENU,
  tables: INITIAL_TABLES,
  activeTable: 4,

  draft: {},
  cart: {},
  orders: [],
  sess: null,
  status: 0,
  tag: '',
  ctr: 1,
  counterBusinessDate: new Date().toISOString().slice(0, 10),
  usedCountersToday: [],
  dailyOrderHistory: [],
  cmode: 'auto',
  track: '',
  trackRes: '',

  WD: {},
  M: {},

  rating: 0,
  reel: null,
  reelCaption: '',
  review: false,
  reviewed: false,
  privateFeedback: '',
  pts: 120,
  stars: 2,
  newStar: false,
  media: null,
  shared: false,
  soc: {},

  billSrc: '',
  pm: 'UPI',
  split: 1,
  paid: false,
  cashReq: false,
  wab: true,
  waOptIn: true,
  hist: [
    {
      id: 'hist-1',
      a: 340,
      subtotal: 324,
      discount: 0,
      gst: 16,
      m: 'UPI',
      o: 'app',
      counterNo: 'C1',
      table: 4,
      customerMob: '+919820112233',
      itemsSummary: '2× Paneer Kathi Roll (₹240), 1× Mango Masala Cooler (₹70)',
      businessDate: new Date().toISOString().slice(0, 10),
      paidAt: new Date().toISOString(),
    },
  ],
  samp: [
    { id: 'samp-1', no: 'C24', t: 2, a: 540, s: 'Bill pushed', mob: '+919820112233' },
    { id: 'samp-2', no: 'C25', t: 6, a: 320, s: 'In kitchen' },
  ],
  spaid: 0,

  cc: '+91',
  me: { mob: '' },
  lg: { step: 0, mob: '' },
  showLogin: false,
  staff: INITIAL_STAFF,
  sf: 'Waiter',
  alr: '',
  auditLog: [],

  googleConfig: {
    enabled: true,
    appsScriptWebAppUrl: process.env.NEXT_PUBLIC_GOOGLE_APPS_SCRIPT_URL || '',
    spreadsheetId: process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '',
    driveFolderId: process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '',
    lastSyncedAt: new Date().toISOString(),
    lastSyncStatus: 'synced',
  },
  driveAssets: [
    {
      id: 'drv-1',
      name: 'paneer_kathi_roll_reel_table4.mp4',
      kind: 'reel',
      mimeType: 'video/mp4',
      sizeBytes: 4820100,
      driveFileId: '1A9x_TadkaDemoReelFileId',
      driveViewUrl: 'https://drive.google.com/file/d/1A9x_TadkaDemoReelFileId/view',
      caption: 'Paneer Kathi Roll at @tadkatruck',
      counterNo: 'C23',
      uploadedBy: '+919820112233',
      createdAt: new Date().toISOString(),
    },
  ],
};

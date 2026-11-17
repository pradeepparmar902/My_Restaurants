import { AppState, Dish, StaffMember, StaffRoleName } from '@/types/tadka';
import {
  getSubtotal,
  getDiscount,
  getGST,
  getTotal,
  formatIndianDateTime,
  formatItemsSummary,
  getCurrentBusinessDate,
} from '@/lib/helpers';
import { ORDER_STATUS_LABELS } from '@/lib/constants';

export type SheetTabName =
  | 'Daily_Counters'
  | 'Orders'
  | 'Bills_Payments'
  | 'Menu_Items'
  | 'Sessions'
  | 'Staff_Access'
  | 'Loyalty_Ledger'
  | 'Social_Reels_Reviews'
  | 'Audit_Log'
  | 'Drive_Assets'
  | 'Restaurant_Config';

export function buildSheetRowsForState(
  state: AppState
): Record<SheetTabName, (string | number | boolean)[][]> {
  const subtotal = getSubtotal(state.menu, state.cart);
  const discount = getDiscount(subtotal, state.reel, state.review);
  const gst = getGST(subtotal, discount);
  const total = getTotal(subtotal, discount);

  const businessDateToday =
    state.counterBusinessDate || getCurrentBusinessDate();

  const Restaurant_Config: (string | number | boolean)[][] = [
    ['Config_Key', 'Config_Value', 'Updated_At'],
    ['restaurant_slug', 'tadka-truck', new Date().toISOString()],
    ['restaurant_name', 'Tadka Truck', new Date().toISOString()],
    ['appsScriptWebAppUrl', state.googleConfig?.appsScriptWebAppUrl || '', new Date().toISOString()],
    ['spreadsheetId', state.googleConfig?.spreadsheetId || '', new Date().toISOString()],
    ['driveFolderId', state.googleConfig?.driveFolderId || '', new Date().toISOString()],
    ['counter_mode', state.cmode, new Date().toISOString()],
    ['whatsapp_final_bill', state.wab, new Date().toISOString()],
    ['counter_business_date', businessDateToday, new Date().toISOString()],
    ['next_counter_number', state.ctr, new Date().toISOString()],
    ['used_counters_today', (state.usedCountersToday || []).join(','), new Date().toISOString()],
  ];

  const Menu_Items: (string | number | boolean)[][] = [
    [
      'Dish_ID',
      'Emoji',
      'Name_English',
      'Name_Hindi',
      'Name_Gujarati',
      'Price_INR',
      'Price_Paise',
      'Is_Veg',
      'Is_Jain',
      'Available',
    ],
    ...state.menu.map((m) => [
      m.id,
      m.e,
      m.n.en,
      m.n.hi,
      m.n.gu,
      m.p,
      m.p * 100,
      m.v === 1,
      !!m.jain,
      m.available,
    ]),
  ];

  const Staff_Access: (string | number | boolean)[][] = [
    ['Staff_ID', 'Name', 'Phone_E164', 'Role', 'Can_Manage_Access', 'Active'],
    ...state.staff.map((s) => [s.id, s.n, s.ph, s.r, s.mg, s.on === 1]),
  ];

  const Sessions: (string | number | boolean)[][] = [
    [
      'Business_Date',
      'Date',
      'Time',
      'Counter_No',
      'Table_No',
      'Customer_Mobile',
      'Items_Ordered_Menu',
      'Session_Subtotal_INR',
      'Status',
      'Created_By_Staff',
      'WhatsApp_Consent',
      'Session_ID',
    ],
    ...(state.sess
      ? (() => {
          const { dateFormatted, timeFormatted } = formatIndianDateTime(
            state.sess.createdAt
          );
          const { summary, subtotal: sessSub } = formatItemsSummary(
            state.menu,
            state.cart
          );
          return [
            [
              state.sess.businessDate || businessDateToday,
              dateFormatted,
              timeFormatted,
              state.sess.no,
              state.sess.table,
              state.sess.mob || 'Guest',
              summary || 'No items yet',
              sessSub,
              state.sess.status.toUpperCase(),
              !!state.sess.staff,
              !!state.sess.waConsent,
              state.sess.id,
            ],
          ];
        })()
      : []),
  ];

  // Combine active session orders + persistent dailyOrderHistory so completed visits stay in the Orders sheet
  const activeOrderRows: (string | number | boolean)[][] = state.orders.map(
    (o) => {
      const { dateFormatted, timeFormatted } = formatIndianDateTime(o.createdAt);
      const { summary, totalQty, subtotal: ordSub } = formatItemsSummary(
        state.menu,
        o.it,
        o.prices
      );
      return [
        state.sess?.businessDate || businessDateToday,
        dateFormatted,
        timeFormatted,
        state.sess?.no || 'Pending',
        state.activeTable,
        o.k,
        o.src === 'waiter' ? 'Waiter' : 'Customer App',
        state.sess?.mob || state.me.mob || 'Guest',
        summary,
        totalQty,
        ordSub,
        ORDER_STATUS_LABELS[o.st] || String(o.st),
        state.paid ? 'PAID' : 'UNPAID',
        state.paid ? state.pm : 'Pending',
        !!o.vip,
        !!o.rush,
        o.id,
      ];
    }
  );

  const historicalOrderRows: (string | number | boolean)[][] = (
    state.dailyOrderHistory || []
  )
    .filter((h) => !state.orders.some((o) => o.id === h.id))
    .map((h) => [
      h.businessDate,
      h.dateFormatted,
      h.timeFormatted,
      h.counterNo,
      h.tableNo,
      h.orderSeq,
      h.source === 'waiter' ? 'Waiter' : 'Customer App',
      h.customerMob || 'Guest',
      h.itemsDetailed,
      h.totalItemsQty,
      h.orderSubtotal,
      h.orderStatus,
      h.billStatus,
      h.paymentMethod,
      false,
      false,
      h.id,
    ]);

  const Orders: (string | number | boolean)[][] = [
    [
      'Business_Date',
      'Date',
      'Time',
      'Counter_No',
      'Table_No',
      'Order_Round',
      'Order_Source',
      'Customer_Mobile',
      'Menu_Items_Ordered',
      'Total_Qty',
      'Order_Amount_INR',
      'Kitchen_Status',
      'Bill_Status',
      'Payment_Method',
      'VIP',
      'Rush',
      'Order_ID',
    ],
    ...activeOrderRows,
    ...historicalOrderRows,
  ];

  // Also include open sessions from other users stored in sessionsByUser
  const otherUserCounterRows: (string | number | boolean)[][] = Object.entries(
    state.sessionsByUser || {}
  )
    .filter(
      ([mobKey, snap]) =>
        snap.sess &&
        !snap.paid &&
        snap.sess.id !== state.sess?.id &&
        mobKey !== '__guest__'
    )
    .map(([mobKey, snap]) => {
      const { dateFormatted, timeFormatted } = formatIndianDateTime(
        snap.sess!.createdAt
      );
      const { summary } = formatItemsSummary(state.menu, snap.cart);
      const subVal = getSubtotal(state.menu, snap.cart);
      const discVal = getDiscount(subVal, snap.reel, snap.review);
      const totVal = getTotal(subVal, discVal);
      return [
        snap.sess!.businessDate || businessDateToday,
        dateFormatted,
        timeFormatted,
        snap.sess!.no,
        state.cmode.toUpperCase(),
        snap.sess!.table || state.activeTable,
        snap.sess!.mob || mobKey,
        summary || 'In progress',
        totVal,
        'OPEN / UNPAID',
        snap.pm || 'UPI',
      ];
    });

  // Daily_Counters: Day-wise counter number tracker (C1, C2, C3... per Business Date with Date, Time, Menu, Amount, Status)
  const Daily_Counters: (string | number | boolean)[][] = [
    [
      'Business_Date',
      'Date',
      'Time',
      'Counter_No',
      'Counter_Mode',
      'Table_No',
      'Customer_Mobile',
      'Menu_Items_Ordered',
      'Total_Bill_INR',
      'Payment_Status',
      'Payment_Method',
    ],
    ...(state.sess && !state.paid
      ? (() => {
          const { dateFormatted, timeFormatted } = formatIndianDateTime(
            state.sess.createdAt
          );
          const { summary } = formatItemsSummary(state.menu, state.cart);
          return [
            [
              state.sess.businessDate || businessDateToday,
              dateFormatted,
              timeFormatted,
              state.sess.no,
              state.cmode.toUpperCase(),
              state.activeTable,
              state.sess.mob || state.me.mob || 'Guest',
              summary || 'In progress',
              total,
              'OPEN / UNPAID',
              state.pm,
            ],
          ];
        })()
      : []),
    ...otherUserCounterRows,
    ...state.hist.map((h) => {
      const { dateFormatted, timeFormatted } = formatIndianDateTime(h.paidAt);
      return [
        h.businessDate || businessDateToday,
        dateFormatted,
        timeFormatted,
        h.counterNo || 'C1',
        state.cmode.toUpperCase(),
        h.table || state.activeTable,
        h.customerMob || 'Guest',
        h.itemsSummary || 'Paid Visit Items',
        h.a,
        'PAID',
        h.m,
      ];
    }),
  ];

  const Bills_Payments: (string | number | boolean)[][] = [
    [
      'Business_Date',
      'Date',
      'Time',
      'Counter_No',
      'Table_No',
      'Customer_Mobile',
      'Menu_Items_Ordered',
      'Subtotal_INR',
      'Discount_INR',
      'GST_5Pct_INR',
      'Total_INR',
      'Payment_Method',
      'Tagged_By',
      'Status',
      'Record_ID',
    ],
    ...(state.sess && !state.paid
      ? (() => {
          const { dateFormatted, timeFormatted } = formatIndianDateTime();
          const { summary } = formatItemsSummary(state.menu, state.cart);
          return [
            [
              state.sess.businessDate || businessDateToday,
              dateFormatted,
              timeFormatted,
              state.sess.no,
              state.activeTable,
              state.sess.mob || state.me.mob || 'Guest',
              summary,
              subtotal,
              discount,
              gst,
              total,
              state.pm,
              state.billSrc || 'draft',
              'UNPAID',
              `live-${state.sess.id}`,
            ],
          ];
        })()
      : []),
    ...state.hist.map((h) => {
      const { dateFormatted, timeFormatted } = formatIndianDateTime(h.paidAt);
      return [
        h.businessDate || businessDateToday,
        dateFormatted,
        timeFormatted,
        h.counterNo || 'C1',
        h.table || state.activeTable,
        h.customerMob || 'Guest',
        h.itemsSummary || 'Paid Visit',
        h.subtotal ?? h.a,
        h.discount ?? 0,
        h.gst ?? Math.round(h.a * 0.05),
        h.a,
        h.m,
        h.o,
        'PAID',
        h.id,
      ];
    }),
  ];

  const Loyalty_Ledger: (string | number | boolean)[][] = [
    ['Customer_Mobile', 'Stars', 'Points', 'Tier', 'Reward_Unlocked', 'Updated_At'],
    [
      state.me.mob || state.sess?.mob || 'Guest',
      state.stars,
      state.pts,
      state.pts >= 200 ? 'Gold' : 'Silver',
      state.stars >= 5,
      new Date().toISOString(),
    ],
  ];

  const Social_Reels_Reviews: (string | number | boolean)[][] = [
    [
      'Session_Counter',
      'Meal_Rating',
      'Google_Review_Posted',
      'Reel_Status',
      'Reel_Caption',
      'Connected_Platforms',
    ],
    [
      state.sess?.no || 'None',
      state.rating,
      state.review || state.reviewed,
      state.reel || 'none',
      state.reelCaption || '',
      Object.entries(state.soc)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', '),
    ],
  ];

  const Audit_Log: (string | number | boolean)[][] = [
    ['Log_ID', 'Who', 'Action', 'Target', 'Details', 'Timestamp'],
    ...state.auditLog.map((a) => [a.id, a.who, a.action, a.what, a.details, a.time]),
  ];

  const Drive_Assets: (string | number | boolean)[][] = [
    [
      'Asset_ID',
      'File_Name',
      'Kind',
      'Mime_Type',
      'Size_Bytes',
      'Drive_File_ID',
      'Drive_URL',
      'Caption',
      'Counter_No',
      'Uploaded_By',
      'Created_At',
    ],
    ...(state.driveAssets || []).map((d) => [
      d.id,
      d.name,
      d.kind,
      d.mimeType,
      d.sizeBytes,
      d.driveFileId || '',
      d.driveViewUrl || '',
      d.caption || '',
      d.counterNo || '',
      d.uploadedBy,
      d.createdAt,
    ]),
  ];

  return {
    Daily_Counters,
    Orders,
    Bills_Payments,
    Menu_Items,
    Sessions,
    Staff_Access,
    Loyalty_Ledger,
    Social_Reels_Reviews,
    Audit_Log,
    Drive_Assets,
    Restaurant_Config,
  };
}

export function toCsvString(rows: (string | number | boolean)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}

export function extractSpreadsheetIdFromUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function extractDriveFolderIdFromUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

export function parseMenuFromSheetRows(rows: unknown[][]): Dish[] | null {
  if (!Array.isArray(rows) || rows.length <= 1) return null;
  const dishes: Dish[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[2]) continue;
    const id = Number(r[0]) || i;
    const e = String(r[1] || '🍲').trim();
    const en = String(r[2] || '').trim();
    if (!en) continue;
    const hi = String(r[3] || en).trim();
    const gu = String(r[4] || en).trim();
    const p = Number(String(r[5] || '100').replace(/[^0-9.]/g, '')) || 100;
    const vRaw = String(r[7] ?? 'true').trim().toLowerCase();
    const v = vRaw === 'false' || vRaw === '0' || vRaw === 'no' ? 0 : 1;
    const jainRaw = String(r[8] ?? 'false').trim().toLowerCase();
    const jain = jainRaw === 'true' || jainRaw === '1' || jainRaw === 'yes';
    const availRaw = String(r[9] ?? 'true').trim().toLowerCase();
    const available = availRaw !== 'false' && availRaw !== '0' && availRaw !== 'no';
    dishes.push({
      id,
      e,
      p,
      v,
      jain,
      available,
      n: { en, hi, gu },
    });
  }
  return dishes.length > 0 ? dishes : null;
}

export function parseStaffFromSheetRows(rows: unknown[][]): StaffMember[] | null {
  if (!Array.isArray(rows) || rows.length <= 1) return null;
  const staff: StaffMember[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[1] || !r[2]) continue;
    staff.push({
      id: String(r[0] || `st-${i}`),
      n: String(r[1]).trim(),
      ph: String(r[2]).trim(),
      r: (String(r[3] || 'Waiter').trim() as StaffRoleName),
      mg: String(r[4]).toLowerCase() === 'true' || r[4] === true,
      on: String(r[5]).toLowerCase() === 'false' ? 0 : 1,
    });
  }
  return staff.length > 0 ? staff : null;
}

export interface ParsedSheetCounterState {
  counterBusinessDate?: string;
  nextCtr?: number;
  usedCountersToday?: string[];
  counterByMob: Record<string, string>;
}

export function parseConfigFromSheetRows(
  rows: unknown[][]
): Partial<AppState['googleConfig']> | null {
  if (!Array.isArray(rows) || rows.length <= 1) return null;
  const cfg: Partial<AppState['googleConfig']> = {};
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    const key = String(r[0]).trim();
    const val = String(r[1] ?? '').trim();
    if (key === 'appsScriptWebAppUrl' && val) cfg.appsScriptWebAppUrl = val;
    if (key === 'spreadsheetId' && val) cfg.spreadsheetId = val;
    if (key === 'driveFolderId' && val) cfg.driveFolderId = val;
  }
  return Object.keys(cfg).length > 0 ? cfg : null;
}

export function normalizeSheetDateString(raw: string): string {
  const s = (raw || '').trim();
  const dateMatch = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/);
  if (dateMatch) {
    const y = dateMatch[1];
    const m = String(Number(dateMatch[2]) + 1).padStart(2, '0');
    const d = String(Number(dateMatch[3])).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

export function parseDailyCountersAndStateFromSheets(
  configRows?: unknown[][],
  dailyCountersRows?: unknown[][]
): ParsedSheetCounterState {
  const todayBizDate = getCurrentBusinessDate();
  const usedSet = new Set<string>();
  const counterByMob: Record<string, string> = {};
  let maxNumberSeen = 0;

  const recordCounter = (cnoRaw: string, mobRaw?: string, statusRaw?: string) => {
    const cno = (cnoRaw || '').trim().toUpperCase();
    if (!cno || cno === 'PENDING' || cno === 'COUNTER_NO') return;
    usedSet.add(cno);
    const numMatch = cno.match(/^C(\d+)$/i);
    if (numMatch && numMatch[1]) {
      const n = Number(numMatch[1]);
      if (n > maxNumberSeen) maxNumberSeen = n;
    }
    const mob = (mobRaw || '').trim();
    const st = (statusRaw || '').toUpperCase();
    if (mob && mob !== 'Guest' && !st.includes('PAID')) {
      counterByMob[mob] = cno;
    }
  };

  if (Array.isArray(configRows) && configRows.length > 1) {
    let cfgDate = '';
    let cfgNextCtr = 0;
    let cfgUsed = '';
    for (let i = 1; i < configRows.length; i++) {
      const r = configRows[i];
      if (!r || !r[0]) continue;
      const k = String(r[0]).trim();
      const v = String(r[1] ?? '').trim();
      if (k === 'counter_business_date') cfgDate = normalizeSheetDateString(v);
      if (k === 'next_counter_number') cfgNextCtr = Number(v) || 0;
      if (k === 'used_counters_today') cfgUsed = v;
    }
    if (cfgDate === todayBizDate) {
      if (cfgNextCtr > maxNumberSeen + 1 && cfgNextCtr < 24) {
        maxNumberSeen = cfgNextCtr - 1;
      }
      if (cfgUsed) {
        cfgUsed
          .split(',')
          .filter((c) => !/^C2[4-9]$/i.test(c.trim()))
          .forEach((c) => recordCounter(c));
      }
    }
  }

  if (Array.isArray(dailyCountersRows) && dailyCountersRows.length > 1) {
    for (let i = 1; i < dailyCountersRows.length; i++) {
      const r = dailyCountersRows[i];
      if (!r || !r[0]) continue;
      const rowBizDate = normalizeSheetDateString(String(r[0] || ''));
      const rowCounterNo = String(r[3] || '').trim();
      const rowMob = String(r[6] || '').trim();
      const rowPayStatus = String(r[9] || '').trim();
      if (rowBizDate === todayBizDate && !/^C2[3-9]$/i.test(rowCounterNo)) {
        recordCounter(rowCounterNo, rowMob, rowPayStatus);
      }
    }
  }

  return {
    counterBusinessDate: todayBizDate,
    nextCtr: maxNumberSeen > 0 ? maxNumberSeen + 1 : undefined,
    usedCountersToday: Array.from(usedSet),
    counterByMob,
  };
}

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Tadka Restaurant Growth Platform — 2-Way Google Sheets & Google Drive Storage Bridge
 * 
 * Setup Instructions (2 minutes, no GCP billing required):
 * 1. Create a new Google Sheet and open Extensions -> Apps Script.
 * 2. Paste this code into Code.gs and click Save.
 * 3. Click Deploy -> New deployment -> Select type: Web app.
 * 4. Set "Execute as: Me" and "Who has access: Anyone", then click Deploy.
 * 5. Copy the Web App URL and paste it in Tadka -> Admin -> Google Drive & Sheets Storage.
 */

function extractId(rawOrUrl, pattern) {
  if (!rawOrUrl) return '';
  var str = String(rawOrUrl).trim();
  var m = str.match(pattern);
  return m && m[1] ? m[1] : str;
}

// 1. PULL FROM GOOGLE SHEET -> APP (Supports both Fetch JSON and JSONP ?callback=...)
function doGet(e) {
  try {
    var sheetId = e && e.parameter && e.parameter.spreadsheetId
      ? extractId(e.parameter.spreadsheetId, /\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/)
      : '';
    var ss = sheetId
      ? SpreadsheetApp.openById(sheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    var result = {};
    ss.getSheets().forEach(function(sheet) {
      result[sheet.getName()] = sheet.getDataRange().getValues();
    });

    var jsonStr = JSON.stringify({
      ok: true,
      sheets: result
    });

    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + jsonStr + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(jsonStr)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errStr = JSON.stringify({ ok: false, error: String(err) });
    if (e && e.parameter && e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + errStr + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(errStr)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 2. PUSH FROM APP -> GOOGLE SHEET & DRIVE (2-Way Write)
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

    if (action === 'PULL_ALL_SHEETS') {
      var pullSheetId = extractId(payload.spreadsheetId, /\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
      var pullSs = pullSheetId
        ? SpreadsheetApp.openById(pullSheetId)
        : SpreadsheetApp.getActiveSpreadsheet();
      var pullResult = {};
      pullSs.getSheets().forEach(function(sheet) {
        pullResult[sheet.getName()] = sheet.getDataRange().getValues();
      });
      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        sheets: pullResult
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'SYNC_ALL_SHEETS') {
      var sheetId = extractId(payload.spreadsheetId, /\\/spreadsheets\\/d\\/([a-zA-Z0-9-_]+)/);
      var ss = sheetId
        ? SpreadsheetApp.openById(sheetId)
        : SpreadsheetApp.getActiveSpreadsheet();
      var sheets = payload.sheets || {};

      Object.keys(sheets).forEach(function(tabName) {
        var rows = sheets[tabName];
        if (!rows || !rows.length) return;
        var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
        sheet.clearContents();
        sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      });

      // Also save or update tadka-config.json inside the restaurant's Google Drive folder
      if (payload.configJson) {
        try {
          var cfgFolderId = extractId(payload.driveFolderId, /\\/folders\\/([a-zA-Z0-9-_]+)/);
          var cfgFolder = cfgFolderId ? DriveApp.getFolderById(cfgFolderId) : DriveApp.getRootFolder();
          var existing = cfgFolder.getFilesByName('tadka-config.json');
          var cfgContent = JSON.stringify(payload.configJson, null, 2);
          if (existing.hasNext()) {
            existing.next().setContent(cfgContent);
          } else {
            cfgFolder.createFile('tadka-config.json', cfgContent, MimeType.PLAIN_TEXT);
          }
        } catch (cfgErr) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        spreadsheetUrl: ss.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'UPLOAD_DRIVE_FILE') {
      var folderId = extractId(payload.driveFolderId, /\\/folders\\/([a-zA-Z0-9-_]+)/);
      var folder = folderId
        ? DriveApp.getFolderById(folderId)
        : DriveApp.getRootFolder();
      var cleaned = (payload.base64Data || '').replace(/^data:[^;]+;base64,/, '');
      var bytes = cleaned ? Utilities.base64Decode(cleaned) : Utilities.newBlob('Tadka Media Asset').getBytes();
      var blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName || 'tadka_upload.bin');
      var file = folder.createFile(blob);
      file.setDescription(payload.caption || 'Uploaded from Tadka Restaurant Growth Platform');

      return ContentService.createTextOutput(JSON.stringify({
        ok: true,
        fileId: file.getId(),
        viewUrl: file.getUrl()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unknown action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

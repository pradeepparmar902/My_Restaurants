import { AppState, Dish, StaffMember, StaffRoleName } from '@/types/tadka';
import { getSubtotal, getDiscount, getGST, getTotal } from '@/lib/helpers';

export type SheetTabName =
  | 'Menu_Items'
  | 'Staff_Access'
  | 'Sessions'
  | 'Orders'
  | 'Bills_Payments'
  | 'Loyalty_Ledger'
  | 'Social_Reels_Reviews'
  | 'Audit_Log'
  | 'Drive_Assets';

export function buildSheetRowsForState(
  state: AppState
): Record<SheetTabName, (string | number | boolean)[][]> {
  const subtotal = getSubtotal(state.menu, state.cart);
  const discount = getDiscount(subtotal, state.reel, state.review);
  const gst = getGST(subtotal, discount);
  const total = getTotal(subtotal, discount);

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
      'Session_ID',
      'Counter_No',
      'Table_No',
      'Customer_Mobile',
      'Status',
      'Created_By_Staff',
      'WhatsApp_Consent',
      'Business_Date',
      'Created_At',
    ],
    ...(state.sess
      ? [
          [
            state.sess.id,
            state.sess.no,
            state.sess.table,
            state.sess.mob || 'Guest',
            state.sess.status,
            !!state.sess.staff,
            !!state.sess.waConsent,
            state.sess.businessDate,
            state.sess.createdAt,
          ],
        ]
      : []),
  ];

  const Orders: (string | number | boolean)[][] = [
    [
      'Order_ID',
      'Order_Seq',
      'Counter_No',
      'Table_No',
      'Source',
      'Status',
      'Items_Summary',
      'VIP',
      'Rush',
      'Created_At',
    ],
    ...state.orders.map((o) => {
      const summary = state.menu
        .filter((m) => o.it[m.id])
        .map((m) => `${o.it[m.id]}x ${m.n.en}`)
        .join(', ');
      return [
        o.id,
        o.k,
        state.sess?.no || 'Pending',
        state.activeTable,
        o.src,
        o.st,
        summary,
        !!o.vip,
        !!o.rush,
        o.createdAt,
      ];
    }),
  ];

  const Bills_Payments: (string | number | boolean)[][] = [
    [
      'Record_ID',
      'Counter_No',
      'Table_No',
      'Subtotal_INR',
      'Discount_INR',
      'GST_5Pct_INR',
      'Total_INR',
      'Payment_Method',
      'Tagged_By',
      'Status',
      'Timestamp',
    ],
    ...(state.sess && !state.paid
      ? [
          [
            `live-${state.sess.id}`,
            state.sess.no,
            state.activeTable,
            subtotal,
            discount,
            gst,
            total,
            state.pm,
            state.billSrc || 'draft',
            'UNPAID',
            new Date().toISOString(),
          ],
        ]
      : []),
    ...state.hist.map((h) => [
      h.id,
      h.counterNo || 'C27',
      h.table || state.activeTable,
      h.a,
      0,
      Math.round(h.a * 0.05),
      h.a,
      h.m,
      h.o,
      'PAID',
      h.paidAt,
    ]),
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
    Menu_Items,
    Staff_Access,
    Sessions,
    Orders,
    Bills_Payments,
    Loyalty_Ledger,
    Social_Reels_Reviews,
    Audit_Log,
    Drive_Assets,
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

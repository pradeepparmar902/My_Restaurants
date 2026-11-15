import { AppState } from '@/types/tadka';
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

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Tadka Restaurant Growth Platform — Google Sheets & Google Drive Storage Bridge
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

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;

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

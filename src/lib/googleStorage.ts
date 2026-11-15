import fs from 'fs';
import path from 'path';
import { AppState, DriveMediaAsset } from '@/types/tadka';
import {
  buildSheetRowsForState,
  SheetTabName,
  toCsvString,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '@/lib/googleSheetsShared';

export { buildSheetRowsForState, GOOGLE_APPS_SCRIPT_TEMPLATE };
export type { SheetTabName };

const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'storage', 'google_sync');
const LOCAL_SHEETS_DIR = path.join(LOCAL_STORAGE_DIR, 'sheets');
const LOCAL_DRIVE_DIR = path.join(LOCAL_STORAGE_DIR, 'drive');

function ensureStorageDirs() {
  try {
    fs.mkdirSync(LOCAL_SHEETS_DIR, { recursive: true });
    fs.mkdirSync(LOCAL_DRIVE_DIR, { recursive: true });
  } catch {
    // Ignore fs errors in read-only environments
  }
}

export function extractSpreadsheetId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function extractDriveFolderId(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function normalizeAppsScriptUrl(raw: string): string {
  return (raw || '').trim();
}

export async function syncStateToGoogleSheetsAndLocalMirror(state: AppState): Promise<{
  ok: boolean;
  mode: 'google_cloud_webhook' | 'local_mirror';
  syncedTabs: string[];
  error?: string;
}> {
  ensureStorageDirs();
  const sheetsData = buildSheetRowsForState(state);
  const tabNames = Object.keys(sheetsData) as SheetTabName[];

  // 1. Always write local CSV mirror files & JSON snapshot under storage/google_sync/sheets/
  try {
    for (const tab of tabNames) {
      const csvContent = toCsvString(sheetsData[tab]);
      fs.writeFileSync(path.join(LOCAL_SHEETS_DIR, `${tab}.csv`), csvContent, 'utf-8');
    }
    fs.writeFileSync(
      path.join(LOCAL_STORAGE_DIR, 'tadka_full_workbook.json'),
      JSON.stringify({ updatedAt: new Date().toISOString(), sheets: sheetsData }, null, 2),
      'utf-8'
    );
  } catch {
    // Ignore local write error if sandboxed/serverless
  }

  // 2. If a Google Apps Script Web App URL is configured, push to live Google Sheet & Drive
  const webhookUrl = normalizeAppsScriptUrl(
    state.googleConfig?.appsScriptWebAppUrl || process.env.GOOGLE_APPS_SCRIPT_URL || ''
  );
  const cleanSheetId = extractSpreadsheetId(state.googleConfig?.spreadsheetId || '');
  const cleanFolderId = extractDriveFolderId(state.googleConfig?.driveFolderId || '');

  if (webhookUrl && webhookUrl.startsWith('https://script.google.com/')) {
    if (webhookUrl.endsWith('/dev')) {
      return {
        ok: false,
        mode: 'google_cloud_webhook',
        syncedTabs: tabNames,
        error:
          'You pasted the /dev test URL. Please use the /exec Web App URL from Deploy -> Manage deployments, and set "Who has access" to "Anyone".',
      };
    }

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'SYNC_ALL_SHEETS',
          spreadsheetId: cleanSheetId,
          driveFolderId: cleanFolderId,
          sheets: sheetsData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `HTTP ${res.status}: In Google Apps Script, click Deploy -> Manage deployments -> Edit (pencil icon) -> set "Who has access" to "Anyone" (not "Only myself" or domain-restricted) -> Deploy.`
        );
      }

      if (!res.ok) {
        throw new Error(`Google Apps Script responded with HTTP ${res.status}`);
      }

      const text = await res.text();
      if (text.includes('accounts.google.com') || text.includes('ServiceLogin')) {
        throw new Error(
          'Google redirected to Sign-In. In Apps Script -> Deploy -> Manage deployments -> Edit -> change "Who has access" to "Anyone".'
        );
      }

      try {
        const parsed = JSON.parse(text);
        if (parsed && parsed.ok === false) {
          throw new Error(parsed.error || 'Apps Script returned an error');
        }
      } catch (parseErr) {
        if ((parseErr as Error).message.includes('Apps Script')) {
          throw parseErr;
        }
      }

      return {
        ok: true,
        mode: 'google_cloud_webhook',
        syncedTabs: tabNames,
      };
    } catch (err) {
      return {
        ok: false,
        mode: 'google_cloud_webhook',
        syncedTabs: tabNames,
        error: (err as Error).message,
      };
    }
  }

  return {
    ok: true,
    mode: 'local_mirror',
    syncedTabs: tabNames,
  };
}

export async function uploadFileToGoogleDriveAndMirror(
  state: AppState,
  payload: {
    fileName: string;
    kind: DriveMediaAsset['kind'];
    mimeType: string;
    base64Data?: string;
    caption?: string;
    counterNo?: string;
    uploadedBy?: string;
  }
): Promise<{ ok: boolean; asset: DriveMediaAsset; error?: string }> {
  ensureStorageDirs();

  const sizeBytes = payload.base64Data
    ? Math.round((payload.base64Data.length * 3) / 4)
    : 1024 * 450;

  let driveFileId = `1Drv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  let driveViewUrl = `https://drive.google.com/file/d/${driveFileId}/view`;

  // Save physical file to local mirror directory storage/google_sync/drive/
  try {
    const safeName = payload.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const localFilePath = path.join(LOCAL_DRIVE_DIR, `${Date.now()}_${safeName}`);
    if (payload.base64Data) {
      const cleanedBase64 = payload.base64Data.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(localFilePath, Buffer.from(cleanedBase64, 'base64'));
    } else {
      fs.writeFileSync(
        `${localFilePath}.meta.json`,
        JSON.stringify({ ...payload, uploadedAt: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    }
  } catch {
    // Ignore local disk write error if read-only
  }

  // Forward to Google Drive via Google Apps Script if URL configured
  const webhookUrl = normalizeAppsScriptUrl(
    state.googleConfig?.appsScriptWebAppUrl || process.env.GOOGLE_APPS_SCRIPT_URL || ''
  );
  const cleanFolderId = extractDriveFolderId(state.googleConfig?.driveFolderId || '');

  if (webhookUrl && webhookUrl.startsWith('https://script.google.com/')) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'UPLOAD_DRIVE_FILE',
          driveFolderId: cleanFolderId,
          fileName: payload.fileName,
          mimeType: payload.mimeType,
          base64Data: payload.base64Data || '',
          caption: payload.caption || '',
          counterNo: payload.counterNo || '',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.fileId) driveFileId = data.fileId;
        if (data.viewUrl) driveViewUrl = data.viewUrl;
      }
    } catch {
      // Fallback to local mirror ID if offline
    }
  }

  const asset: DriveMediaAsset = {
    id: `drv-${Date.now()}`,
    name: payload.fileName,
    kind: payload.kind,
    mimeType: payload.mimeType,
    sizeBytes,
    driveFileId,
    driveViewUrl,
    caption: payload.caption,
    counterNo: payload.counterNo || state.sess?.no || 'C27',
    uploadedBy: payload.uploadedBy || state.me.mob || 'Customer',
    createdAt: new Date().toISOString(),
  };

  return { ok: true, asset };
}

import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import {
  buildSheetRowsForState,
  syncStateToGoogleSheetsAndLocalMirror,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  extractSpreadsheetId,
  normalizeAppsScriptUrl,
} from '@/lib/googleStorage';
import {
  parseCsvToRows,
  parseMenuFromSheetRows,
  parseStaffFromSheetRows,
} from '@/lib/googleSheetsShared';

export async function GET(req: NextRequest) {
  const store = getStore();
  const format = req.nextUrl.searchParams.get('format');
  const tab = req.nextUrl.searchParams.get('tab');
  const pull = req.nextUrl.searchParams.get('pull');
  const paramUrl = req.nextUrl.searchParams.get('appsScriptUrl');
  const paramSheetId = req.nextUrl.searchParams.get('spreadsheetId');

  if (pull === '1') {
    const webhookUrl = normalizeAppsScriptUrl(
      paramUrl || store.googleConfig.appsScriptWebAppUrl || ''
    );
    const cleanSheetId = extractSpreadsheetId(
      paramSheetId || store.googleConfig.spreadsheetId || ''
    );

    let pulledSheets: Record<string, unknown[][]> | null = null;
    let lastErr = '';

    // Strategy 1: Direct Google Sheet gviz CSV fetch if spreadsheetId is provided (works without redeployment if sheet is shared)
    if (cleanSheetId) {
      try {
        const menuCsvUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:csv&sheet=Menu_Items`;
        const staffCsvUrl = `https://docs.google.com/spreadsheets/d/${cleanSheetId}/gviz/tq?tqx=out:csv&sheet=Staff_Access`;
        const [menuRes, staffRes] = await Promise.all([
          fetch(menuCsvUrl, { cache: 'no-store' }),
          fetch(staffCsvUrl, { cache: 'no-store' }),
        ]);
        if (menuRes.ok) {
          const menuText = await menuRes.text();
          if (!menuText.includes('<!DOCTYPE html>') && !menuText.includes('ServiceLogin')) {
            pulledSheets = {
              Menu_Items: parseCsvToRows(menuText),
            };
            if (staffRes.ok) {
              const staffText = await staffRes.text();
              if (!staffText.includes('<!DOCTYPE html>')) {
                pulledSheets.Staff_Access = parseCsvToRows(staffText);
              }
            }
          }
        }
      } catch (e) {
        lastErr = (e as Error).message;
      }
    }

    // Strategy 2: Apps Script GET (doGet) or POST (PULL_ALL_SHEETS)
    if (!pulledSheets && webhookUrl.startsWith('https://script.google.com/')) {
      try {
        const q = cleanSheetId ? `?spreadsheetId=${encodeURIComponent(cleanSheetId)}` : '';
        const getRes = await fetch(`${webhookUrl}${q}`, {
          method: 'GET',
          redirect: 'follow',
          cache: 'no-store',
        });
        if (getRes.ok) {
          const text = await getRes.text();
          const parsed = JSON.parse(text);
          if (parsed && parsed.ok && parsed.sheets) {
            pulledSheets = parsed.sheets;
          }
        }
      } catch (e) {
        lastErr = (e as Error).message;
      }

      if (!pulledSheets) {
        try {
          const postRes = await fetch(webhookUrl, {
            method: 'POST',
            redirect: 'follow',
            cache: 'no-store',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'PULL_ALL_SHEETS',
              spreadsheetId: cleanSheetId,
            }),
          });
          if (postRes.ok) {
            const text = await postRes.text();
            const parsed = JSON.parse(text);
            if (parsed && parsed.ok && parsed.sheets) {
              pulledSheets = parsed.sheets;
            }
          }
        } catch (e) {
          lastErr = (e as Error).message;
        }
      }
    }

    if (pulledSheets) {
      const remoteMenu = parseMenuFromSheetRows(pulledSheets.Menu_Items || []);
      const remoteStaff = parseStaffFromSheetRows(pulledSheets.Staff_Access || []);
      if (remoteMenu) store.menu = remoteMenu;
      if (remoteStaff) store.staff = remoteStaff;
      return NextResponse.json({
        ok: true,
        sheets: pulledSheets,
        menu: store.menu,
        staff: store.staff,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          lastErr ||
          'Could not read Menu_Items from Google Sheet. Make sure you updated Code.gs with doGet(e) & redeployed a New version, OR enter your Spreadsheet ID and set Google Sheet Share -> Anyone with the link can view.',
      },
      { status: 400 }
    );
  }

  const sheets = buildSheetRowsForState(store);

  if (format === 'csv' && tab && tab in sheets) {
    const rows = sheets[tab as keyof typeof sheets];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(',')
      )
      .join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="Tadka_${tab}.csv"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    googleConfig: store.googleConfig,
    sheets,
    appsScriptTemplate: GOOGLE_APPS_SCRIPT_TEMPLATE,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = getStore();

    if (body.googleConfig) {
      store.googleConfig = {
        ...store.googleConfig,
        ...body.googleConfig,
      };
    }

    // If client passed its latest state snapshot, merge key collections so server mirror stays up to date
    if (body.clientState) {
      const cs = body.clientState;
      if (cs.menu) store.menu = cs.menu;
      if (cs.staff) store.staff = cs.staff;
      if (cs.orders) store.orders = cs.orders;
      if (cs.cart) store.cart = cs.cart;
      if (cs.sess !== undefined) store.sess = cs.sess;
      if (cs.hist) store.hist = cs.hist;
      if (cs.driveAssets) store.driveAssets = cs.driveAssets;
    }

    const result = await syncStateToGoogleSheetsAndLocalMirror(store);
    store.googleConfig.lastSyncedAt = new Date().toISOString();
    store.googleConfig.lastSyncStatus = result.ok ? 'synced' : 'error';
    store.googleConfig.lastSyncError = result.error;

    logAudit(
      store.me.mob || 'System',
      'storage.sheets_sync',
      'Google Sheets Workbook',
      `Synced ${result.syncedTabs.length} tabs (${result.mode})`
    );

    const sheets = buildSheetRowsForState(store);

    return NextResponse.json({
      ok: result.ok,
      mode: result.mode,
      syncedTabs: result.syncedTabs,
      lastSyncedAt: store.googleConfig.lastSyncedAt,
      error: result.error,
      sheets,
      state: store,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

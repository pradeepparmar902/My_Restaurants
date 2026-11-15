import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import {
  buildSheetRowsForState,
  syncStateToGoogleSheetsAndLocalMirror,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
} from '@/lib/googleStorage';

export async function GET(req: NextRequest) {
  const store = getStore();
  const format = req.nextUrl.searchParams.get('format');
  const tab = req.nextUrl.searchParams.get('tab');
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

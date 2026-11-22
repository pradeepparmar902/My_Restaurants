import { NextRequest, NextResponse } from 'next/server';
import { getTableStatusMap, setTableStatus } from '@/lib/serverStore';

export async function GET() {
  return NextResponse.json({
    success: true,
    tables: getTableStatusMap(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tableId = Number(body.tableId);
    const active = Boolean(body.active);
    if (!tableId || tableId < 1) {
      return NextResponse.json({ success: false, error: 'Invalid table ID' }, { status: 400 });
    }
    const updated = setTableStatus(tableId, active);
    return NextResponse.json({
      success: true,
      tableId,
      active,
      tables: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

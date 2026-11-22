import { NextRequest, NextResponse } from 'next/server';
import { getTableStatusMap, setTableStatus } from '@/lib/serverStore';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenant = searchParams.get('tenant') || searchParams.get('w') || 'default';
  return NextResponse.json(
    {
      success: true,
      tenant,
      tables: getTableStatusMap(tenant),
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tableId = Number(body.tableId);
    const active = Boolean(body.active);
    const tenant = (body.tenant || body.w || 'default').toString();

    if (!tableId || tableId < 1) {
      return NextResponse.json(
        { success: false, error: 'Invalid table ID' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const updated = setTableStatus(tableId, active, tenant);
    return NextResponse.json(
      {
        success: true,
        tenant,
        tableId,
        active,
        tables: updated,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_GATEWAY = process.env.WHATSAPP_GATEWAY_URL || 'http://localhost:5050';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'status';
  const gatewayUrl = (searchParams.get('gatewayUrl') || DEFAULT_GATEWAY).replace(/\/$/, '');
  const sessionId = searchParams.get('sessionId') || 'default';

  try {
    if (action === 'status') {
      const res = await fetch(`${gatewayUrl}/api/status?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'sessions') {
      const res = await fetch(`${gatewayUrl}/api/sessions`, { cache: 'no-store' });
      const data = await res.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, status: 'offline', error: err?.message || 'Gateway connection failed' },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'send', gatewayUrl = DEFAULT_GATEWAY, sessionId = 'default', to, text } = body;
    const cleanGateway = gatewayUrl.replace(/\/$/, '');

    if (action === 'connect') {
      const res = await fetch(`${cleanGateway}/api/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'disconnect') {
      const res = await fetch(`${cleanGateway}/api/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      return NextResponse.json(data);
    }

    if (action === 'send') {
      if (!to || !text) {
        return NextResponse.json({ ok: false, error: 'Missing "to" or "text"' }, { status: 400 });
      }

      const res = await fetch(`${cleanGateway}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, to, text }),
      });
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Gateway proxy failure' },
      { status: 502 }
    );
  }
}

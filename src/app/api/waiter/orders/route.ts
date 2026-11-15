import { NextRequest, NextResponse } from 'next/server';
import { bookWaiterOrderInStore } from '@/lib/serverStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, counterNo, mob } = body;
    const res = bookWaiterOrderInStore(items || {}, counterNo, mob);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      session: res.state.sess,
      orders: res.state.orders,
      state: res.state,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

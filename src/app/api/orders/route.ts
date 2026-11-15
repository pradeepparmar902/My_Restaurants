import { NextRequest, NextResponse } from 'next/server';
import { getStore, placeCustomerOrderInStore } from '@/lib/serverStore';

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    ok: true,
    orders: store.orders,
    session: store.sess,
    cart: store.cart,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, mob, waConsent } = body;
    const res = placeCustomerOrderInStore(items || {}, mob, waConsent);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      guestToken: res.state.sess?.guestToken,
      session: res.state.sess,
      orders: res.state.orders,
      state: res.state,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { completePaymentInStore } from '@/lib/serverStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method = 'UPI' } = body;
    const store = completePaymentInStore(method, 'app');
    return NextResponse.json({
      ok: true,
      paid: true,
      whatsappQueued: store.wab && !!store.sess?.mob,
      state: store,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

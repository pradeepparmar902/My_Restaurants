import { NextRequest, NextResponse } from 'next/server';
import { completePaymentInStore, getStore } from '@/lib/serverStore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { method = 'Cash', sampleIndex } = body;
    const store = getStore();

    if (typeof sampleIndex === 'number' && store.samp[sampleIndex]) {
      const removed = store.samp.splice(sampleIndex, 1)[0];
      store.spaid += removed.a;
      return NextResponse.json({ ok: true, state: store });
    }

    const updated = completePaymentInStore(method, 'owner');
    return NextResponse.json({
      ok: true,
      paid: true,
      state: updated,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

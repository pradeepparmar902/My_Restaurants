import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import { cleanCounterNumber } from '@/lib/helpers';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await context.params;
    const body = await req.json();
    const { counterNo, autoAssign } = body;
    const store = getStore();

    if (!store.sess) {
      return NextResponse.json({ ok: false, error: 'No open session found' }, { status: 404 });
    }

    if (autoAssign) {
      const assigned = `C${store.ctr++}`;
      store.sess = { ...store.sess, no: assigned, pend: false };
      logAudit(store.me.mob || 'Staff', 'session.counter', assigned, 'Assigned counter number');
      return NextResponse.json({ ok: true, counterNo: assigned, state: store });
    }

    const v = cleanCounterNumber(counterNo || '');
    if (!v) {
      return NextResponse.json({ ok: false, error: 'Enter the number you were given' }, { status: 400 });
    }

    // Check duplicate counter number in active sample rows
    if (store.samp.some((s) => s.no.toUpperCase() === v)) {
      return NextResponse.json(
        { ok: false, error: 'That counter number is already in use today' },
        { status: 409 }
      );
    }

    store.sess = { ...store.sess, no: v, pend: false };
    logAudit(store.me.mob || 'User', 'session.counter', v, 'Saved counter number');
    return NextResponse.json({ ok: true, counterNo: v, state: store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

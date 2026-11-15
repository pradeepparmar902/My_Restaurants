import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import { getSubtotal, getDiscount, getGST, getTotal } from '@/lib/helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mob, recall } = body;
    const store = getStore();

    if (recall) {
      store.billSrc = '';
      store.cashReq = false;
      if (store.sess) store.sess.status = 'open';
      logAudit(store.me.mob || 'Staff', 'bills.recall', 'Session Bill', 'Recalled pushed bill');
      return NextResponse.json({ ok: true, recalled: true, state: store });
    }

    if (!store.sess) {
      return NextResponse.json({ ok: false, error: 'No open session to bill' }, { status: 400 });
    }

    const itemCount = Object.values(store.cart).reduce((a, b) => a + b, 0);
    if (itemCount === 0) {
      return NextResponse.json({ ok: false, error: 'Nothing to bill' }, { status: 400 });
    }

    if (mob && !store.sess.mob) {
      store.sess.mob = mob;
    }

    store.billSrc = 'waiter';
    store.paid = false;
    store.cashReq = false;
    store.split = 1;
    store.sess.status = 'billed';

    const subtotal = getSubtotal(store.menu, store.cart);
    const discount = getDiscount(subtotal, store.reel, store.review);
    const gst = getGST(subtotal, discount);
    const total = getTotal(subtotal, discount);

    logAudit(store.me.mob || 'Staff', 'bills.push', `Bill ₹${total}`, `Pushed bill for ${store.sess.no}`);

    return NextResponse.json({
      ok: true,
      bill: {
        subtotalInPaise: subtotal * 100,
        discountInPaise: discount * 100,
        gstInPaise: gst * 100,
        totalInPaise: total * 100,
        subtotal,
        discount,
        gst,
        total,
      },
      state: store,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

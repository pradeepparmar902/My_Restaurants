import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { status, rush, expectedStatus } = body;
    const store = getStore();

    const orderIndex = store.orders.findIndex((o) => o.id === id || String(o.k) === id);
    if (orderIndex === -1) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    const order = store.orders[orderIndex];
    if (typeof expectedStatus === 'number' && order.st !== expectedStatus) {
      return NextResponse.json(
        { ok: false, error: 'Order was changed by someone else, refresh' },
        { status: 409 }
      );
    }

    if (typeof rush === 'boolean') {
      order.rush = rush;
      logAudit(store.me.mob || 'Chef', 'orders.kitchen', `Order #${order.k}`, `Rush set to ${rush}`);
    }

    if (typeof status === 'number') {
      if (status === 4 && store.sess?.pend) {
        return NextResponse.json(
          { ok: false, error: 'Set counter number before marking delivered' },
          { status: 400 }
        );
      }
      order.st = status as 1 | 2 | 3 | 4 | 5;
      if (status === 3) order.readyAt = new Date().toISOString();
      if (status === 4) order.deliveredAt = new Date().toISOString();
      store.status = status;
      logAudit(store.me.mob || 'Staff', 'orders.status', `Order #${order.k}`, `Status moved to ${status}`);
    }

    return NextResponse.json({ ok: true, order, state: store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

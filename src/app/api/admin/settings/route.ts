import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit, updateMenuItemInStore } from '@/lib/serverStore';
import { CounterMode } from '@/types/tadka';

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    ok: true,
    wab: store.wab,
    cmode: store.cmode,
    menu: store.menu,
    tables: store.tables,
    state: store,
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { wab, cmode, dish, regenerateTableId } = body;
    const store = getStore();

    if (typeof wab === 'boolean') {
      store.wab = wab;
      logAudit(store.me.mob || 'Admin', 'settings.edit', 'WhatsApp Final Bill', `Set to ${wab}`);
    }

    if (cmode === 'auto' || cmode === 'manual') {
      store.cmode = cmode as CounterMode;
      if (cmode === 'auto' && store.sess && store.sess.pend) {
        store.sess = { ...store.sess, no: `C${store.ctr++}`, pend: false };
      }
      logAudit(store.me.mob || 'Admin', 'settings.edit', 'Counter Mode', `Set to ${cmode}`);
    }

    if (dish) {
      updateMenuItemInStore(dish);
      logAudit(store.me.mob || 'Admin', 'menu.edit', dish.n?.en || `Dish #${dish.id}`, 'Updated menu item');
    }

    if (typeof regenerateTableId === 'number') {
      const tbl = store.tables.find((t) => t.id === regenerateTableId);
      if (tbl) {
        tbl.token = `qr-tadka-t${tbl.id}-${Math.random().toString(36).slice(2, 6)}`;
        logAudit(store.me.mob || 'Admin', 'settings.edit', tbl.label, `Regenerated QR token: ${tbl.token}`);
      }
    }

    return NextResponse.json({ ok: true, state: store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import { StaffRoleName } from '@/types/tadka';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await req.json();
    const { mg, on, role } = body;
    const store = getStore();

    const idx = store.staff.findIndex((s, i) => s.id === id || String(i) === id || s.ph === id);
    if (idx === -1) {
      return NextResponse.json({ ok: false, error: 'Staff member not found' }, { status: 404 });
    }

    const member = store.staff[idx];

    // Enforce rule: A restaurant must keep at least one active admin
    if (member.r === 'Admin' && on === 0) {
      const activeAdmins = store.staff.filter((s) => s.r === 'Admin' && s.on === 1);
      if (activeAdmins.length <= 1) {
        return NextResponse.json(
          { ok: false, error: 'A restaurant must keep at least one active admin' },
          { status: 400 }
        );
      }
    }

    if (typeof mg === 'boolean') {
      member.mg = mg;
      logAudit(store.me.mob || 'Admin', 'staff.manage', member.n, `Set manage access to ${mg}`);
    }
    if (typeof on === 'number') {
      member.on = on;
      logAudit(
        store.me.mob || 'Admin',
        'staff.manage',
        member.n,
        on ? 'Restored staff access' : 'Removed staff access'
      );
    }
    if (role) {
      member.r = role as StaffRoleName;
      logAudit(store.me.mob || 'Admin', 'staff.manage', member.n, `Changed role to ${role}`);
    }

    return NextResponse.json({ ok: true, member, staff: store.staff, state: store });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

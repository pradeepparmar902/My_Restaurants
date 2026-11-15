import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/serverStore';
import { getActiveStaffMember, getAllowedPortals } from '@/lib/helpers';

export async function GET(req: NextRequest) {
  const store = getStore();
  const mob = req.nextUrl.searchParams.get('mob') || store.me.mob;
  const staffMember = getActiveStaffMember(store.staff, mob);
  const portals = getAllowedPortals(staffMember);
  return NextResponse.json({
    ok: true,
    mob,
    staffMember: staffMember || null,
    portals,
    defaultPortal: portals[1] || 'c',
    state: store,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mob, otp } = body;
    const store = getStore();

    if (otp && otp !== '1234') {
      return NextResponse.json({ ok: false, error: 'Wrong OTP. Demo OTP is 1234' }, { status: 401 });
    }

    store.me.mob = mob || '';
    const staffMember = getActiveStaffMember(store.staff, store.me.mob);
    const portals = getAllowedPortals(staffMember);
    store.role = portals[1] || 'c';

    return NextResponse.json({
      ok: true,
      mob: store.me.mob,
      staffMember: staffMember || null,
      portals,
      state: store,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

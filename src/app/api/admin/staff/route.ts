import { NextRequest, NextResponse } from 'next/server';
import { addStaffMemberInStore, getStore } from '@/lib/serverStore';
import { StaffRoleName } from '@/types/tadka';

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    ok: true,
    staff: store.staff,
    auditLog: store.auditLog,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, role } = body;
    const res = addStaffMemberInStore(name || '', phone || '', (role || 'Waiter') as StaffRoleName);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      staff: res.state.staff,
      state: res.state,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

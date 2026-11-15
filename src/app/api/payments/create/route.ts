import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/serverStore';
import { getSubtotal, getDiscount, getTotal } from '@/lib/helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { split = 1, method = 'UPI' } = body;
    const store = getStore();

    const subtotal = getSubtotal(store.menu, store.cart);
    const discount = getDiscount(subtotal, store.reel, store.review);
    const total = getTotal(subtotal, discount);
    const shareAmount = Math.ceil(total / Math.max(1, Number(split)));

    return NextResponse.json({
      ok: true,
      razorpayOrder: {
        id: `order_rzp_${Date.now()}`,
        amount: shareAmount * 100, // in paise
        currency: 'INR',
        method,
        split,
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

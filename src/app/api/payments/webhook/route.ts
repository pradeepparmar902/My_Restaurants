import { NextRequest, NextResponse } from 'next/server';
import {
  completePaymentInStore,
  addBankInflow,
  getBankInflows,
  ServerBankInflow,
} from '@/lib/serverStore';

/**
 * GET /api/payments/webhook
 * Returns list of recent incoming bank & UPI transactions for the Split-Screen Auto-Reconciliation Feed.
 */
export async function GET() {
  try {
    const inflows = getBankInflows();
    return NextResponse.json({
      ok: true,
      inflows,
      count: inflows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/webhook
 * Universal Inbound Webhook for:
 * - Google Pay for Business Webhooks
 * - Paytm for Business Merchant Webhooks
 * - PhonePe Merchant Webhooks
 * - Bank SMS Forwarder / MacroDroid HTTP Pings
 * - Test / Simulated Inflow Pings
 */
export async function POST(req: NextRequest) {
  try {
    let payload: Record<string, unknown> = {};

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        payload[key] = value.toString();
      });
    } else {
      payload = await req.json().catch(() => ({}));
    }

    // 1. Identify Provider & Normalize Transaction Data
    let source: ServerBankInflow['source'] = 'Manual';
    let amount = 0;
    let utr = '';
    let payerName = 'UPI Customer';
    let payerVpa = '';
    let isSuccess = true;

    // A. Paytm for Business Payload
    if (payload.MID || payload.TXNAMOUNT || payload.STATUS) {
      source = 'Paytm';
      amount = Number(payload.TXNAMOUNT || payload.amount || 0);
      utr = String(payload.BANKTXNID || payload.TXNID || payload.orderId || '').trim();
      payerName = String(payload.PAYER_NAME || payload.payer || 'Paytm Customer').trim();
      payerVpa = String(payload.PAYER_VPA || '').trim();
      isSuccess = String(payload.STATUS || '').toUpperCase() === 'TXN_SUCCESS';
    }
    // B. Google Pay for Business Payload
    else if (payload.upiTransactionRef || (payload.amount && typeof payload.amount === 'object')) {
      source = 'GooglePay';
      const amtObj = payload.amount as { value?: string | number } | undefined;
      amount = Number(amtObj?.value || payload.amount || 0);
      utr = String(payload.upiTransactionRef || payload.transactionId || '').trim();
      payerName = String(payload.payerName || payload.customerName || 'GPay Customer').trim();
      payerVpa = String(payload.payerVpa || '').trim();
      isSuccess = String(payload.status || 'SUCCESS').toUpperCase() === 'SUCCESS';
    }
    // C. PhonePe Merchant Payload
    else if (payload.merchantTransactionId || payload.transactionId) {
      source = 'PhonePe';
      amount = Number(payload.amount || payload.amountInr || 0);
      utr = String(payload.providerReferenceId || payload.transactionId || '').trim();
      payerName = String(payload.payerName || 'PhonePe Customer').trim();
      isSuccess = String(payload.code || 'PAYMENT_SUCCESS').toUpperCase().includes('SUCCESS');
    }
    // D. Android SMS Forwarder / Generic / Test Payload
    else {
      source = (payload.source as ServerBankInflow['source']) || 'Manual';
      amount = Number(payload.amount || payload.amt || 0);
      utr = String(payload.utr || payload.ref || payload.txnId || '').trim();
      payerName = String(payload.payer || payload.name || payload.payerName || 'Bank UPI Inflow').trim();
      payerVpa = String(payload.vpa || '').trim();
      isSuccess = true;
    }

    if (!utr) {
      utr = `UPI-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    }

    // Only record successful credits
    if (!isSuccess || amount <= 0) {
      return NextResponse.json({
        ok: false,
        message: 'Non-credit or failed transaction ignored',
        source,
      });
    }

    // Log the transaction in the bank inflow store
    const recordedInflow = addBankInflow({
      source,
      amount,
      utr,
      payerName,
      payerVpa,
      time: new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      rawPayload: payload,
    });

    // Also update server session store if matching method
    const store = completePaymentInStore('UPI', 'app');

    return NextResponse.json({
      ok: true,
      status: 'ACCEPTED',
      source,
      inflow: recordedInflow,
      state: store,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

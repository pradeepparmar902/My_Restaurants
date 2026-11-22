/**
 * src/lib/whatsappClient.ts
 * 
 * Client helper to communicate with the Standalone WhatsApp Linked Device Gateway
 * (powered by @whiskeysockets/baileys in whatsapp-standalone-connector).
 * 
 * Enables silent, background messaging directly to customer WhatsApp phone numbers
 * without opening the WhatsApp mobile/web app on each transaction.
 */

export interface WhatsAppGatewayStatus {
  ok: boolean;
  sessionId: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'offline';
  phone?: string | null;
  qr?: string | null;
  error?: string;
}

export interface SendWhatsAppResult {
  ok: boolean;
  result?: any;
  error?: string;
  fallbackUrl?: string;
}

const DEFAULT_GATEWAY_URL = 'http://localhost:5050';

/**
 * Normalizes phone number to international E.164 without '+' or spaces for WhatsApp JID
 */
export function normalizeWhatsAppNumber(rawNumber: string, defaultCountryCode: string = '+91'): string {
  let cleaned = String(rawNumber || '').trim().replace(/\D/g, '');
  if (!cleaned) return '';
  
  const ccDigits = defaultCountryCode.replace(/\D/g, '') || '91';
  
  // If 10-digit Indian number without country code
  if (cleaned.length === 10) {
    cleaned = `${ccDigits}${cleaned}`;
  }
  return cleaned;
}

/**
 * Check gateway connection status
 */
export async function getWhatsAppStatus(
  gatewayUrl?: string,
  sessionId: string = 'default'
): Promise<WhatsAppGatewayStatus> {
  const targetUrl = gatewayUrl?.trim() || DEFAULT_GATEWAY_URL;

  // Try via Next.js proxy route first to avoid CORS / mixed-content issues
  try {
    const res = await fetch(`/api/whatsapp?action=status&gatewayUrl=${encodeURIComponent(targetUrl)}&sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        sessionId,
        status: data.status || 'disconnected',
        phone: data.phone,
        qr: data.qr || null,
      };
    }
  } catch {
    // If Next.js proxy route is unavailable, try direct fetch
  }

  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/status?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        ok: true,
        sessionId,
        status: data.status || 'disconnected',
        phone: data.phone,
        qr: data.qr || null,
      };
    }
    return { ok: false, sessionId, status: 'disconnected', error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { ok: false, sessionId, status: 'offline', error: err?.message || 'Gateway unreachable' };
  }
}

/**
 * Request WhatsApp session start / QR code generation
 */
export async function startWhatsAppSession(
  gatewayUrl?: string,
  sessionId: string = 'default'
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const targetUrl = gatewayUrl?.trim() || DEFAULT_GATEWAY_URL;

  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', gatewayUrl: targetUrl, sessionId }),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback to direct
  }

  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to start session' };
  }
}

/**
 * Disconnect WhatsApp session
 */
export async function disconnectWhatsAppSession(
  gatewayUrl?: string,
  sessionId: string = 'default'
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const targetUrl = gatewayUrl?.trim() || DEFAULT_GATEWAY_URL;

  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect', gatewayUrl: targetUrl, sessionId }),
    });
    if (res.ok) return await res.json();
  } catch {
    // fallback to direct
  }

  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to disconnect session' };
  }
}

/**
 * Send WhatsApp text message silently in background
 */
export async function sendDirectWhatsAppMessage(payload: {
  to: string;
  text: string;
  gatewayUrl?: string;
  sessionId?: string;
  defaultCountryCode?: string;
}): Promise<SendWhatsAppResult> {
  const { to, text, gatewayUrl, sessionId = 'default', defaultCountryCode = '+91' } = payload;
  const normalizedNumber = normalizeWhatsAppNumber(to, defaultCountryCode);
  const targetUrl = gatewayUrl?.trim() || DEFAULT_GATEWAY_URL;

  const fallbackUrl = `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(text)}`;

  if (!normalizedNumber) {
    return { ok: false, error: 'Invalid phone number', fallbackUrl };
  }

  // 1. Try sending via Next.js proxy route
  try {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send',
        gatewayUrl: targetUrl,
        sessionId,
        to: normalizedNumber,
        text,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok) {
        return { ok: true, result: data.result, fallbackUrl };
      }
    }
  } catch {
    // continue to direct fetch
  }

  // 2. Direct fetch to gateway
  try {
    const res = await fetch(`${targetUrl.replace(/\/$/, '')}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        to: normalizedNumber,
        text,
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, result: data.result, fallbackUrl };
    }
    return { ok: false, error: data.error || `HTTP ${res.status}`, fallbackUrl };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Gateway unreachable', fallbackUrl };
  }
}

/**
 * Build formatted order placement confirmation message
 */
export function formatOrderConfirmationMessage(params: {
  restaurantName: string;
  counterNo: string;
  tableNo: number | string;
  orderId: string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  isPrepaid?: boolean;
  upiPaymentLink?: string;
}): string {
  const { restaurantName, counterNo, tableNo, orderId, items, subtotal, isPrepaid, upiPaymentLink } = params;

  let msg = `🍽️ *${restaurantName}*\n`;
  msg += `✅ *Order Received & Confirmed!*\n`;
  msg += `─────────────────────────\n`;
  msg += `🔖 *Counter:* ${counterNo}  |  *Table:* ${tableNo}\n`;
  msg += `🆔 *Order ID:* #${orderId.slice(-6)}\n\n`;

  msg += `*Items Ordered:*\n`;
  items.forEach((it) => {
    msg += `• ${it.name} x ${it.qty} = ₹${it.price * it.qty}\n`;
  });

  msg += `─────────────────────────\n`;
  msg += `💰 *Subtotal:* ₹${subtotal}\n`;

  if (isPrepaid) {
    msg += `\n⏳ *Payment Mode:* Prepaid\n`;
    if (upiPaymentLink) {
      msg += `👉 *Pay via UPI:* ${upiPaymentLink}\n`;
    }
    msg += `_Your order will be prepared as soon as payment is verified._\n`;
  } else {
    msg += `\n👨‍🍳 *Status:* Your order has gone straight to the kitchen for preparation!\n`;
  }

  msg += `\n🙏 Thank you for dining with us!`;
  return msg;
}

/**
 * Build formatted bill receipt message with UPI payment link
 */
export function formatBillReceiptMessage(params: {
  restaurantName: string;
  counterNo: string;
  tableNo: number | string;
  items: Array<{ name: string; qty: number; price: number }>;
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  finalTotal: number;
  upiPaymentLink?: string;
  isPaid?: boolean;
}): string {
  const {
    restaurantName,
    counterNo,
    tableNo,
    items,
    subtotal,
    gstAmount,
    discountAmount,
    finalTotal,
    upiPaymentLink,
    isPaid,
  } = params;

  let msg = `🧾 *${restaurantName}*\n`;
  msg += isPaid ? `🎉 *TAX INVOICE / RECEIPT (PAID)*\n` : `💳 *BILL / PAYMENT REQUEST*\n`;
  msg += `─────────────────────────\n`;
  msg += `🔖 *Counter:* ${counterNo}  |  *Table:* ${tableNo}\n\n`;

  msg += `*Ordered Items:*\n`;
  items.forEach((it) => {
    msg += `• ${it.name} x ${it.qty} = ₹${it.price * it.qty}\n`;
  });

  msg += `─────────────────────────\n`;
  msg += `Subtotal: ₹${subtotal}\n`;
  if (gstAmount > 0) {
    msg += `GST: ₹${gstAmount}\n`;
  }
  if (discountAmount > 0) {
    msg += `Discount: -₹${discountAmount}\n`;
  }
  msg += `*Total Payable: ₹${finalTotal}*\n`;
  msg += `─────────────────────────\n`;

  if (isPaid) {
    msg += `✅ *Payment Status: PAID*\n`;
    msg += `Thank you for your payment! Please visit again. 😊\n`;
  } else {
    msg += `⏳ *Payment Status: PENDING*\n`;
    if (upiPaymentLink) {
      msg += `\n📲 *Click to Pay via UPI (GPay/PhonePe/Paytm):*\n${upiPaymentLink}\n`;
    }
  }

  return msg;
}

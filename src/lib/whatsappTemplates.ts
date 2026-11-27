import { buildUpiUri } from './helpers';

/**
 * Dynamic WhatsApp Message Template Engine
 * Powers drag-and-drop / variable-based templates across multiple restaurant stages:
 * - Stage 1: Order Placement (Prepaid with Invoice & Payment Link vs Postpaid Cooking Intimation)
 * - Stage 2: Order Ready / Delivered
 * - Stage 3: Final Bill Dispatch & Settlement
 * - Stage 4: Customer Feedback & Google Review
 * - Stage 5: Special Offers & Star Reward Vouchers
 */

export type WhatsAppTemplateStage =
  | 'order_prepaid'
  | 'order_postpaid'
  | 'order_placed'
  | 'order_delivered'
  | 'bill_dispatch'
  | 'feedback'
  | 'special_offer';

export type WhatsAppTemplateMode = 'prepaid' | 'postpaid' | 'both';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  stage: WhatsAppTemplateStage;
  mode: WhatsAppTemplateMode;
  enabled: boolean;
  headerBannerUrl?: string; // Optional image banner sent as header with message
  templateText: string;
  updatedAt?: string;
}

export interface TemplateVariableDef {
  key: string;
  label: string;
  category: 'core' | 'billing' | 'order' | 'links';
  description: string;
  example: string;
}

export const TEMPLATE_VARIABLES: TemplateVariableDef[] = [
  {
    key: 'restaurant_name',
    label: 'Restaurant Name',
    category: 'core',
    description: 'Name of the restaurant / brand',
    example: 'Bhart Dhab',
  },
  {
    key: 'restaurant_tagline',
    label: 'Restaurant Tagline',
    category: 'core',
    description: 'Tagline or short motto',
    example: 'Authentic Flavors, Fresh Every Day',
  },
  {
    key: 'greetings',
    label: 'Hospitality Greeting',
    category: 'core',
    description: 'Time-based or welcoming greeting',
    example: 'Namaste! Welcome to Bhart Dhab 🙏',
  },
  {
    key: 'customer_name',
    label: 'Customer Name',
    category: 'core',
    description: 'Customer name or phone',
    example: 'Pradeep',
  },
  {
    key: 'customer_mobile',
    label: 'Customer Mobile',
    category: 'core',
    description: '10-digit customer phone number',
    example: '+919819984437',
  },
  {
    key: 'counter_no',
    label: 'Counter Number',
    category: 'order',
    description: 'Assigned customer counter token',
    example: 'C7',
  },
  {
    key: 'table_no',
    label: 'Table Number',
    category: 'order',
    description: 'Dining table number',
    example: 'Table 3',
  },
  {
    key: 'order_id',
    label: 'Order ID',
    category: 'order',
    description: 'Short unique order identifier',
    example: 'ORD-8437',
  },
  {
    key: 'order_status_text',
    label: 'Preparation Status',
    category: 'order',
    description: 'Kitchen status intimation',
    example: '👨‍🍳 Your order has been sent to the kitchen and is under preparation!',
  },
  {
    key: 'items_summary',
    label: 'Items List & Prices',
    category: 'order',
    description: 'Bulleted list of items, quantities and price',
    example: '• 1× Paneer Kathi Roll = ₹100\n• 2× Mango Masala Cooler = ₹140',
  },
  {
    key: 'invoice_no',
    label: 'Invoice Number',
    category: 'billing',
    description: 'Generated Tax Invoice / Bill number',
    example: 'INV-20261125-C7-01',
  },
  {
    key: 'invoice_date',
    label: 'Invoice Date & Time',
    category: 'billing',
    description: 'Indian formatted date and timestamp',
    example: '25 Nov 2026, 08:30 AM',
  },
  {
    key: 'gstin',
    label: 'GSTIN Box',
    category: 'billing',
    description: 'Restaurant GST number box',
    example: '🏛️ GSTIN: 27AABCU9603R1ZM',
  },
  {
    key: 'subtotal',
    label: 'Subtotal (₹)',
    category: 'billing',
    description: 'Items subtotal without tax & discounts',
    example: '240',
  },
  {
    key: 'discount_amount',
    label: 'Discount (₹)',
    category: 'billing',
    description: 'Total coupon / reward discount',
    example: '50',
  },
  {
    key: 'gst_rate',
    label: 'GST Rate (%)',
    category: 'billing',
    description: 'GST tax percentage',
    example: '5',
  },
  {
    key: 'gst_amount',
    label: 'GST Amount (₹)',
    category: 'billing',
    description: 'Calculated GST amount',
    example: '12',
  },
  {
    key: 'total_amount',
    label: 'Total Grand Amount (₹)',
    category: 'billing',
    description: 'Final payable amount',
    example: '202',
  },
  {
    key: 'payment_link',
    label: 'UPI Payment Link',
    category: 'billing',
    description: 'Click-to-pay instant UPI payment link with exact amount',
    example: 'upi://pay?pa=9819984437@upi&pn=Bhart-Dhab&am=202&cu=INR',
  },
  {
    key: 'social_links',
    label: 'Social Media & Review Links',
    category: 'links',
    description: 'Instagram, Google Review and Facebook links',
    example: '⭐ Google Review: https://g.page/r/your-review\n📸 Instagram: @bhartdhab',
  },
  {
    key: 'current_offers',
    label: 'Current Offers & Rewards',
    category: 'links',
    description: 'Active coupons, Star milestones and reel rewards',
    example: '🎉 Use TADKA50 for ₹50 OFF | 🌟 Collect 5 stars for a Free Dessert!',
  },
];

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-stage1-prepaid',
    name: 'Stage 1: Prepaid Order Confirmation & Payment Link',
    stage: 'order_prepaid',
    mode: 'prepaid',
    enabled: true,
    templateText: `{{greetings}}

🍽️ *{{restaurant_name}}*
🧾 *TAX INVOICE & PREPAID ORDER*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *Invoice No:* {{invoice_no}}
📅 *Date & Time:* {{invoice_date}}
{{gstin}}
🔖 *Counter:* {{counter_no}}  |  *Table:* {{table_no}}
🆔 *Order ID:* #{{order_id}}

📋 *Order Details:*
{{items_summary}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Subtotal: ₹{{subtotal}}
🏷️ Discount: -₹{{discount_amount}}
🏛️ GST ({{gst_rate}}%): ₹{{gst_amount}}
💵 *Total Payable: ₹{{total_amount}}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ *CLICK TO PAY VIA UPI:*
{{payment_link}}

_Once payment is completed, your order will be instantly prepared by our chefs!_

🎁 *Current Offers & Rewards:*
{{current_offers}}

📸 *Share your food story & tag us:*
{{social_links}}

🙏 Thank you for dining with {{restaurant_name}}!`,
  },
  {
    id: 'tpl-stage1-postpaid',
    name: 'Stage 1: Postpaid Order Intimation & Kitchen Status',
    stage: 'order_postpaid',
    mode: 'postpaid',
    enabled: true,
    templateText: `{{greetings}}

🍽️ *{{restaurant_name}}*
✅ *ORDER RECEIVED & UNDER PREPARATION*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔖 *Counter:* {{counter_no}}  |  *Table:* {{table_no}}
🆔 *Order ID:* #{{order_id}}
📅 *Time:* {{invoice_date}}

📋 *Items Ordered:*
{{items_summary}}

💰 *Estimated Bill:* ₹{{total_amount}} (incl. taxes)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👨‍🍳 *Kitchen Status:*
{{order_status_text}}
_You can add more dishes anytime from your table QR code until you request the final bill._

🎁 *Today's Rewards & Offers:*
{{current_offers}}

📸 *Loved your visit? Share & tag us:*
{{social_links}}

🙏 We hope you enjoy your meal at {{restaurant_name}}!`,
  },
  {
    id: 'tpl-stage2-delivered',
    name: 'Stage 2: Order Ready & Delivered',
    stage: 'order_delivered',
    mode: 'both',
    enabled: true,
    templateText: `🍽️ *{{restaurant_name}}*
🚀 *Your Order is Ready & Served!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔖 *Counter:* {{counter_no}}  |  *Table:* {{table_no}}
🆔 *Order ID:* #{{order_id}}

Your freshly cooked dishes have arrived at your table! 😋

Need extra cutlery, water, or more delicious dishes? Just tap your table QR code anytime.

Bon Appétit! 🙏✨`,
  },
  {
    id: 'tpl-stage3-bill',
    name: 'Stage 3: Final Bill & Paid Tax Invoice Dispatch',
    stage: 'bill_dispatch',
    mode: 'both',
    enabled: true,
    templateText: `🍽️ *{{restaurant_name}}*
🧾 *FINAL TAX INVOICE & RECEIPT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📄 *Invoice No:* {{invoice_no}}
📅 *Date:* {{invoice_date}}
{{gstin}}
🔖 *Counter:* {{counter_no}}  |  *Table:* {{table_no}}
👤 *Customer:* {{customer_mobile}}

📋 *Final Itemized Bill:*
{{items_summary}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Subtotal: ₹{{subtotal}}
🏷️ Discount: -₹{{discount_amount}}
🏛️ GST ({{gst_rate}}%): ₹{{gst_amount}}
💵 *Grand Total Paid: ₹{{total_amount}}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ *Payment Status:* PAID & SETTLED
🙏 Thank you for dining with {{restaurant_name}}!

⭐ *Rate Us on Google & win a Free Dessert on your next visit:*
{{social_links}}`,
  },
  {
    id: 'tpl-stage4-feedback',
    name: 'Stage 4: Feedback & Google Review Request',
    stage: 'feedback',
    mode: 'both',
    enabled: true,
    templateText: `Namaste from *{{restaurant_name}}*! 🙏

We hope you loved your food and dining experience today at Table {{table_no}}! 🌟

Could you take 30 seconds to drop us a quick Google review? It helps us grow:
⭐ {{social_links}}

🎁 Show your review screenshot on your next visit to get a Free Dessert on us!

Looking forward to welcoming you back! 🍽️✨`,
  },
  {
    id: 'tpl-stage5-offer',
    name: 'Stage 5: Exclusive Promotional Offer',
    stage: 'special_offer',
    mode: 'both',
    enabled: true,
    templateText: `🎉 *Exclusive Offer from {{restaurant_name}}!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
We miss you! Here is a special treat for your next dining visit:

{{current_offers}}

📍 Visit us today or scan your table QR code to redeem your offer.

See you soon at *{{restaurant_name}}*! 🍽️🔥`,
  },
];

export interface TemplateInterpolationContext {
  restaurantName?: string;
  restaurantTagline?: string;
  greetings?: string;
  customerName?: string;
  customerMobile?: string;
  counterNo?: string;
  tableNo?: number | string;
  orderId?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  gstin?: string;
  items?: Array<{ name: string; qty: number; price: number }>;
  itemsSummaryText?: string;
  subtotal?: number;
  discountAmount?: number;
  gstRate?: number;
  gstAmount?: number;
  totalAmount?: number;
  paymentLink?: string;
  orderStatusText?: string;
  socialLinksText?: string;
  currentOffersText?: string;
}

/**
 * Cleanly format Indian currency amount without decimals if integer
 */
export function formatCurrencyAmount(num?: number): string {
  if (typeof num !== 'number' || isNaN(num)) return '0';
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
}

/**
 * Generate standardized, professional invoice number e.g. INV-20261125-C7-01
 */
export function generateTaxInvoiceNumber(params: {
  orderId?: string;
  counterNo?: string;
  businessDate?: string;
  dateObj?: Date;
}): string {
  const d = params.dateObj || new Date();
  const dateStr = params.businessDate
    ? params.businessDate.replace(/-/g, '')
    : `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
        d.getDate()
      ).padStart(2, '0')}`;
  const counter = (params.counterNo || 'C1').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const rawId = String(params.orderId || '');
  let suffix = '01';
  if (rawId.includes('-')) {
    const parts = rawId.split('-');
    suffix = parts[parts.length - 1].slice(-4).toUpperCase();
  } else if (rawId) {
    suffix = rawId.slice(-4).toUpperCase();
  }
  return `INV-${dateStr}-${counter}-${suffix}`;
}

/**
 * Compile template text by replacing all {{variable}} tags with dynamic context values
 */
export function renderWhatsAppTemplate(
  templateText: string,
  ctx: TemplateInterpolationContext
): string {
  if (!templateText) return '';

  const restaurantName = (ctx.restaurantName || '').trim() || 'Restaurant';
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12
      ? 'Good morning'
      : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
  const defaultGreetings = `Namaste! ${timeGreeting} & welcome to *${restaurantName}* 🙏`;

  const itemsFormatted =
    ctx.itemsSummaryText ||
    (ctx.items && ctx.items.length > 0
      ? ctx.items
          .map(
            (it) =>
              `• ${it.name} × ${it.qty} = ₹${formatCurrencyAmount(
                it.price * it.qty
              )}`
          )
          .join('\n')
      : '• Order items');

  const gstinText = ctx.gstin
    ? `🏛️ *GSTIN:* ${ctx.gstin}`
    : '';

  const replacements: Record<string, string> = {
    restaurant_name: restaurantName,
    restaurant_tagline: ctx.restaurantTagline || '',
    greetings: ctx.greetings || defaultGreetings,
    customer_name: ctx.customerName || ctx.customerMobile || 'Valued Guest',
    customer_mobile: ctx.customerMobile || '',
    counter_no: ctx.counterNo || 'C1',
    table_no: String(ctx.tableNo || '1'),
    order_id: (ctx.orderId || '').replace(/^ord-/i, '').slice(0, 10),
    invoice_no: ctx.invoiceNo || generateTaxInvoiceNumber({ counterNo: ctx.counterNo }),
    invoice_date:
      ctx.invoiceDate ||
      new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date()),
    gstin: gstinText,
    items_summary: itemsFormatted,
    subtotal: formatCurrencyAmount(ctx.subtotal ?? 0),
    discount_amount: formatCurrencyAmount(ctx.discountAmount ?? 0),
    gst_rate: String(ctx.gstRate ?? 5),
    gst_amount: formatCurrencyAmount(ctx.gstAmount ?? 0),
    total_amount: formatCurrencyAmount(ctx.totalAmount ?? ctx.subtotal ?? 0),
    payment_link: ctx.paymentLink || '',
    order_status_text:
      ctx.orderStatusText ||
      '👨‍🍳 Your order has been confirmed and sent straight to the chef for cooking!',
    social_links:
      ctx.socialLinksText ||
      '⭐ Review us: https://g.page/r/share\n📸 Instagram: @restaurant',
    current_offers:
      ctx.currentOffersText ||
      '🎉 Show this bill on your next visit for 10% OFF on orders above ₹299!',
  };

  let rendered = templateText;
  Object.entries(replacements).forEach(([key, val]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    rendered = rendered.replace(regex, val);
  });

  // Clean up any remaining unreplaced double-brace tags gracefully
  rendered = rendered.replace(/{{\s*[\w_]+\s*}}/g, '');

  // Collapse triple or more consecutive newlines down to double newlines
  rendered = rendered.replace(/\n{3,}/g, '\n\n').trim();

  return rendered;
}

/**
 * Find matching active template for a given stage and billing mode
 */
export function getActiveTemplateForStage(
  templates: WhatsAppTemplate[] | undefined,
  stage: WhatsAppTemplateStage,
  isPrepaid: boolean
): WhatsAppTemplate {
  const allTemplates =
    templates && templates.length > 0 ? templates : DEFAULT_WHATSAPP_TEMPLATES;

  // 1. Exact match for stage & mode
  const targetMode = isPrepaid ? 'prepaid' : 'postpaid';
  const exact = allTemplates.find(
    (t) =>
      t.enabled &&
      t.stage === stage &&
      (t.mode === targetMode || t.mode === 'both')
  );
  if (exact) return exact;

  // 2. Stage fallback (ignoring mode)
  const stageMatch = allTemplates.find((t) => t.enabled && t.stage === stage);
  if (stageMatch) return stageMatch;

  // 3. Fallback to default
  const defaultStage = isPrepaid ? 'order_prepaid' : 'order_postpaid';
  return (
    DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.stage === defaultStage) ||
    DEFAULT_WHATSAPP_TEMPLATES[0]
  );
}

/**
 * Universal Order Confirmation WhatsApp Message Builder
 * Generates the unified, template-driven message payload for any order across prepaid and postpaid
 */
export function buildOrderWhatsAppPayload(params: {
  googleConfig: any;
  activeWorkspaceSlug: string;
  counterNo: string;
  tableNo: number | string;
  orderId: string;
  businessDate?: string;
  customerMob: string;
  items: Array<{ name: string; qty: number; price: number }>;
  itemsRaw?: string;
  subtotal: number;
  discountAmount?: number;
  totalAmount?: number;
  isPrepaid?: boolean;
}): { text: string; imageUrl?: string } {
  const {
    googleConfig = {},
    activeWorkspaceSlug,
    counterNo,
    tableNo,
    orderId,
    businessDate,
    customerMob,
    items,
    itemsRaw,
    subtotal,
    discountAmount = 0,
    totalAmount,
    isPrepaid = googleConfig?.billingModel === 'prepaid',
  } = params;

  const gstRate =
    googleConfig?.gstEnabled !== false ? googleConfig?.gstRate ?? 5 : 0;
  const taxableSubtotal = Math.max(0, subtotal - discountAmount);
  const gstAmount = Math.round(taxableSubtotal * (gstRate / 100));
  const finalTotal =
    typeof totalAmount === 'number' && totalAmount > 0
      ? totalAmount
      : taxableSubtotal + gstAmount;

  const invoiceNo = generateTaxInvoiceNumber({
    orderId,
    counterNo,
    businessDate,
  });

  const now = new Date();
  const invoiceDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  const restaurantName =
    (googleConfig?.restaurantName || '').trim() ||
    (activeWorkspaceSlug === 'bhart-dhab' ? 'Bhart Dhab' : 'Tadka Restaurant');

  // Format UPI Link for prepaid
  const upiId =
    (googleConfig?.upiId || '').trim() ||
    (activeWorkspaceSlug === 'bhart-dhab' ? 'pradeepparmar9022@okaxis' : 'pradeepparmar9022@okaxis');
  const upiName = (googleConfig?.upiName || '').trim() || restaurantName;
  const paymentLink = buildUpiUri({
    upiId,
    payeeName: upiName,
    amount: finalTotal,
    note: `Counter ${counterNo} Table ${tableNo}`,
  });

  // Social Links
  const socialParts: string[] = [];
  if (googleConfig?.googleReviewUrl) {
    socialParts.push(`⭐ Google Review: ${googleConfig.googleReviewUrl}`);
  }
  if (googleConfig?.instagramHandle) {
    socialParts.push(
      `📸 Instagram: @${googleConfig.instagramHandle.replace(/^@/, '')}`
    );
  }
  if (googleConfig?.facebookUrl) {
    socialParts.push(`👍 Facebook: ${googleConfig.facebookUrl}`);
  }
  const socialLinksText =
    socialParts.length > 0
      ? socialParts.join('\n')
      : '⭐ Review & follow us online for surprise food rewards!';

  // Current Offers
  const rewardRules = googleConfig?.rewardRules;
  const offerParts: string[] = [];
  if (rewardRules?.couponCode) {
    offerParts.push(
      `🏷️ Use code *${rewardRules.couponCode}* for ₹${
        rewardRules.couponValue || 50
      } OFF (Min bill ₹${rewardRules.couponMinBill || 200})`
    );
  }
  if (rewardRules?.starsTarget) {
    offerParts.push(
      `🌟 Collect ${rewardRules.starsTarget} visits for a *${
        rewardRules.starFreeRewardLabel || 'Free Dessert'
      }*!`
    );
  }
  if (rewardRules?.reelDiscountPercent) {
    offerParts.push(
      `🎥 Share your food reel & tag us for ${rewardRules.reelDiscountPercent}% instant discount!`
    );
  }
  const currentOffersText =
    offerParts.length > 0
      ? offerParts.join('\n')
      : "🎉 Ask your server about today's chef specials and seasonal desserts!";

  const stage = isPrepaid ? 'order_prepaid' : 'order_postpaid';
  const template = getActiveTemplateForStage(
    googleConfig?.whatsappTemplates,
    stage,
    isPrepaid
  );

  const text = renderWhatsAppTemplate(template.templateText, {
    restaurantName,
    restaurantTagline: googleConfig?.restaurantTagline,
    customerMobile: customerMob,
    counterNo,
    tableNo,
    orderId,
    invoiceNo,
    invoiceDate,
    gstin: googleConfig?.gstin,
    items,
    itemsSummaryText: itemsRaw,
    subtotal,
    discountAmount,
    gstRate,
    gstAmount,
    totalAmount: finalTotal,
    paymentLink,
    orderStatusText: isPrepaid
      ? '⚡ Your prepaid order is placed. Once payment is confirmed, the kitchen cooks it immediately!'
      : '👨‍🍳 Your order has gone straight to our kitchen and is under fresh preparation!',
    socialLinksText,
    currentOffersText,
  });

  const imageUrl =
    template.headerBannerUrl ||
    googleConfig?.whatsappHeaderBannerUrl ||
    undefined;

  return { text, imageUrl };
}

/**
 * Universal Final Bill WhatsApp Message Builder
 */
export function buildFinalBillWhatsAppPayload(params: {
  googleConfig: any;
  activeWorkspaceSlug: string;
  counterNo: string;
  tableNo: number | string;
  customerMob: string;
  items: Array<{ name: string; qty: number; price: number }>;
  itemsRaw?: string;
  subtotal: number;
  discountAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
  isPaid?: boolean;
}): { text: string; imageUrl?: string } {
  const {
    googleConfig = {},
    activeWorkspaceSlug,
    counterNo,
    tableNo,
    customerMob,
    items,
    itemsRaw,
    subtotal,
    discountAmount = 0,
    gstAmount = 0,
    totalAmount = subtotal,
  } = params;

  const invoiceNo = generateTaxInvoiceNumber({ counterNo });
  const invoiceDate = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date());

  const restaurantName =
    (googleConfig?.restaurantName || '').trim() ||
    (activeWorkspaceSlug === 'bhart-dhab' ? 'Bhart Dhab' : 'Tadka Restaurant');

  const socialParts: string[] = [];
  if (googleConfig?.googleReviewUrl) {
    socialParts.push(`⭐ Google Review: ${googleConfig.googleReviewUrl}`);
  }
  if (googleConfig?.instagramHandle) {
    socialParts.push(
      `📸 Instagram: @${googleConfig.instagramHandle.replace(/^@/, '')}`
    );
  }
  const socialLinksText =
    socialParts.length > 0
      ? socialParts.join('\n')
      : '⭐ Review & follow us online for surprise food rewards!';

  const template = getActiveTemplateForStage(
    googleConfig?.whatsappTemplates,
    'bill_dispatch',
    false
  );

  const text = renderWhatsAppTemplate(template.templateText, {
    restaurantName,
    restaurantTagline: googleConfig?.restaurantTagline,
    customerMobile: customerMob,
    counterNo,
    tableNo,
    invoiceNo,
    invoiceDate,
    gstin: googleConfig?.gstin,
    items,
    itemsSummaryText: itemsRaw,
    subtotal,
    discountAmount,
    gstRate: googleConfig?.gstRate ?? 5,
    gstAmount,
    totalAmount,
    socialLinksText,
  });

  const imageUrl =
    template.headerBannerUrl ||
    googleConfig?.whatsappHeaderBannerUrl ||
    undefined;

  return { text, imageUrl };
}

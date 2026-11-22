# 📋 Tadka Truck / Restaurant OS — Pending Features & Integrations Roadmap

*This living document tracks all pending third-party integrations, pending API approvals, and upcoming platform roadmap items. It is directly viewable in the Super Admin Portal.*

---

## ⏳ 1. Google Pay for Business Merchant Console API (Option A)

* **Status:** `⏳ Under Google Automated Review (24 to 48 hours)`
* **Merchant ID:** `BCR2DN6DWLD3RXC3`
* **Google Payments Profile ID:** `0957-5529-8719`
* **Submitted Business Profile:**
  * Public Name: *f1 / Pradeep Parmar Foods*
  * Category: *Eating Places / Restaurants (MCC 5812 / 5814)*
  * Contact Email: `pradeepparmar902@yahoo.com`
  * Support URL: `https://my-restaurants-zeta.vercel.app`
* **Action Required Once Approved by Google:**
  1. Open [Google Pay & Wallet Console](https://pay.google.com/business/console/in/payment/BCR2DN6DWLD3RXC3).
  2. Click **Integrations** tab in the sidebar.
  3. Click **`+ Add UPI ID`** and enter your UPI ID:
     ```text
     pradeepparmar9022@okaxis
     ```
  4. Under **Webhook / Payment Notifications URL**, enter:
     ```text
     https://my-restaurants-zeta.vercel.app/api/payments/webhook
     ```
  5. Save & Activate. Future Google Pay transactions will auto-ping this webhook and reconcile in real-time.

---

## 📱 2. Free Android SMS-to-Webhook Forwarder (Option B — Instant & Zero Approval)

* **Status:** `📋 Ready for Device Setup (API Endpoint is live)`
* **Why Use Option B:**
  * Zero Google approval needed.
  * Works with any personal or business UPI account (Google Pay, PhonePe, Paytm, BHIM, Axis Bank, HDFC, SBI, ICICI).
  * 100% free and processes bank credit SMS messages within 1-2 seconds.
* **Vercel Webhook Endpoint:**
  ```text
  https://my-restaurants-zeta.vercel.app/api/payments/webhook
  ```
* **Step-by-Step Setup:**
  1. Install any free SMS Forwarder app on the counter Android phone (e.g., *SMS Forwarder*, *MacroDroid*, or *SMS to Webhook*).
  2. Set trigger: Incoming SMS from bank (e.g. `AXISBK`, `HDFCBK`, `SBI`, `PAYTM`, `UPI`, or containing `credited`/`UPI Ref`).
  3. Set action: HTTP `POST` to `https://my-restaurants-zeta.vercel.app/api/payments/webhook`.
  4. Test: Send ₹1 via UPI; verify that the payment appears instantly under **Staff > Orders > Split Recon**.

---

## 🔊 3. Counter Soundbox Hardware & Bluetooth Webhook Bridge

* **Status:** `📋 Ready for Deployment`
* **Guide Reference:** `docs/soundbox_and_auto_reconciliation_guide.md`
* **Options:**
  1. **Paytm / PhonePe / GPay Merchant Soundbox:** Pair via merchant dashboard webhook or notification listener.
  2. **Free In-App Software Audio Chime:** Already built-in on Staff & Kitchen portals (`playPaymentChime()`) when a customer clicks "I Have Paid" or webhook receives an inflow.

---

## 💬 4. WhatsApp Cloud API Official Automated Receipts & Invoices

* **Status:** `📋 Planned Backlog`
* **Features:**
  * Auto-dispatch official PDF tax receipts directly to customer WhatsApp on payment completion.
  * Kitchen status updates via WhatsApp templates.

---

*Last Updated: 22 Nov 2026*

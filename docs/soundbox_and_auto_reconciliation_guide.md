# 🔊 Counter Soundbox & Live Bank Auto-Reconciliation Playbook

This playbook explains how to integrate physical **UPI Soundboxes** (Google Pay SoundPod, Paytm Soundbox, PhonePe SmartSpeaker) and build a **Split-Screen Live Bank Auto-Reconciliation Engine** (Incoming GPay/Bank Inflow on Left vs Unpaid Bills on Right).

---

## 1. What is a Counter Soundbox?

A **Soundbox** is an independent wireless audio device with a pre-activated 4G cellular SIM card. It is connected directly to your Bank / Merchant UPI account.

### How it operates:
```
Customer Scans QR / Taps GPay
               │
               ▼
Money enters Bank / Merchant Account
               │
               ▼ (Instant 4G Signal from Bank)
Soundbox Speaks Aloud at Cash Counter:
"🔊 Google Pay par ₹273 prapt hue!"
```

### Key Highlights:
- **Independent Hardware:** Operates on its own 4G network. Requires no Wi-Fi, Bluetooth, or local app pairing.
- **Rental / Acquisition:** ₹99 to ₹125/month rental via Google Pay for Business, PhonePe Business, or Paytm Business (frequently free for active merchants).
- **Fraud Proof:** 100% eliminates fake screenshot scamming. Staff only serve food when the box announces the amount.
- **0% Commission:** Zero gateway deductions. 100% of payment goes straight to your current/savings account.

---

## 2. The Split-Screen Live Bank Auto-Reconciliation Engine

### The Problem in Busy Restaurants:
In peak rush hours, 5–10 tables pay simultaneously. The cashier needs to know:
* *"Which customer paid for Counter C1?"*
* *"Did Table 3 pay ₹450 or ₹520?"*

### The Solution: 2-Column Live Reconciliation:

```
┌────────────────────────────────────────┬────────────────────────────────────────┐
│  🟢 LEFT: Live Bank / GPay Feed       │  🟠 RIGHT: Pending Bills / Counter Orders│
├────────────────────────────────────────┼────────────────────────────────────────┤
│ • ₹273 · UTR 432198765432 · 08:05 AM   │ • Counter C1 · ₹273 · Table 1 (Waiting)│
│   Payer: Rahul S.                      │   Items: Paneer Roll x2, Fries x1      │
│   [ 🔗 Auto-Matched with Counter C1 ]  │                                        │
│   [ ⚡ Confirm & Push to Kitchen ]     │                                        │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ • ₹180 · UTR 432198765433 · 08:02 AM   │ • Counter C2 · ₹180 · Table 3 (Waiting)│
│   Payer: Priya M.                      │   Items: Masala Dosa x1, Cold Coffee x1│
│   [ 🔗 Auto-Matched with Counter C2 ]  │                                        │
│   [ ⚡ Confirm & Push to Kitchen ]     │                                        │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

---

## 3. How to Ingest GPay / Bank Transactions into the App

There are **3 proven methods** to pull incoming UPI transactions into the Left Column:

### Option A: Google Pay for Business / Paytm Merchant API (Direct Webhook)
* **How it works:** If you register as a merchant on Google Pay for Business or Paytm for Business, they provide a **Merchant Webhook URL** and **Transaction Fetch API**.
* **Configuration:** In your merchant dashboard, set Webhook URL to:
  `https://your-domain.com/api/payments/webhook`
* **Result:** Every incoming UPI transaction lands in the app within 500 milliseconds with Amount, UTR, and Payer Name.

### Option B: Free Android SMS-to-Sheet Bridge (Zero-Cost, No Merchant API Needed)
* **How it works:** Banks send an SMS on every incoming credit (*"A/c credited by INR 273.00 via UPI Ref 432198765432..."*).
* Using a free Android automation app (like **MacroDroid** or **SMS to Google Sheets**), any SMS matching your bank's sender ID automatically writes a row into your restaurant's Google Sheet (`Bank_Feed` tab).
* Our app pulls from that Google Sheet tab and displays it on the left panel!

### Option C: Customer UTR Auto-Matching (Already Live in Your App!)
* When the customer taps **"I Have Paid"** on their mobile, they enter or auto-submit their 12-digit UTR.
* It instantly flags the order at the top of the manager's queue with UTR, amount, and counter number for 1-tap verification.

---

## 4. Business Pitch for Restaurant Clients
When pitching your system against Petpooja or DotPe:
1. *"DotPe charges 1.5% to 2% commission on your own dine-in sales. With our app + Soundbox, your commission is 0%."*
2. *"You get instant voice confirmation on the counter, plus a live split-screen dashboard that matches bills with bank transactions automatically."*
3. *"Zero expensive POS hardware required — runs on any tablet, phone, or laptop."*

# Platform Roadmap & Pending Feature Requests

This document tracks upcoming features, external merchant console approvals, and system enhancements for the **Tadka Platform / My_Restaurants**. Items listed here appear in the **Super Admin** portal for review and scheduling.

---

## 1. Google Pay Direct Merchant & UPI In-App Gateway
- **Status:** ⏳ *Under Review by Google*
- **Payments Profile ID:** `0957-5529-8719`
- **Business Console ID:** `BCR2DN6DWLD3RXC3`
- **Region:** India (IN)
- **Console Link:** [Google Pay & Wallet Console](https://pay.google.com/business/console/info/BCR2DN6DWLD3RXC3)
- **Scope & Deliverables:**
  - Native Google Pay Web Payment Request API (`PaymentRequest` / `@google-pay/button-react`).
  - In-app Google Pay intent flow without redirecting away from the restaurant menu.
  - Real-time automated transaction verification and payment callback webhook.
  - *Next Action:* Awaiting Google Business Profile approval (under review). Once approved, initiate gateway credentials setup.

---

## 2. Post-Payment Mode: Customer Bill Generation on Delivered Items
- **Status:** 📋 *Queued for Next Phase*
- **Scope & Deliverables:**
  - Once food is delivered, customer has an option on their mobile screen to **Generate Bill** for all delivered items.
  - Automatically calculates item totals, GST taxes, and discounts.
  - Generates dynamic UPI QR code and deep payment link.
  - **Kitchen Preparation Notification:** If any items for that counter/table are still under preparation, display notice:
    > *"Notice: Dish [Item Name] is currently under preparation in the kitchen. This item is included in your bill."*

---

## 3. Push Bill Payment Mode
- **Status:** 📋 *Queued for Next Phase*
- **Scope & Deliverables:**
  - Manager / Admin / Cashier generates the final invoice from the staff billing desk.
  - Staff clicks **Push Bill to Customer**.
  - Customer scans their table QR code or opens the app:
    - Customer is prompted to log in (if not already logged in).
    - Their itemized invoice appears directly on screen with UPI QR code and payment link.
  - Once customer pays, cashier and waiter screens update instantly with payment confirmation.

---

## 4. Table Activation Toggle (Anti-Fake Order Lock)
- **Status:** 🟢 *Implemented & Active*
- **Scope & Deliverables:**
  - Restaurant management (Owner / Admin / Waiter) controls table activation via toggle switch.
  - When Table is **Inactive (Locked)**:
    - Customers can scan the table QR code, browse full menu, and select dishes.
    - "Place Order" button is locked to prevent fake orders before staff greets the table.
  - When Table is **Active (Unlocked)**:
    - Order placement is fully unlocked.
  - Real-time auto-polling so customer's screen unlocks immediately when staff activates the table.

---

## 5. WhatsApp Standalone Linked Device Gateway (Baileys)
- **Status:** 🚀 *Integrating Now*
- **Folder:** `whatsapp-standalone-connector/`
- **Architecture:** Baileys multi-device socket connector on port 5050.
- **Scope & Deliverables:**
  - QR Code scanning directly in Admin Settings via WhatsApp Linked Devices (`WhatsApp > Linked Devices > Link a Device`).
  - Automated background messaging for:
    - Instant order placement confirmation.
    - Kitchen food ready notification.
    - Final itemized GST bill and UPI payment link.
  - Runs silently in the background without opening the WhatsApp mobile/web app on each transaction.

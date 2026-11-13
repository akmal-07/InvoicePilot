# InvoicePilot

> **Describe the work in plain words. Get a professional invoice. Get paid.**

Built for the **PayPal AI Hackathon 2026** by **Mohammed Akmal K M** & **Godavarthi Sai Harsha**.

---

## 🔗 Live Links

- **Live Application:** [https://invoicepilot.vercel.app](https://invoicepilot.vercel.app) *(Deploy URL placeholder)*
- **Demo Video (90s):** [https://youtu.be/placeholder](https://youtu.be/placeholder) *(YouTube/Loom link)*
- **GitHub Repository:** [https://github.com/your-username/invoicepilot](https://github.com/your-username/invoicepilot)

---

## 💡 Why InvoicePilot?

Freelancers lose up to 20 business days every year chasing unpaid invoices and manually assembling spreadsheets. Current invoicing software is clunky, generic AI chatbots hallucinate numbers, and manual payment follow-ups are awkward.

**InvoicePilot** bridges conversational AI and trusted fintech infrastructure:
1. **Gemini 2.5 Flash Structured Drafting:** Converts natural plain-text job descriptions into strict, typed invoice line items, tax, and terms.
2. **Deterministic Arithmetic Engine:** Never trusts AI for floating-point math; all subtotals, tax rates, line item products, and totals are computed deterministically in verified code with `Math.round((n + Number.EPSILON) * 100) / 100`.
3. **Deep PayPal Sandbox Integration:**
   - **PayPal Invoicing API v2:** Generates drafts, sends invoices directly to clients, and surfaces real-time payment status and URLs.
   - **PayPal Checkout / Orders API v2:** Embeds seamless Sandbox checkout (`CAPTURE` intent) with instant receipt generation.
4. **Late-Payment Risk Scoring & Tone-Adaptive AI Reminders:** Evaluates payment risk heuristics and drafts tone-adjusted follow-up emails (*Polite*, *Firm*, *Final*) with a strict **non-auto-send guarantee** (human-in-the-loop review).

---

## ⚡ 90-Second Judge Test Guide

Experience the full end-to-end workflow in under 2 minutes:

1. **Step 1 — AI Invoice Generation (`/create`):**
   - Click **"Create Invoice"** in the top navigation.
   - Click one of the sample prompt chips (e.g., *"Brand Identity & Logo Design..."*) or type your own description.
   - Click **"Generate Invoice with Gemini"** — watch Gemini 2.5 Flash structure the client details, line items, and terms in real-time.
   - Inspect the editable line-item table; notice totals calculate deterministically.

2. **Step 2 — Send via PayPal Invoicing API v2:**
   - Click **"Save & Send via PayPal"** (or click **"Save as Draft"** and send from the detail view).
   - The server contacts the PayPal Invoicing API v2 to create and send the invoice, assigning a live `INV2-...` Sandbox ID.

3. **Step 3 — Client Sandbox Payment Experience (`/client/:id`):**
   - Click **"Open Client Share View"** (or click the external link icon on the Dashboard).
   - Click **"Pay with PayPal Sandbox"** — a mock PayPal Checkout modal opens (`CAPTURE` intent).
   - Click **"Approve & Capture Sandbox Payment"** — the order is captured, marked **Paid**, and a verified PayPal receipt card with Transaction ID appears.

4. **Step 4 — Late-Payment Risk & Tone-Adaptive AI Reminders (`/invoice/INV-2026-103`):**
   - Navigate to the **Dashboard** and click the overdue invoice (`INV-2026-103` - Apex Fitness).
   - Review the **Risk Heuristic Badge** (`82 High` - Overdue by 9+ days).
   - In the **AI Reminder Composer**, toggle between **Polite**, **Firm**, and **Final** tones to see contextual drafts with invoice ID, amount, and PayPal payment link.
   - Click **"Copy Reminder"** or **"Mark Reminder Logged"** (verifying our strict human-in-the-loop guarantee).

---

## 👥 Team

- **Mohammed Akmal K M** — Full-Stack Architecture, PayPal API Integration, Backend Serverless Engine
- **Godavarthi Sai Harsha** — Gemini AI Prompt Architecture, UI/UX Design System, Risk Engine

---

## 🛠️ Architecture & Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, Vite 6, TypeScript, Tailwind CSS | High-performance SPA with PayPal Blue design tokens |
| **Icons & Validation** | Lucide React, Zod | Accessible iconography and runtime schema validation |
| **AI Intelligence** | Google Gemini 2.5 Flash (`responseSchema`) | Natural language to strictly typed invoice schemas & reminder generation |
| **Payments** | PayPal Invoicing API v2 & Orders API v2 | Native invoice creation, delivery, and Sandbox checkout capture |
| **Backend** | Vercel Serverless Functions (`/api/*`) | Secure proxy keeping PayPal and Gemini credentials server-side |
| **Local Proxy** | Vite Connect Dev Middleware | Seamless `/api/*` local emulation without extra tooling |

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+ & npm

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/invoicepilot.git
   cd invoicepilot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   Add your credentials in `.env`:
   ```ini
   PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
   PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret
   PAYPAL_MODE=sandbox
   GEMINI_API_KEY=your_gemini_api_key
   ```
   *(Note: If left as placeholder values, InvoicePilot automatically engages its resilient simulation engine with realistic IDs and templates so you can test 100% of the UI uninterrupted!)*

4. **Run the local dev server:**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:5173`. The `/api/health` badge in the header will display **Sandbox** status.

---

## 🛡️ Security & Integrity Commitments

- **Zero Credentials on Client:** PayPal client secrets and Gemini API keys are never exposed to browser bundles.
- **Floating-Point Drift Elimination:** Float math calculations are rounded deterministically using IEEE 754 epsilon adjustments.
- **Human-in-the-Loop AI Reminders:** Late payment reminders are strictly non-auto-sent, ensuring complete user agency.
- **Resilient Fallback Mode:** Gracefully handles rate limits, offline networks, or missing API keys without breaking UI flows.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
Copyright (c) 2026 Mohammed Akmal K M & Godavarthi Sai Harsha.

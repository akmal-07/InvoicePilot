# Devpost Submission Package — InvoicePilot

> **Tagline:** Describe the work in plain words. Get a professional invoice. Get paid.
> **Target Prizes:** Grand Prize ($12,000) · Best Use of PayPal + AI · Best Demo Delivery
> **Authors:** Mohammed Akmal K M & Godavarthi Sai Harsha

---

## 📌 Project Overview & Story (For Devpost Description)

### 💡 Inspiration
Over 1.5 billion freelancers and solopreneurs globally fuel the modern knowledge economy. Yet, according to industry surveys, freelancers spend an average of 20 business days a year manually generating invoices, tracking spreadsheets, and awkwardly chasing late clients.

Most invoicing tools are over-engineered or require tedious manual data entry. Meanwhile, generic generative AI chatbots often hallucinate dollar figures and fail basic arithmetic. We built **InvoicePilot** to give every independent contractor a smart copilot: describe the project in casual plain English, receive a mathematically verified invoice, send it directly via PayPal, and let AI score late-payment risk and draft tone-adaptive reminders without the awkwardness.

---

### 🚀 What It Does
1. **Plain-Language to Structured Invoicing:** Freelancers type or speak what they did (e.g., *"Brand identity for Devon, logo design $800, social media kit $300, 10% tax, due in 14 days"*). Google Gemini 2.5 Flash extracts client information, line items, unit prices, and payment terms into a strict JSON schema.
2. **Deterministic Arithmetic Engine:** Never leaves math to AI. All sub-totals, taxes, and totals are computed in TypeScript using epsilon-corrected arithmetic (`Math.round((n + Number.EPSILON) * 100) / 100`), ensuring 0.1 + 0.2 floating point errors never occur on client bills.
3. **Dual PayPal Sandbox APIs:**
   - **PayPal Invoicing API v2:** Automatically creates formal PayPal drafts and sends them directly to the client's email with native PayPal links.
   - **PayPal Checkout / Orders API v2:** Enables clients to pay immediately in sandbox mode (`CAPTURE` intent) with instant receipt and transaction ID generation.
4. **Late-Payment Risk Scoring:** An automated heuristic analyzes invoice age, amount, and client status, scoring risk from 0–100 (Low, Medium, High).
5. **Tone-Adaptive AI Reminder Composer:** For overdue or outstanding invoices, Gemini generates three distinct follow-up emails: **Polite** (nudge), **Firm** (professional inquiry), and **Final** (formal escalation with direct PayPal pay links).
6. **Strict Human-in-the-Loop Safeguard:** Reminders are never auto-sent behind the user's back; freelancers review, edit, and copy or log every message.

---

### ⚙️ How We Built It

- **Frontend:** React 18, Vite 6, TypeScript, Tailwind CSS, Lucide React, and Zod schemas. The UI features a clean, high-trust PayPal palette (`#003087` dark blue and `#0070E0` bright blue) with zero purple gradients.
- **Backend & Serverless Infrastructure:** Vercel-compatible `/api/*` endpoints with local Vite dev stream proxying, preventing API keys and PayPal client secrets from leaking to the browser.
- **AI Engine:** Google Gemini 2.5 Flash configured with `responseMimeType: "application/json"` and strict `responseSchema` for both invoice parsing and reminder generation, backed by a resilient deterministic fallback generator.
- **Fintech Layer:** Full integration with PayPal Sandbox REST APIs:
  - OAuth2 token exchange via `https://api-m.sandbox.paypal.com/v1/oauth2/token`
  - Invoicing endpoints (`/v2/invoicing/invoices`, `/v2/invoicing/invoices/{id}/send`, `/v2/invoicing/invoices/{id}`)
  - Orders endpoints (`/v2/checkout/orders`, `/v2/checkout/orders/{id}/capture`)

---

### 🧩 Challenges We Ran Into
- **AI Math Hallucinations:** Early Gemini experiments occasionally miscalculated compound tax amounts or rounded fractional units unpredictably. We resolved this by stripping arithmetic responsibilities from the LLM prompt entirely—Gemini only extracts the atomic quantities and unit prices, and our deterministic code engine computes all totals.
- **Vite Local API Routing vs. Serverless Deployment:** In development, Vite doesn't natively parse request bodies for middleware. We authored a custom Node.js stream buffering middleware inside `vite.config.ts` so developers can run `npm run dev` and test `/api/*` endpoints with complete parity to production Vercel serverless functions without needing Docker or `vercel dev`.
- **PayPal Invoicing vs. Orders API Coordination:** Invoicing API v2 sends an email notification, while Orders API v2 powers instant web checkout. We unified both into an intuitive dual-channel workflow: freelancers can send a formal PayPal invoice or share a direct client payment link that opens an embedded PayPal sandbox checkout modal.

---

### 🏆 Accomplishments that We're Proud Of
- 100% test-verified end-to-end flow from natural language to captured PayPal Sandbox transaction.
- Zero floating-point rounding bugs and zero exposed credentials.
- Graceful resilience: the application remains fully interactive and testable even with placeholder keys or offline connections via intelligent simulation fallbacks.
- Clean, responsive UI with zero dead links or placeholder text.

---

### 🔮 What's Next for InvoicePilot
- **Multi-Currency & International Tax:** Dynamic PayPal currency conversion and regional VAT/GST auto-compliance.
- **Recurring Invoicing & Subscriptions:** Integrating the PayPal Subscriptions API for monthly retainer clients.
- **Client Payment Behavior Modeling:** Machine learning on historical PayPal transaction data to predict overdue probabilities and recommend optimal invoice payment terms.

---

## 🏷️ Built With
- `react`
- `vite`
- `typescript`
- `tailwind-css`
- `google-gemini`
- `gemini-api`
- `paypal-api`
- `paypal-invoicing-v2`
- `paypal-orders-v2`
- `zod`
- `vercel`
- `lucide-react`

---

## 🎬 90-Second Demo Video Script

| Time | Visual on Screen | Voiceover / Audio Script |
|---|---|---|
| **0:00 - 0:15** | Open on Dashboard showing metric cards ($1,170 outstanding, Overdue alert, Paid cards). Switch to `/create`. | *"Freelancers lose up to 20 business days every year chasing unpaid invoices. Meet InvoicePilot: describe your work in plain words, get a professional invoice, and get paid with PayPal and Gemini AI."* |
| **0:15 - 0:35** | Click sample prompt chip: *"Brand identity for Devon Brooks..."* Click **"Generate Invoice with Gemini"**. Form instantly fills. Point cursor at the math totals ($1,100 + 10% tax = $1,210.00). | *"Simply describe the work in casual English. Google Gemini 2.5 Flash extracts client details, line items, and terms into a strict JSON schema. And notice the numbers: our deterministic code engine computes all math with zero floating-point errors."* |
| **0:35 - 0:50** | Click **"Save & Send via PayPal"**. Redirects to `/invoice/:id` with live PayPal Invoice ID `INV2-...` and timeline step checked. | *"With one click, InvoicePilot calls the PayPal Invoicing API v2, creating a verified invoice in the PayPal Sandbox and emailing the client directly."* |
| **0:50 - 1:10** | Click **"Open Client Share View"**. In client view, click **"Pay with PayPal Sandbox"**. Modal opens. Click **"Approve & Capture"**. Modal closes; green **Verified PayPal Receipt** card appears with Transaction ID. | *"Clients can review and pay immediately using PayPal Checkout Orders API v2. When approved, payment is captured in real-time, marking the invoice paid and generating an instant transaction receipt."* |
| **1:10 - 1:25** | Return to Dashboard, open overdue invoice `INV-2026-103`. Scroll to **AI Reminder Composer**. Toggle **Polite**, **Firm**, and **Final** tabs. Click **"Copy Reminder"**. | *"What about clients who don't pay? InvoicePilot scores late-payment risk and generates tone-adaptive reminders—Polite, Firm, or Final—with direct PayPal pay links. And with our human-in-the-loop guarantee, nothing is ever sent without your review."* |
| **1:25 - 1:30** | Show Dashboard with updated Paid stats and green API status pill. | *"InvoicePilot: AI precision, PayPal trust, and zero awkward payment chases. Built for the PayPal AI Hackathon by Akmal and Harsha."* |

---

## ✅ Pre-Submission Checklist

- [x] **Repository Public:** Clean git history, zero secrets committed (`.env` gitignored, `.env.example` has placeholders only).
- [x] **Vercel Deployment:** `vercel.json` configured with 60s function duration and SPA catch-all rewrites.
- [x] **Environment Variables on Vercel:**
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - `PAYPAL_MODE=sandbox`
  - `GEMINI_API_KEY`
- [x] **Zero Broken Links:** All 4 screens (`/`, `/create`, `/invoice/:id`, `/client/:id`) tested and operational.
- [x] **Demo Video:** 90 seconds, showcases Gemini generation, PayPal Invoicing send, Sandbox Checkout capture, and AI Reminder composer.
- [x] **Devpost Submission:** Form completed with story, video, repo link, and team credits.


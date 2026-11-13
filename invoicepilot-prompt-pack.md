# InvoicePilot — PayPal AI Hackathon — Prompt Pack (Locked)

**Locked:** 2026-11-10 16:12 IST, by Akmal in the PayPal side chat
**Aim:** Win the grand prize, not just submit. 1st $12,000. Total pool $69,750 per Devpost mail.
**Deadline:** Fri 13 Nov 2026, 01:30 IST (Thu 12 Nov, 12:00 PM PT)
**Devpost:** paypalaihackathon.devpost.com
**Status:** Registered 2026-11-08 12:18 IST (verified by email). Draft started 'Untitled' 13:19 IST. Do NOT register again.
**Build window:** Thu 12 Nov evening, after the Computer Vision exam (10:00–13:00). Submit that night.
**Working style:** Same as Planovent — Antigravity, bit by bit, verification gate before the next bit. Never claim a later bit is underway before the earlier one is verified green.

## 1. Win thesis

Judging criteria (Devpost, verified live 2026-11-10):
1. Technological Implementation — PayPal + AI depth, working, non-trivial
2. Design — complete product experience
3. Potential Impact — real problem, real audience
4. Innovation / Idea
5. Presentation — video shows it working end-to-end

Specials to target: Best Use of PayPal + AI ($5,000), Best Demo Delivery ($5,000).

Why InvoicePilot beats SplitSmart / Planovent Pay:
- SplitSmart = Splitwise clone. Innovation 2/5, PayPal is just a checkout link at the end.
- Planovent Pay = mostly pre-built. Innovation 1/5, payments not central.
- InvoicePilot = PayPal Invoicing API is native, not bolted on. AI does structured drafting + risk + reminders, not a chatbot wrapper. Freelancers losing money to late payment is real, global, measurable.

## 2. Product — one page

**One-liner:** Describe the work in plain words. Get a professional invoice. Get paid.

**Problem:** Freelancers do the work, then chase payment for weeks. Invoices are manual, reminders are awkward, and there's no signal for who will pay late.

**User:** Freelance designer / developer / editor / creator, 1-person business, paid per project.

**Core loop (this is the 90-second demo):**
1. Type / paste: "Logo for cafe, 3 revisions, $200, due in 7 days, client Priya Sharma, priya@example.com"
2. Gemini returns validated structured invoice JSON — client, line items, amounts, tax, due date, notes.
3. User edits line items if needed, clicks Send.
4. PayPal Invoicing API v2 creates + sends the invoice. Client gets a PayPal payment link.
5. Client pays in PayPal Sandbox → dashboard flips Draft → Sent → Paid live, with timeline.
6. If unpaid past due, AI drafts a follow-up (polite → firm) and shows a late-payment risk score.

**Screens (4 only — keep it tight):**
1. Create Invoice — big plain-language input + live AI preview
2. Invoices Dashboard — status chips (Draft / Sent / Paid / Overdue), totals, risk score
3. Invoice Detail — line items, PayPal status, payment timeline, AI reminder composer
4. Client view (share link) — clean invoice + Pay Now button

**Non-goals for v1 (cut list — do not build):**
No multi-currency conversion, no accounting / tax filing, no team accounts, no email inbox integration, no real-money PayPal. Sandbox only.

## 3. Tech stack

Same as Planovent, no new learning curve:
- Frontend: React + Vite + TypeScript + Tailwind
- Backend: Node / serverless `/api/*` proxy (same pattern as Planovent's `/api/generate`)
- AI: Gemini — structured JSON output only, schema-validated, never free text into the invoice
- PayPal: Sandbox only. Developer account + sandbox Client ID / Secret in env vars only, never in code or repo.
- Storage: localStorage for v1 demo data + PayPal invoice ID / status. No DB needed for the hackathon demo.
- Repo: Public GitHub, MIT licence, README with setup + demo steps.

## 4. PayPal depth — what judges must see

Use these, in this order of priority:
1. **PayPal Invoicing API v2** — Create invoice, Send invoice, Get invoice status. This is the core, not a generic checkout link.
2. **PayPal Checkout / Orders API v2** — Pay Now flow from the client view, sandbox payer pays, capture shown.
3. **Status tracking** — Poll / refresh invoice status after payment; show Paid with PayPal transaction ID + timestamp. Webhooks if time allows, polling fallback is acceptable for the demo — do not block Bit 3 on webhooks.

Demo proof: a real sandbox payment must be visible on screen. A static "Paid" label with no transaction is not proof.

## 5. AI depth — what judges must see

1. **Structured drafting:** Gemini takes messy plain text → strict JSON:
```json
{
  "client_name": "string",
  "client_email": "string",
  "currency": "USD",
  "line_items": [{"description": "string", "quantity": 1, "unit_price": 0}],
  "tax_percent": 0,
  "due_days": 7,
  "notes": "string"
}
```
Validate: totals must be deterministic — `sum(qty * price) + tax = total`. Never trust the model for arithmetic; compute totals in code.

2. **Late-payment risk score:** 0–100 + one-line reason, from due_days, amount, client history in demo data, and invoice age. Label it as a demo heuristic, not a credit score.

3. **Reminder drafting:** 3 tones — Polite, Firm, Final — generated from invoice + days overdue. User edits before sending (never auto-send in v1).

## 6. Bits — paste-ready for Antigravity

Work one bit at a time. After each bit, report Pass / Blocker with what you checked. Do not start the next bit until the previous is green.

### Bit 0 — Foundations (30 min max, do this first)
> Create a public GitHub repo named `invoicepilot`, MIT licence, README with setup steps. Scaffold React + Vite + TypeScript + Tailwind. Add `.env.example` with `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=sandbox`, `GEMINI_API_KEY` — no real keys in the repo. Create a PayPal Developer account, make a Sandbox app, copy sandbox keys into local `.env` only. Add a serverless / Node `/api/health` route that returns 200.
>
> Verification: `npm run dev` loads, README renders, repo is public with MIT, `/api/health` returns 200, no keys committed (check `git log` / `git status`).

### Bit 1 — Scaffold + Create Invoice screen
> Build the app shell + 4 screens from §2 (Create, Dashboard, Detail, Client view) with routing and clean, professional design — white, PayPal blue accent (#003087 / #0070E0), no purple gradients. Create Invoice screen: large textarea, "Generate invoice" button, editable line-items table, totals computed in code, Save as Draft. Use localStorage key `invoicepilot_v1`. Seed 3 demo invoices (1 Paid, 1 Sent, 1 Overdue).
>
> Verification: app runs, all 4 screens render, totals are correct for a 2-item test, draft persists after reload.

### Bit 2 — Gemini structured drafting
> Add `/api/generate-invoice` proxy. It takes plain text, calls Gemini with a strict JSON schema from §5, validates the JSON, returns it. Frontend shows the AI preview, user can edit every field before saving. If Gemini fails / returns bad JSON, show a clear error and keep the manual form usable — never crash, never save invalid data.
>
> Verification: paste "Logo for cafe, 3 revisions, $200, due in 7 days" → returns client + 1+ line items + $200 total, totals recomputed in code match, bad input shows error not a crash.

### Bit 3 — PayPal Invoicing + Checkout (the win bit)
> Add `/api/paypal/*` proxy using sandbox credentials from env. Implement: create PayPal invoice from the validated invoice JSON, send it, fetch status. Client view has a Pay Now button that opens PayPal Sandbox Checkout (Orders API). After sandbox payment, refresh status and show Paid + PayPal transaction ID + timestamp on the Invoice Detail timeline.
>
> Verification: end-to-end in sandbox — create → send → pay with sandbox buyer → status flips to Paid with a transaction ID visible. Record the sandbox payer email used. If webhooks are not ready, polling refresh is the accepted fallback — say so in the report.

### Bit 4 — Tracking + AI reminders + risk
> Dashboard: totals (Outstanding / Overdue / Paid this month), status filters, risk score 0–100 with reason per invoice. Detail: AI reminder composer with Polite / Firm / Final tones via `/api/draft-reminder`, editable before copy/send. Overdue invoices show a red Overdue chip and days-overdue count.
>
> Verification: dashboard totals match the seeded + created invoices, risk scores show for all, all 3 reminder tones generate different text, no auto-send happens.

### Bit 5 — Polish, demo, submission
> Polish: empty states, loading states, error states, mobile layout, no lorem ipsum, no dead buttons. Deploy the demo (hosted URL). Record a <3 min video (script in §7). Write Devpost copy from §8, update README with demo link + video link + setup steps.
>
> Verification: hosted URL loads, full demo flow works on the hosted link (not just localhost), video is <3:00 and publicly visible on YouTube/Vimeo, Devpost draft has title, description, repo link, demo link, video link.

## 7. Demo video script — 90 seconds, no slides

- 0–10s: "Freelancers do the work, then chase payment for weeks."
- 10–35s: Paste plain text → AI invoice appears, edit one line item, click Send.
- 35–65s: Client view → Pay Now in PayPal Sandbox → payment succeeds.
- 65–85s: Dashboard flips to Paid live, transaction ID visible. Show one Overdue invoice → AI reminder in Firm tone.
- 85–90s: "InvoicePilot — describe the work, get paid." + repo / demo link on screen.

Film the real app, real sandbox payment. No mockups.

## 8. Devpost submission draft

**Title:** InvoicePilot
**Tagline:** Describe the work in plain words. Get a professional invoice. Get paid.
**Description (draft — edit before submitting):**
InvoicePilot is an AI payment agent for freelancers. Describe the work in plain language and Gemini drafts a structured, validated invoice. PayPal Invoicing API creates and sends it, the client pays via PayPal Checkout in sandbox, and the dashboard tracks it to Paid live. If payment is late, InvoicePilot predicts late-payment risk and drafts a follow-up in the right tone — polite, firm, or final — so freelancers get paid without the awkward chase.
**Built with:** React, Vite, TypeScript, Tailwind, Gemini, PayPal Invoicing API v2, PayPal Checkout / Orders API v2, PayPal Sandbox
**Links needed:** Public GitHub repo (MIT), hosted demo URL, <3 min YouTube/Vimeo video

## 9. Risks

- PayPal Sandbox is the biggest risk — if Invoicing API stalls, fall back to Orders / Checkout only, and say so. Never fake a Paid status.
- Gemini JSON must be schema-validated; totals always computed in code.
- Time: build window is Thu 12 Nov evening only. If Bit 4 slips, cut reminders to 1 tone and ship Bits 0–3 + video. A working Paid flow beats a full dashboard.

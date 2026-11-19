# InvoicePilot — Devpost Project Overview

Built by Mohammed Akmal K M for the PayPal AI Hackathon.  
Status: Developed and tested locally using PayPal Sandbox; official hackathon submission was not made.  
Repository: https://github.com/akmal-07/InvoicePilot  

---

## Overview

InvoicePilot is an invoicing tool for freelancers and contractors that converts plain-language job descriptions into structured invoices, calculates totals deterministically, and connects to PayPal Sandbox APIs for invoice delivery and order payments.

The project was created to address common issues freelancers face: tedious manual invoice generation, arithmetic errors introduced by generic large language models, and delayed payments without structured follow-up mechanisms.

## What It Does

1. Plain-Language Drafting: Users enter informal descriptions of completed work. Google Gemini 2.5 Flash extracts client details, line items, quantities, unit prices, and payment terms into a schema-enforced JSON structure.
2. Deterministic Arithmetic: Calculations for subtotals, tax amounts, line items, and final totals are computed in TypeScript using epsilon-adjusted rounding (`Math.round((n + Number.EPSILON) * 100) / 100`). The language model is never trusted with arithmetic operations.
3. PayPal Invoicing API v2: Creates draft invoices, sends them directly to recipient email addresses, and provides real-time status tracking in the PayPal Sandbox environment.
4. PayPal Orders API v2: Provides an embedded checkout workflow in sandbox mode with capture intent, processing simulated payments and generating receipt confirmations.
5. Late-Payment Risk Scoring: Analyzes invoice age, amount, and payment history to produce an objective risk score from 0 to 100.
6. Tone-Adaptive Reminders: Drafts follow-up communications in three selectable tones (Polite, Firm, Final) with direct PayPal payment links. All reminders require user review and manual action before sending.

## Technical Implementation

- Frontend: React 19, Vite 6, TypeScript, and Tailwind CSS.
- Schema Validation: Zod schemas enforce structured contracts for invoice data, API payloads, and AI extraction outputs.
- AI Layer: Google Gemini 2.5 Flash using structured output mode (`responseMimeType: "application/json"` with JSON schema validation), with local rule-based fallback generation for offline resilience.
- Payments Layer: PayPal Sandbox REST APIs:
  - OAuth2 token exchange (`/v1/oauth2/token`)
  - Invoicing API v2 (`/v2/invoicing/invoices`, `/v2/invoicing/invoices/{id}/send`, `/v2/invoicing/invoices/{id}`)
  - Orders API v2 (`/v2/checkout/orders`, `/v2/checkout/orders/{id}/capture`)
- Serverless Backend: Vercel-compatible serverless functions under `api/*` (`api/health.ts`, `api/generate-invoice.ts`, `api/paypal.ts`, `api/draft-reminder.ts`) with custom request buffering middleware in `vite.config.ts` for local development.

## Challenges and Solutions

- AI Arithmetic Inaccuracies: Early iterations showed large language models occasionally produce floating-point discrepancies or inaccurate tax calculations. To resolve this, prompt extraction is strictly limited to identifying atomic values (items, quantities, rates), while all financial calculations are executed by a deterministic code engine.
- Local API Parity: Vite dev server does not natively parse request bodies for middleware functions. A stream-buffering handler was implemented in `vite.config.ts` to allow full local testing of `/api/*` serverless routes without external proxy tooling.
- Workflow Dual-Channel Integration: The system bridges formal PayPal Invoicing (email dispatch) with instant direct checkout via PayPal Orders, updating local state and audit timelines across both payment paths.

## Built With

- react
- vite
- typescript
- tailwind-css
- google-gemini
- paypal-api
- paypal-invoicing-v2
- paypal-orders-v2
- zod
- vercel
- lucide-react

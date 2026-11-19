# InvoicePilot

Describe work in plain language, generate structured invoices, and collect payments via PayPal.

Built by Mohammed Akmal K M.

---

## Why It Exists

Freelancers spend significant time manually drafting invoices, calculating taxes, and following up on overdue payments. Generic language models often introduce arithmetic errors or hallucinate totals. InvoicePilot combines natural language drafting with deterministic code-level arithmetic and PayPal Sandbox APIs to streamline invoicing and payment collection.

## Features

- Plain-language drafting: Extracts client information, line items, and payment terms from unstructured text using Google Gemini 2.5 Flash with structured JSON schema outputs.
- Deterministic arithmetic: Calculates line item totals, subtotals, tax amounts, and invoice totals in application code using epsilon-adjusted rounding to prevent floating-point inaccuracies.
- PayPal Invoicing API v2: Creates formal invoice drafts, sends them directly to client email addresses, and tracks invoice status in the PayPal Sandbox.
- PayPal Orders API v2: Generates capture orders and processes sandbox payments through an embedded checkout flow with instant receipt confirmation.
- Late-payment risk scoring: Evaluates invoice age, amount, and payment history to compute an objective risk score.
- Tone-adaptive reminders: Generates polite, firm, or final reminder drafts with payment links, requiring manual review before sending.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS |
| Schema Validation | Zod |
| AI | Google Gemini 2.5 Flash (structured outputs) |
| Payments | PayPal Invoicing API v2, PayPal Orders API v2 (Sandbox) |
| Serverless API | Vercel Serverless Functions (`api/*`) |

## Setup

### Prerequisites

- Node.js 18+ and npm
- PayPal Developer account (Sandbox credentials)
- Google Gemini API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/akmal-07/InvoicePilot.git
   cd InvoicePilot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
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
   If credentials are not configured, the application uses local fallback generators and simulated sandbox responses for development and testing.

## Running Locally

Start the Vite development server:
```bash
npm run dev
```

The application runs at `http://localhost:5173`. The `/api/health` endpoint verifies local API functionality.

To create a production build:
```bash
npm run build
```

## License

MIT License. See [LICENSE](LICENSE) for details.
Copyright (c) 2026 Mohammed Akmal K M.

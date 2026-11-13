import { z } from 'zod';

// ── Zod Schemas ──────────────────────────────────────────────

export const LineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(0.01, 'Quantity must be > 0'),
  unit_price: z.number().min(0, 'Price must be ≥ 0'),
});

export const InvoiceStatusSchema = z.enum(['Draft', 'Sent', 'Paid', 'Overdue']);

export const TimelineEntrySchema = z.object({
  label: z.string(),
  timestamp: z.string().optional(),
  done: z.boolean(),
});

export const InvoiceSchema = z.object({
  id: z.string(),
  client_name: z.string().min(1, 'Client name is required'),
  client_email: z.string().email('Valid email required'),
  currency: z.literal('USD'),
  line_items: z.array(LineItemSchema).min(1, 'At least one line item is required'),
  tax_percent: z.number().min(0).max(100),
  due_days: z.number().int().min(1),
  created_at: z.string(),
  due_date: z.string(),
  notes: z.string(),
  status: InvoiceStatusSchema,
  subtotal: z.number(),
  tax_amount: z.number(),
  total: z.number(),
  risk_score: z.number().min(0).max(100),
  risk_reason: z.string(),
  paypal_invoice_id: z.string().optional(),
  paypal_order_id: z.string().optional(),
  paypal_transaction_id: z.string().optional(),
  payer_email: z.string().optional(),
  recipient_view_url: z.string().optional(),
  paid_at: z.string().optional(),
  timeline: z.array(TimelineEntrySchema),
});

// ── TypeScript Types (derived from Zod) ──────────────────────

export type LineItem = z.infer<typeof LineItemSchema>;
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;

// ── Helper: generate a new invoice ID ────────────────────────

let _counter = 200;
export function generateInvoiceId(): string {
  _counter += 1;
  return `INV-2026-${_counter}`;
}

// ── Helper: generate a line-item ID ──────────────────────────

let _lineCounter = 0;
export function generateLineItemId(): string {
  _lineCounter += 1;
  return `li-${Date.now()}-${_lineCounter}`;
}

// ── Gemini Structured Output Schemas (§5 Contract) ──────────

export const GeminiLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be > 0').default(1),
  unit_price: z.number().nonnegative('Unit price must be >= 0').default(0),
});

export const GeminiDraftSchema = z.object({
  client_name: z.string().min(1).default('Valued Client'),
  client_email: z.string().default(''),
  currency: z.literal('USD').default('USD'),
  line_items: z.array(GeminiLineItemSchema).min(1, 'At least one line item is required'),
  tax_percent: z.number().min(0).max(100).default(0),
  due_days: z.number().int().min(1).max(365).default(7),
  notes: z.string().default('Payment is due within agreed terms. Thank you for your business!'),
});

export type GeminiLineItem = z.infer<typeof GeminiLineItemSchema>;
export type GeminiDraft = z.infer<typeof GeminiDraftSchema>;

export interface GeneratedInvoiceResponse {
  ok: boolean;
  source?: 'gemini' | 'fallback_parser';
  error?: string;
  draft?: GeminiDraft & {
    subtotal: number;
    tax_amount: number;
    total: number;
  };
}



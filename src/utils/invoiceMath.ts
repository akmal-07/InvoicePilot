import type { Invoice, LineItem } from '../types/invoice';

// ── Deterministic Rounding ───────────────────────────────────
// Round to 2 decimal places using Math.round to avoid floating-point drift.
// e.g. round2(0.1 + 0.2) === 0.3, not 0.30000000000000004

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Line Item Total ──────────────────────────────────────────

export function lineItemTotal(item: Pick<LineItem, 'quantity' | 'unit_price'>): number {
  return round2(item.quantity * item.unit_price);
}

// ── Invoice Totals ───────────────────────────────────────────

export function computeSubtotal(items: Pick<LineItem, 'quantity' | 'unit_price'>[]): number {
  return round2(items.reduce((sum, item) => sum + lineItemTotal(item), 0));
}

export function computeTaxAmount(subtotal: number, taxPercent: number): number {
  return round2(subtotal * (taxPercent / 100));
}

export function computeTotal(subtotal: number, taxAmount: number): number {
  return round2(subtotal + taxAmount);
}

/** Recompute subtotal, tax_amount, total from line_items + tax_percent */
export function recomputeTotals(
  lineItems: Pick<LineItem, 'quantity' | 'unit_price'>[],
  taxPercent: number,
): { subtotal: number; tax_amount: number; total: number } {
  const subtotal = computeSubtotal(lineItems);
  const tax_amount = computeTaxAmount(subtotal, taxPercent);
  const total = computeTotal(subtotal, tax_amount);
  return { subtotal, tax_amount, total };
}

// ── Due Date Helpers ─────────────────────────────────────────

export function dueDateFromDays(createdAt: string, dueDays: number): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + dueDays);
  return d.toISOString();
}

export function daysOverdue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = now.getTime() - due.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function daysUntilDue(dueDate: string): number {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

// ── Demo Risk Heuristic (0–100) ──────────────────────────────
// NOT a credit score. Deterministic formula for the hackathon demo.

export function computeRiskScore(invoice: Invoice): { risk_score: number; risk_reason: string } {
  const { status, total, due_date } = invoice;

  // Paid → low risk
  if (status === 'Paid') {
    return { risk_score: 10, risk_reason: 'Paid in full via PayPal Sandbox' };
  }

  let score = 20; // baseline
  const reasons: string[] = [];

  // High total adds risk
  if (total >= 1000) {
    score += 20;
    reasons.push(`High invoice total ($${total.toLocaleString()})`);
  } else if (total >= 500) {
    score += 10;
    reasons.push(`High invoice total ($${total.toLocaleString()})`);
  }

  // Overdue adds significant risk
  if (status === 'Overdue') {
    const overdueDays = daysOverdue(due_date);
    score += Math.min(40, overdueDays * 4);
    reasons.push(`${overdueDays} days past due date with no buyer view recorded`);
  } else if (status === 'Sent') {
    const remaining = daysUntilDue(due_date);
    if (remaining <= 3) {
      score += 15;
      reasons.push(`Only ${remaining} day${remaining !== 1 ? 's' : ''} remaining until due date`);
    } else if (remaining <= 7) {
      score += 8;
      reasons.push(`${remaining} days remaining until due date`);
    }
  }

  // Draft = minimal risk
  if (status === 'Draft') {
    score = Math.min(score, 15);
    reasons.length = 0;
    reasons.push('Draft invoice, not yet sent');
  }

  const risk_score = Math.min(100, Math.max(0, score));
  const risk_reason = reasons.join('; ') || 'Standard risk level';

  return { risk_score, risk_reason };
}

// ── Format Currency ──────────────────────────────────────────

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ── Format Date ──────────────────────────────────────────────

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


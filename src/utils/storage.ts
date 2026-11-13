import type { Invoice } from '../types/invoice';

const STORAGE_KEY = 'invoicepilot_v1';

// ── Read / Write ─────────────────────────────────────────────

export function loadInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Invoice[];
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: Invoice[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function getInvoice(id: string): Invoice | undefined {
  return loadInvoices().find((inv) => inv.id === id);
}

export function upsertInvoice(invoice: Invoice): void {
  const invoices = loadInvoices();
  const idx = invoices.findIndex((inv) => inv.id === invoice.id);
  if (idx >= 0) {
    invoices[idx] = invoice;
  } else {
    invoices.push(invoice);
  }
  saveInvoices(invoices);
}

export function deleteInvoice(id: string): void {
  saveInvoices(loadInvoices().filter((inv) => inv.id !== id));
}

// ── Seed Data ────────────────────────────────────────────────

function buildSeedData(): Invoice[] {
  const now = new Date();

  // Helper to create a date N days ago
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  };

  // Helper to create a date N days from now
  const daysFromNow = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d.toISOString();
  };

  return [
    // 1. Paid Invoice
    {
      id: 'INV-2026-101',
      client_name: 'Studio Kaffe (Elena Rostova)',
      client_email: 'elena@studiokaffe.example.com',
      currency: 'USD',
      line_items: [
        { id: 'seed-li-1', description: 'Brand Identity & Menu Design', quantity: 1, unit_price: 450 },
      ],
      tax_percent: 0,
      due_days: 14,
      created_at: daysAgo(20),
      due_date: daysAgo(6),
      notes: 'Includes logo, color palette, typography, and full menu card layout.',
      status: 'Paid',
      subtotal: 450,
      tax_amount: 0,
      total: 450,
      risk_score: 12,
      risk_reason: 'Paid on time via PayPal Checkout',
      paypal_invoice_id: 'INV2-XXXX-PAID',
      paypal_transaction_id: '7XK92831904L',
      paid_at: daysAgo(8),
      timeline: [
        { label: 'Draft Created', timestamp: daysAgo(20), done: true },
        { label: 'Invoice Sent via PayPal', timestamp: daysAgo(18), done: true },
        { label: 'Paid in PayPal Sandbox', timestamp: daysAgo(8), done: true },
      ],
    },
    // 2. Sent Invoice
    {
      id: 'INV-2026-102',
      client_name: 'NovaSaaS Inc (Marcus Vance)',
      client_email: 'marcus@novasaas.example.com',
      currency: 'USD',
      line_items: [
        { id: 'seed-li-2', description: 'Landing Page React Build', quantity: 1, unit_price: 600 },
        { id: 'seed-li-3', description: 'Responsive QA & Cross-Browser Testing', quantity: 1, unit_price: 250 },
      ],
      tax_percent: 0,
      due_days: 14,
      created_at: daysAgo(9),
      due_date: daysFromNow(5),
      notes: 'Deployed to Vercel staging. Includes 1 round of revisions.',
      status: 'Sent',
      subtotal: 850,
      tax_amount: 0,
      total: 850,
      risk_score: 38,
      risk_reason: 'High invoice total ($850), 5 days remaining until due date',
      paypal_invoice_id: 'INV2-XXXX-SENT',
      timeline: [
        { label: 'Draft Created', timestamp: daysAgo(9), done: true },
        { label: 'Invoice Sent via PayPal', timestamp: daysAgo(8), done: true },
        { label: 'Paid in PayPal Sandbox', done: false },
      ],
    },
    // 3. Overdue Invoice
    {
      id: 'INV-2026-103',
      client_name: 'Apex Fitness (Devon Brooks)',
      client_email: 'devon@apexfit.example.com',
      currency: 'USD',
      line_items: [
        { id: 'seed-li-4', description: 'Promo Video Edit + 3 Vertical Reels', quantity: 1, unit_price: 320 },
      ],
      tax_percent: 0,
      due_days: 7,
      created_at: daysAgo(16),
      due_date: daysAgo(9),
      notes: 'Final exports delivered via Google Drive link.',
      status: 'Overdue',
      subtotal: 320,
      tax_amount: 0,
      total: 320,
      risk_score: 82,
      risk_reason: '9 days past due date with no buyer view recorded',
      paypal_invoice_id: 'INV2-XXXX-OVERDUE',
      timeline: [
        { label: 'Draft Created', timestamp: daysAgo(16), done: true },
        { label: 'Invoice Sent via PayPal', timestamp: daysAgo(14), done: true },
        { label: 'Paid in PayPal Sandbox', done: false },
      ],
    },
  ];
}

/** Seed demo data only if localStorage is empty */
export function ensureSeedData(): Invoice[] {
  let invoices = loadInvoices();
  if (invoices.length === 0) {
    invoices = buildSeedData();
    saveInvoices(invoices);
  }
  return invoices;
}

/** Reset localStorage to factory seed data */
export function resetToSeedData(): Invoice[] {
  const invoices = buildSeedData();
  saveInvoices(invoices);
  return invoices;
}


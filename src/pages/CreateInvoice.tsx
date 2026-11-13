import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Plus,
  Trash2,
  Save,
  Send,
  Wand2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { generateInvoiceId, generateLineItemId } from '../types/invoice';
import type { Invoice, LineItem, GeneratedInvoiceResponse } from '../types/invoice';
import {
  recomputeTotals,
  lineItemTotal,
  formatUSD,
  dueDateFromDays,
  computeRiskScore,
} from '../utils/invoiceMath';
import { upsertInvoice } from '../utils/storage';
import { SAMPLE_PROMPTS } from '../utils/promptParser';

function emptyLineItem(): LineItem {
  return { id: generateLineItemId(), description: '', quantity: 1, unit_price: 0 };
}

export default function CreateInvoice() {
  const navigate = useNavigate();

  // Prompt state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingPayPal, setIsSendingPayPal] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<'gemini' | 'fallback_parser' | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [dueDays, setDueDays] = useState(7);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  // Computed totals (always computed deterministically in code)
  const totals = recomputeTotals(lineItems, taxPercent);

  // ── Prompt Parsing via Gemini API ──────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStatus(null);

    try {
      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = (await response.json().catch(() => null)) as GeneratedInvoiceResponse | null;

      if (!response.ok || !data?.ok || !data?.draft) {
        const errorMsg =
          data?.error || `Failed to generate invoice (HTTP ${response.status}). You can still fill in the form manually below.`;
        setGenerationError(errorMsg);
        return;
      }

      // Populate all editable fields from the structured draft
      const draft = data.draft;
      setClientName(draft.client_name || '');
      setClientEmail(draft.client_email || '');
      setDueDays(draft.due_days || 7);
      setTaxPercent(draft.tax_percent || 0);
      setNotes(draft.notes || '');

      if (draft.line_items && draft.line_items.length > 0) {
        setLineItems(
          draft.line_items.map((item) => ({
            id: generateLineItemId(),
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          })),
        );
      }

      setGenerationStatus(data.source === 'gemini' ? 'gemini' : 'fallback_parser');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error communicating with AI server';
      setGenerationError(`${msg}. The manual invoice builder remains ready below.`);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating]);

  const handleSamplePrompt = (sample: string) => {
    setPrompt(sample);
    setGenerationError(null);
  };

  // ── Line Item CRUD ─────────────────────────────────────────
  const addLineItem = () => {
    setLineItems((prev) => [...prev, emptyLineItem()]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };

  const updateLineItem = (id: string, field: keyof Omit<LineItem, 'id'>, value: string | number) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)),
    );
  };

  // ── Save as Draft or Save & Send via PayPal ────────────────
  const buildInvoiceObject = (): Invoice | null => {
    if (!clientName.trim() || !clientEmail.trim()) {
      alert('Client name and email are required.');
      return null;
    }
    if (lineItems.some((li) => !li.description.trim())) {
      alert('All line items must have a description.');
      return null;
    }

    const now = new Date().toISOString();
    const id = generateInvoiceId();
    const dueDate = dueDateFromDays(now, dueDays);

    const draft: Invoice = {
      id,
      client_name: clientName.trim(),
      client_email: clientEmail.trim(),
      currency: 'USD',
      line_items: lineItems,
      tax_percent: taxPercent,
      due_days: dueDays,
      created_at: now,
      due_date: dueDate,
      notes: notes.trim(),
      status: 'Draft',
      ...totals,
      risk_score: 0,
      risk_reason: '',
      timeline: [
        { label: 'Draft Created', timestamp: now, done: true },
        { label: 'Invoice Sent via PayPal', done: false },
        { label: 'Paid in PayPal Sandbox', done: false },
      ],
    };

    const { risk_score, risk_reason } = computeRiskScore(draft);
    draft.risk_score = risk_score;
    draft.risk_reason = risk_reason;
    return draft;
  };

  const handleSave = () => {
    const draft = buildInvoiceObject();
    if (!draft) return;
    upsertInvoice(draft);
    navigate(`/invoice/${draft.id}`);
  };

  const handleSaveAndSend = async () => {
    const draft = buildInvoiceObject();
    if (!draft) return;

    setIsSendingPayPal(true);
    try {
      const res = await fetch('/api/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_and_send_invoice',
          invoice: draft,
        }),
      });

      interface PayPalSendResponse {
        ok: boolean;
        paypal_invoice_id?: string;
        recipient_view_url?: string;
        sent_at?: string;
        error?: string;
      }

      const data = (await res.json()) as PayPalSendResponse;
      if (!data.ok) {
        throw new Error(data.error || 'Failed to send invoice via PayPal');
      }

      const now = new Date().toISOString();
      const sentInvoice: Invoice = {
        ...draft,
        status: 'Sent',
        paypal_invoice_id: data.paypal_invoice_id,
        recipient_view_url: data.recipient_view_url,
        timeline: [
          { label: 'Draft Created', timestamp: draft.created_at, done: true },
          { label: 'Invoice Sent via PayPal', timestamp: data.sent_at || now, done: true },
          { label: 'Paid in PayPal Sandbox', done: false },
        ],
      };

      const { risk_score, risk_reason } = computeRiskScore(sentInvoice);
      sentInvoice.risk_score = risk_score;
      sentInvoice.risk_reason = risk_reason;

      upsertInvoice(sentInvoice);
      navigate(`/invoice/${sentInvoice.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Could not send via PayPal: ${message}. Saved as Draft instead.`);
      upsertInvoice(draft);
      navigate(`/invoice/${draft.id}`);
    } finally {
      setIsSendingPayPal(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003087]">Create Invoice</h1>
        <p className="text-slate-500 mt-1">Describe the work in plain words or build the invoice manually.</p>
      </div>

      {/* ── AI Prompt Section ──────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#0070E0]" />
            <h2 className="text-lg font-semibold text-slate-800">Describe the Work</h2>
          </div>
          <span className="text-xs bg-[#0070E0]/10 text-[#0070E0] px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0070E0] animate-pulse"></span>
            Gemini 2.5 Flash Structured
          </span>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            if (generationError) setGenerationError(null);
          }}
          disabled={isGenerating}
          placeholder='e.g. "Logo for cafe, 3 revisions, $200, due in 7 days, client Priya Sharma, priya@example.com"'
          className="w-full h-28 p-4 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent resize-none disabled:bg-slate-50"
        />

        {/* Sample Prompt Chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {SAMPLE_PROMPTS.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSamplePrompt(s)}
              disabled={isGenerating}
              className="text-xs bg-slate-50 hover:bg-[#0070E0]/5 text-slate-600 hover:text-[#0070E0] px-3 py-1.5 rounded-full border border-slate-200 hover:border-[#0070E0]/30 transition-colors truncate max-w-xs disabled:opacity-50"
            >
              {s.length > 50 ? s.substring(0, 50) + '…' : s}
            </button>
          ))}
        </div>

        {/* Action Button & Badges */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 bg-[#0070E0] hover:bg-[#005bbf] disabled:bg-slate-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Drafting with Gemini AI...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate Invoice
              </>
            )}
          </button>

          {/* Success Status Badge */}
          {generationStatus && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>
                {generationStatus === 'gemini'
                  ? '✓ Structured by Gemini AI — review & edit fields below'
                  : '✓ Structured by AI fallback — review & edit fields below'}
              </span>
            </div>
          )}
        </div>

        {/* Error Alert Banner */}
        {generationError && (
          <div className="mt-4 flex items-start justify-between gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Could not draft invoice</p>
                <p className="text-red-700 text-xs mt-0.5">{generationError}</p>
              </div>
            </div>
            <button
              onClick={() => setGenerationError(null)}
              className="text-red-400 hover:text-red-600 p-1"
              title="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Manual Form (Always 100% Usable) ───────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-semibold text-slate-800">Invoice Details</h2>
          <span className="text-xs text-slate-400">All fields editable before saving</span>
        </div>

        {/* Client Info Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Priya Sharma"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Client Email</label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="priya@example.com"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent"
            />
          </div>
        </div>

        {/* Terms Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value="USD"
              disabled
              className="w-full px-3 py-2 border border-slate-100 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due (Days)</label>
            <input
              type="number"
              value={dueDays}
              onChange={(e) => setDueDays(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tax %</label>
            <input
              type="number"
              value={taxPercent}
              onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              min={0}
              max={100}
              step={0.5}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent"
            />
          </div>
        </div>

        {/* ── Line Items ─────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-slate-700">Line Items</label>
            <button
              onClick={addLineItem}
              className="flex items-center gap-1 text-xs text-[#0070E0] hover:text-[#005bbf] font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </button>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_90px_110px_100px_40px] gap-2 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            {/* Table Rows */}
            {lineItems.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_90px_110px_100px_40px] gap-2 items-center px-4 py-2 border-t border-slate-100"
              >
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                  placeholder="Service description"
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#0070E0]"
                />
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    updateLineItem(item.id, 'quantity', Math.max(0.01, parseFloat(e.target.value) || 0))
                  }
                  min={0.01}
                  step={1}
                  className="w-full px-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0070E0]"
                />
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    value={item.unit_price}
                    onChange={(e) =>
                      updateLineItem(item.id, 'unit_price', Math.max(0, parseFloat(e.target.value) || 0))
                    }
                    min={0}
                    step={0.01}
                    className="w-full pl-6 pr-2 py-1.5 border border-slate-200 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0070E0]"
                  />
                </div>
                <span className="text-sm font-medium text-slate-700 text-right">
                  {formatUSD(lineItemTotal(item))}
                </span>
                <button
                  onClick={() => removeLineItem(item.id)}
                  disabled={lineItems.length <= 1}
                  className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Totals Summary ─────────────────────────────── */}
        <div className="flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatUSD(totals.subtotal)}</span>
            </div>
            {taxPercent > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax ({taxPercent}%)</span>
                <span>{formatUSD(totals.tax_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg text-[#003087] border-t border-slate-200 pt-2">
              <span>Total</span>
              <span>{formatUSD(totals.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes / Terms</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes or payment terms for the client..."
            className="w-full h-20 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent resize-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSendingPayPal}
            className="flex items-center gap-2 border border-slate-300 hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save as Draft
          </button>
          <button
            onClick={handleSaveAndSend}
            disabled={isSendingPayPal}
            className="flex items-center gap-2 bg-[#0070E0] hover:bg-[#005bbf] text-white px-6 py-3 rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:bg-slate-300"
          >
            {isSendingPayPal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending via PayPal...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Save & Send via PayPal
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

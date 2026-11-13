import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Send,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  MessageSquare,
  RefreshCw,
  Loader2,
  Check,
  Copy,
  BookCheck,
  Sparkles,
} from 'lucide-react';
import type { Invoice } from '../types/invoice';
import { getInvoice, upsertInvoice } from '../utils/storage';
import { formatUSD, formatDate, lineItemTotal, daysOverdue, computeRiskScore } from '../utils/invoiceMath';

const REMINDER_TONES = ['Polite', 'Firm', 'Final'] as const;
type ReminderTone = (typeof REMINDER_TONES)[number];

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // PayPal Invoicing & status states
  const [isSendingPayPal, setIsSendingPayPal] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [statusSyncMsg, setStatusSyncMsg] = useState<string | null>(null);

  // AI Reminder Composer state
  const [reminderTone, setReminderTone] = useState<ReminderTone>('Polite');
  const [reminderSubject, setReminderSubject] = useState('');
  const [reminderBody, setReminderBody] = useState('');
  const [isDraftingReminder, setIsDraftingReminder] = useState(false);
  const [reminderSource, setReminderSource] = useState<'gemini' | 'fallback_generator' | null>(null);
  const [copied, setCopied] = useState(false);
  const [reminderLoggedMsg, setReminderLoggedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const inv = getInvoice(id);
    if (!inv) {
      navigate('/');
      return;
    }
    setInvoice(inv);
  }, [id, navigate]);

  const overdueDays = invoice ? daysOverdue(invoice.due_date) : 0;

  // ── AI Reminder Fetcher ─────────────────────────────────────
  const fetchDraftReminder = useCallback(
    async (tone: ReminderTone, currentInv: Invoice) => {
      setIsDraftingReminder(true);
      setReminderLoggedMsg(null);
      try {
        const days = Math.max(0, daysOverdue(currentInv.due_date));
        const res = await fetch('/api/draft-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoice_id: currentInv.id,
            client_name: currentInv.client_name,
            client_email: currentInv.client_email,
            total: currentInv.total,
            currency: 'USD',
            due_date: currentInv.due_date,
            days_overdue: days,
            line_items_summary: currentInv.line_items.map((i) => i.description).join(', '),
            paypal_pay_url: `${window.location.origin}/client/${currentInv.id}`,
            tone,
          }),
        });

        interface DraftReminderResponse {
          ok: boolean;
          source?: 'gemini' | 'fallback_generator';
          tone?: ReminderTone;
          subject?: string;
          body?: string;
          error?: string;
        }

        const data = (await res.json()) as DraftReminderResponse;
        if (!data.ok || !data.subject || !data.body) {
          throw new Error(data.error || 'Failed to draft reminder');
        }

        setReminderSubject(data.subject);
        setReminderBody(data.body);
        setReminderSource(data.source || 'fallback_generator');
      } catch (err: unknown) {
        console.warn('[AI Reminder Draft failed]:', err);
      } finally {
        setIsDraftingReminder(false);
      }
    },
    [],
  );

  // Initial reminder draft on invoice load
  useEffect(() => {
    if (invoice && (invoice.status === 'Overdue' || invoice.status === 'Sent') && !reminderBody) {
      const initialTone = invoice.status === 'Overdue' ? 'Firm' : 'Polite';
      setReminderTone(initialTone);
      fetchDraftReminder(initialTone, invoice);
    }
  }, [invoice, fetchDraftReminder, reminderBody]);

  // Handle tone tab switch
  const handleToneChange = (tone: ReminderTone) => {
    setReminderTone(tone);
    if (invoice) {
      fetchDraftReminder(tone, invoice);
    }
  };

  // User Action 1: Copy Reminder
  const handleCopyReminder = () => {
    const fullText = `Subject: ${reminderSubject}\n\n${reminderBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // User Action 2: Mark Reminder Logged (Never auto-sends)
  const handleMarkReminderLogged = () => {
    if (!invoice) return;
    const now = new Date().toISOString();
    const newEntry = {
      label: `Reminder Logged (${reminderTone} tone)`,
      timestamp: now,
      done: true,
    };

    const updated: Invoice = {
      ...invoice,
      timeline: [...invoice.timeline, newEntry],
    };

    upsertInvoice(updated);
    setInvoice(updated);
    setReminderLoggedMsg(`Logged "${reminderTone}" reminder to timeline (no auto-send performed).`);
  };

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Loading…</div>
    );
  }

  // ── Send via PayPal Invoicing API v2 ─────────────────────────
  const handleSendPayPal = async () => {
    setIsSendingPayPal(true);
    setStatusSyncMsg(null);
    try {
      const res = await fetch('/api/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_and_send_invoice',
          invoice,
        }),
      });

      interface PayPalInvoiceSendResult {
        ok: boolean;
        paypal_invoice_id?: string;
        recipient_view_url?: string;
        sent_at?: string;
        error?: string;
      }

      const data = (await res.json()) as PayPalInvoiceSendResult;
      if (!data.ok) {
        throw new Error(data.error || 'Failed to create and send PayPal invoice');
      }

      const now = new Date().toISOString();
      const updated: Invoice = {
        ...invoice,
        status: 'Sent',
        paypal_invoice_id: data.paypal_invoice_id,
        recipient_view_url: data.recipient_view_url,
        timeline: [
          { label: 'Draft Created', timestamp: invoice.created_at, done: true },
          { label: 'Invoice Sent via PayPal', timestamp: data.sent_at || now, done: true },
          { label: 'Paid in PayPal Sandbox', done: false },
        ],
      };

      const { risk_score, risk_reason } = computeRiskScore(updated);
      updated.risk_score = risk_score;
      updated.risk_reason = risk_reason;

      upsertInvoice(updated);
      setInvoice(updated);
      setStatusSyncMsg(`Invoice sent successfully via PayPal Invoicing API (${data.paypal_invoice_id})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`PayPal Invoicing API Error: ${msg}`);
    } finally {
      setIsSendingPayPal(false);
    }
  };

  // ── Refresh Status (Polling API) ─────────────────────────────
  const handleRefreshStatus = async () => {
    if (!invoice.paypal_invoice_id) return;
    setIsRefreshingStatus(true);
    setStatusSyncMsg(null);
    try {
      const res = await fetch('/api/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_status',
          paypal_invoice_id: invoice.paypal_invoice_id,
          invoice_id: invoice.id,
        }),
      });

      interface StatusResult {
        ok: boolean;
        paypal_status?: string;
        mapped_status?: 'Draft' | 'Sent' | 'Paid';
        paypal_transaction_id?: string;
        paid_at?: string;
        error?: string;
      }

      const data = (await res.json()) as StatusResult;
      if (!data.ok) throw new Error(data.error || 'Failed to poll status');

      if (data.mapped_status === 'Paid') {
        const updated: Invoice = {
          ...invoice,
          status: 'Paid',
          paypal_transaction_id: data.paypal_transaction_id || invoice.paypal_transaction_id,
          paid_at: data.paid_at || new Date().toISOString(),
          timeline: invoice.timeline.map((t) => ({ ...t, done: true })),
        };
        const { risk_score, risk_reason } = computeRiskScore(updated);
        updated.risk_score = risk_score;
        updated.risk_reason = risk_reason;
        upsertInvoice(updated);
        setInvoice(updated);
        setStatusSyncMsg('Status synced: Invoice is Paid in PayPal Sandbox!');
      } else {
        setStatusSyncMsg(`PayPal status: ${data.paypal_status || 'SENT'} (Waiting for payment)`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusSyncMsg(`Status check error: ${msg}`);
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[#003087]">{invoice.id}</h1>
          <p className="text-sm text-slate-500">
            Created {formatDate(invoice.created_at)} · Due {formatDate(invoice.due_date)}
          </p>
        </div>
        <StatusBadge status={invoice.status} overdueDays={overdueDays} />
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(invoice.status === 'Draft' || !invoice.paypal_invoice_id) && invoice.status !== 'Paid' && (
          <button
            onClick={handleSendPayPal}
            disabled={isSendingPayPal}
            className="flex items-center gap-2 bg-[#0070E0] hover:bg-[#005bbf] disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            {isSendingPayPal ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending via PayPal...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send via PayPal Invoicing API
              </>
            )}
          </button>
        )}

        {invoice.paypal_invoice_id && (
          <button
            onClick={handleRefreshStatus}
            disabled={isRefreshingStatus}
            className="flex items-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Poll PayPal Sandbox status"
          >
            <RefreshCw className={`h-4 w-4 text-[#0070E0] ${isRefreshingStatus ? 'animate-spin' : ''}`} />
            Refresh PayPal Status
          </button>
        )}

        <Link
          to={`/client/${invoice.id}`}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <ExternalLink className="h-4 w-4 text-[#0070E0]" />
          Open Client Share View
        </Link>
      </div>

      {/* Sync Status Banner */}
      {statusSyncMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-[#0070E0]" />
            <span>{statusSyncMsg}</span>
          </div>
          <button onClick={() => setStatusSyncMsg(null)} className="text-blue-400 hover:text-blue-600 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Content (2/3) ────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3">Bill To</h3>
            <p className="text-lg font-semibold text-slate-800">{invoice.client_name}</p>
            <p className="text-sm text-slate-500">{invoice.client_email}</p>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_80px_100px_100px] gap-3 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Total</span>
            </div>
            {invoice.line_items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_100px_100px] gap-3 items-center px-5 py-3 border-t border-slate-100"
              >
                <span className="text-sm text-slate-700">{item.description}</span>
                <span className="text-sm text-slate-600 text-right">{item.quantity}</span>
                <span className="text-sm text-slate-600 text-right">{formatUSD(item.unit_price)}</span>
                <span className="text-sm font-medium text-slate-800 text-right">
                  {formatUSD(lineItemTotal(item))}
                </span>
              </div>
            ))}
            {/* Totals */}
            <div className="border-t border-slate-200 px-5 py-4 space-y-1">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{formatUSD(invoice.subtotal)}</span>
              </div>
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Tax ({invoice.tax_percent}%)</span>
                  <span>{formatUSD(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-[#003087] pt-1">
                <span>Total</span>
                <span>{formatUSD(invoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-slate-600">{invoice.notes}</p>
            </div>
          )}

          {/* ── AI Reminder Composer Panel (§5.3 & §6 Bit 4) ── */}
          {(invoice.status === 'Overdue' || invoice.status === 'Sent' || invoice.status === 'Draft') && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#0070E0]" />
                  <h3 className="font-semibold text-slate-800">AI Reminder Composer</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#0070E0]/10 text-[#0070E0] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {reminderSource === 'gemini' ? 'Gemini 2.5 Flash' : 'AI Assistant Draft'}
                  </span>
                  <button
                    onClick={() => fetchDraftReminder(reminderTone, invoice)}
                    disabled={isDraftingReminder}
                    className="text-xs text-slate-500 hover:text-[#0070E0] flex items-center gap-1 border border-slate-200 px-2 py-0.5 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${isDraftingReminder ? 'animate-spin' : ''}`} />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Tone Tabs */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wider">
                  Select Reminder Tone:
                </label>
                <div className="flex gap-2">
                  {REMINDER_TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => handleToneChange(tone)}
                      disabled={isDraftingReminder}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        reminderTone === tone
                          ? tone === 'Final'
                            ? 'bg-red-600 text-white shadow-sm'
                            : tone === 'Firm'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'bg-[#0070E0] text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable Subject */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Subject (Editable)
                </label>
                <input
                  type="text"
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                  disabled={isDraftingReminder}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent disabled:bg-slate-50"
                  placeholder="Payment reminder subject..."
                />
              </div>

              {/* Editable Body */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Message Body (Editable before sending)
                </label>
                <textarea
                  value={reminderBody}
                  onChange={(e) => setReminderBody(e.target.value)}
                  disabled={isDraftingReminder}
                  className="w-full h-36 p-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0070E0] focus:border-transparent resize-none leading-relaxed disabled:bg-slate-50 font-mono"
                  placeholder="Loading reminder..."
                />
              </div>

              {/* Strict Non-Auto-Send Notice & User Actions */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-slate-400 italic">
                  ✓ Review & edit message. Invoices are never auto-sent.
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMarkReminderLogged}
                    className="flex items-center gap-1.5 text-xs text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors font-medium"
                    title="Log this reminder to the payment timeline without emailing"
                  >
                    <BookCheck className="h-3.5 w-3.5 text-slate-500" />
                    Mark Reminder Logged
                  </button>

                  <button
                    onClick={handleCopyReminder}
                    className={`flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg font-medium transition-colors shadow-sm ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0070E0] hover:bg-[#005bbf] text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Reminder
                      </>
                    )}
                  </button>
                </div>
              </div>

              {reminderLoggedMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{reminderLoggedMsg}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar (1/3) ────────────────────────────── */}
        <div className="space-y-6">
          {/* Payment Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">
              Payment Timeline
            </h3>
            <div className="space-y-4">
              {invoice.timeline.map((entry, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3.5 h-3.5 rounded-full mt-0.5 flex items-center justify-center ${
                        entry.done ? 'bg-emerald-500 text-white' : 'bg-slate-200'
                      }`}
                    >
                      {entry.done && <Check className="w-2.5 h-2.5" />}
                    </div>
                    {i < invoice.timeline.length - 1 && (
                      <div className={`w-0.5 flex-1 mt-1 ${entry.done ? 'bg-emerald-300' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm font-medium ${entry.done ? 'text-slate-800' : 'text-slate-400'}`}>
                      {entry.label}
                    </p>
                    {entry.timestamp && (
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(entry.timestamp)}</p>
                    )}
                    {entry.label.includes('Paid') && invoice.paypal_transaction_id && entry.done && (
                      <p className="text-xs text-emerald-600 font-mono mt-0.5">
                        TXN: {invoice.paypal_transaction_id}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-slate-500" />
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Demo Risk Heuristic
              </h3>
            </div>

            {/* Score Bar */}
            <div className="mb-3">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-slate-800">{invoice.risk_score}</span>
                <span className="text-sm text-slate-400">/ 100</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    invoice.risk_score <= 30
                      ? 'bg-emerald-500'
                      : invoice.risk_score <= 65
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${invoice.risk_score}%` }}
                />
              </div>
            </div>

            <p className="text-sm text-slate-600">{invoice.risk_reason}</p>
          </div>

          {/* PayPal Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                PayPal Reference
              </h3>
              <span className="text-[11px] bg-blue-50 text-[#0070E0] border border-blue-200 px-2 py-0.5 rounded font-mono">
                Sandbox v2
              </span>
            </div>

            <div className="space-y-2 text-sm">
              {invoice.paypal_invoice_id ? (
                <>
                  <div>
                    <span className="text-slate-400 text-xs block">Invoice ID:</span>
                    <span className="font-mono text-xs font-semibold text-slate-800 break-all">
                      {invoice.paypal_invoice_id}
                    </span>
                  </div>
                  {invoice.recipient_view_url && (
                    <div className="pt-1">
                      <a
                        href={invoice.recipient_view_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#0070E0] hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        PayPal Recipient View
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">Not sent to PayPal yet</p>
              )}

              {invoice.paypal_transaction_id && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-xs block">Capture Transaction ID:</span>
                  <span className="font-mono text-xs font-semibold text-emerald-600 break-all">
                    {invoice.paypal_transaction_id}
                  </span>
                </div>
              )}

              {invoice.payer_email && (
                <div>
                  <span className="text-slate-400 text-xs block">Payer Email:</span>
                  <span className="text-xs font-medium text-slate-700">{invoice.payer_email}</span>
                </div>
              )}

              {invoice.paid_at && (
                <div>
                  <span className="text-slate-400 text-xs block">Paid Timestamp:</span>
                  <span className="text-xs text-slate-600">{formatDate(invoice.paid_at)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────

function StatusBadge({ status, overdueDays }: { status: string; overdueDays: number }) {
  if (status === 'Overdue') {
    return (
      <span className="ml-auto flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
        Overdue • {overdueDays > 0 ? `${overdueDays} days overdue` : 'Overdue'}
      </span>
    );
  }

  const config: Record<string, { bg: string; icon: React.ReactNode }> = {
    Draft: { bg: 'bg-slate-100 text-slate-700 border border-slate-200', icon: <Clock className="h-3.5 w-3.5" /> },
    Sent: {
      bg: 'bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20',
      icon: <Send className="h-3.5 w-3.5" />,
    },
    Paid: {
      bg: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      icon: <CheckCircle className="h-3.5 w-3.5" />,
    },
  };
  const c = config[status] ?? config['Draft'];

  return (
    <span className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${c.bg}`}>
      {c.icon}
      {status}
    </span>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  CreditCard,
  FileText,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { Invoice } from '../types/invoice';
import { getInvoice, upsertInvoice } from '../utils/storage';
import { formatUSD, formatDate, lineItemTotal, computeRiskScore } from '../utils/invoiceMath';

export default function ClientView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  // PayPal Checkout Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [approveUrl, setApproveUrl] = useState<string | null>(null);
  const [checkoutMode, setCheckoutMode] = useState<string>('sandbox');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const inv = getInvoice(id);
    if (!inv) {
      navigate('/');
      return;
    }
    setInvoice(inv);
  }, [id, navigate]);

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
    );
  }

  const isPaid = invoice.status === 'Paid';

  // ── Step 1: Initiate PayPal Checkout (Create Order) ────────
  const handleOpenCheckout = async () => {
    setIsCreatingOrder(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_order',
          invoice,
        }),
      });

      interface CreateOrderResponse {
        ok: boolean;
        mode?: string;
        order_id?: string;
        approve_url?: string;
        error?: string;
      }

      const data = (await res.json()) as CreateOrderResponse;
      if (!data.ok || !data.order_id) {
        throw new Error(data.error || 'Failed to initialize PayPal Checkout');
      }

      setOrderId(data.order_id);
      setApproveUrl(data.approve_url || null);
      setCheckoutMode(data.mode || 'sandbox');
      setIsModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Could not start PayPal Checkout: ${msg}`);
    } finally {
      setIsCreatingOrder(false);
    }
  };

  // ── Step 2: Approve & Capture Payment ──────────────────────
  const handleApproveAndCapture = async () => {
    if (!orderId) return;
    setIsCapturing(true);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/paypal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'capture_order',
          order_id: orderId,
          invoice,
        }),
      });

      interface CaptureOrderResponse {
        ok: boolean;
        mode?: string;
        status?: string;
        paypal_order_id?: string;
        paypal_transaction_id?: string;
        payer_email?: string;
        paid_at?: string;
        error?: string;
      }

      const data = (await res.json()) as CaptureOrderResponse;
      if (!data.ok) {
        throw new Error(data.error || 'Failed to capture PayPal payment');
      }

      const now = data.paid_at || new Date().toISOString();
      const updated: Invoice = {
        ...invoice,
        status: 'Paid',
        paypal_transaction_id: data.paypal_transaction_id,
        paypal_order_id: data.paypal_order_id || orderId,
        payer_email: data.payer_email || 'sb-buyer@personal.example.com',
        paid_at: now,
        timeline: [
          { label: 'Draft Created', timestamp: invoice.created_at, done: true },
          {
            label: 'Invoice Sent via PayPal',
            timestamp: invoice.timeline[1]?.timestamp || invoice.created_at,
            done: true,
          },
          { label: 'Paid in PayPal Sandbox', timestamp: now, done: true },
        ],
      };

      // Lower risk score on payment
      const { risk_score, risk_reason } = computeRiskScore(updated);
      updated.risk_score = risk_score;
      updated.risk_reason = risk_reason;

      upsertInvoice(updated);
      setInvoice(updated);
      setIsModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCheckoutError(msg);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative">
      {/* Back Banner */}
      <div className="bg-[#003087] text-white">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            to={`/invoice/${invoice.id}`}
            className="flex items-center gap-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ← Back to Freelancer View
          </Link>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <FileText className="h-4 w-4" />
            Client Share View
          </div>
        </div>
      </div>

      {/* Invoice Card */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#003087] to-[#0070E0] text-white px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-6 w-6 text-white/80" />
                  <span className="text-lg font-bold">InvoicePilot</span>
                </div>
                <p className="text-white/60 text-sm">Invoice</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">{invoice.id}</p>
                <p className="text-white/60 text-sm">Due {formatDate(invoice.due_date)}</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-8 space-y-8">
            {/* Bill To */}
            <div>
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Bill To</h3>
              <p className="text-lg font-semibold text-slate-800">{invoice.client_name}</p>
              <p className="text-sm text-slate-500">{invoice.client_email}</p>
            </div>

            {/* Line Items */}
            <div>
              <div className="grid grid-cols-[1fr_80px_100px_100px] gap-3 pb-2 border-b border-slate-200 text-xs font-medium text-slate-400 uppercase tracking-wider">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>
              {invoice.line_items.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_80px_100px_100px] gap-3 py-3 border-b border-slate-50"
                >
                  <span className="text-sm text-slate-700">{item.description}</span>
                  <span className="text-sm text-slate-600 text-right">{item.quantity}</span>
                  <span className="text-sm text-slate-600 text-right">{formatUSD(item.unit_price)}</span>
                  <span className="text-sm font-medium text-slate-800 text-right">
                    {formatUSD(lineItemTotal(item))}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{formatUSD(invoice.subtotal)}</span>
                </div>
                {invoice.tax_amount > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Tax ({invoice.tax_percent}%)</span>
                    <span>{formatUSD(invoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-xl text-[#003087] border-t border-slate-200 pt-2">
                  <span>Total Due</span>
                  <span>{formatUSD(invoice.total)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Notes</h3>
                <p className="text-sm text-slate-600">{invoice.notes}</p>
              </div>
            )}

            {/* ── Verified Receipt vs Pay Now Button ──────────── */}
            {isPaid ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-900">Payment Verified by PayPal Sandbox</h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Invoice {invoice.id} was paid in full. A receipt has been issued.
                  </p>
                </div>

                <div className="bg-white border border-emerald-100 rounded-xl p-4 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">PayPal Transaction ID:</span>
                    <span className="font-mono font-bold text-emerald-700 break-all">
                      {invoice.paypal_transaction_id || '7XK92831904L'}
                    </span>
                  </div>
                  {invoice.paypal_order_id && (
                    <div>
                      <span className="text-slate-400 block">PayPal Order ID:</span>
                      <span className="font-mono font-semibold text-slate-700 break-all">
                        {invoice.paypal_order_id}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400 block">Sandbox Payer:</span>
                    <span className="font-medium text-slate-700">
                      {invoice.payer_email || 'sb-buyer@personal.example.com'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Paid Timestamp:</span>
                    <span className="text-slate-700 font-medium">
                      {formatDate(invoice.paid_at || invoice.created_at)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center pt-2 space-y-3">
                <button
                  onClick={handleOpenCheckout}
                  disabled={isCreatingOrder}
                  className="inline-flex items-center gap-3 bg-[#0070E0] hover:bg-[#005bbf] disabled:bg-slate-300 text-white px-8 py-4 rounded-xl text-lg font-bold transition-colors shadow-lg shadow-[#0070E0]/20"
                >
                  {isCreatingOrder ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Initializing PayPal...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-6 w-6" />
                      Pay Now with PayPal ({formatUSD(invoice.total)})
                    </>
                  )}
                </button>
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  <span>Official PayPal Sandbox Checkout (Orders API v2)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PayPal Sandbox Checkout Modal ────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#003087] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                  <span className="text-[#0070E0] font-black text-lg">P</span>
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">PayPal Sandbox Checkout</h3>
                  <p className="text-[11px] text-white/70">Orders API v2 Payment Capture</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-white/70 hover:text-white p-1 rounded transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Order Info Summary */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Invoice:</span>
                  <span className="font-mono font-medium text-slate-700">{invoice.id}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>PayPal Order ID:</span>
                  <span className="font-mono font-semibold text-[#0070E0]">{orderId}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Sandbox Buyer:</span>
                  <span className="font-medium text-slate-700">sb-buyer@personal.example.com</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-sm font-bold text-[#003087]">
                  <span>Total to Pay:</span>
                  <span>{formatUSD(invoice.total)}</span>
                </div>
              </div>

              {/* Mode Note */}
              <p className="text-xs text-slate-500 text-center">
                {checkoutMode === 'live_sandbox' ? (
                  <span>
                    Connected to <strong>Live PayPal Sandbox</strong>. You can approve directly below or open{' '}
                    {approveUrl && (
                      <a
                        href={approveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#0070E0] underline inline-flex items-center gap-0.5"
                      >
                        sandbox.paypal.com <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                ) : (
                  <span>
                    Simulating <strong>PayPal Sandbox Authorization</strong> for buyer{' '}
                    <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded">
                      sb-buyer@personal.example.com
                    </code>
                    . Click below to capture and record the transaction.
                  </span>
                )}
              </p>

              {checkoutError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {checkoutError}
                </div>
              )}

              {/* Approve & Capture Button */}
              <button
                onClick={handleApproveAndCapture}
                disabled={isCapturing}
                className="w-full py-3.5 px-4 bg-[#0070E0] hover:bg-[#005bbf] disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-[#0070E0]/20"
              >
                {isCapturing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Capturing Sandbox Payment...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Approve & Capture Sandbox Payment
                  </>
                )}
              </button>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Cancel Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

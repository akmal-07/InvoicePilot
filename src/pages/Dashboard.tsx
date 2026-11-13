import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign,
  AlertTriangle,
  CheckCircle,
  FileText,
  Eye,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import type { Invoice, InvoiceStatus } from '../types/invoice';
import { loadInvoices, ensureSeedData } from '../utils/storage';
import { formatUSD, formatDate, daysOverdue, daysUntilDue } from '../utils/invoiceMath';

const STATUS_FILTERS: (InvoiceStatus | 'All')[] = ['All', 'Draft', 'Sent', 'Paid', 'Overdue'];

function statusChip(inv: Invoice) {
  if (inv.status === 'Overdue') {
    const days = daysOverdue(inv.due_date);
    return (
      <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
        Overdue • {days > 0 ? `${days}d late` : 'late'}
      </span>
    );
  }

  if (inv.status === 'Sent') {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-[#0070E0]/10 text-[#0070E0] border border-[#0070E0]/20">
        Sent
      </span>
    );
  }

  if (inv.status === 'Paid') {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        Paid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
      Draft
    </span>
  );
}

function riskBadge(score: number, reason: string) {
  let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let level = 'Low';
  if (score > 65) {
    badgeColor = 'bg-red-50 text-red-700 border-red-200';
    level = 'High';
  } else if (score > 30) {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    level = 'Med';
  }

  return (
    <div className="flex flex-col items-center group relative cursor-help">
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
        {score} <span className="text-[10px] font-normal opacity-80">({level})</span>
      </span>
      <span className="text-[10px] text-slate-400 truncate max-w-[120px] mt-0.5 text-center" title={reason}>
        {reason}
      </span>
      {/* Tooltip on hover */}
      <div className="absolute bottom-full mb-1 hidden group-hover:block z-20 w-48 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg">
        <p className="font-semibold text-slate-200">Demo Risk Heuristic</p>
        <p className="text-slate-300 mt-0.5">{reason}</p>
      </div>
    </div>
  );
}

interface DashboardProps {
  refreshKey?: number;
}

export default function Dashboard({ refreshKey }: DashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatus | 'All'>('All');

  useEffect(() => {
    ensureSeedData();
    setInvoices(loadInvoices());
  }, [refreshKey]);

  // ── Metrics ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    // Outstanding = Sent + Overdue
    const outstanding = invoices
      .filter((i) => i.status === 'Sent' || i.status === 'Overdue')
      .reduce((s, i) => s + i.total, 0);

    const overdueList = invoices.filter((i) => i.status === 'Overdue');
    const overdue = overdueList.reduce((s, i) => s + i.total, 0);

    const paidList = invoices.filter((i) => i.status === 'Paid');
    const paid = paidList.reduce((s, i) => s + i.total, 0);

    const sentCount = invoices.filter((i) => i.status === 'Sent').length;
    const draftCount = invoices.filter((i) => i.status === 'Draft').length;

    return {
      outstanding,
      overdue,
      overdueCount: overdueList.length,
      paid,
      paidCount: paidList.length,
      sentCount,
      draftCount,
      total: invoices.length,
    };
  }, [invoices]);

  // ── Filtered List ──────────────────────────────────────────
  const filtered = useMemo(
    () => (filter === 'All' ? invoices : invoices.filter((i) => i.status === filter)),
    [invoices, filter],
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#003087]">Invoices Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Track outstanding invoices, overdue payments, and AI late-payment risk heuristics.
        </p>
      </div>

      {/* ── Metric Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Outstanding"
          value={formatUSD(metrics.outstanding)}
          subtext={`${metrics.sentCount} sent, ${metrics.overdueCount} overdue`}
          icon={<DollarSign className="h-5 w-5 text-[#0070E0]" />}
          color="bg-[#0070E0]/5 border-[#0070E0]/20"
        />
        <MetricCard
          label="Overdue"
          value={formatUSD(metrics.overdue)}
          subtext={`${metrics.overdueCount} invoice${metrics.overdueCount !== 1 ? 's' : ''} past due`}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          color="bg-red-50 border-red-200"
        />
        <MetricCard
          label="Paid This Month"
          value={formatUSD(metrics.paid)}
          subtext={`${metrics.paidCount} paid via PayPal`}
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-50 border-emerald-200"
        />
        <MetricCard
          label="Total Invoices"
          value={String(metrics.total)}
          subtext={`${metrics.paidCount} Paid • ${metrics.sentCount} Sent • ${metrics.overdueCount} Overdue`}
          icon={<FileText className="h-5 w-5 text-slate-500" />}
          color="bg-slate-50 border-slate-200"
        />
      </div>

      {/* ── Filter Pills with Live Counts ─────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        {STATUS_FILTERS.map((s) => {
          const count = s === 'All' ? invoices.length : invoices.filter((i) => i.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === s
                  ? 'bg-[#003087] text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{s}</span>
              <span
                className={`text-xs px-1.5 py-0.2 rounded-full ${
                  filter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Invoice Table ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[120px_1fr_130px_140px_110px_110px_90px] gap-3 px-5 py-3 bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider border-b border-slate-100">
          <span>Invoice ID</span>
          <span>Client</span>
          <span>Status</span>
          <span className="text-center flex items-center justify-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-slate-400" />
            Risk Heuristic
          </span>
          <span>Due Date</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Actions</span>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-3">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold text-slate-700">
              {filter === 'All' ? 'No invoices found' : `No ${filter.toLowerCase()} invoices`}
            </p>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {filter === 'All'
                ? 'Create your first invoice by describing the work in plain language.'
                : `There are currently no invoices with status "${filter}".`}
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              {filter !== 'All' && (
                <button
                  onClick={() => setFilter('All')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Clear Filter
                </button>
              )}
              <Link
                to="/create"
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#0070E0] hover:bg-[#003087] transition-colors"
              >
                + Create Invoice
              </Link>
            </div>
          </div>
        ) : (
          filtered.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-1 md:grid-cols-[120px_1fr_130px_140px_110px_110px_90px] gap-3 items-center px-5 py-4 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
            >
              {/* ID */}
              <span className="text-sm font-mono font-semibold text-slate-700">{inv.id}</span>

              {/* Client */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{inv.client_name}</p>
                <p className="text-xs text-slate-400 truncate">{inv.client_email}</p>
              </div>

              {/* Status Chip */}
              <div>{statusChip(inv)}</div>

              {/* Risk Heuristic Column */}
              <div>{riskBadge(inv.risk_score, inv.risk_reason)}</div>

              {/* Due Date */}
              <span className="text-sm text-slate-600">
                {formatDate(inv.due_date)}
                {inv.status === 'Sent' && (
                  <span className="block text-xs text-slate-400">
                    {daysUntilDue(inv.due_date)}d left
                  </span>
                )}
              </span>

              {/* Amount */}
              <span className="text-sm font-semibold text-slate-800 text-right">
                {formatUSD(inv.total)}
              </span>

              {/* Actions */}
              <div className="flex items-center justify-end gap-1">
                <Link
                  to={`/invoice/${inv.id}`}
                  className="p-1.5 text-slate-400 hover:text-[#0070E0] rounded hover:bg-slate-100 transition-colors"
                  title="View Details"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <Link
                  to={`/client/${inv.id}`}
                  className="p-1.5 text-slate-400 hover:text-[#0070E0] rounded hover:bg-slate-100 transition-colors"
                  title="Client Share View"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Metric Card Component ────────────────────────────────────

function MetricCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      {subtext && <p className="text-xs text-slate-500 mt-1">{subtext}</p>}
    </div>
  );
}

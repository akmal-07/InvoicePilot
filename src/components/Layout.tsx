import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, PlusCircle, LayoutDashboard, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { resetToSeedData } from '../utils/storage';

interface LayoutProps {
  children: ReactNode;
  onReset?: () => void;
}

export default function Layout({ children, onReset }: LayoutProps) {
  const location = useLocation();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setApiOk(d.ok === true))
      .catch(() => setApiOk(false));
  }, []);

  const handleReset = () => {
    resetToSeedData();
    onReset?.();
  };

  const isActive = (path: string) => location.pathname === path;

  // Don't show navbar on client view
  const isClientView = location.pathname.startsWith('/client/');
  if (isClientView) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Brand */}
            <Link to="/" className="flex items-center gap-2 shrink-0">
              <FileText className="h-7 w-7 text-[#0070E0]" />
              <span className="text-xl font-bold text-[#003087]">InvoicePilot</span>
            </Link>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1">
              <Link
                to="/create"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/create')
                    ? 'bg-[#0070E0] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <PlusCircle className="h-4 w-4" />
                Create Invoice
              </Link>
              <Link
                to="/"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/')
                    ? 'bg-[#0070E0] text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* API Status Pill */}
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${
                  apiOk === true
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : apiOk === false
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-slate-50 text-slate-500 border border-slate-200'
                }`}
              >
                {apiOk === true ? (
                  <Wifi className="h-3 w-3" />
                ) : (
                  <WifiOff className="h-3 w-3" />
                )}
                {apiOk === true ? 'Sandbox' : apiOk === false ? 'Offline' : '…'}
              </div>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                title="Reset to demo data"
              >
                <RefreshCw className="h-3 w-3" />
                Reset Demo Data
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}


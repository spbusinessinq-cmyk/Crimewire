import { useState, useEffect } from "react";
import { Link } from "wouter";

import AdminDashboard from "./admin/AdminDashboard";
import AdminReports from "./admin/AdminReports";
import AdminCaseFiles from "./admin/AdminCaseFiles";
import AdminUploads from "./admin/AdminUploads";
import AdminCrimeWire from "./admin/AdminCrimeWire";
import AdminReaderInbox from "./admin/AdminReaderInbox";
import AdminMailingList from "./admin/AdminMailingList";
import AdminAdvertisers from "./admin/AdminAdvertisers";
import AdminCorrections from "./admin/AdminCorrections";
import AdminSettings from "./admin/AdminSettings";
import AdminFrontPage from "./admin/AdminFrontPage";
import AdminComics from "./admin/AdminComics";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type TabId =
  | "dashboard"
  | "front-page"
  | "reports"
  | "case-files"
  | "uploads"
  | "crime-wire"
  | "comics"
  | "reader-inbox"
  | "mailing-list"
  | "advertisers"
  | "corrections"
  | "settings";

const TABS: { id: TabId; label: string; short: string }[] = [
  { id: "dashboard",    label: "Dashboard",         short: "Dash" },
  { id: "front-page",   label: "Front Page",        short: "Front" },
  { id: "reports",      label: "City Reports",      short: "Reports" },
  { id: "case-files",   label: "Case Files",        short: "Cases" },
  { id: "uploads",      label: "Records & Uploads", short: "Uploads" },
  { id: "crime-wire",   label: "Crime Wire",        short: "CW" },
  { id: "comics",       label: "The Funnies",       short: "Comics" },
  { id: "reader-inbox", label: "Reader Inbox",      short: "Inbox" },
  { id: "mailing-list", label: "Mailing List",      short: "Mail" },
  { id: "advertisers",  label: "Advertisers",       short: "Ads" },
  { id: "corrections",  label: "Corrections",       short: "Fixes" },
  { id: "settings",     label: "Settings",          short: "Settings" },
];

export default function Admin() {
  // null = checking session, false = not logged in, true = logged in
  const [isAuthenticated, setIsAuthenticated] = useState<null | boolean>(null);
  const [codeInput, setCodeInput]             = useState("");
  const [authError, setAuthError]             = useState<string | null>(null);
  const [loginPending, setLoginPending]       = useState(false);
  const [activeTab, setActiveTab]             = useState<TabId>("dashboard");
  const [mobileNav, setMobileNav]             = useState(false);

  // ── Check for existing session on mount ──────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setIsAuthenticated(d.authenticated === true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!codeInput) return;
    setLoginPending(true);
    setAuthError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput }),
      });
      if (res.ok) {
        setIsAuthenticated(true);
        setCodeInput("");
      } else if (res.status === 429) {
        setAuthError("Too many login attempts. Please wait 15 minutes.");
      } else if (res.status === 503) {
        setAuthError("Admin auth is not configured on this deployment. Contact the site operator.");
      } else {
        setAuthError("Access denied.");
      }
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setLoginPending(false);
    }
  }

  // ── Logout ────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch(`${BASE}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    setIsAuthenticated(false);
    setCodeInput("");
    setAuthError(null);
  }

  // ── Loading state ─────────────────────────────────────────────
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Login screen ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4 font-sans">
        <div className="w-full max-w-sm border border-black p-8">
          <div className="text-center mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">
              RSR Crime Division
            </p>
            <h1 className="text-3xl font-serif font-bold">BUREAU LOGIN</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">
                Access Code
              </label>
              <input
                type="password"
                value={codeInput}
                onChange={(e) => { setCodeInput(e.target.value); setAuthError(null); }}
                className="w-full border border-black px-3 py-2 text-black bg-white focus:outline-none focus:ring-1 focus:ring-black"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>
            {authError && (
              <p className="text-xs text-red-600 uppercase tracking-widest font-bold">
                {authError}
              </p>
            )}
            <button
              type="submit"
              disabled={loginPending}
              className="w-full bg-black text-white py-2 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loginPending ? "Verifying…" : "Enter Admin Desk"}
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <Link
              href="/"
              className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black"
            >
              ← Return to Public Site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin shell ───────────────────────────────────────────────
  const navigate = (tab: string) => {
    setActiveTab(tab as TabId);
    setMobileNav(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Top bar */}
      <header className="bg-black text-white sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 h-12">
          {/* Left: wordmark */}
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1 text-gray-400 hover:text-white"
              onClick={() => setMobileNav(!mobileNav)}
              aria-label="Toggle navigation"
            >
              <span className="text-lg leading-none">{mobileNav ? "✕" : "☰"}</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-[0.2em]">
              RSR Crime Division
            </span>
            <span className="hidden sm:inline text-gray-500 text-xs">·</span>
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest text-gray-400">
              Admin Desk
            </span>
          </div>
          {/* Right: controls */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-white hidden sm:inline"
            >
              Public Site ↗
            </a>
            <button
              onClick={handleLogout}
              className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-white"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Desktop tab nav */}
        <nav className="hidden lg:flex overflow-x-auto border-t border-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Tablet tab nav */}
        <nav className="hidden md:flex lg:hidden overflow-x-auto border-t border-gray-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
              className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {tab.short}
            </button>
          ))}
        </nav>
      </header>

      {/* Mobile slide-out nav */}
      {mobileNav && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="bg-black w-64 h-full overflow-y-auto pt-4 pb-8">
            <nav className="flex flex-col">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id)}
                  className={`px-5 py-3 text-left text-xs font-bold uppercase tracking-widest transition-colors ${
                    activeTab === tab.id
                      ? "bg-white text-black"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileNav(false)} />
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          {activeTab !== "dashboard" && (
            <button
              onClick={() => setActiveTab("dashboard")}
              aria-label="Back to Admin Desk dashboard"
              className="inline-flex items-center gap-1.5 mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black rounded-sm"
            >
              <span aria-hidden="true">←</span>
              Admin Desk
            </button>
          )}
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400 mb-0.5">
            Admin Desk
          </p>
          <h1 className="text-xl font-serif font-bold">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
          <div className="h-px bg-gray-200 mt-3" />
        </div>

        <div>
          {activeTab === "dashboard"    && <AdminDashboard onNavigate={navigate} />}
          {activeTab === "front-page"   && <AdminFrontPage />}
          {activeTab === "reports"      && <AdminReports />}
          {activeTab === "case-files"   && <AdminCaseFiles />}
          {activeTab === "uploads"      && <AdminUploads />}
          {activeTab === "crime-wire"   && <AdminCrimeWire />}
          {activeTab === "comics"       && <AdminComics />}
          {activeTab === "reader-inbox" && <AdminReaderInbox />}
          {activeTab === "mailing-list" && <AdminMailingList />}
          {activeTab === "advertisers"  && <AdminAdvertisers />}
          {activeTab === "corrections"  && <AdminCorrections />}
          {activeTab === "settings"     && <AdminSettings />}
        </div>
      </main>
    </div>
  );
}

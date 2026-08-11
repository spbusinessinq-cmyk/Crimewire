import { useState, useEffect } from "react";
import { api, fmtDateTime, Spinner } from "./shared";

interface Props {
  onNavigate: (tab: string) => void;
}

interface Stats {
  reports: { total: number; published: number; draft: number; developing: number };
  issues: { total: number; published: number };
  subscribers: { total: number };
  inbox: { total: number; newCount: number };
  caseFiles: { total: number };
  log: Array<{ id: number; action: string; entityType: string; entityTitle: string; createdAt: string }>;
}

interface EmailStatus {
  configured: boolean;
  missing: string[];
  optional: string[];
  hasNewsroom: boolean;
  siteUrl: string;
}

export default function AdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reportsRes, issuesRes, subsRes, lettersRes, caseFilesRes, logRes, emailRes] = await Promise.all([
          api("/reports/all/list"),
          api("/issues/all"),
          api("/subscriptions"),
          api("/letters"),
          api("/case-files/all"),
          api("/admin-log?limit=10"),
          api("/admin/email/status"),
        ]);

        const reports = reportsRes.ok ? await reportsRes.json() : [];
        const issues = issuesRes.ok ? await issuesRes.json() : [];
        const subs = subsRes.ok ? await subsRes.json() : [];
        const letters = lettersRes.ok ? await lettersRes.json() : [];
        const cases = caseFilesRes.ok ? await caseFilesRes.json() : [];
        const logData = logRes.ok ? await logRes.json() : [];
        const email = emailRes.ok ? await emailRes.json() : null;

        setStats({
          reports: {
            total: reports.length,
            published: reports.filter((r: { status: string }) => r.status === "published").length,
            draft: reports.filter((r: { status: string }) => r.status === "draft").length,
            developing: reports.filter((r: { status: string }) => r.status === "developing").length,
          },
          issues: {
            total: issues.length,
            published: issues.filter((i: { status: string }) => i.status === "published").length,
          },
          subscribers: { total: subs.length },
          inbox: {
            total: letters.length,
            newCount: letters.filter((l: { status: string }) => l.status === "pending").length,
          },
          caseFiles: { total: cases.length },
          log: logData,
        });
        setEmailStatus(email);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const quickActions = [
    { label: "Edit Front Page",         tab: "front-page" },
    { label: "New City Report",         tab: "reports" },
    { label: "New Court Update",        tab: "reports" },
    { label: "New Field Dispatch",      tab: "reports" },
    { label: "Upload Record",           tab: "uploads" },
    { label: "Open Case File",          tab: "case-files" },
    { label: "Upload Crime Wire PDF",   tab: "crime-wire" },
    { label: "Manage Comics",           tab: "comics" },
    { label: "Publish Correction",      tab: "corrections" },
  ];

  const statCards = [
    {
      label: "City Reports",
      value: stats.reports?.total ?? 0,
      sub: `${stats.reports?.published ?? 0} published · ${stats.reports?.draft ?? 0} draft`,
      tab: "reports",
      alert: (stats.reports?.developing ?? 0) > 0 ? `${stats.reports?.developing} developing` : null,
    },
    {
      label: "Crime Wire Issues",
      value: stats.issues?.total ?? 0,
      sub: stats.issues?.total === 0
        ? "No issues on file — upload first edition"
        : `${stats.issues?.published ?? 0} current`,
      tab: "crime-wire",
      alert: null,
    },
    {
      label: "Subscribers",
      value: stats.subscribers?.total ?? 0,
      sub: "Thursday Drop list",
      tab: "mailing-list",
      alert: null,
    },
    {
      label: "Reader Inbox",
      value: stats.inbox?.total ?? 0,
      sub: `${stats.inbox?.newCount ?? 0} awaiting review`,
      tab: "reader-inbox",
      alert: (stats.inbox?.newCount ?? 0) > 0 ? `${stats.inbox?.newCount} unreviewed` : null,
    },
    {
      label: "Case Files",
      value: stats.caseFiles?.total ?? 0,
      sub: "investigative",
      tab: "case-files",
      alert: null,
    },
  ];

  return (
    <div className="space-y-7">

      {/* ── Quick Actions ────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Actions</p>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={() => onNavigate(qa.tab)}
              className="px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-gray-700 transition-colors"
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Newsroom Status</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {statCards.map((s) => (
            <button
              key={s.label}
              onClick={() => onNavigate(s.tab)}
              className="border-2 border-black p-4 text-left hover:bg-black hover:text-white transition-colors group"
            >
              <div className="text-3xl font-serif font-bold leading-none mb-1 tabular-nums">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 group-hover:text-white">{s.label}</div>
              <div className="text-[10px] text-gray-400 group-hover:text-gray-300">{s.sub}</div>
              {s.alert && (
                <div className="mt-1 text-[9px] font-bold uppercase tracking-widest text-amber-600 group-hover:text-yellow-300">
                  ▲ {s.alert}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Activity Log ─────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Activity</p>
        {!stats.log?.length ? (
          <p className="text-xs text-gray-400 border border-gray-200 px-4 py-3">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200">
            {stats.log?.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap pt-0.5 w-[72px] shrink-0">
                  {entry.action}
                </span>
                <span className="text-xs flex-1 min-w-0">
                  <span className="text-gray-500">{entry.entityType}:</span>{" "}
                  <span className="font-medium truncate">{entry.entityTitle || "—"}</span>
                </span>
                <span className="text-[10px] text-gray-400 whitespace-nowrap shrink-0">
                  {fmtDateTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Service Status — live data ────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Service Status</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Email — live from /admin/email/status */}
          {emailStatus === null ? (
            <div className="border border-gray-200 p-4 bg-gray-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email · Checking…</p>
            </div>
          ) : emailStatus.configured ? (
            <div className="border-l-4 border-green-600 border border-green-200 p-4 bg-green-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-1">
                ✓ Email Delivery Connected
              </p>
              <p className="text-xs text-green-700">
                Resend active. Welcome emails, Thursday Drop dispatch, and newsroom notifications are operational.
                {!emailStatus.hasNewsroom && (
                  <span className="block mt-1 text-amber-700">EMAIL_NEWSROOM not set — contact-form copies go nowhere.</span>
                )}
              </p>
              <button onClick={() => onNavigate("mailing-list")}
                className="mt-2 text-[10px] font-bold uppercase tracking-widest underline text-green-800">
                Manage in Mailing List →
              </button>
            </div>
          ) : (
            <div className="border-l-4 border-amber-500 border border-amber-200 p-4 bg-amber-50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">
                ⚠ Email — Configuration Incomplete
              </p>
              <p className="text-xs text-amber-700 mb-1">
                Signups are stored. No emails are sent. Missing secrets:
              </p>
              <ul className="space-y-0.5 mb-2">
                {emailStatus.missing.map((k) => (
                  <li key={k} className="text-[10px] font-mono font-bold text-amber-800">{k}</li>
                ))}
              </ul>
              <button onClick={() => onNavigate("settings")}
                className="text-[10px] font-bold uppercase tracking-widest underline text-amber-800">
                View setup guide in Settings →
              </button>
            </div>
          )}

          {/* File storage — neutral, directs to Settings */}
          <div className="border border-gray-200 p-4 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">File Storage</p>
            <p className="text-xs text-gray-600">
              Uploaded files and PDFs are stored via the configured storage provider. To review storage configuration or change providers, go to Settings.
            </p>
            <button onClick={() => onNavigate("settings")}
              className="mt-2 text-[10px] font-bold uppercase tracking-widest underline text-gray-500">
              Go to Settings →
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

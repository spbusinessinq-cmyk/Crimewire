import { useState, useEffect } from "react";
import { Link } from "wouter";
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

export default function AdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState<Partial<Stats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [reportsRes, issuesRes, subsRes, lettersRes, caseFilesRes, logRes] = await Promise.all([
          api("/reports/all/list"),
          api("/issues/all"),
          api("/subscriptions"),
          api("/letters"),
          api("/case-files/all"),
          api("/admin-log?limit=10"),
        ]);

        const reports = reportsRes.ok ? await reportsRes.json() : [];
        const issues = issuesRes.ok ? await issuesRes.json() : [];
        const subs = subsRes.ok ? await subsRes.json() : [];
        const letters = lettersRes.ok ? await lettersRes.json() : [];
        const cases = caseFilesRes.ok ? await caseFilesRes.json() : [];
        const logData = logRes.ok ? await logRes.json() : [];

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
    { label: "New City Report", tab: "reports", action: "new" },
    { label: "New Court Update", tab: "reports", action: "new-court" },
    { label: "New Field Dispatch", tab: "reports", action: "new-field" },
    { label: "Upload Record", tab: "uploads", action: "new" },
    { label: "Open Case File", tab: "case-files", action: "new" },
    { label: "Upload Crime Wire PDF", tab: "crime-wire", action: "new" },
    { label: "Publish Correction", tab: "corrections", action: "new" },
  ];

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((qa) => (
            <button
              key={qa.label}
              onClick={() => onNavigate(qa.tab)}
              className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Newsroom Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            {
              label: "City Reports",
              value: stats.reports?.total ?? 0,
              sub: `${stats.reports?.published ?? 0} published · ${stats.reports?.draft ?? 0} draft`,
              tab: "reports",
            },
            {
              label: "Crime Wire Issues",
              value: stats.issues?.total ?? 0,
              sub: `${stats.issues?.published ?? 0} current`,
              tab: "crime-wire",
            },
            {
              label: "Subscribers",
              value: stats.subscribers?.total ?? 0,
              sub: "mailing list",
              tab: "mailing-list",
            },
            {
              label: "Reader Inbox",
              value: stats.inbox?.total ?? 0,
              sub: `${stats.inbox?.newCount ?? 0} awaiting review`,
              tab: "reader-inbox",
            },
            {
              label: "Case Files",
              value: stats.caseFiles?.total ?? 0,
              sub: "investigative",
              tab: "case-files",
            },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => onNavigate(s.tab)}
              className="border border-gray-200 p-4 text-left hover:border-black transition-colors"
            >
              <div className="text-2xl font-serif font-bold">{s.value}</div>
              <div className="text-[10px] font-bold uppercase tracking-widest mt-1">{s.label}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Developing Stories */}
      {(stats.reports?.developing ?? 0) > 0 && (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Developing Stories — {stats.reports?.developing} Active
          </h3>
          <button
            onClick={() => onNavigate("reports")}
            className="text-xs font-bold uppercase tracking-widest underline"
          >
            View in Reports →
          </button>
        </div>
      )}

      {/* Activity Log */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Recent Activity
        </h3>
        {stats.log?.length === 0 ? (
          <p className="text-xs text-gray-400">No activity recorded yet.</p>
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-100">
            {stats.log?.map((entry) => (
              <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap pt-0.5 min-w-[80px]">
                  {entry.action}
                </span>
                <span className="text-xs flex-1">
                  <span className="text-gray-500">{entry.entityType}:</span>{" "}
                  {entry.entityTitle || "—"}
                </span>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {fmtDateTime(entry.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Honest notices */}
      <div className="border border-gray-200 p-4 bg-gray-50 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Service Status</p>
        <p className="text-xs text-gray-600">
          <span className="font-bold">Email delivery:</span> Not connected. Subscriber signups are stored but no emails are dispatched.
          Connect an email provider (Resend, SendGrid) to activate Thursday Drop delivery.
        </p>
        <p className="text-xs text-gray-600">
          <span className="font-bold">File storage:</span> Uploads save to local disk. Files are not persistent across redeploys.
          Integrate Replit Object Storage for production-grade file persistence.
        </p>
      </div>
    </div>
  );
}

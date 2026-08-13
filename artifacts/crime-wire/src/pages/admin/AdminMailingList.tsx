import { useState, useEffect, useCallback } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, textareaCls, fmtDate, downloadCsv } from "./shared";

interface Subscriber {
  id: number; email: string; name: string | null; zip: string | null;
  editionType: string; consent: boolean; status: string; createdAt: string;
}
interface PressClubMember {
  id: number; email: string; name: string | null; tier: string;
  city: string | null; zip: string | null; mailingAddress: string | null;
  status: string; adminNote: string | null; createdAt: string;
}
interface EmailStatus {
  configured: boolean;
  missing: string[];
  optional: string[];
  siteUrl: string;
  hasNewsroom: boolean;
  recentLog: LogEntry[];
}
interface LogEntry {
  id: number; type: string; subject?: string; to?: string;
  sent?: number; failed?: number; total?: number; skipped?: number; ok?: boolean;
  error?: string | null; timestamp: string; category?: string;
}
interface DispatchIssue {
  id: number; volume: number; number: string; title: string;
  publishDate: string | null; pdfUrl: string | null;
  readCtaUrl: string | null; downloadCtaUrl: string | null; status: string;
}

type TabId = "digital" | "press_club" | "dispatch";

const EDITION_LABELS: Record<string, string> = {
  digital: "Digital Edition",
  mailed: "Mailed Copy (Waitlist)",
  both: "Both",
};

export default function AdminMailingList() {
  const [activeTab, setActiveTab] = useState<TabId>("digital");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [pressClub, setPressClub] = useState<PressClubMember[]>([]);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailLoading, setEmailLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEdition, setFilterEdition] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteVal, setNoteVal] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  // Dispatch form state
  const [testTo, setTestTo] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string>("");
  const [issueSubject, setIssueSubject] = useState("");
  const [issuePreview, setIssuePreview] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [issueConfirm, setIssueConfirm] = useState(false);
  const [issueSending, setIssueSending] = useState(false);
  const [issueResult, setIssueResult] = useState<{ ok: boolean; msg: string; sent?: number; failed?: number; skipped?: number; duplicate?: boolean } | null>(null);
  const [issues, setIssues] = useState<DispatchIssue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [issueMessage, setIssueMessage] = useState("");
  const [recipientInfo, setRecipientInfo] = useState<{ eligible: number; total: number; skipped: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/subscriptions").then((r) => r.ok ? r.json() : []),
      api("/press-club").then((r) => r.ok ? r.json() : []),
      api("/issues/all").then((r) => r.ok ? r.json() : []),
    ]).then(([subs, pc, iss]) => {
      const clean = (arr: any[]) =>
        arr.filter((s: any) => !s.email.includes("test@") && !s.email.includes("audit@") && !s.email.includes("example.com"));
      setSubscribers(clean(subs as Subscriber[]));
      setPressClub(clean(pc as PressClubMember[]));
      const publishedIss = (iss as DispatchIssue[])
        .filter((i) => i.status === "published" || i.status === "archived")
        .sort((a, b) => {
          const diff = new Date(b.publishDate ?? "").getTime() - new Date(a.publishDate ?? "").getTime();
          return diff !== 0 ? diff : b.id - a.id;
        });
      setIssues(publishedIss);
      setSelectedIssueId((prev) => {
        if (prev !== null) return prev;
        const current = (iss as DispatchIssue[]).find((i) => i.status === "published");
        return current?.id ?? null;
      });
    }).finally(() => setLoading(false));
  }, []);

  const loadEmailStatus = useCallback(() => {
    setEmailLoading(true);
    Promise.all([
      api("/admin/email/status").then(async (r) => r.ok ? r.json() : null),
      api("/admin/email/recipients").then(async (r) => r.ok ? r.json() : null),
    ]).then(([status, recipients]) => {
      if (status) setEmailStatus(status);
      if (recipients) setRecipientInfo(recipients);
    }).finally(() => setEmailLoading(false));
  }, []);

  useEffect(() => { loadAll(); loadEmailStatus(); }, [loadAll, loadEmailStatus]);

  // Auto-populate subject/preview when an issue is selected
  useEffect(() => {
    if (!selectedIssueId || !issues.length) return;
    const sel = issues.find((i) => i.id === selectedIssueId);
    if (!sel) return;
    const dateStr = sel.publishDate
      ? new Date(sel.publishDate + (sel.publishDate.length === 10 ? "T12:00:00" : ""))
          .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : "";
    setIssueSubject(`Los Angeles Crime Wire \u2014 ${dateStr || sel.title}`);
    setIssuePreview((prev) => prev || sel.title || "");
  }, [selectedIssueId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function updatePressClub(id: number, updates: Partial<PressClubMember>) {
    setSaving(true); setError(""); setSuccess("");
    const res = await api(`/press-club/${id}`, { method: "PATCH", body: JSON.stringify(updates) });
    if (res.ok) { setSuccess("Member updated."); setEditingNote(null); loadAll(); }
    else { const d = await res.json(); setError(d.error ?? "Update failed"); }
    setSaving(false);
  }

  async function sendTest() {
    if (!testTo.trim()) return;
    setTestSending(true); setTestResult("");
    const res = await api("/admin/email/test", { method: "POST", body: JSON.stringify({ to: testTo.trim() }) });
    const d = await res.json();
    setTestResult(res.ok ? `✓ Delivered to ${testTo} at ${d.timestamp}` : `✗ ${d.error}`);
    if (res.ok) loadEmailStatus();
    setTestSending(false);
  }

  async function sendIssue() {
    if (!issueSubject.trim() || !issueConfirm) return;
    setIssueSending(true); setIssueResult(null);
    const res = await api("/admin/email/send-issue", {
      method: "POST",
      body: JSON.stringify({
        subject: issueSubject,
        preview: issuePreview,
        message: issueMessage,
        issueId: selectedIssueId,
        confirmSend: true,
      }),
    });
    const d = await res.json();
    if (res.ok) {
      setIssueResult({ ok: true, msg: `Dispatched to ${d.sent} of ${d.total} eligible`, sent: d.sent, failed: d.failed, skipped: d.skipped });
      setIssueConfirm(false);
      loadEmailStatus();
    } else {
      setIssueResult({ ok: false, msg: d.error, duplicate: d.duplicate });
    }
    setIssueSending(false);
  }

  const filteredSubs = subscribers.filter((s) => {
    if (search && !s.email.toLowerCase().includes(search.toLowerCase()) &&
        !(s.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEdition && s.editionType !== filterEdition) return false;
    return true;
  });

  const filteredPc = pressClub.filter((m) => {
    if (search && !m.email.toLowerCase().includes(search.toLowerCase()) &&
        !(m.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTier && m.tier !== filterTier) return false;
    return true;
  });

  const activeSubs = subscribers.filter((s) => s.status === "active");
  const printWaitlist = filteredPc.filter((m) => m.tier === "print_waitlist");
  const pressClubMembers = filteredPc.filter((m) => m.tier !== "print_waitlist");

  // ── Email status banner ────────────────────────────────────────

  const StatusBanner = () => {
    if (emailLoading) return <div className="border border-gray-200 bg-gray-50 p-3 mb-4 text-xs text-gray-400">Checking email configuration…</div>;
    if (!emailStatus) return null;

    if (emailStatus.configured) {
      return (
        <div className="border border-green-200 bg-green-50 p-3 mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-700 mb-1">✓ Email Connected</p>
          <p className="text-xs text-green-700">
            Resend is active. Welcome emails, newsroom notifications, and Thursday Drop dispatch are all operational.
            {!emailStatus.hasNewsroom && " Add EMAIL_NEWSROOM to enable contact-form notifications to the newsroom."}
          </p>
        </div>
      );
    }

    return (
      <div className="border border-amber-200 bg-amber-50 p-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 mb-1">⚠ Email Configuration Incomplete</p>
        <p className="text-xs text-amber-700 mb-2">
          Signups are stored but no emails are sent. Set the following in Replit → Secrets:
        </p>
        <ul className="text-xs text-amber-800 space-y-1 pl-3">
          {emailStatus.missing.map((k) => (
            <li key={k} className="font-mono font-bold">{k}</li>
          ))}
        </ul>
        {emailStatus.optional.length > 0 && (
          <p className="text-[10px] text-amber-600 mt-2">
            Also recommended: {emailStatus.optional.join(", ")}
          </p>
        )}
        <p className="text-[10px] text-amber-600 mt-2 border-t border-amber-200 pt-2">
          <strong>Setup:</strong> Get a free Resend account at resend.com → create an API key →
          verify your sender domain → set RESEND_API_KEY and EMAIL_FROM (e.g. "Crime Wire &lt;noreply@lacrimewire.online&gt;").
        </p>
      </div>
    );
  };

  return (
    <div>
      <StatusBanner />

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4 border-b border-gray-200 overflow-x-auto">
        {([
          { id: "digital" as TabId, label: "Digital Readers", count: subscribers.length },
          { id: "press_club" as TabId, label: "Press Club", count: pressClub.length },
          { id: "dispatch" as TabId, label: "Dispatch", count: null },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
              activeTab === t.id ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}{t.count !== null ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      {/* ── Digital + Press Club filter bar ──── */}
      {activeTab !== "dispatch" && (
        <div className="flex flex-wrap gap-3 mb-4 items-center">
          <input
            className={inputCls + " w-56"}
            placeholder="Search email or name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {activeTab === "digital" && (
            <select className={selectCls + " w-44"} value={filterEdition} onChange={(e) => setFilterEdition(e.target.value)}>
              <option value="">All editions</option>
              <option value="digital">Digital</option>
              <option value="mailed">Mailed (Waitlist)</option>
              <option value="both">Both</option>
            </select>
          )}
          {activeTab === "press_club" && (
            <select className={selectCls + " w-44"} value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
              <option value="">All tiers</option>
              <option value="press_club">Press Club</option>
              <option value="founding">Founding Supporter</option>
              <option value="print_waitlist">Print Waitlist</option>
            </select>
          )}
          <Btn
            variant="secondary"
            size="xs"
            onClick={() => {
              if (activeTab === "digital") {
                const csv = [
                  "id,email,name,zip,editionType,consent,createdAt",
                  ...filteredSubs.map((s) =>
                    `${s.id},"${s.email}","${s.name ?? ""}","${s.zip ?? ""}","${s.editionType}",${s.consent},"${s.createdAt}"`
                  ),
                ].join("\n");
                downloadCsv(csv, "digital-readers.csv");
              } else {
                const csv = [
                  "id,email,name,tier,city,zip,status,adminNote,createdAt",
                  ...filteredPc.map((m) =>
                    `${m.id},"${m.email}","${m.name ?? ""}","${m.tier}","${m.city ?? ""}","${m.zip ?? ""}","${m.status}","${m.adminNote ?? ""}","${m.createdAt}"`
                  ),
                ].join("\n");
                downloadCsv(csv, "press-club.csv");
              }
            }}
          >
            Export CSV
          </Btn>
          <span className="text-xs text-gray-400 self-center">
            {activeTab === "digital" ? filteredSubs.length : filteredPc.length} results
          </span>
        </div>
      )}

      {loading && activeTab !== "dispatch" ? <Spinner /> : (
        <>
          {/* ── Digital Readers ──── */}
          {activeTab === "digital" && (
            filteredSubs.length === 0 ? (
              <EmptyState message="No digital subscribers match this filter" />
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200">
                {filteredSubs.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.email}</span>
                        {s.name && <span className="text-xs text-gray-500">{s.name}</span>}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {EDITION_LABELS[s.editionType] ?? s.editionType}
                        </span>
                        <Badge status={s.status} />
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400">Signed up {fmtDate(s.createdAt)}</span>
                        {s.zip && <span className="text-[10px] text-gray-400">ZIP {s.zip}</span>}
                        {s.consent && <span className="text-[10px] text-green-600">Consent recorded</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── Press Club ──── */}
          {activeTab === "press_club" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Press Club & Founding Supporters ({pressClubMembers.length})
                </h3>
                {pressClubMembers.length === 0 ? (
                  <EmptyState message="No members match this filter" />
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200">
                    {pressClubMembers.map((m) => (
                      <div key={m.id} className="px-4 py-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">{m.email}</span>
                              {m.name && <span className="text-xs text-gray-500">{m.name}</span>}
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {m.tier === "founding" ? "Founding" : "Press Club"}
                              </span>
                              <Badge status={m.status} />
                            </div>
                            {m.city && <p className="text-[10px] text-gray-400">{m.city}{m.zip ? `, ${m.zip}` : ""}</p>}
                            <p className="text-[10px] text-gray-400 mt-0.5">Joined {fmtDate(m.createdAt)}</p>
                            {m.adminNote && editingNote !== m.id && (
                              <p className="text-xs text-gray-500 italic mt-1">Note: {m.adminNote}</p>
                            )}
                            {editingNote === m.id && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  className={inputCls + " flex-1 text-xs"}
                                  value={noteVal}
                                  onChange={(e) => setNoteVal(e.target.value)}
                                  placeholder="Add internal note…"
                                />
                                <Btn size="xs" onClick={() => updatePressClub(m.id, { adminNote: noteVal })} disabled={saving}>Save</Btn>
                                <Btn size="xs" variant="secondary" onClick={() => setEditingNote(null)}>Cancel</Btn>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Btn size="xs" variant="ghost" onClick={() => { setEditingNote(m.id); setNoteVal(m.adminNote ?? ""); }}>Note</Btn>
                            {m.status === "active" && (
                              <Btn size="xs" variant="secondary" onClick={() => updatePressClub(m.id, { status: "inactive" })} disabled={saving}>
                                Deactivate
                              </Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Print Edition Waitlist ({printWaitlist.length})
                </h3>
                {printWaitlist.length === 0 ? (
                  <EmptyState message="Print waitlist is empty" />
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200">
                    {printWaitlist.map((m, idx) => (
                      <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                        <span className="text-lg font-serif font-bold text-gray-300 w-6 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{m.email}</span>
                            {m.name && <span className="text-xs text-gray-500">{m.name}</span>}
                            <Badge status={m.status} />
                          </div>
                          {(m.city || m.zip) && <p className="text-[10px] text-gray-400">{[m.city, m.zip].filter(Boolean).join(" · ")}</p>}
                          {m.mailingAddress && <p className="text-[10px] text-gray-400">{m.mailingAddress}</p>}
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtDate(m.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Dispatch ──── */}
          {activeTab === "dispatch" && (
            <div className="space-y-8 max-w-xl">

              {/* Send Issue */}
              <section className="border-2 border-black p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest border-b border-black pb-3 mb-4">
                  Send Thursday Drop
                  {recipientInfo && (
                    <span className="text-gray-400 font-normal normal-case tracking-normal ml-2">
                      — {recipientInfo.eligible} digital-eligible subscriber{recipientInfo.eligible !== 1 ? "s" : ""}
                    </span>
                  )}
                </h3>

                {issueResult && (
                  <div className={`mb-4 p-3 text-xs ${issueResult.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
                    <p className="font-bold uppercase tracking-wider">{issueResult.msg}</p>
                    {issueResult.ok && (
                      <p className="mt-1 text-[10px]">
                        {issueResult.sent ?? 0} delivered · {issueResult.failed ?? 0} failed
                        {(issueResult.skipped ?? 0) > 0 && ` · ${issueResult.skipped} mailed-only skipped`}
                        {(issueResult.failed ?? 0) > 0 && " — check delivery log for addresses"}
                      </p>
                    )}
                    {issueResult.duplicate && (
                      <p className="mt-1 text-[10px]">Each issue can only be dispatched once. Check the delivery log or select a different issue.</p>
                    )}
                  </div>
                )}

                <div className="space-y-4">

                  {/* Issue selector */}
                  <Field label="Edition" required hint="Select the published issue. Subject and preview will be auto-populated.">
                    <select
                      className={selectCls}
                      value={selectedIssueId ?? ""}
                      onChange={(e) => {
                        setSelectedIssueId(e.target.value ? Number(e.target.value) : null);
                        setIssuePreview(""); // let auto-fill re-run
                        setIssueSubject("");
                      }}
                    >
                      <option value="">— select an edition —</option>
                      {issues.map((i) => {
                        const dateStr = i.publishDate
                          ? new Date(i.publishDate + (i.publishDate.length === 10 ? "T12:00:00" : ""))
                              .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : "";
                        return (
                          <option key={i.id} value={i.id}>
                            {i.status === "published" ? "★ " : ""}Vol. {i.volume} No. {i.number} — {i.title}{dateStr ? ` (${dateStr})` : ""}
                            {!i.pdfUrl ? " ⚠ no PDF" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </Field>

                  {/* Recipient breakdown */}
                  {recipientInfo && (
                    <div className="bg-gray-50 border border-gray-200 p-3 text-xs">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Recipient Breakdown</p>
                      <div className="flex gap-6">
                        <span><strong>{recipientInfo.eligible}</strong> digital-eligible</span>
                        <span className="text-gray-400">{recipientInfo.skipped} mailed-only (will skip)</span>
                        <span className="text-gray-400">{recipientInfo.total} active total</span>
                      </div>
                    </div>
                  )}

                  <Field label="Subject line" required hint="Appears in the reader's inbox.">
                    <input
                      className={inputCls}
                      value={issueSubject}
                      onChange={(e) => setIssueSubject(e.target.value)}
                      placeholder="Los Angeles Crime Wire — Thursday, Aug 14, 2026"
                    />
                  </Field>

                  <Field label="Preview text" hint="Shown below the subject in most email clients. Keep under 90 characters.">
                    <input
                      className={inputCls}
                      value={issuePreview}
                      onChange={(e) => setIssuePreview(e.target.value)}
                      placeholder="This week: the Biltmore case, records update, and Shell Shocker."
                    />
                  </Field>

                  <Field label="Message body" hint="Optional note to subscribers shown above the Read button.">
                    <textarea
                      className={textareaCls}
                      rows={3}
                      value={issueMessage}
                      onChange={(e) => setIssueMessage(e.target.value)}
                      placeholder="This week's edition covers…"
                    />
                  </Field>

                  {/* Email preview toggle */}
                  {selectedIssueId && (
                    <div>
                      <button
                        type="button"
                        className="text-xs font-bold uppercase tracking-widest underline text-gray-600 hover:text-black"
                        onClick={() => setShowPreview((p) => !p)}
                      >
                        {showPreview ? "Hide preview ▲" : "Preview email ▼"}
                      </button>
                      {showPreview && (() => {
                        const sel = issues.find((i) => i.id === selectedIssueId);
                        const dateStr = sel?.publishDate
                          ? new Date(sel.publishDate + (sel.publishDate.length === 10 ? "T12:00:00" : ""))
                              .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
                          : "";
                        const readUrl = sel?.readCtaUrl || sel?.pdfUrl || "https://lacrimewire.online/crime-wire";
                        const dlUrl = sel?.downloadCtaUrl || (sel?.pdfUrl ? sel.pdfUrl + "?download=1" : null);
                        return (
                          <div className="mt-3 border border-gray-300 bg-white p-4 text-xs space-y-2">
                            <p className="text-gray-400">
                              <span className="font-bold">To:</span> {recipientInfo?.eligible ?? "—"} digital subscribers
                            </p>
                            <p className="text-gray-400">
                              <span className="font-bold">Subject:</span> <span className="text-black">{issueSubject || "—"}</span>
                            </p>
                            {issuePreview && (
                              <p className="text-gray-400">
                                <span className="font-bold">Preview:</span> <span className="text-black">{issuePreview}</span>
                              </p>
                            )}
                            <hr className="border-gray-200" />
                            {sel && (
                              <div className="border-b-2 border-black pb-2 mb-2">
                                <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                                  Vol. {sel.volume} · {sel.number}
                                </p>
                                <p className="font-bold text-sm uppercase">{sel.title}</p>
                                {dateStr && <p className="text-gray-500">{dateStr}</p>}
                              </div>
                            )}
                            {issuePreview && <p className="italic text-gray-600">{issuePreview}</p>}
                            {issueMessage && <p>{issueMessage}</p>}
                            {!issueMessage && !issuePreview && (
                              <p className="text-gray-500">This week's Los Angeles Crime Wire is now available. Thank you for reading.</p>
                            )}
                            <p>
                              <span className="bg-black text-white px-3 py-1 font-bold">
                                Read This Week's Edition →
                              </span>
                              <span className="text-gray-400 ml-2 text-[10px]">{readUrl}</span>
                            </p>
                            {dlUrl && (
                              <p className="font-bold underline text-gray-700">↓ Download PDF</p>
                            )}
                            <hr className="border-gray-200" />
                            <p className="text-gray-400 text-[10px]">
                              lacrimewire.online · Unsubscribe · You're receiving this because you signed up for the Thursday Drop.
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={issueConfirm}
                      onChange={(e) => setIssueConfirm(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-gray-700">
                      I confirm this is ready to send to <strong>{recipientInfo?.eligible ?? "all digital"}</strong> subscribers.
                      Each issue can only be dispatched once.
                    </span>
                  </label>

                  <Btn
                    onClick={sendIssue}
                    disabled={issueSending || !issueSubject.trim() || !issueConfirm || !emailStatus?.configured || !selectedIssueId}
                  >
                    {issueSending
                      ? `Sending to ${recipientInfo?.eligible ?? "…"} subscribers…`
                      : `Dispatch to ${recipientInfo?.eligible ?? "…"} digital subscribers`}
                  </Btn>

                  {!emailStatus?.configured && (
                    <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">
                      Email not configured — complete setup above before dispatching.
                    </p>
                  )}
                </div>
              </section>

              {/* Test Email */}
              <section className="border border-gray-200 p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest border-b border-gray-200 pb-3 mb-4">
                  Send Test Email
                </h3>
                <div className="space-y-3">
                  <Field label="Recipient address">
                    <input
                      className={inputCls}
                      type="email"
                      value={testTo}
                      onChange={(e) => setTestTo(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Btn
                    variant="secondary"
                    onClick={sendTest}
                    disabled={testSending || !testTo.trim() || !emailStatus?.configured}
                  >
                    {testSending ? "Sending…" : "Send Test"}
                  </Btn>
                  {testResult && (
                    <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${testResult.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>
                      {testResult}
                    </p>
                  )}
                </div>
              </section>

              {/* Delivery Log */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest">Delivery Log</h3>
                  <Btn size="xs" variant="ghost" onClick={loadEmailStatus}>Refresh</Btn>
                </div>

                {emailLoading ? <Spinner /> : (
                  !emailStatus?.recentLog?.length ? (
                    <EmptyState message="No delivery history yet" />
                  ) : (
                    <div className="divide-y divide-gray-100 border border-gray-200">
                      {emailStatus.recentLog.map((entry) => (
                        <div key={entry.id} className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${
                                  entry.type === "campaign" ? "bg-black text-white" :
                                  entry.type === "welcome"  ? "bg-gray-800 text-white" :
                                  entry.type === "test"     ? "bg-gray-200 text-gray-700" :
                                                               "bg-gray-100 text-gray-600"
                                }`}>{entry.type}</span>
                                {entry.subject && <span className="text-xs font-medium truncate max-w-[240px]">{entry.subject}</span>}
                                {entry.to && !entry.subject && <span className="text-xs text-gray-500 truncate">{entry.to}</span>}
                                {entry.category && <span className="text-[9px] text-gray-400 uppercase">{entry.category}</span>}
                              </div>
                              {entry.type === "campaign" && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {entry.sent ?? 0} sent · {entry.failed ?? 0} failed · {entry.total ?? 0} eligible
                                  {(entry.skipped ?? 0) > 0 && ` · ${entry.skipped} mailed skipped`}
                                </p>
                              )}
                              {entry.error && (
                                <p className="text-[10px] text-red-600 mt-0.5 truncate">{entry.error}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {entry.ok === false ? (
                                <span className="text-[9px] font-bold text-red-600 uppercase">Failed</span>
                              ) : entry.ok === true ? (
                                <span className="text-[9px] font-bold text-green-600 uppercase">OK</span>
                              ) : null}
                              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {new Date(entry.timestamp).toLocaleString("en-US", {
                                  month: "short", day: "numeric",
                                  hour: "numeric", minute: "2-digit", hour12: true
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

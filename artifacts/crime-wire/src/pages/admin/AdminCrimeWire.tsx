import { useState, useEffect, useRef } from "react";
import { api, apiForm, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, textareaCls, fmtDate } from "./shared";

interface Props { token: string }

interface Issue {
  id: number; volume: number; number: string; title: string;
  tagline: string | null; headline: string | null; description: string | null;
  pdfUrl: string | null; pageCount: number; accessLevel: string;
  status: string; publishDate: string | null; createdAt: string;
}

interface QueuedReport {
  id: number; headline: string; status: string; type: string;
  publishedAt: string | null; placement: string;
}

const EMPTY_ISSUE = {
  volume: 1, number: "", title: "", tagline: "", headline: "",
  description: "", accessLevel: "public", status: "draft",
  publishDate: "", pageCount: 12,
};

export default function AdminCrimeWire({ token }: Props) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [queue, setQueue] = useState<QueuedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Issue> | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api("/issues/all", token).then((r) => r.ok ? r.json() : []),
      api("/reports/all/list", token).then((r) => r.ok ? r.json() : []),
    ]).then(([iss, reps]) => {
      setIssues(iss);
      setQueue(reps.filter((r: QueuedReport) => {
        try { return JSON.parse(r.placement || "{}").crime_wire_queue; } catch { return false; }
      }));
    }).finally(() => setLoading(false));
  };

  useEffect(loadAll, [token]);

  async function saveIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true); setError(""); setSuccess("");

    const fd = new FormData();
    const numericFields = ["volume", "pageCount"] as const;
    const textFields = ["number", "title", "tagline", "headline", "description", "accessLevel", "status", "publishDate"] as const;

    numericFields.forEach((k) => { if (editing[k] !== undefined) fd.append(k, String(editing[k])); });
    textFields.forEach((k) => { if (editing[k] !== undefined) fd.append(k, String(editing[k] ?? "")); });

    const file = fileRef.current?.files?.[0];
    if (file) fd.append("pdf", file);

    const isNew = !editing.id;
    const res = await apiForm(
      isNew ? "/issues" : `/issues/${editing.id}`,
      token, fd, isNew ? "POST" : "PATCH"
    );

    if (res.ok) {
      setSuccess(isNew ? "Issue created." : "Issue updated.");
      setEditing(null);
      if (fileRef.current) fileRef.current.value = "";
      loadAll();
    } else {
      const d = await res.json().catch(() => ({ error: `Failed (${res.status})` }));
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  async function publishIssue(id: number) {
    setSaving(true);
    const res = await api(`/issues/${id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ status: "published", publishDate: new Date().toISOString() }),
    });
    if (res.ok) { setSuccess("Issue published. Previous issue archived."); loadAll(); }
    else { const d = await res.json(); setError(d.error ?? "Failed"); }
    setSaving(false);
  }

  async function archiveIssue(id: number) {
    setSaving(true);
    await api(`/issues/${id}`, token, { method: "PATCH", body: JSON.stringify({ status: "archived" }) });
    setSuccess("Issue archived."); loadAll(); setSaving(false);
  }

  function set(key: string, value: unknown) {
    setEditing((e) => e ? { ...e, [key]: value } : e);
  }

  if (loading) return <Spinner />;

  // Edit form
  if (editing !== null) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {editing.id ? "Edit Issue" : "Upload New Issue"}
          </h2>
          <Btn variant="ghost" onClick={() => setEditing(null)}>← Back</Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}

        <form onSubmit={saveIssue} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Field label="Volume">
              <input type="number" className={inputCls} value={editing.volume ?? 1} min={1} onChange={(e) => set("volume", parseInt(e.target.value))} />
            </Field>
            <Field label="Issue Number" required hint="Admin-controlled. No auto-increment.">
              <input className={inputCls} placeholder="No. 3" value={editing.number ?? ""} onChange={(e) => set("number", e.target.value)} />
            </Field>
            <Field label="Page Count">
              <input type="number" className={inputCls} value={editing.pageCount ?? 12} min={1} onChange={(e) => set("pageCount", parseInt(e.target.value))} />
            </Field>
          </div>
          <Field label="Title / Edition Name" required>
            <input className={inputCls} placeholder="Weekly · August 14, 2026" value={editing.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Headline">
            <input className={inputCls} value={editing.headline ?? ""} onChange={(e) => set("headline", e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className={textareaCls} rows={2} value={editing.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Access Level">
              <select className={selectCls} value={editing.accessLevel ?? "public"} onChange={(e) => set("accessLevel", e.target.value)}>
                <option value="public">Public</option>
                <option value="press_club">Press Club</option>
                <option value="preview_only">Preview Only</option>
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={editing.status ?? "draft"} onChange={(e) => set("status", e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published (archives previous)</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
          </div>
          <Field label="Publish Date">
            <input type="date" className={inputCls} value={editing.publishDate?.slice(0, 10) ?? ""} onChange={(e) => set("publishDate", e.target.value)} />
          </Field>
          <Field label="PDF File" hint={editing.id ? "Leave blank to keep existing PDF." : "Upload the finished edition PDF."}>
            <input ref={fileRef} type="file" accept="application/pdf" className="w-full text-sm py-1" />
          </Field>
          {editing.pdfUrl && (
            <p className="text-xs text-gray-500">
              Current PDF: <a href={editing.pdfUrl} target="_blank" rel="noopener noreferrer" className="underline">{editing.pdfUrl}</a>
            </p>
          )}

          <div className="border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Issue Number Note</p>
            <p className="text-xs text-gray-600">
              Only two editions have been produced (No. 1 and No. 2). Do not advance numbering without the editor's direction.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Btn type="submit" disabled={saving || !editing.number || !editing.title}>
              {saving ? "Saving…" : editing.id ? "Update Issue" : "Create Issue"}
            </Btn>
            <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Issues */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">Crime Wire Editions</h2>
          <Btn onClick={() => setEditing({ ...EMPTY_ISSUE })}>+ Upload Issue</Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
        {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

        {issues.length === 0 ? (
          <EmptyState message="No issues on file" />
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200">
            {issues.map((issue) => (
              <div key={issue.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      Vol. {issue.volume} · {issue.number}
                    </span>
                    <Badge status={issue.status} />
                    <span className="text-[10px] text-gray-400">{issue.pageCount} pages</span>
                    {issue.accessLevel !== "public" && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-orange-600">{issue.accessLevel}</span>
                    )}
                  </div>
                  <span className="font-bold text-sm">{issue.title}</span>
                  {issue.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{issue.description}</p>
                  )}
                  {issue.publishDate && (
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(issue.publishDate)}</p>
                  )}
                  {issue.pdfUrl && (
                    <a href={issue.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 underline">
                      {issue.pdfUrl}
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Btn size="xs" variant="secondary" onClick={() => setEditing(issue)}>Edit</Btn>
                  {issue.status === "draft" && (
                    <Btn size="xs" onClick={() => publishIssue(issue.id)} disabled={saving}>Publish</Btn>
                  )}
                  {issue.status === "published" && (
                    <Btn size="xs" variant="secondary" onClick={() => archiveIssue(issue.id)} disabled={saving}>Archive</Btn>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Crime Wire Queue */}
      <div>
        <div className="mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Weekly Planning Queue</h2>
          <p className="text-xs text-gray-400">
            Reports queued for Crime Wire consideration. Queuing adds to this planning list — it does not automatically insert content into the PDF.
          </p>
        </div>
        {queue.length === 0 ? (
          <EmptyState message="No reports queued for Crime Wire. Add reports via the Reports tab." />
        ) : (
          <div className="divide-y divide-gray-100 border border-gray-200">
            {queue.map((r) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3">
                <Badge status={r.status} />
                <span className="text-sm flex-1">{r.headline}</span>
                <span className="text-[10px] text-gray-400 uppercase tracking-widest">{r.type.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

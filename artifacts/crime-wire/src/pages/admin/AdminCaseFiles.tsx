import { useState, useEffect } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, textareaCls, fmtDate } from "./shared";

interface Props {}

interface CaseFile {
  id: number; identifier: string; title: string; status: string;
  summary: string | null; chronology: string | null;
  investigativeNotes: string | null; internalNotes: string | null;
  isPublic: boolean; createdAt: string; updatedAt: string;
  linkedReports?: Array<{ id: number; headline: string; status: string; type: string; publishedAt: string | null }>;
}

const EMPTY: Partial<CaseFile> = {
  identifier: "", title: "", status: "open", summary: "", chronology: "",
  investigativeNotes: "", internalNotes: "", isPublic: false,
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open", cold: "Cold", closed: "Closed", referred: "Referred",
  active_investigation: "Active Investigation",
};

export default function AdminCaseFiles() {
  const [items, setItems] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CaseFile> | null>(null);
  const [detail, setDetail] = useState<CaseFile | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api("/case-files/all").then(async (r) => {
      if (r.ok) setItems(await r.json());
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  async function loadDetail(id: number) {
    const r = await api(`/case-files/${id}`);
    if (r.ok) setDetail(await r.json());
  }

  async function save() {
    if (!editing) return;
    setSaving(true); setError(""); setSuccess("");
    const isNew = !editing.id;
    const res = await api(
      isNew ? "/case-files" : `/case-files/${editing.id}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(editing) }
    );
    if (res.ok) {
      setSuccess(isNew ? "Case file created." : "Case file updated.");
      setEditing(null);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  function set(key: keyof CaseFile, value: unknown) {
    setEditing((e) => e ? { ...e, [key]: value } : e);
  }

  if (loading) return <Spinner />;

  // Detail view
  if (detail) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Case File · {detail.identifier}
          </h2>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => { setEditing(detail); setDetail(null); }}>Edit</Btn>
            <Btn variant="ghost" onClick={() => setDetail(null)}>← Back</Btn>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-serif font-bold">{detail.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge status={detail.status} />
              <span className="text-[10px] text-gray-400">{detail.isPublic ? "Public" : "Internal"}</span>
              <span className="text-[10px] text-gray-400">Updated {fmtDate(detail.updatedAt)}</span>
            </div>
          </div>

          {detail.summary && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Summary</p>
              <p className="text-sm whitespace-pre-wrap">{detail.summary}</p>
            </div>
          )}

          {detail.chronology && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Chronology</p>
              <p className="text-sm whitespace-pre-wrap font-mono">{detail.chronology}</p>
            </div>
          )}

          {detail.investigativeNotes && (
            <div className="bg-yellow-50 border border-yellow-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-700 mb-1">Investigative Notes — Internal</p>
              <p className="text-sm whitespace-pre-wrap">{detail.investigativeNotes}</p>
            </div>
          )}

          {detail.internalNotes && (
            <div className="bg-gray-50 border border-gray-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Internal Notes</p>
              <p className="text-sm whitespace-pre-wrap">{detail.internalNotes}</p>
            </div>
          )}

          {/* Linked reports */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Linked Reports</p>
            {!detail.linkedReports?.length ? (
              <p className="text-xs text-gray-400">No reports linked to this case file yet.</p>
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200">
                {detail.linkedReports.map((r) => (
                  <div key={r.id} className="px-3 py-2 flex items-center gap-3">
                    <Badge status={r.status} />
                    <span className="text-xs flex-1">{r.headline}</span>
                    <span className="text-[10px] text-gray-400">{r.publishedAt ? fmtDate(r.publishedAt) : "Unpublished"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Edit form
  if (editing !== null) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {editing.id ? `Edit · ${editing.identifier}` : "New Case File"}
          </h2>
          <Btn variant="ghost" onClick={() => setEditing(null)}>← Back</Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Identifier" required hint="Unique case ID, e.g. BDH-002, LAPD-2026-001">
              <input className={inputCls} value={editing.identifier ?? ""} onChange={(e) => set("identifier", e.target.value)} />
            </Field>
            <Field label="Status">
              <select className={selectCls} value={editing.status ?? "open"} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Title" required>
            <input className={inputCls} value={editing.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Summary" hint="Public-facing overview (shown when case file is public)">
            <textarea className={textareaCls} rows={4} value={editing.summary ?? ""} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <Field label="Chronology" hint="Timeline of events (public when case file is public)">
            <textarea className={textareaCls} rows={5} value={editing.chronology ?? ""} onChange={(e) => set("chronology", e.target.value)} />
          </Field>
          <div className="border border-yellow-200 bg-yellow-50 p-3">
            <Field label="Investigative Notes — Internal Only" hint="Never shown publicly regardless of case file visibility">
              <textarea className={textareaCls} rows={4} value={editing.investigativeNotes ?? ""} onChange={(e) => set("investigativeNotes", e.target.value)} />
            </Field>
          </div>
          <Field label="Internal Notes">
            <textarea className={textareaCls} rows={2} value={editing.internalNotes ?? ""} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!editing.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Make Public</span>
            </label>
            <span className="text-[10px] text-gray-400">Summary and chronology will be visible on the public site</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <Btn type="submit" onClick={save} disabled={saving || !editing.identifier || !editing.title}>
            {saving ? "Saving…" : editing.id ? "Update" : "Create Case File"}
          </Btn>
          <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Case Files ({items.length})
        </h2>
        <Btn onClick={() => setEditing({ ...EMPTY })}>+ Open Case File</Btn>
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      {items.length === 0 ? (
        <EmptyState message="No case files open" />
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {items.map((c) => (
            <div key={c.id} className="px-4 py-3 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{c.identifier}</span>
                  <Badge status={c.status} />
                  {c.isPublic && (
                    <span className="text-[10px] text-gray-400">Public</span>
                  )}
                </div>
                <span className="font-bold text-sm">{c.title}</span>
                {c.summary && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{c.summary}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">Updated {fmtDate(c.updatedAt)}</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Btn variant="ghost" size="xs" onClick={() => loadDetail(c.id)}>View</Btn>
                <Btn variant="secondary" size="xs" onClick={() => setEditing(c)}>Edit</Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

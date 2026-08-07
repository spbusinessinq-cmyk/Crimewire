import { useState, useEffect } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, textareaCls, fmtDate, fmtDateTime } from "./shared";

interface Props { token: string }

interface Correction {
  id: number;
  issueLabel: string | null;
  section: string | null;
  originalText: string;
  correctedText: string;
  adminNote: string | null;
  publishedAt: string | null;
  createdAt: string;
}

const EMPTY: Partial<Correction> = {
  issueLabel: "", section: "", originalText: "", correctedText: "", adminNote: "",
};

export default function AdminCorrections({ token }: Props) {
  const [items, setItems] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Correction> | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api("/corrections/all", token).then(async (r) => {
      if (r.ok) setItems(await r.json());
    }).finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  async function save() {
    if (!editing) return;
    setSaving(true); setError(""); setSuccess("");
    const isNew = !editing.id;
    const res = await api(
      isNew ? "/corrections" : `/corrections/${editing.id}`,
      token,
      { method: isNew ? "POST" : "PATCH", body: JSON.stringify(editing) }
    );
    if (res.ok) {
      setSuccess(isNew ? "Correction created." : "Correction updated.");
      setEditing(null);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  async function togglePublish(c: Correction) {
    setSaving(true);
    const res = await api(`/corrections/${c.id}`, token, {
      method: "PATCH",
      body: JSON.stringify({ publishedAt: c.publishedAt ? null : new Date().toISOString() }),
    });
    if (res.ok) {
      setSuccess(c.publishedAt ? "Correction unpublished." : "Correction published.");
      load();
    }
    setSaving(false);
  }

  function set(key: keyof Correction, value: unknown) {
    setEditing((e) => e ? { ...e, [key]: value } : e);
  }

  if (loading) return <Spinner />;

  if (editing !== null) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {editing.id ? "Edit Correction" : "New Correction"}
          </h2>
          <Btn variant="ghost" onClick={() => setEditing(null)}>← Back</Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Issue Label" hint="E.g. Vol. 1 · No. 2 or Report headline">
              <input className={inputCls} value={editing.issueLabel ?? ""} onChange={(e) => set("issueLabel", e.target.value)} />
            </Field>
            <Field label="Section / Column">
              <input className={inputCls} value={editing.section ?? ""} onChange={(e) => set("section", e.target.value)} />
            </Field>
          </div>
          <Field label="Original Text (as published)" required>
            <textarea className={textareaCls} rows={3} value={editing.originalText ?? ""} onChange={(e) => set("originalText", e.target.value)} />
          </Field>
          <Field label="Corrected Text" required>
            <textarea className={textareaCls} rows={3} value={editing.correctedText ?? ""} onChange={(e) => set("correctedText", e.target.value)} />
          </Field>
          <Field label="Editor Note (shown publicly)">
            <textarea className={textareaCls} rows={2} value={editing.adminNote ?? ""} onChange={(e) => set("adminNote", e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <Btn type="submit" onClick={save} disabled={saving || !editing.originalText || !editing.correctedText}>
            {saving ? "Saving…" : editing.id ? "Update" : "Create Correction"}
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
          Corrections ({items.length})
        </h2>
        <Btn onClick={() => setEditing({ ...EMPTY })}>+ New Correction</Btn>
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      {items.length === 0 ? (
        <EmptyState message="No corrections on record" />
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {items.map((c) => (
            <div key={c.id} className="px-4 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {c.issueLabel && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{c.issueLabel}</span>
                  )}
                  {c.section && (
                    <span className="text-[10px] text-gray-400">· {c.section}</span>
                  )}
                  <Badge status={c.publishedAt ? "published" : "draft"} />
                  {c.publishedAt && (
                    <span className="text-[10px] text-gray-400">Published {fmtDate(c.publishedAt)}</span>
                  )}
                </div>
                <p className="text-xs text-red-700 line-through mb-0.5 leading-snug">{c.originalText}</p>
                <p className="text-xs text-green-800 leading-snug">{c.correctedText}</p>
                {c.adminNote && (
                  <p className="text-xs text-gray-500 mt-1 italic">{c.adminNote}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Added {fmtDateTime(c.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <Btn variant="secondary" size="xs" onClick={() => setEditing(c)}>Edit</Btn>
                <Btn
                  size="xs"
                  variant={c.publishedAt ? "secondary" : "primary"}
                  onClick={() => togglePublish(c)}
                  disabled={saving}
                >
                  {c.publishedAt ? "Unpublish" : "Publish"}
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

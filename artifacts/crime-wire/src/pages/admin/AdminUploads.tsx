import { useState, useEffect, useRef } from "react";
import { api, apiForm, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, textareaCls, fmtDate, fmtDateTime } from "./shared";

interface Props { token: string }

interface Upload {
  id: number; filename: string; originalName: string; filePath: string;
  mimeType: string | null; fileSize: number | null; title: string | null;
  caption: string | null; source: string | null; credit: string | null;
  acquisitionDate: string | null; relatedReportId: number | null;
  relatedCaseId: number | null; visibility: string;
  approvedForPublication: boolean; internalNotes: string | null;
  createdAt: string;
}

const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,application/pdf,audio/mpeg,audio/mp4,audio/wav,video/mp4,video/webm";

export default function AdminUploads({ token }: Props) {
  const [items, setItems] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Upload | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [form, setForm] = useState({
    title: "", caption: "", source: "", credit: "",
    visibility: "internal_only", internalNotes: "",
  });

  const load = () => {
    setLoading(true);
    api("/uploads", token).then(async (r) => {
      if (r.ok) setItems(await r.json());
    }).finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Please select a file."); return; }

    setUploading(true); setError(""); setSuccess("");

    const fd = new FormData();
    fd.append("file", file);
    if (form.title) fd.append("title", form.title);
    if (form.caption) fd.append("caption", form.caption);
    if (form.source) fd.append("source", form.source);
    if (form.credit) fd.append("credit", form.credit);
    fd.append("visibility", form.visibility);
    if (form.internalNotes) fd.append("internalNotes", form.internalNotes);

    const res = await apiForm("/uploads", token, fd, "POST");
    if (res.ok) {
      setSuccess("File uploaded. Visibility is INTERNAL ONLY until you explicitly approve it for publication.");
      setForm({ title: "", caption: "", source: "", credit: "", visibility: "internal_only", internalNotes: "" });
      if (fileRef.current) fileRef.current.value = "";
      load();
    } else {
      const d = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      setError(d.error ?? "Upload failed");
    }
    setUploading(false);
  }

  async function patchUpload(id: number, updates: Partial<Upload>) {
    setSaving(true);
    const res = await api(`/uploads/${id}`, token, { method: "PATCH", body: JSON.stringify(updates) });
    if (res.ok) {
      setSuccess("Record updated.");
      setEditing(null);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Update failed");
    }
    setSaving(false);
  }

  async function deleteUpload(id: number) {
    if (!confirm("Remove this upload record? The file on disk is not deleted.")) return;
    setSaving(true);
    await api(`/uploads/${id}`, token, { method: "DELETE" });
    load();
    setSaving(false);
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function mimeIcon(mime: string | null) {
    if (!mime) return "📎";
    if (mime.startsWith("image/")) return "🖼";
    if (mime === "application/pdf") return "📄";
    if (mime.startsWith("audio/")) return "🎙";
    if (mime.startsWith("video/")) return "🎥";
    return "📎";
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Records & Media Uploads</h2>
        <p className="text-xs text-gray-400">
          Uploaded files default to <strong>Internal Only</strong>. You must explicitly approve an item for publication — it will never become public automatically.
        </p>
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      {/* Upload form */}
      <form onSubmit={handleUpload} className="border border-gray-200 p-4 mb-6 space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Upload New File</h3>
        <Field label="File" required hint="Images, PDFs, audio, video. Max 100 MB. Common scans and records welcome.">
          <input ref={fileRef} type="file" accept={ACCEPTED} className="w-full text-sm py-1" required />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Title">
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Credit / Photographer">
            <input className={inputCls} value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} />
          </Field>
          <Field label="Source">
            <input className={inputCls} placeholder="Agency, archive, photographer, etc." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </Field>
          <Field label="Visibility" hint="Cannot be set to public here — use Approve for Publication below">
            <select className={selectCls} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
              <option value="internal_only">Internal Only (default)</option>
              <option value="redacted_public">Redacted Public Version</option>
            </select>
          </Field>
        </div>
        <Field label="Caption">
          <textarea className={textareaCls} rows={2} value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
        </Field>
        <Field label="Internal Notes">
          <input className={inputCls} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
        </Field>
        <Btn type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload File"}
        </Btn>
      </form>

      {/* File list */}
      {loading ? <Spinner /> : items.length === 0 ? (
        <EmptyState message="No files uploaded yet" />
      ) : (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
            All Files ({items.length})
          </h3>
          <div className="divide-y divide-gray-100 border border-gray-200">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-3">
                {editing?.id === item.id ? (
                  // Inline edit
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Title">
                        <input className={inputCls} value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                      </Field>
                      <Field label="Credit">
                        <input className={inputCls} value={editing.credit ?? ""} onChange={(e) => setEditing({ ...editing, credit: e.target.value })} />
                      </Field>
                      <Field label="Source">
                        <input className={inputCls} value={editing.source ?? ""} onChange={(e) => setEditing({ ...editing, source: e.target.value })} />
                      </Field>
                      <Field label="Visibility">
                        <select className={selectCls} value={editing.visibility} onChange={(e) => setEditing({ ...editing, visibility: e.target.value })}>
                          <option value="internal_only">Internal Only</option>
                          <option value="public">Public</option>
                          <option value="redacted_public">Redacted Public</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Caption">
                      <textarea className={textareaCls} rows={2} value={editing.caption ?? ""} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} />
                    </Field>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editing.approvedForPublication} onChange={(e) => setEditing({ ...editing, approvedForPublication: e.target.checked })} className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-widest text-green-700">Approved for Publication</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <Btn size="xs" onClick={() => patchUpload(item.id, {
                        title: editing.title, caption: editing.caption, source: editing.source,
                        credit: editing.credit, visibility: editing.visibility,
                        approvedForPublication: editing.approvedForPublication,
                      })} disabled={saving}>Save</Btn>
                      <Btn size="xs" variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-xl leading-none mt-0.5">{mimeIcon(item.mimeType)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{item.title || item.originalName}</span>
                        <Badge status={item.visibility === "internal_only" ? "draft" : item.visibility === "public" ? "published" : "needs_review"} />
                        {item.approvedForPublication && (
                          <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">✓ Approved</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {item.mimeType ?? "—"} · {formatSize(item.fileSize)} · {fmtDateTime(item.createdAt)}
                      </p>
                      {item.credit && <p className="text-[10px] text-gray-500">Credit: {item.credit}</p>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Btn size="xs" variant="secondary" onClick={() => setEditing(item)}>Edit</Btn>
                      <Btn size="xs" variant="danger" onClick={() => deleteUpload(item.id)}>Remove</Btn>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            Note: Files are stored on local disk and will not persist across redeploys. Integrate Replit Object Storage for persistence.
          </p>
        </div>
      )}
    </div>
  );
}

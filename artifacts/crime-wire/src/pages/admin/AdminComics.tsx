import { useState, useEffect, useRef } from "react";
import { api, apiForm, BASE, STATUS_COLORS, inputCls, selectCls, textareaCls, labelCls, Spinner } from "./shared";

interface Comic {
  id: number;
  series: string;
  episode: number | null;
  title: string | null;
  artworkUrl: string | null;
  caption: string | null;
  transcript: string | null;
  publishDate: string | null;
  status: string;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

const SERIES_LABELS: Record<string, string> = {
  "ink-and-alibi": "Ink & Alibi",
  "morning-joe": "Morning Joe",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const EMPTY_FORM = {
  series: "ink-and-alibi",
  episode: "",
  title: "",
  caption: "",
  transcript: "",
  publishDate: "",
  status: "draft",
  sortOrder: "",
  artworkUrl: "",
};

type FormState = typeof EMPTY_FORM;

export default function AdminComics() {
  const [strips, setStrips] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [editing, setEditing] = useState<Comic | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api("/admin/comics");
      if (res.ok) setStrips(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setArtworkFile(null);
    setArtworkPreview(null);
    setError("");
    setSuccessMsg("");
    setCreating(true);
  }

  function openEdit(strip: Comic) {
    setCreating(false);
    setForm({
      series: strip.series,
      episode: strip.episode != null ? String(strip.episode) : "",
      title: strip.title ?? "",
      caption: strip.caption ?? "",
      transcript: strip.transcript ?? "",
      publishDate: strip.publishDate ? strip.publishDate.slice(0, 10) : "",
      status: strip.status,
      sortOrder: strip.sortOrder != null ? String(strip.sortOrder) : "",
      artworkUrl: strip.artworkUrl ?? "",
    });
    setArtworkFile(null);
    setArtworkPreview(null);
    setError("");
    setSuccessMsg("");
    setEditing(strip);
  }

  function cancel() {
    setEditing(null);
    setCreating(false);
    setArtworkFile(null);
    setArtworkPreview(null);
    setError("");
    setSuccessMsg("");
  }

  function handleArtworkChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setArtworkFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setArtworkPreview(url);
    } else {
      setArtworkPreview(null);
    }
  }

  async function save(overrideStatus?: string) {
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const fd = new FormData();
      fd.append("series", form.series);
      if (form.episode) fd.append("episode", form.episode);
      if (form.title) fd.append("title", form.title);
      if (form.caption) fd.append("caption", form.caption);
      if (form.transcript) fd.append("transcript", form.transcript);
      if (form.publishDate) fd.append("publishDate", form.publishDate);
      fd.append("status", overrideStatus ?? form.status);
      if (form.sortOrder) fd.append("sortOrder", form.sortOrder);
      if (artworkFile) {
        fd.append("artwork", artworkFile);
      } else if (!artworkFile && form.artworkUrl !== undefined) {
        fd.append("artworkUrl", form.artworkUrl);
      }

      let res: Response;
      if (editing) {
        res = await apiForm(`/admin/comics/${editing.id}`, fd, "PATCH");
      } else {
        res = await apiForm("/admin/comics", fd, "POST");
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Save failed");
        return;
      }

      setSuccessMsg(overrideStatus === "published" ? "Published." : "Saved.");
      await load();
      if (creating) {
        setCreating(false);
        setEditing(null);
      } else if (editing) {
        const updated = await res.json().catch(() => null);
        if (updated) setEditing(updated);
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(strip: Comic, status: string) {
    try {
      const fd = new FormData();
      fd.append("status", status);
      const res = await apiForm(`/admin/comics/${strip.id}`, fd, "PATCH");
      if (res.ok) { await load(); }
    } catch { /* ignore */ }
  }

  async function deleteStrip(id: number) {
    if (!confirm("Delete this strip permanently? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await api(`/admin/comics/${id}`, { method: "DELETE" });
      await load();
      if (editing?.id === id) cancel();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  const filtered = strips.filter((s) => {
    if (seriesFilter !== "all" && s.series !== seriesFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const isOpen = creating || !!editing;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">

      {/* ── Toolbar ────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={seriesFilter}
            onChange={(e) => setSeriesFilter(e.target.value)}
            className="border border-gray-300 text-xs px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="all">All Series</option>
            <option value="ink-and-alibi">Ink & Alibi</option>
            <option value="morning-joe">Morning Joe</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 text-xs px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-black"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            {filtered.length} strip{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
        {!isOpen && (
          <button
            onClick={openCreate}
            className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-4 py-2 hover:bg-gray-800 transition-colors"
          >
            + New Strip
          </button>
        )}
      </div>

      {/* ── Create / Edit form ────────────────────── */}
      {isOpen && (
        <div className="border-2 border-black p-6 bg-white space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-widest">
              {creating ? "New Strip" : `Editing — ${SERIES_LABELS[editing!.series] ?? editing!.series} #${editing!.episode ?? "?"}`}
            </h2>
            <button
              onClick={cancel}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div className="border-2 border-red-500 text-red-700 p-3 text-xs font-bold uppercase tracking-wider">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="border-2 border-green-600 text-green-700 p-3 text-xs font-bold uppercase tracking-wider">
              {successMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Series */}
            <div>
              <label className={labelCls}>Series *</label>
              <select
                value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value })}
                className={selectCls}
              >
                <option value="ink-and-alibi">Ink & Alibi</option>
                <option value="morning-joe">Morning Joe</option>
              </select>
            </div>

            {/* Episode / Week number */}
            <div>
              <label className={labelCls}>Week / Episode Number</label>
              <input
                type="number"
                min={1}
                value={form.episode}
                onChange={(e) => setForm({ ...form, episode: e.target.value })}
                placeholder="e.g. 1"
                className={inputCls}
              />
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className={selectCls}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Strip Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. The Blotter"
              className={inputCls}
            />
          </div>

          {/* Publish date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Publication Date</label>
              <input
                type="date"
                value={form.publishDate}
                onChange={(e) => setForm({ ...form, publishDate: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Sort Order (optional)</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                placeholder="Lower = higher priority"
                className={inputCls}
              />
            </div>
          </div>

          {/* Artwork upload */}
          <div>
            <label className={labelCls}>Artwork</label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  Upload File (replaces existing)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleArtworkChange}
                  className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:border file:border-black file:bg-black file:text-white file:text-[10px] file:font-bold file:uppercase file:tracking-widest file:cursor-pointer hover:file:bg-gray-800"
                />
                {!artworkFile && (
                  <>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Or paste artwork URL
                    </label>
                    <input
                      type="url"
                      value={form.artworkUrl}
                      onChange={(e) => setForm({ ...form, artworkUrl: e.target.value })}
                      placeholder="https://… or /api/files/comics/…"
                      className={inputCls}
                    />
                  </>
                )}
              </div>
              {/* Current artwork preview */}
              {(artworkPreview || (!artworkFile && (form.artworkUrl || editing?.artworkUrl))) && (
                <div className="flex-shrink-0">
                  <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Preview
                  </label>
                  <img
                    src={artworkPreview ?? form.artworkUrl ?? editing?.artworkUrl ?? ""}
                    alt="Artwork preview"
                    className="w-32 h-32 object-contain border border-gray-300 bg-gray-50"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Caption */}
          <div>
            <label className={labelCls}>Caption</label>
            <input
              type="text"
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="Short caption shown below the strip"
              className={inputCls}
            />
          </div>

          {/* Transcript */}
          <div>
            <label className={labelCls}>Accessible Transcript / Alt Text *</label>
            <textarea
              value={form.transcript}
              onChange={(e) => setForm({ ...form, transcript: e.target.value })}
              rows={4}
              placeholder="Describe the strip's content in full — dialogue, actions, setting. Used as alt text and as an accessible transcript for screen readers."
              className={textareaCls}
            />
            <p className="text-[9px] text-gray-400 mt-1">
              Required for accessibility. Describe all dialogue and key visual content.
            </p>
          </div>

          {/* Save actions */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
            <button
              onClick={() => save("draft")}
              disabled={saving}
              className="px-5 py-2.5 border-2 border-black text-xs font-bold uppercase tracking-widest hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save as Draft"}
            </button>
            <button
              onClick={() => save("published")}
              disabled={saving}
              className="px-5 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Publishing…" : "Publish Strip"}
            </button>
            {editing && (
              <button
                onClick={() => save(form.status)}
                disabled={saving}
                className="px-5 py-2.5 border border-gray-300 text-xs font-bold uppercase tracking-widest text-gray-600 hover:border-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Strip list ────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-gray-300 py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            No strips on file
          </p>
          <p className="text-xs text-gray-400 font-serif">
            Click "+ New Strip" to create the first comic entry.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {filtered.map((strip) => {
            const isEditing = editing?.id === strip.id;
            return (
              <div
                key={strip.id}
                className={`flex items-start gap-4 px-4 py-4 transition-colors ${
                  isEditing ? "bg-gray-50" : "hover:bg-gray-50"
                }`}
              >
                {/* Artwork thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 border border-gray-200 bg-gray-50 overflow-hidden">
                  {strip.artworkUrl ? (
                    <img
                      src={`${BASE}${strip.artworkUrl.startsWith("/api") ? "" : ""}${strip.artworkUrl}`}
                      alt={strip.transcript ?? strip.title ?? ""}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest text-center px-1">
                        No Art
                      </span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                      {SERIES_LABELS[strip.series] ?? strip.series}
                    </span>
                    {strip.episode != null && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        · Week {strip.episode}
                      </span>
                    )}
                    <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${STATUS_COLORS[strip.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[strip.status] ?? strip.status}
                    </span>
                  </div>
                  <p className="font-bold text-sm uppercase truncate">
                    {strip.title || `${SERIES_LABELS[strip.series]} #${strip.episode ?? "?"}`}
                  </p>
                  {strip.publishDate && (
                    <p className="text-[9px] text-gray-400 mt-0.5">
                      {new Date(strip.publishDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {strip.caption && (
                    <p className="text-xs text-gray-500 truncate mt-0.5 italic font-serif">{strip.caption}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                  <button
                    onClick={() => isEditing ? cancel() : openEdit(strip)}
                    className="text-[9px] font-bold uppercase tracking-widest border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                  >
                    {isEditing ? "Close" : "Edit"}
                  </button>

                  {strip.status === "published" && (
                    <button
                      onClick={() => setStatus(strip, "archived")}
                      className="text-[9px] font-bold uppercase tracking-widest border border-gray-300 px-2 py-1 text-gray-500 hover:border-black hover:text-black transition-colors whitespace-nowrap"
                    >
                      Unpublish
                    </button>
                  )}
                  {strip.status === "draft" && (
                    <button
                      onClick={() => setStatus(strip, "published")}
                      className="text-[9px] font-bold uppercase tracking-widest border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors whitespace-nowrap"
                    >
                      Publish
                    </button>
                  )}
                  {strip.status === "archived" && (
                    <button
                      onClick={() => setStatus(strip, "draft")}
                      className="text-[9px] font-bold uppercase tracking-widest border border-gray-300 px-2 py-1 text-gray-500 hover:border-black hover:text-black transition-colors whitespace-nowrap"
                    >
                      Restore
                    </button>
                  )}

                  <button
                    onClick={() => deleteStrip(strip.id)}
                    disabled={deleting === strip.id}
                    className="text-[9px] font-bold uppercase tracking-widest border border-red-300 px-2 py-1 text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    {deleting === strip.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View on public site link */}
      {strips.some((s) => s.status === "published") && (
        <div className="pt-2 text-right">
          <a
            href="/crime-wire/the-funnies"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black underline"
          >
            View The Funnies on site ↗
          </a>
        </div>
      )}
    </div>
  );
}

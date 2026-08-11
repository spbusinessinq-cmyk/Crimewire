import { useState, useEffect, useRef } from "react";
import { api, apiForm, Spinner, ErrorMsg, SuccessMsg, Btn, Field, inputCls, textareaCls, labelCls } from "./shared";

// ── Types ─────────────────────────────────────────────────────
interface Issue {
  id?: number;
  volume: number;
  number: string;
  title: string;
  headline: string;
  deck: string;
  caseLabel: string;
  description: string;
  pdfUrl: string | null;
  coverImageUrl: string | null;
  pageCount: number;
  accessLevel: string;
  status: string;
  publishDate: string;
  dropDate: string;
  countdownEnabled: boolean;
  publicStatus: string;
  readCtaLabel: string;
  readCtaUrl: string;
  downloadCtaLabel: string;
  downloadCtaUrl: string;
  joinCtaLabel: string;
  tagline: string;
}

const DEFAULTS: Issue = {
  volume: 1, number: "No. 2", title: "Weekly · August 14, 2026",
  headline: "The Story Got Smaller. The Clues Got Better.",
  deck: "As the 1947 headline count collapsed, what remained in the record grew more specific: names, addresses, drivers, bartenders, hotels, and at least four leads the investigation eliminated on the record.",
  caseLabel: "BDH-002 · The Black Dahlia Investigation",
  description: "", pdfUrl: null, coverImageUrl: null, pageCount: 12,
  accessLevel: "public", status: "draft",
  publishDate: "", dropDate: "", countdownEnabled: true, publicStatus: "",
  readCtaLabel: "Read Latest Issue", readCtaUrl: "",
  downloadCtaLabel: "Download PDF", downloadCtaUrl: "",
  joinCtaLabel: "Join Thursday Drop", tagline: "",
};

// ── Roman numeral helper ──────────────────────────────────────
function toRoman(n: number): string {
  const map: [number, string][] = [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "";
  for (const [v, s] of map) { while (n >= v) { r += s; n -= v; } }
  return r;
}

// ── Preview component ─────────────────────────────────────────
function Preview({ f }: { f: Issue }) {
  const volStr = `Vol. ${toRoman(f.volume)}, No. ${f.number.replace(/^No\.\s*/i, "")}`;
  const pdfHref = f.readCtaUrl || f.pdfUrl || "";
  return (
    <div className="border-2 border-black bg-white max-w-xl mx-auto text-black font-sans text-sm select-none">
      {/* Countdown bar preview */}
      <div className="bg-black text-white flex items-center justify-between px-3 py-1">
        <span className="text-[9px] font-bold uppercase tracking-widest">Next Crime Wire Drop</span>
        <span className="text-[9px] font-mono font-bold">
          {f.countdownEnabled ? "⬛ Live countdown" : "Countdown off"}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest">Thursday · {f.pageCount} Pages</span>
      </div>
      {/* Dateline */}
      <div className="border-b border-black px-3 py-1 text-center">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Los Angeles Crime Wire</span>
      </div>
      {/* Dateline rule */}
      <div className="border-b border-black px-3 py-1 text-center">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em]">
          {f.publishDate ? new Date(f.publishDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Edition date not set"}&nbsp;·&nbsp;{volStr}&nbsp;·&nbsp;{f.pageCount} Pages
          {f.caseLabel ? `\u00a0·\u00a0${f.caseLabel}` : ""}
        </span>
      </div>
      <div className="p-4">
        {/* Section slug */}
        <div className="flex gap-2 mb-2">
          <span className="bg-black text-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest">The Lead</span>
          {f.caseLabel && (
            <span className="text-[8px] font-bold uppercase tracking-widest border border-black px-2 py-0.5">{f.caseLabel}</span>
          )}
        </div>
        {/* Headline */}
        <div className="text-xl font-serif font-bold uppercase leading-tight mb-2 whitespace-pre-line">
          {f.headline || "Headline not set"}
        </div>
        {/* Deck */}
        {f.deck && (
          <p className="font-serif text-xs italic border-l-2 border-black pl-3 mb-3 leading-snug">
            {f.deck}
          </p>
        )}
        {/* Public status */}
        {f.publicStatus && (
          <div className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2 py-1 mb-3 inline-block">
            {f.publicStatus}
          </div>
        )}
        {/* CTAs */}
        <div className="flex gap-2 flex-wrap">
          <span className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-black ${pdfHref ? "bg-black text-white" : "opacity-40"}`}>
            {f.readCtaLabel || "Read Latest Issue"}
          </span>
          <span className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-black ${pdfHref ? "" : "opacity-40"}`}>
            {f.downloadCtaLabel || "Download PDF"}
          </span>
          <span className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest border border-black">
            {f.joinCtaLabel || "Join Thursday Drop"}
          </span>
        </div>
        {/* Cover image */}
        {f.coverImageUrl && (
          <div className="mt-3 border border-black">
            <img src={f.coverImageUrl} alt="Cover" className="w-full max-h-48 object-cover object-center" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function AdminFrontPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<Issue>(DEFAULTS);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [existingUploads, setExistingUploads] = useState<Array<{ id: number; originalName: string; filePath: string; mimeType: string }>>([]);
  const pdfFileRef  = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Load most recent issue
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [issuesRes, uploadsRes] = await Promise.all([
          api("/issues/all"),
          api("/uploads"),
        ]);
        const issues: Issue[] = issuesRes.ok ? await issuesRes.json() : [];
        const uploads = uploadsRes.ok ? await uploadsRes.json() : [];

        // Prefer published, then draft, then most recent
        const sorted = [...issues].sort((a, b) => {
          const priority = (s: string) => s === "published" ? 0 : s === "draft" ? 1 : 2;
          return priority(a.status) - priority(b.status);
        });

        if (sorted.length > 0) {
          const latest = sorted[0] as Issue & { id: number };
          setExistingId(latest.id ?? null);
          setForm({
            ...DEFAULTS,
            ...latest,
            deck: latest.deck ?? latest.description ?? DEFAULTS.deck,
            caseLabel: latest.caseLabel ?? DEFAULTS.caseLabel,
            countdownEnabled: latest.countdownEnabled !== false,
            readCtaLabel: latest.readCtaLabel ?? DEFAULTS.readCtaLabel,
            readCtaUrl: latest.readCtaUrl ?? "",
            downloadCtaLabel: latest.downloadCtaLabel ?? DEFAULTS.downloadCtaLabel,
            downloadCtaUrl: latest.downloadCtaUrl ?? "",
            joinCtaLabel: latest.joinCtaLabel ?? DEFAULTS.joinCtaLabel,
            publicStatus: latest.publicStatus ?? "",
            dropDate: latest.dropDate ?? "",
            coverImageUrl: latest.coverImageUrl ?? "",
            publishDate: latest.publishDate?.slice(0, 10) ?? "",
          });
        }

        setExistingUploads(
          uploads.filter((u: { mimeType: string }) =>
            u.mimeType?.startsWith("image/") || u.mimeType === "application/pdf"
          )
        );
      } catch (e) {
        setError("Failed to load issue data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function set(key: keyof Issue, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function saveAs(targetStatus: "draft" | "published") {
    setSaving(true); setError(""); setSuccess("");
    try {
      const fd = new FormData();
      // Numeric fields
      fd.append("volume", String(form.volume));
      fd.append("pageCount", String(form.pageCount));
      // Text fields
      const textFields: (keyof Issue)[] = [
        "number", "title", "headline", "deck", "caseLabel", "tagline", "description",
        "accessLevel", "publishDate", "dropDate", "publicStatus",
        "readCtaLabel", "readCtaUrl", "downloadCtaLabel", "downloadCtaUrl", "joinCtaLabel",
        "coverImageUrl",
      ];
      for (const k of textFields) {
        fd.append(k, String(form[k] ?? ""));
      }
      fd.append("status", targetStatus);
      fd.append("countdownEnabled", form.countdownEnabled ? "true" : "false");

      // PDF file
      const pdfFile = pdfFileRef.current?.files?.[0];
      if (pdfFile) fd.append("pdf", pdfFile);

      // Cover image file
      const coverFile = coverFileRef.current?.files?.[0];
      if (coverFile) fd.append("cover", coverFile);

      const isNew = !existingId;
      const res = await apiForm(
        isNew ? "/issues" : `/issues/${existingId}`,
        fd,
        isNew ? "POST" : "PATCH"
      );

      if (res.ok) {
        const data = await res.json();
        if (isNew) setExistingId(data.id);
        setSuccess(targetStatus === "published" ? "Front page published." : "Saved as draft.");
        // Update pdfUrl if returned
        if (data.pdfUrl) setForm(f => ({ ...f, pdfUrl: data.pdfUrl }));
        if (data.coverImageUrl) setForm(f => ({ ...f, coverImageUrl: data.coverImageUrl }));
        if (pdfFileRef.current) pdfFileRef.current.value = "";
        if (coverFileRef.current) coverFileRef.current.value = "";
      } else {
        const d = await res.json().catch(() => ({ error: `Failed (${res.status})` }));
        setError(d.error ?? "Save failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  const pdfUploads = existingUploads.filter(u => u.mimeType === "application/pdf");
  const imgUploads = existingUploads.filter(u => u.mimeType?.startsWith("image/"));

  return (
    <div className="space-y-6">

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("edit")}
          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${mode === "edit" ? "bg-black text-white border-black" : "border-gray-300 text-gray-500 hover:border-black hover:text-black"}`}
        >
          Edit
        </button>
        <button
          onClick={() => setMode("preview")}
          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${mode === "preview" ? "bg-black text-white border-black" : "border-gray-300 text-gray-500 hover:border-black hover:text-black"}`}
        >
          Preview
        </button>
        <div className="ml-auto flex gap-2">
          <Btn variant="secondary" onClick={() => saveAs("draft")} disabled={saving}>
            {saving ? "Saving…" : "Save Draft"}
          </Btn>
          <Btn onClick={() => saveAs("published")} disabled={saving}>
            {saving ? "Publishing…" : "Publish →"}
          </Btn>
        </div>
      </div>

      {error && <ErrorMsg message={error} />}
      {success && <SuccessMsg message={success} />}

      {/* Notice for issue #2 */}
      {existingId && (
        <div className="bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">
          Editing{" "}
          <strong>
            Vol. {toRoman(form.volume)}, {form.number}
          </strong>
          {" "}(status: <strong>{form.status}</strong>). Publishing replaces the current public front page; previous editions are automatically archived.
        </div>
      )}
      {!existingId && (
        <div className="bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
          No issue on file. Completing this form and saving will create Issue No. 1. Do not advance numbering without editorial direction.
        </div>
      )}

      {/* ── Preview mode ──────────────────────────────────────── */}
      {mode === "preview" && (
        <div className="pt-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Homepage Preview</p>
          <Preview f={form} />
        </div>
      )}

      {/* ── Edit mode ─────────────────────────────────────────── */}
      {mode === "edit" && (
        <div className="space-y-7">

          {/* Edition Identity */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Edition Identity</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Volume">
                <input type="number" min={1} className={inputCls} value={form.volume}
                  onChange={e => set("volume", parseInt(e.target.value) || 1)} />
              </Field>
              <Field label="Issue Number" hint="e.g. No. 3">
                <input className={inputCls} value={form.number}
                  onChange={e => set("number", e.target.value)} />
              </Field>
              <Field label="Page Count">
                <input type="number" min={1} className={inputCls} value={form.pageCount}
                  onChange={e => set("pageCount", parseInt(e.target.value) || 12)} />
              </Field>
              <Field label="Publish Date">
                <input type="date" className={inputCls} value={form.publishDate}
                  onChange={e => set("publishDate", e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Edition Title / Name" hint="Internal label. e.g. Weekly · August 14, 2026">
                <input className={inputCls} value={form.title}
                  onChange={e => set("title", e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Lead Story */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Lead Story</p>
            <div className="space-y-4">
              <Field label="Case Label" hint="Shown in badge. e.g. BDH-002 · The Black Dahlia Investigation">
                <input className={inputCls} value={form.caseLabel}
                  onChange={e => set("caseLabel", e.target.value)} />
              </Field>
              <Field label="Headline">
                <textarea className={textareaCls} rows={2} value={form.headline}
                  onChange={e => set("headline", e.target.value)} />
              </Field>
              <Field label="Deck" hint="Pull-quote italic text below headline. One or two sentences.">
                <textarea className={textareaCls} rows={3} value={form.deck}
                  onChange={e => set("deck", e.target.value)} />
              </Field>
              <Field label="Public Status" hint="Optional. Max ~60 characters. Shown as a small badge below the deck.">
                <input className={inputCls} maxLength={70} value={form.publicStatus}
                  onChange={e => set("publicStatus", e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">{form.publicStatus.length}/60 characters</p>
              </Field>
            </div>
          </section>

          {/* Cover Image */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Cover Image</p>
            <div className="space-y-3">
              <Field label="Upload New Cover Image" hint="Replaces the existing cover. JPG or PNG.">
                <input ref={coverFileRef} type="file" accept="image/*" className="w-full text-sm py-1" />
              </Field>
              {imgUploads.length > 0 && (
                <Field label="Or Select from Existing Uploads">
                  <select className={inputCls} value={form.coverImageUrl ?? ""}
                    onChange={e => set("coverImageUrl", e.target.value)}>
                    <option value="">— None / use default —</option>
                    {imgUploads.map(u => (
                      <option key={u.id} value={u.filePath}>{u.originalName}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Or Paste Image URL">
                <input className={inputCls} placeholder="https://… or /api/files/…"
                  value={form.coverImageUrl ?? ""}
                  onChange={e => set("coverImageUrl", e.target.value)} />
              </Field>
              {form.coverImageUrl && (
                <div className="border border-gray-200 p-2 inline-block">
                  <img src={form.coverImageUrl} alt="Cover preview" className="max-h-40 object-contain" />
                </div>
              )}
            </div>
          </section>

          {/* Issue PDF */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Issue PDF</p>
            <div className="space-y-3">
              <Field label="Upload New PDF">
                <input ref={pdfFileRef} type="file" accept="application/pdf" className="w-full text-sm py-1" />
              </Field>
              {pdfUploads.length > 0 && (
                <Field label="Or Select from Existing Uploads">
                  <select className={inputCls} value={form.pdfUrl ?? ""}
                    onChange={e => set("pdfUrl", e.target.value)}>
                    <option value="">— None —</option>
                    {pdfUploads.map(u => (
                      <option key={u.id} value={u.filePath}>{u.originalName}</option>
                    ))}
                  </select>
                </Field>
              )}
              {form.pdfUrl && (
                <p className="text-xs text-gray-500">
                  Current PDF:{" "}
                  <a href={form.pdfUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-600">{form.pdfUrl}</a>
                </p>
              )}
            </div>
          </section>

          {/* Call-to-Action Labels */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Call-to-Action Labels &amp; Destinations</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Read Button Label">
                <input className={inputCls} value={form.readCtaLabel}
                  onChange={e => set("readCtaLabel", e.target.value)} />
              </Field>
              <Field label="Read Button URL" hint="Leave blank to use the issue PDF URL.">
                <input className={inputCls} placeholder="https://… or leave blank"
                  value={form.readCtaUrl}
                  onChange={e => set("readCtaUrl", e.target.value)} />
              </Field>
              <Field label="Download Button Label">
                <input className={inputCls} value={form.downloadCtaLabel}
                  onChange={e => set("downloadCtaLabel", e.target.value)} />
              </Field>
              <Field label="Download Button URL" hint="Leave blank to use the issue PDF URL.">
                <input className={inputCls} placeholder="https://… or leave blank"
                  value={form.downloadCtaUrl}
                  onChange={e => set("downloadCtaUrl", e.target.value)} />
              </Field>
              <Field label="Join Button Label">
                <input className={inputCls} value={form.joinCtaLabel}
                  onChange={e => set("joinCtaLabel", e.target.value)} />
              </Field>
            </div>
          </section>

          {/* Thursday Drop Countdown */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Thursday Drop Countdown</p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input type="checkbox" checked={form.countdownEnabled}
                    onChange={e => set("countdownEnabled", e.target.checked)}
                    className="peer sr-only" />
                  <div className="w-10 h-5 border-2 border-black bg-white transition-colors peer-checked:bg-black rounded-sm" />
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-black peer-checked:bg-white transition-all peer-checked:translate-x-5 rounded-sm" />
                </div>
                <span className={`text-xs font-bold uppercase tracking-widest ${form.countdownEnabled ? "text-black" : "text-gray-400"}`}>
                  {form.countdownEnabled ? "Countdown Enabled" : "Countdown Disabled"}
                </span>
              </label>
              <Field
                label="Drop Date/Time Override"
                hint="Leave blank to automatically count down to the next Thursday at 12:00 PM PT. Format: YYYY-MM-DDTHH:MM"
              >
                <input type="datetime-local" className={inputCls} value={form.dropDate}
                  onChange={e => set("dropDate", e.target.value)} />
              </Field>
              {!form.dropDate && (
                <p className="text-[10px] text-gray-500 font-mono bg-gray-50 border border-gray-200 px-3 py-2">
                  Auto-target: next Thursday · 12:00 PM PT (America/Los_Angeles)
                </p>
              )}
            </div>
          </section>

          {/* Access & Status */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Access &amp; Status</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Access Level">
                <select className={inputCls} value={form.accessLevel}
                  onChange={e => set("accessLevel", e.target.value)}>
                  <option value="public">Public</option>
                  <option value="press_club">Press Club</option>
                  <option value="preview_only">Preview Only</option>
                </select>
              </Field>
            </div>
          </section>

          {/* Publish actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
            <Btn variant="secondary" onClick={() => saveAs("draft")} disabled={saving}>
              {saving ? "Saving…" : "Save Draft"}
            </Btn>
            <Btn onClick={() => saveAs("published")} disabled={saving}>
              {saving ? "Publishing…" : "Publish Front Page →"}
            </Btn>
            <span className="text-[10px] text-gray-400 font-mono ml-2">
              Current status: {form.status}
            </span>
          </div>

        </div>
      )}
    </div>
  );
}

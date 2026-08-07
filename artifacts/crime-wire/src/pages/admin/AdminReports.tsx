import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg,
  Btn, Field, inputCls, selectCls, textareaCls, fmtDate, fmtDateTime, BASE,
} from "./shared";

interface Props {}

interface Report {
  id: number; type: string; status: string; headline: string; deck: string | null;
  neighborhood: string | null; city: string | null; incidentDate: string | null;
  publishDate: string | null; byline: string | null; body: string;
  agenciesInvolved: string | null; caseNumber: string | null; reportNumber: string | null;
  sourceLinks: string | null; evidenceStatus: string | null;
  featuredImageUrl: string | null; internalNotes: string | null;
  relatedCaseFileId: number | null; placement: string;
  isDeveloping: boolean; updateHistory: string; correctionNotice: string | null;
  correctionHistory: string; publishedAt: string | null;
  createdAt: string; updatedAt: string;
}

interface CaseFile { id: number; identifier: string; title: string }

const REPORT_TYPES = [
  { value: "crime_brief", label: "Crime Brief" },
  { value: "incident_report", label: "Full Incident Report" },
  { value: "breaking", label: "Breaking / Developing" },
  { value: "court_update", label: "Court Update" },
  { value: "arrest", label: "Arrest / Charging Update" },
  { value: "field_dispatch", label: "Field Dispatch" },
  { value: "records_update", label: "Records Update" },
  { value: "community_safety", label: "Community Safety Notice" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "correction_report", label: "Correction" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "needs_review", label: "Needs Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "developing", label: "Developing (live updates)" },
  { value: "updated", label: "Updated" },
  { value: "corrected", label: "Corrected" },
  { value: "archived", label: "Archived" },
];

const EVIDENCE_LABELS = [
  "documented", "corroborated", "reported", "oral_history",
  "open", "disputed", "unverified", "inference",
];

const PLACEMENTS = [
  { key: "homepage", label: "Crime Division Homepage" },
  { key: "city_desk", label: "City Desk" },
  { key: "courts_records", label: "Courts & Records" },
  { key: "records_desk", label: "Records Desk" },
  { key: "featured", label: "Featured Report" },
  { key: "crime_wire_queue", label: "Queue for Crime Wire" },
];

const EMPTY_REPORT: Partial<Report> = {
  type: "crime_brief", status: "draft", headline: "", deck: "",
  neighborhood: "", city: "Los Angeles", byline: "", body: "",
  agenciesInvolved: "", caseNumber: "", reportNumber: "", sourceLinks: "",
  evidenceStatus: "reported", internalNotes: "", placement: "{}",
  isDeveloping: false, correctionNotice: "",
};

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Report> | null>(null);
  const [preview, setPreview] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [updateSummary, setUpdateSummary] = useState("");
  const [correctionSummary, setCorrectionSummary] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api("/reports/all/list").then((r) => r.ok ? r.json() : []),
      api("/case-files/all").then((r) => r.ok ? r.json() : []),
    ]).then(([reps, cases]) => {
      setReports(reps);
      setCaseFiles(cases);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  function parsePlacement(s: string): Record<string, boolean> {
    try { return JSON.parse(s || "{}"); } catch { return {}; }
  }

  function setPlacement(key: string, val: boolean) {
    const p = parsePlacement(editing?.placement ?? "{}");
    p[key] = val;
    setField("placement", JSON.stringify(p));
  }

  function setField(key: keyof Report, val: unknown) {
    setEditing((e) => e ? { ...e, [key]: val } : e);
  }

  async function save(extraFields?: object) {
    if (!editing) return;
    setSaving(true); setError(""); setSuccess("");

    const isNew = !editing.id;
    const payload: Record<string, unknown> = {
      type: editing.type, status: editing.status, headline: editing.headline,
      deck: editing.deck || null, neighborhood: editing.neighborhood || null,
      city: editing.city || "Los Angeles", byline: editing.byline || null,
      body: editing.body || "", agenciesInvolved: editing.agenciesInvolved || null,
      caseNumber: editing.caseNumber || null, reportNumber: editing.reportNumber || null,
      sourceLinks: editing.sourceLinks || null, evidenceStatus: editing.evidenceStatus || null,
      featuredImageUrl: editing.featuredImageUrl || null,
      internalNotes: editing.internalNotes || null,
      relatedCaseFileId: editing.relatedCaseFileId || null,
      placement: editing.placement || "{}",
      isDeveloping: editing.isDeveloping ?? false,
      correctionNotice: editing.correctionNotice || null,
      incidentDate: editing.incidentDate || null,
      publishDate: editing.publishDate || null,
      ...extraFields,
    };

    const res = await api(
      isNew ? "/reports" : `/reports/${editing.id}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(payload) }
    );

    if (res.ok) {
      const saved = await res.json();
      setSuccess(isNew ? "Report created." : "Report saved.");
      if (isNew) {
        setEditing(saved); // stays open for continued editing
        load();
      } else {
        load();
      }
    } else {
      const d = await res.json().catch(() => ({ error: "Save failed" }));
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  async function publish() {
    await save({ status: "published" });
    setEditing((e) => e ? { ...e, status: "published" } : e);
  }

  async function saveWithUpdate() {
    await save({ status: "updated", updateSummary });
    setUpdateSummary("");
  }

  async function saveWithCorrection() {
    await save({ status: "corrected", correctionSummary });
    setCorrectionSummary("");
  }

  async function archive(id: number) {
    if (!confirm("Archive this report? It will no longer appear publicly.")) return;
    setSaving(true);
    await api(`/reports/${id}`, { method: "DELETE" });
    setEditing(null);
    load();
    setSaving(false);
  }

  const filtered = reports.filter((r) => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterType && r.type !== filterType) return false;
    return true;
  });

  // --- EDITOR ---
  if (editing !== null) {
    const placement = parsePlacement(editing.placement ?? "{}");
    const isNew = !editing.id;
    const isPublished = editing.status === "published" || editing.status === "developing" || editing.status === "updated";

    return (
      <div className="max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Btn variant="ghost" onClick={() => { setEditing(null); setPreview(false); }}>← Reports</Btn>
            <span className="text-gray-300">|</span>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
              {isNew ? "New Report" : editing.headline || "Edit Report"}
            </h2>
            {editing.status && <Badge status={editing.status} />}
          </div>
          <Btn variant="secondary" size="xs" onClick={() => setPreview(!preview)}>
            {preview ? "Edit" : "Preview"}
          </Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
        {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

        {preview ? (
          /* Preview pane */
          <div className="border border-gray-200 p-6 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                {REPORT_TYPES.find((t) => t.value === editing.type)?.label ?? editing.type}
                {editing.evidenceStatus && ` · ${editing.evidenceStatus.toUpperCase()}`}
              </p>
              <h1 className="text-2xl font-serif font-bold leading-tight">{editing.headline || "(No headline)"}</h1>
              {editing.deck && <p className="text-base italic text-gray-600 mt-2">{editing.deck}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                {editing.byline && <span>By {editing.byline}</span>}
                {editing.neighborhood && <span>{editing.neighborhood}, {editing.city || "Los Angeles"}</span>}
                {editing.incidentDate && <span>{fmtDate(editing.incidentDate)}</span>}
              </div>
            </div>
            <hr />
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {editing.body || <span className="text-gray-400 italic">(No body text)</span>}
            </div>
            {editing.correctionNotice && (
              <div className="border-l-4 border-red-500 pl-3 text-sm text-red-700">
                <strong>Correction:</strong> {editing.correctionNotice}
              </div>
            )}
            {editing.agenciesInvolved && (
              <p className="text-xs text-gray-500">Agencies: {editing.agenciesInvolved}</p>
            )}
          </div>
        ) : (
          /* Edit form */
          <div className="space-y-5">
            {/* Classification */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Report Type" required>
                <select className={selectCls} value={editing.type ?? "crime_brief"} onChange={(e) => setField("type", e.target.value)}>
                  {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className={selectCls} value={editing.status ?? "draft"} onChange={(e) => setField("status", e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <Field label="Evidence / Factual Status">
                <select className={selectCls} value={editing.evidenceStatus ?? "reported"} onChange={(e) => setField("evidenceStatus", e.target.value)}>
                  <option value="">— None —</option>
                  {EVIDENCE_LABELS.map((l) => <option key={l} value={l}>{l.replace(/_/g, " ").toUpperCase()}</option>)}
                </select>
              </Field>
            </div>

            {/* Core fields */}
            <Field label="Headline" required>
              <input
                className={inputCls + " text-base font-bold"}
                placeholder="e.g. Suspect Charged in Silverlake Arson, DA Announces"
                value={editing.headline ?? ""}
                onChange={(e) => setField("headline", e.target.value)}
              />
            </Field>
            <Field label="Deck (Short Summary)">
              <input
                className={inputCls}
                placeholder="One or two sentence summary shown in listings"
                value={editing.deck ?? ""}
                onChange={(e) => setField("deck", e.target.value)}
              />
            </Field>

            {/* Location / byline */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="Neighborhood">
                <input className={inputCls} placeholder="Silverlake" value={editing.neighborhood ?? ""} onChange={(e) => setField("neighborhood", e.target.value)} />
              </Field>
              <Field label="City">
                <input className={inputCls} value={editing.city ?? "Los Angeles"} onChange={(e) => setField("city", e.target.value)} />
              </Field>
              <Field label="Byline">
                <input className={inputCls} placeholder="RSR Crime Division Staff" value={editing.byline ?? ""} onChange={(e) => setField("byline", e.target.value)} />
              </Field>
              <Field label="Incident Date">
                <input type="date" className={inputCls} value={editing.incidentDate?.slice(0, 10) ?? ""} onChange={(e) => setField("incidentDate", e.target.value)} />
              </Field>
            </div>

            {/* Report body */}
            <Field label="Report Body" required hint="Plain text. Paragraphs separated by blank lines.">
              <textarea
                className={textareaCls + " min-h-[300px]"}
                placeholder="Write the full report here. Paragraphs separated by blank lines."
                value={editing.body ?? ""}
                onChange={(e) => setField("body", e.target.value)}
              />
            </Field>

            {/* Record / agency fields */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Agencies Involved">
                <input className={inputCls} placeholder="LAPD, DA's Office" value={editing.agenciesInvolved ?? ""} onChange={(e) => setField("agenciesInvolved", e.target.value)} />
              </Field>
              <Field label="Case / Incident Number">
                <input className={inputCls} placeholder="DR-2026-4421" value={editing.caseNumber ?? ""} onChange={(e) => setField("caseNumber", e.target.value)} />
              </Field>
              <Field label="Report Number">
                <input className={inputCls} value={editing.reportNumber ?? ""} onChange={(e) => setField("reportNumber", e.target.value)} />
              </Field>
              <Field label="Publish Date">
                <input type="date" className={inputCls} value={editing.publishDate?.slice(0, 10) ?? ""} onChange={(e) => setField("publishDate", e.target.value)} />
              </Field>
            </div>

            {/* Source links */}
            <Field label="Source Links (JSON)" hint='Array of source objects, e.g. [{"label":"LAPD Press Release","url":"https://..."}]'>
              <textarea className={textareaCls} rows={2} value={editing.sourceLinks ?? ""} onChange={(e) => setField("sourceLinks", e.target.value)} />
            </Field>

            {/* Related case file */}
            <Field label="Related Case File">
              <select className={selectCls} value={editing.relatedCaseFileId ?? ""} onChange={(e) => setField("relatedCaseFileId", e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">— None —</option>
                {caseFiles.map((c) => <option key={c.id} value={c.id}>{c.identifier} — {c.title}</option>)}
              </select>
            </Field>

            {/* Placement */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2">Where to show this report</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PLACEMENTS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!placement[p.key]}
                      onChange={(e) => setPlacement(p.key, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-xs">{p.label}</span>
                  </label>
                ))}
              </div>
              {placement.crime_wire_queue && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Queuing adds this report to the Crime Wire planning list. It will not appear in the PDF automatically.
                </p>
              )}
            </div>

            {/* Developing story */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!editing.isDeveloping} onChange={(e) => setField("isDeveloping", e.target.checked)} className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Developing Story (receives timestamped updates on same page)</span>
              </label>
            </div>

            {/* Featured image */}
            <Field label="Featured Image URL">
              <input className={inputCls} placeholder="https://…" value={editing.featuredImageUrl ?? ""} onChange={(e) => setField("featuredImageUrl", e.target.value)} />
            </Field>

            {/* Internal notes */}
            <div className="border border-yellow-200 bg-yellow-50 p-3">
              <Field label="Internal Editor Notes — Never Shown Publicly">
                <textarea className={textareaCls} rows={2} value={editing.internalNotes ?? ""} onChange={(e) => setField("internalNotes", e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* Action bar */}
        <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
          {/* Primary save + publish */}
          <div className="flex flex-wrap gap-2 items-center">
            <Btn onClick={() => save()} disabled={saving || !editing.headline}>
              {saving ? "Saving…" : isNew ? "Create Draft" : "Save"}
            </Btn>
            {!isNew && editing.status !== "published" && editing.status !== "archived" && (
              <Btn variant="primary" onClick={publish} disabled={saving || !editing.headline}>
                Publish to City Desk
              </Btn>
            )}
            {!isNew && editing.status !== "archived" && (
              <Btn variant="secondary" onClick={() => save({ status: "needs_review" })} disabled={saving}>
                Mark Needs Review
              </Btn>
            )}
            {!isNew && editing.status !== "archived" && (
              <Btn variant="secondary" onClick={() => save({ status: "scheduled" })} disabled={saving}>
                Schedule
              </Btn>
            )}
            {!isNew && (
              <Btn variant="danger" onClick={() => archive(editing.id!)} disabled={saving}>
                Archive
              </Btn>
            )}
          </div>

          {/* Update workflow (for published/developing reports) */}
          {!isNew && isPublished && (
            <div className="border border-gray-200 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Add Update to Published Report</p>
              <div className="flex gap-2">
                <input
                  className={inputCls + " flex-1"}
                  placeholder="Brief update summary (e.g. 'Suspect identified')"
                  value={updateSummary}
                  onChange={(e) => setUpdateSummary(e.target.value)}
                />
                <Btn onClick={saveWithUpdate} disabled={saving || !updateSummary} size="xs">
                  Save Update
                </Btn>
              </div>
            </div>
          )}

          {/* Correction workflow */}
          {!isNew && (
            <div className="border border-red-100 p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">Issue a Correction</p>
              <Field label="Correction Notice (shown publicly)">
                <input className={inputCls} placeholder="An earlier version of this report stated…" value={editing.correctionNotice ?? ""} onChange={(e) => setField("correctionNotice", e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <input
                  className={inputCls + " flex-1"}
                  placeholder="Internal correction summary"
                  value={correctionSummary}
                  onChange={(e) => setCorrectionSummary(e.target.value)}
                />
                <Btn variant="danger" size="xs" onClick={saveWithCorrection} disabled={saving || !correctionSummary || !editing.correctionNotice}>
                  Record Correction
                </Btn>
              </div>
            </div>
          )}

          {/* Update history */}
          {!isNew && (() => {
            try {
              const h: Array<{ timestamp: string; summary: string }> = JSON.parse(editing.updateHistory ?? "[]");
              if (!h.length) return null;
              return (
                <div className="text-xs text-gray-500 space-y-1">
                  <p className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Update History</p>
                  {h.map((e, i) => <p key={i}>{fmtDateTime(e.timestamp)} — {e.summary}</p>)}
                </div>
              );
            } catch { return null; }
          })()}

          <div className="pt-1">
            <Btn variant="ghost" onClick={() => { setEditing(null); setPreview(false); }}>
              ← Back to all reports
            </Btn>
          </div>
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          City Reports ({reports.length})
        </h2>
        <Btn onClick={() => setEditing({ ...EMPTY_REPORT })}>+ New Report</Btn>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select className={selectCls + " w-44"} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className={selectCls + " w-48"} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {REPORT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <span className="text-xs text-gray-400 self-center">{filtered.length} of {reports.length}</span>
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <EmptyState message="No reports match these filters" />
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {filtered.map((r) => {
            const placement = parsePlacement(r.placement);
            const placementTags = PLACEMENTS.filter((p) => placement[p.key]).map((p) => p.label);
            return (
              <div key={r.id} className="px-4 py-3 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {REPORT_TYPES.find((t) => t.value === r.type)?.label ?? r.type}
                    </span>
                    <Badge status={r.status} />
                    {r.evidenceStatus && (
                      <span className="text-[10px] text-gray-400 uppercase">{r.evidenceStatus.replace(/_/g, " ")}</span>
                    )}
                    {r.isDeveloping && (
                      <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Developing</span>
                    )}
                  </div>
                  <span className="font-bold text-sm">{r.headline}</span>
                  {r.deck && <p className="text-xs text-gray-500 truncate mt-0.5">{r.deck}</p>}
                  {placementTags.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Showing on: {placementTags.join(", ")}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {r.publishedAt ? `Published ${fmtDate(r.publishedAt)}` : `Draft — ${fmtDateTime(r.createdAt)}`}
                    {r.neighborhood && ` · ${r.neighborhood}`}
                  </p>
                </div>
                <Btn variant="secondary" size="xs" onClick={() => setEditing(r)}>Edit</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

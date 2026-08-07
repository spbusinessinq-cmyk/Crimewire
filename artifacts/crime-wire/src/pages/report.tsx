import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";

interface Report {
  id: number; type: string; status: string; headline: string;
  deck: string | null; neighborhood: string | null; city: string | null;
  incidentDate: string | null; publishDate: string | null; byline: string | null;
  body: string; agenciesInvolved: string | null; caseNumber: string | null;
  reportNumber: string | null; sourceLinks: string | null;
  evidenceStatus: string | null; featuredImageUrl: string | null;
  relatedCaseFileId: number | null; isDeveloping: boolean;
  updateHistory: string; correctionNotice: string | null;
  correctionHistory: string; publishedAt: string | null;
  createdAt: string; updatedAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  crime_brief: "Crime Brief",
  incident_report: "Incident Report",
  breaking: "Breaking",
  court_update: "Court Update",
  arrest: "Arrest / Charging Update",
  field_dispatch: "Field Dispatch",
  records_update: "Records Update",
  community_safety: "Community Safety Notice",
  follow_up: "Follow-Up",
  correction_report: "Correction",
};

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    fetch(`${BASE}/api/reports/${params.id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => { if (d) setReport(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="py-24 text-center text-xs uppercase tracking-widest text-gray-400">
        Loading…
      </div>
    );
  }

  if (notFound || !report) {
    return (
      <div className="py-24 text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-4">Report not found</p>
        <Link href="/city-desk" className="text-xs uppercase tracking-widest underline">
          ← City Desk
        </Link>
      </div>
    );
  }

  let sourceLinks: Array<{ label: string; url: string }> = [];
  try { sourceLinks = JSON.parse(report.sourceLinks ?? "[]"); } catch {}

  let updateHistory: Array<{ timestamp: string; summary: string }> = [];
  try { updateHistory = JSON.parse(report.updateHistory ?? "[]"); } catch {}

  let correctionHistory: Array<{ timestamp: string; summary: string }> = [];
  try { correctionHistory = JSON.parse(report.correctionHistory ?? "[]"); } catch {}

  const paragraphs = report.body.split(/\n\n+/).filter(Boolean);

  return (
    <article className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400 mb-6">
        <Link href="/city-desk" className="hover:text-black transition-colors">City Desk</Link>
        <span>›</span>
        <span>{TYPE_LABELS[report.type] ?? report.type}</span>
      </nav>

      {/* Status indicators */}
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {TYPE_LABELS[report.type] ?? report.type}
        </span>
        {report.isDeveloping && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse inline-block" />
            Developing Story
          </span>
        )}
        {report.status === "corrected" && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Corrected</span>
        )}
        {report.evidenceStatus && (
          <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest">
            {report.evidenceStatus.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {/* Headline */}
      <h1 className="text-3xl sm:text-4xl font-serif font-black leading-tight mb-3">
        {report.headline}
      </h1>

      {/* Deck */}
      {report.deck && (
        <p className="text-lg text-gray-600 italic mb-4 leading-snug">{report.deck}</p>
      )}

      {/* Byline / dateline */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 border-t border-b border-gray-200 py-3 mb-6">
        {report.byline && <span><strong className="text-black">By</strong> {report.byline}</span>}
        {(report.neighborhood || report.city) && (
          <span>{[report.neighborhood, report.city || "Los Angeles"].filter(Boolean).join(", ")}</span>
        )}
        {report.incidentDate && <span>Incident: {fmtDate(report.incidentDate)}</span>}
        {report.publishedAt && <span>Published: {fmtDateTime(report.publishedAt)}</span>}
        {report.updatedAt && report.status !== "published" && (
          <span>Updated: {fmtDateTime(report.updatedAt)}</span>
        )}
      </div>

      {/* Correction notice — prominently before body */}
      {report.correctionNotice && (
        <div className="border-l-4 border-red-600 bg-red-50 px-4 py-3 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-1">Correction</p>
          <p className="text-sm text-red-800">{report.correctionNotice}</p>
        </div>
      )}

      {/* Featured image */}
      {report.featuredImageUrl && (
        <div className="mb-6">
          <img
            src={report.featuredImageUrl}
            alt={report.headline}
            className="w-full object-cover border border-gray-200"
          />
        </div>
      )}

      {/* Body */}
      <div className="prose prose-sm max-w-none mb-8 space-y-4">
        {paragraphs.length > 0 ? paragraphs.map((p, i) => (
          <p key={i} className="text-base leading-relaxed">{p}</p>
        )) : (
          <p className="text-gray-400 italic">No report body provided.</p>
        )}
      </div>

      {/* Update timeline (developing stories) */}
      {updateHistory.length > 0 && (
        <section className="border-t border-gray-200 pt-6 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Update Timeline
          </h2>
          <div className="space-y-3">
            {updateHistory.slice().reverse().map((u, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-[10px] text-gray-400 whitespace-nowrap mt-0.5 min-w-[130px]">
                  {fmtDateTime(u.timestamp)}
                </span>
                <p className="text-sm">{u.summary}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Metadata panel */}
      <aside className="border border-gray-200 p-4 mb-6 text-xs space-y-2 text-gray-600">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Report Details</p>
        {report.caseNumber && <p><strong>Case / DR #:</strong> {report.caseNumber}</p>}
        {report.reportNumber && <p><strong>Report #:</strong> {report.reportNumber}</p>}
        {report.agenciesInvolved && <p><strong>Agencies:</strong> {report.agenciesInvolved}</p>}
        {report.evidenceStatus && (
          <p>
            <strong>Factual Status:</strong>{" "}
            <span className="uppercase">{report.evidenceStatus.replace(/_/g, " ")}</span>
          </p>
        )}
        {sourceLinks.length > 0 && (
          <div>
            <strong>Sources:</strong>
            <ul className="mt-1 space-y-0.5">
              {sourceLinks.map((s, i) => (
                <li key={i}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
                    {s.label || s.url}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {report.relatedCaseFileId && (
          <p>
            <strong>Case File:</strong>{" "}
            <Link href={`/case-files`} className="underline hover:text-black">
              View Case File
            </Link>
          </p>
        )}
      </aside>

      {/* Correction history (public) */}
      {correctionHistory.length > 0 && (
        <section className="border-t border-red-200 pt-4 mb-6">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-2">
            Correction History
          </h2>
          <div className="space-y-2">
            {correctionHistory.map((c, i) => (
              <p key={i} className="text-xs text-gray-600">
                <span className="text-gray-400">{fmtDateTime(c.timestamp)}</span> — {c.summary}
              </p>
            ))}
          </div>
        </section>
      )}

      {/* Footer nav */}
      <nav className="border-t border-gray-200 pt-4 flex items-center gap-4 flex-wrap text-[10px] uppercase tracking-widest text-gray-400">
        <Link href="/city-desk" className="hover:text-black transition-colors">← City Desk</Link>
        <span>·</span>
        <Link href="/standards" className="hover:text-black transition-colors">Editorial Standards</Link>
        <span>·</span>
        <Link href="/crime-wire/corrections" className="hover:text-black transition-colors">Corrections Log</Link>
      </nav>
    </article>
  );
}

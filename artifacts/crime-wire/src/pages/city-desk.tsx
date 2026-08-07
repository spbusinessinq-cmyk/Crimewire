import { useState, useEffect } from "react";
import { Link } from "wouter";

interface Report {
  id: number; type: string; status: string; headline: string;
  deck: string | null; neighborhood: string | null; city: string | null;
  byline: string | null; incidentDate: string | null; publishedAt: string | null;
  evidenceStatus: string | null; isDeveloping: boolean; correctionNotice: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  crime_brief: "Crime Brief",
  incident_report: "Incident Report",
  breaking: "Breaking",
  court_update: "Court Update",
  arrest: "Arrest / Charging",
  field_dispatch: "Field Dispatch",
  records_update: "Records",
  community_safety: "Community Safety",
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

function EvidenceBadge({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <span className="inline-block border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest">
      {label.replace(/_/g, " ")}
    </span>
  );
}

export default function CityDesk() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/reports?placement=city_desk`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setReports)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const breaking = reports.filter((r) => r.type === "breaking" || r.isDeveloping);
  const main     = reports.filter((r) => r.type !== "breaking" && !r.isDeveloping);

  return (
    <div>
      {/* Header */}
      <div className="border-b border-black mb-6 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">
          RSR Crime Division
        </p>
        <h1 className="text-4xl font-serif font-black uppercase tracking-tight leading-none">
          City Desk
        </h1>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Los Angeles crime, courts, and incident reporting. All reports are independently sourced,
          factual-status labeled, and subject to the Crime Division editorial standards.
        </p>
      </div>

      {loading && (
        <div className="py-12 text-center text-xs uppercase tracking-widest text-gray-400">
          Loading reports…
        </div>
      )}

      {error && (
        <div className="py-4 px-4 bg-red-50 border border-red-200 text-red-700 text-sm mb-6">
          Unable to load reports. Please try again.
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        /* Pending state — only shown when no published reports exist */
        <div className="border border-dashed border-gray-300 py-16 px-8 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
            PENDING — MATERIAL UNDER REVIEW
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            City Desk reports will appear here once filed and confirmed. The Crime Division does not
            publish until sourcing and editorial review are complete.
          </p>
        </div>
      )}

      {!loading && !error && reports.length > 0 && (
        <div className="space-y-10">
          {/* Breaking / Developing */}
          {breaking.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-700 mb-3 flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                Developing
              </h2>
              <div className="divide-y divide-gray-200 border-t border-b border-black">
                {breaking.map((r) => (
                  <ReportRow key={r.id} report={r} prominent />
                ))}
              </div>
            </section>
          )}

          {/* Lead report */}
          {main.length > 0 && (
            <section>
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
                Latest Reports
              </h2>
              <div className="divide-y divide-gray-200 border-t border-b border-black">
                {main.map((r, i) => (
                  <ReportRow key={r.id} report={r} prominent={i === 0} />
                ))}
              </div>
            </section>
          )}

          {/* Standards link */}
          <div className="border-t border-gray-200 pt-4 flex items-center gap-4 flex-wrap text-[10px] uppercase tracking-widest text-gray-400">
            <Link href="/standards" className="hover:text-black transition-colors">Editorial Standards</Link>
            <span>·</span>
            <Link href="/crime-wire/corrections" className="hover:text-black transition-colors">Corrections Log</Link>
            <span>·</span>
            <span>All reports factual-status labeled · Victim first · A red string is not evidence</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportRow({ report: r, prominent }: { report: Report; prominent: boolean }) {
  const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

  return (
    <article className={`py-4 ${prominent ? "py-6" : ""}`}>
      <div className="flex items-start gap-3 mb-1 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          {TYPE_LABELS[r.type] ?? r.type}
        </span>
        {r.isDeveloping && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-600 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse inline-block" />
            Developing
          </span>
        )}
        {r.evidenceStatus && <EvidenceBadge label={r.evidenceStatus} />}
        {r.correctionNotice && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Corrected</span>
        )}
      </div>
      <Link href={`/report/${r.id}`}>
        <h3 className={`font-serif font-bold leading-tight hover:underline cursor-pointer ${
          prominent ? "text-2xl" : "text-lg"
        }`}>
          {r.headline}
        </h3>
      </Link>
      {r.deck && (
        <p className="text-sm text-gray-600 mt-1 leading-snug">{r.deck}</p>
      )}
      <div className="flex items-center gap-3 mt-2 flex-wrap text-[10px] text-gray-400 uppercase tracking-widest">
        {r.byline && <span>By {r.byline}</span>}
        {r.neighborhood && <span>{r.neighborhood}, {r.city || "Los Angeles"}</span>}
        {r.publishedAt && <span>{fmtDate(r.publishedAt)}</span>}
      </div>
      {r.correctionNotice && (
        <p className="text-xs text-red-600 mt-1 border-l-2 border-red-400 pl-2">
          Correction: {r.correctionNotice}
        </p>
      )}
    </article>
  );
}

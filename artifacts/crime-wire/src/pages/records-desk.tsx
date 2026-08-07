import { useState, useEffect } from "react";
import { Link } from "wouter";

interface Report {
  id: number; headline: string; deck: string | null; publishedAt: string | null;
  evidenceStatus: string | null; caseNumber: string | null;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export default function RecordsDesk() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/api/reports?placement=records_desk`)
      .then((r) => r.ok ? r.json() : [])
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {/* Header */}
      <div className="border-b border-black mb-6 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-1">RSR Crime Division</p>
        <h1 className="text-4xl font-serif font-black uppercase tracking-tight leading-none">Records Desk</h1>
        <p className="mt-2 text-sm text-gray-600 max-w-2xl">
          Public record documents, FOIA / CPRA requests, court filings, and evidence chain notes.
          Internal records are not published without editorial review and explicit approval.
        </p>
      </div>

      {/* Records content */}
      {loading ? (
        <div className="py-12 text-center text-xs uppercase tracking-widest text-gray-400">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="border border-dashed border-gray-300 py-16 px-8 text-center mb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-3">
            RECORD PENDING
          </p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Public records and document analysis will appear here as requests are filed and documents are
            obtained, reviewed, and approved for publication.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 border-t border-b border-black mb-8">
          {reports.map((r) => (
            <article key={r.id} className="py-4">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {r.caseNumber && (
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{r.caseNumber}</span>
                )}
                {r.evidenceStatus && (
                  <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                    {r.evidenceStatus.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <Link href={`/report/${r.id}`}>
                <h3 className="font-serif font-bold text-xl leading-tight hover:underline cursor-pointer">
                  {r.headline}
                </h3>
              </Link>
              {r.deck && <p className="text-sm text-gray-600 mt-1">{r.deck}</p>}
              {r.publishedAt && (
                <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest">{fmtDate(r.publishedAt)}</p>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Records policy section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8 pt-4 border-t border-gray-200">
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2">Document Requests</h3>
          <p className="text-sm text-gray-600">
            The Crime Division files FOIA and CPRA requests with LAPD, the DA's Office, courts, and
            public agencies. Tracking active requests is part of our standard practice.
          </p>
        </div>
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2">Source Chain</h3>
          <p className="text-sm text-gray-600">
            Every document published here is labeled with its acquisition date, source agency, and
            evidence status. Redacted versions are labeled clearly.
          </p>
        </div>
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-widest mb-2">Submission</h3>
          <p className="text-sm text-gray-600">
            Have a document tip? Use the{" "}
            <Link href="/crime-wire/reader-desk" className="underline">Reader Desk</Link>.
            {" "}Crime Wire is not a secure document system — do not submit
            sensitive identity, medical, or financial records.
          </p>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 flex items-center gap-4 flex-wrap text-[10px] uppercase tracking-widest text-gray-400">
        <Link href="/standards" className="hover:text-black transition-colors">Editorial Standards</Link>
        <span>·</span>
        <Link href="/city-desk" className="hover:text-black transition-colors">City Desk</Link>
        <span>·</span>
        <Link href="/crime-wire/corrections" className="hover:text-black transition-colors">Corrections</Link>
      </div>
    </div>
  );
}

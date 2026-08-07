import { useEffect, useState } from "react";
import { Link } from "wouter";

interface Correction {
  id: number;
  issueLabel: string | null;
  section: string | null;
  originalText: string;
  correctedText: string;
  publishedAt: string | null;
  createdAt: string;
}

export default function CwCorrections() {
  useEffect(() => {
    document.title = "Corrections | Los Angeles Crime Wire";
  }, []);

  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    fetch(`${base}/api/corrections`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((data) => {
        setCorrections(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Corrections</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          Errors are corrected openly. Each correction names the issue, the original error, and the correction.
          No silent edits. No deletions. The record stands.
        </p>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-3">
          To submit a correction, use the <Link href="/crime-wire/reader-desk" className="underline hover:text-black">Reader Desk</Link>.
        </p>
      </header>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Checking the record…</p>
        </div>
      ) : corrections.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-black">
          <p className="font-headline font-bold text-2xl uppercase tracking-widest text-gray-400 mb-2">Record Pending</p>
          <p className="font-serif italic text-sm text-gray-500">No corrections on file. Errors submitted via the Reader Desk are reviewed and published here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {corrections.map((c) => (
            <div key={c.id} className="border-2 border-black p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4 pb-3 border-b border-black">
                <div>
                  {c.issueLabel && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">{c.issueLabel}</p>
                  )}
                  {c.section && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{c.section}</p>
                  )}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {c.publishedAt
                    ? new Date(c.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                    : ""}
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">As originally published:</p>
                  <p className="font-serif text-sm text-gray-700 leading-relaxed line-through">{c.originalText}</p>
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-black mb-1">Corrected:</p>
                  <p className="font-serif text-sm leading-relaxed">{c.correctedText}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 pt-6 border-t border-black">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
          To submit a correction: <Link href="/crime-wire/reader-desk" className="underline hover:text-black">Reader Desk → Letter to the Desk</Link>
        </p>
      </div>
    </div>
  );
}

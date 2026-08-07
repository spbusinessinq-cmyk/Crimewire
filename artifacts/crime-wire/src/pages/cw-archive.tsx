import { useEffect, useState } from "react";
import { Link } from "wouter";

interface Issue {
  id: number;
  volume: number;
  number: string;
  title: string;
  tagline: string | null;
  description: string | null;
  pdfUrl: string | null;
  pageCount: number;
  status: string;
  publishDate: string | null;
}

export default function CwArchive() {
  useEffect(() => {
    document.title = "Archive | Los Angeles Crime Wire";
  }, []);

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    fetch(`${base}/api/issues`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((data) => {
        setIssues(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Archive</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4">
          All published editions of the Los Angeles Crime Wire, ordered most recent first.
        </p>
      </header>

      {loading ? (
        <div className="py-16 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading archive…</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-black">
          <p className="font-headline font-bold text-xl uppercase tracking-widest text-gray-400 mb-2">Record Pending</p>
          <p className="font-serif italic text-sm text-gray-500">No published editions on file yet. Check back Thursday.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black border-t border-b border-black">
          {[...issues].sort((a, b) => {
            const da = a.publishDate ? new Date(a.publishDate).getTime() : 0;
            const db_ = b.publishDate ? new Date(b.publishDate).getTime() : 0;
            return db_ - da;
          }).map((issue) => (
            <div key={issue.id} className="flex items-start justify-between gap-6 py-5 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">Vol. {issue.volume} · {issue.number}</span>
                  {issue.publishDate && (
                    <>
                      <span className="text-[9px] text-gray-400">·</span>
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                        {new Date(issue.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </span>
                    </>
                  )}
                  {issue.status === "published" && (
                    <span className="text-[8px] font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5">Current</span>
                  )}
                </div>
                <h3 className="font-headline font-bold text-2xl uppercase leading-tight mb-1">{issue.title}</h3>
                {issue.description && (
                  <p className="font-serif text-sm text-gray-600 leading-snug">{issue.description}</p>
                )}
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-2">{issue.pageCount} pages</p>
              </div>
              {issue.pdfUrl ? (
                <a
                  href={issue.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 bg-black text-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors whitespace-nowrap self-center"
                >
                  Open PDF
                </a>
              ) : (
                <span className="flex-shrink-0 border border-gray-300 px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap self-center">
                  No PDF
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-12 pt-6 border-t border-black text-center">
        <Link href="/crime-wire/press-club" className="inline-block border-2 border-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
          Join the Press Club for Early Access
        </Link>
      </div>
    </div>
  );
}

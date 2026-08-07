import { useEffect, useState } from 'react';
import { Link, useSearch } from 'wouter';

// Stable QR destination — always shows the current published issue.
// Accepts ?src= for campaign tracking (QR code, street sheet, etc.)

interface Issue {
  id: number;
  volume: number;
  number: string;
  title: string;
  tagline: string | null;
  description: string | null;
  pdfUrl: string | null;
  status: string;
  publishDate: string | null;
}

export default function Edition() {
  useEffect(() => {
    document.title = "Current Edition | Los Angeles Crime Wire";
  }, []);

  const search = useSearch();
  const src = new URLSearchParams(search).get('src');

  const [latest, setLatest] = useState<Issue | null>(null);
  const [archive, setArchive] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    Promise.all([
      fetch(`${base}/api/issues/latest`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${base}/api/issues`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([lat, all]) => {
      setLatest(lat);
      // All issues except the latest (shown in the "past editions" list)
      const allList = Array.isArray(all) ? all : [];
      setArchive(allList.filter(i => !lat || i.id !== lat.id));
      setLoading(false);
    });
  }, []);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center px-4 py-16 min-h-[60vh]">
      <div className="w-full max-w-md mx-auto">

        {/* Masthead strip */}
        <div className="text-center border-t-4 border-b-4 border-black py-4 mb-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500 mb-1">
            Los Angeles Crime Wire
          </p>
          <h1 className="font-headline font-bold text-4xl uppercase tracking-widest">
            Current Edition
          </h1>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mt-1">
            Independent Crime and Investigative Weekly
          </p>
          {src && (
            <p className="font-sans text-[9px] font-bold uppercase tracking-widest text-gray-400 mt-1">
              Via: {src}
            </p>
          )}
        </div>

        {loading ? (
          <div className="border-4 border-black p-10 text-center mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading edition…</p>
          </div>
        ) : latest ? (
          <div className="border-4 border-black bg-white p-8 mb-6" data-testid="latest-edition-card">
            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">
              Vol. {latest.volume} · {latest.number}
              {latest.publishDate ? ` · ${new Date(latest.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
            </span>
            <h2 className="font-headline font-bold text-3xl uppercase mt-1 mb-1 leading-tight">
              {latest.title}
            </h2>
            <p className="font-serif italic text-sm text-gray-700 mb-6">
              {latest.description || latest.tagline}
            </p>
            {latest.pdfUrl ? (
              <a
                href={latest.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="button-open-latest-edition"
                className="block w-full bg-black text-white text-center py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
              >
                Read the Latest Edition
              </a>
            ) : (
              <div className="w-full bg-gray-100 text-gray-500 text-center py-4 text-xs font-bold uppercase tracking-widest border border-gray-300">
                PDF Not Yet Available
              </div>
            )}
          </div>
        ) : (
          <div className="border-4 border-black p-10 text-center mb-6">
            <p className="font-headline font-bold text-xl uppercase tracking-widest text-gray-500 mb-2">Next Issue Incoming</p>
            <p className="font-serif italic text-sm text-gray-600">The next edition publishes this Thursday.</p>
          </div>
        )}

        {/* Past editions */}
        {archive.length > 0 && (
          <div className="border border-black divide-y divide-black mb-8">
            {[...archive]
              .sort((a, b) => {
                const da = a.publishDate ? new Date(a.publishDate).getTime() : 0;
                const db_ = b.publishDate ? new Date(b.publishDate).getTime() : 0;
                return db_ - da;
              })
              .map((ed) => (
                <div key={ed.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                      Vol. {ed.volume} · {ed.number}
                      {ed.publishDate ? ` · ${new Date(ed.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""}
                    </p>
                    <p className="font-headline font-bold uppercase text-base leading-tight">{ed.title}</p>
                  </div>
                  {ed.pdfUrl && (
                    <a
                      href={ed.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 border border-black px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
                    >
                      Open PDF
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Subscribe CTA */}
        <Link
          href="/crime-wire"
          data-testid="link-subscribe-crime-wire"
          className="block w-full border-2 border-black text-center py-4 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
        >
          Join the Thursday Drop
        </Link>

      </div>
    </div>
  );
}

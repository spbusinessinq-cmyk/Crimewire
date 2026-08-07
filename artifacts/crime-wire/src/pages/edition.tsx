import { useEffect } from 'react';
import { Link } from 'wouter';

// Stable route for the QR code — always points to the current edition PDF
const LATEST_EDITION_URL = "/editions/edition-002-august-5-2026.pdf";

const editions = [
  {
    vol: "Vol. 1 · No. 2",
    date: "August 5, 2026",
    label: "Weekly · August 5, 2026",
    url: "/editions/edition-002-august-5-2026.pdf",
    current: true,
  },
  {
    vol: "Vol. 1 · No. 1",
    date: "Special Edition",
    label: "The Missing Exit",
    url: "/editions/edition-001-the-missing-exit.pdf",
    current: false,
  },
];

export default function Edition() {
  useEffect(() => {
    document.title = "Current Edition | Los Angeles Crime Wire";
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
        </div>

        {/* Latest edition CTA */}
        <div className="border-4 border-black bg-white p-8 mb-6" data-testid="latest-edition-card">
          <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500">Vol. 1 · No. 2 · August 5, 2026</span>
          <h2 className="font-headline font-bold text-3xl uppercase mt-1 mb-1 leading-tight">
            Weekly · August 5, 2026
          </h2>
          <p className="font-serif italic text-sm text-gray-700 mb-6">
            The Black Dahlia investigation. Los Angeles crime, courts and records.
          </p>
          <a
            href={LATEST_EDITION_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="button-open-latest-edition"
            className="block w-full bg-black text-white text-center py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            Read the Latest Edition
          </a>
        </div>

        {/* Past editions */}
        <div className="border border-black divide-y divide-black mb-8">
          {editions.filter(e => !e.current).map((ed) => (
            <div key={ed.url} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <p className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">{ed.vol} · {ed.date}</p>
                <p className="font-headline font-bold uppercase text-base leading-tight">{ed.label}</p>
              </div>
              <a
                href={ed.url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`link-past-edition-${ed.vol}`}
                className="flex-shrink-0 border border-black px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
              >
                Open PDF
              </a>
            </div>
          ))}
        </div>

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

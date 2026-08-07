import { useEffect } from "react";
import { Link } from "wouter";

export default function CwMorgue() {
  useEffect(() => {
    document.title = "From the Morgue | Los Angeles Crime Wire";
  }, []);

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire · Section 9</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">From the Morgue</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          Archival material — historical crime reporting, primary source documents, and throwback cases
          from the Los Angeles record. The morgue does not forget.
        </p>
      </header>

      <div className="border border-dashed border-black py-20 text-center">
        <p className="font-headline font-bold text-2xl uppercase tracking-widest text-gray-400 mb-3">
          Archive Intake
        </p>
        <p className="font-serif italic text-sm text-gray-500 max-w-sm mx-auto mb-6">
          Archival entries run in Section 9 of the print edition.
          A public index of historical Crime Wire content will appear here as the archive builds.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Historical Reporting · Primary Sources · Cold Case Chronology
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-black">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
          Browse the full archive: <Link href="/crime-wire/archive" className="underline hover:text-black">Crime Wire Archive</Link>
        </p>
      </div>
    </div>
  );
}

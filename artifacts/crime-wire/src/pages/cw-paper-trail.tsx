import { useEffect } from "react";
import { Link } from "wouter";

export default function CwPaperTrail() {
  useEffect(() => {
    document.title = "Paper Trail | Los Angeles Crime Wire";
  }, []);

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire · Section 6</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Paper Trail</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          Document analysis, FOIA requests, public records requests, and source chain notes.
          The Paper Trail section runs in every issue of the Crime Wire.
        </p>
      </header>

      <div className="border border-dashed border-black py-20 text-center">
        <p className="font-headline font-bold text-2xl uppercase tracking-widest text-gray-400 mb-3">
          Record Pending
        </p>
        <p className="font-serif italic text-sm text-gray-500 max-w-sm mx-auto mb-6">
          Paper Trail entries for this issue are in the print edition (Section 6).
          A public records index will be built here as document sets are logged.
        </p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
          FOIA · Public Records · Document Analysis · Source Chain
        </p>
      </div>

      <div className="mt-12 pt-6 border-t border-black">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
          Have a document lead? <Link href="/crime-wire/reader-desk" className="underline hover:text-black">Submit to the Reader Desk</Link>
        </p>
      </div>
    </div>
  );
}

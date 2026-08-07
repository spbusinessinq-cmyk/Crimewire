import { useEffect } from "react";
import { Link } from "wouter";

export default function CwMarket() {
  useEffect(() => {
    document.title = "Market Page | Los Angeles Crime Wire";
  }, []);

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Market Page</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          Section 12 of the Los Angeles Crime Wire. Period-style classified advertisements and community notices.
          All advertising is disclosed. No advertiser influences editorial content.
        </p>
      </header>

      {/* Empty state — honest */}
      <div className="border border-dashed border-black py-20 text-center">
        <p className="font-headline font-bold text-2xl uppercase tracking-widest text-gray-400 mb-3">
          Classified Archive Intake
        </p>
        <p className="font-serif italic text-sm text-gray-500 max-w-sm mx-auto mb-6">
          No advertisers are on file. The Market Page launches with the next scheduled print run.
          Classifieds will be styled in the 1940s Los Angeles broadsheet format.
        </p>
        <div className="border-t border-gray-200 pt-6 mt-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Advertising Disclosure</p>
          <p className="text-xs font-serif text-gray-500 max-w-sm mx-auto">
            All advertisements in the Los Angeles Crime Wire are clearly labeled as paid placements.
            Advertisers do not select, review, or influence editorial content.
            The Market Page is the only section that carries advertising.
          </p>
        </div>
      </div>

      <div className="mt-10 pt-8 border-t border-black text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Advertising inquiries: <Link href="/crime-wire/reader-desk" className="underline hover:text-black">Reader Desk — Letter to the Desk</Link>
        </p>
      </div>
    </div>
  );
}

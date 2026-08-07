import { useEffect } from 'react';
import { Link } from 'wouter';

export default function CaseFiles() {
  useEffect(() => {
    document.title = "Case Files | RSR Crime Division — Los Angeles";
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
      
      {/* Header */}
      <header className="mb-16 border-b border-black pb-8">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 block">
          Public Case Documentation
        </span>
        <h1 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest mb-6">
          Case Files
        </h1>
        <p className="text-base font-serif max-w-2xl text-gray-600">
          RSR Crime Division maintains public case files for active and archived investigations. Files are updated as the record develops.
        </p>
      </header>

      <div className="flex flex-col gap-16">
        
        {/* BDH-002 */}
        <section className="border-4 border-black p-6 sm:p-10 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <header className="border-b-2 border-black pb-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
              <div>
                <span className="text-sm font-bold uppercase tracking-widest text-gray-500 block mb-1">
                  BDH-002
                </span>
                <h2 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-wider">
                  The Black Dahlia
                </h2>
              </div>
              <div className="flex gap-3">
                <span className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 flex items-center justify-center">
                  Open
                </span>
                <span className="border border-black text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 flex items-center justify-center">
                  Active Investigation
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between text-[11px] font-bold uppercase tracking-widest text-gray-600 gap-2 mt-4 sm:mt-0">
              <span>File Opened: 1947 (Reopened {new Date().getFullYear()})</span>
              <span>Latest Update: Biltmore exit question active. Olive Street thread open.</span>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-7 font-serif text-lg leading-relaxed text-gray-800">
              <h3 className="font-headline font-bold text-2xl uppercase tracking-widest mb-6 text-black">
                The Missing Exit
              </h3>
              <p className="mb-6">
                <span className="float-left text-5xl font-serif leading-[0.8] pr-2 pt-1 font-bold text-black">T</span>he Biltmore Hotel on South Grand Avenue is the last location in Elizabeth Short's known movement record that rests on reasonably firm contemporary ground. What the documentary record shows: she was seen in the lobby on the evening of January 9, 1947. Beyond that, the file becomes contested territory.
              </p>
              <p className="mb-6">
                The working documentary floor — active research files, not institutional memory — reports an Olive Street exit and movement south around 10 p.m. that night. This lead is open: it has not been confirmed against a contemporaneous named source, but it is the current best-supported directional thread in the exit question.
              </p>
              <p className="mb-6">
                A separate chain — drawn from Biltmore institutional oral history — describes a former doorman who recalled a waiting cab on the night. That account is noted in the record but remains unverified: neither the doorman's name nor the original record have been produced. It is held as an unconfirmed institutional memory, not an established fact.
              </p>
              <p className="mb-6">
                These are two distinct leads, and they are tracked separately. The working exit thread (Olive Street, south, ~10 p.m.) and the institutional cab account are not merged in the file.
              </p>
              <p>
                A separate transportation lead, dated January 11 — involving Sixth and Main — is tracked independently and is not part of the Biltmore exit question.
              </p>
            </div>
            
            <div className="md:col-span-5 flex flex-col gap-6">
              <div className="bg-gray-50 border border-black p-6">
                <h4 className="font-sans font-bold text-sm uppercase tracking-widest border-b border-black pb-3 mb-4 text-black">
                  What the File Actually Says
                </h4>
                <ul className="space-y-4 text-sm font-serif list-none text-gray-800">
                  <li className="flex gap-3">
                    <span className="font-bold text-black">I.</span>
                    <span>The Biltmore is the last strong location in the known movement record.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-black">II.</span>
                    <span>The working documentary floor reports an Olive Street exit and movement south, ~10 p.m., January 9. This lead is active and unconfirmed.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-black">III.</span>
                    <span>A separate Biltmore oral-history chain describes a doorman and waiting cab. Named source and original record are not in evidence. This is noted but not established.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-black">IV.</span>
                    <span>The January 11 Sixth and Main transportation lead is tracked separately.</span>
                  </li>
                </ul>
              </div>
              
              <Link href="/crime-wire" className="w-full bg-black text-white text-center py-4 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors mt-auto">
                Read in Crime Wire →
              </Link>
            </div>
          </div>
        </section>

        {/* Other Cases */}
        <section>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4 block">
            Additional Files
          </span>
          <div className="border border-dashed border-gray-400 bg-gray-50 p-12 text-center flex flex-col items-center justify-center min-h-[200px]">
            <span className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 mb-4">
              Case Desk Pending
            </span>
            <span className="font-serif text-gray-600">
              No additional public case files at this time.
            </span>
          </div>
        </section>
        
      </div>
    </div>
  );
}

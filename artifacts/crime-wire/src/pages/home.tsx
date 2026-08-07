import { useEffect } from 'react';
import { Link } from 'wouter';

export default function Home() {
  useEffect(() => {
    document.title = "RSR Crime Division — Los Angeles";
  }, []);

  return (
    <div className="w-full">
      {/* Hero / Masthead */}
      <div className="bg-black text-white w-full py-16 px-4 sm:px-6 lg:px-8 border-b-4 border-black">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-gray-400">
            RSR Crime Division · Established
          </span>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-headline font-extrabold uppercase tracking-widest mb-4 leading-none">
            RSR Crime Division
          </h1>
          <h2 className="text-xl sm:text-2xl font-sans font-bold uppercase tracking-[0.3em] mb-8 text-gray-300">
            The Bureau — Los Angeles
          </h2>
          <p className="font-serif italic text-lg sm:text-xl text-gray-400 max-w-2xl">
            "Victim first. Facts second. Theories last."
          </p>
          <div className="w-full max-w-md h-[1px] bg-gray-700 mt-12"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 flex flex-col gap-16 lg:gap-24">
        
        {/* Primary Investigation Feature */}
        <section>
          <div className="flex flex-col gap-2 mb-8">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
              Active Investigation · BDH-002
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <h2 className="text-5xl sm:text-6xl font-headline font-bold uppercase tracking-wider leading-none">
                The Black Dahlia
              </h2>
              <span className="bg-black text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 mt-1 sm:mt-0">
                Open
              </span>
            </div>
            <p className="font-serif italic text-xl mt-4 max-w-3xl">
              The Biltmore Hotel and the last confirmed location in the known movement record.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-7 font-serif text-lg leading-relaxed">
              <p className="mb-6">
                <span className="float-left text-5xl font-serif leading-[0.8] pr-2 pt-1 font-bold">T</span>he Biltmore Hotel on South Grand Avenue is the last location in Elizabeth Short's known movement record that rests on reasonably firm contemporary ground. What the documentary record shows: she was seen in the lobby on the evening of January 9, 1947. Beyond that, the file becomes contested territory.
              </p>
              <p className="mb-8">
                The working documentary floor — active research files, not institutional memory — reports an Olive Street exit and movement south around 10 p.m. that night. This lead is open: it has not been confirmed against a contemporaneous named source, but it is the current best-supported directional thread in the exit question.
              </p>
              <Link href="/case-files" className="inline-block border-b-2 border-black font-sans font-bold uppercase tracking-widest text-sm pb-1 hover:text-gray-600 transition-colors">
                View Case File →
              </Link>
            </div>
            
            <div className="lg:col-span-5 bg-gray-50 border border-black p-6 sm:p-8 flex flex-col">
              <h3 className="font-sans font-bold text-sm uppercase tracking-widest border-b border-black pb-4 mb-4">
                What the File Says
              </h3>
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
              
              <div className="mt-8 pt-6 border-t border-black text-center">
                <p className="font-serif italic font-bold text-lg">
                  "A red string is not evidence."
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <Link href="/case-files" className="w-full bg-black text-white text-center py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                  View Case File
                </Link>
                <Link href="/crime-wire" className="w-full border border-black text-center py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors">
                  Read Crime Wire
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Most Recent Development */}
        <section className="border-t border-black pt-12">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 block mb-6">
            Latest File Update
          </span>
          <div className="border border-dashed border-gray-400 bg-gray-50 p-12 text-center flex items-center justify-center min-h-[200px]">
            <span className="font-sans font-bold uppercase tracking-widest text-sm text-gray-500">
              Case Update Pending · Check back Thursday
            </span>
          </div>
        </section>

        {/* Entry Points Grid */}
        <section className="border-t border-black pt-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: 'Case Files', desc: 'Public case documentation and investigation records', href: '/case-files' },
              { title: 'City Desk', desc: 'Current Los Angeles crime reporting', href: '/city-desk' },
              { title: 'Crime Wire', desc: 'The weekly investigative newspaper', href: '/crime-wire' },
              { title: 'Reader Desk', desc: 'Submit tips, corrections and correspondence', href: '/reader-desk' },
            ].map((card) => (
              <Link key={card.href} href={card.href} className="group border border-black p-6 flex flex-col h-full hover:bg-black hover:text-white transition-colors">
                <h3 className="font-headline font-bold text-2xl uppercase tracking-wider mb-3">
                  {card.title}
                </h3>
                <p className="font-serif text-sm flex-1 opacity-80 group-hover:opacity-100 mb-8">
                  {card.desc}
                </p>
                <div className="mt-auto self-start text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  Enter <span className="text-lg leading-none">→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Crime Wire Issue Feature */}
        <section className="border-t-4 border-black pt-12 mb-12">
          <div className="text-center flex flex-col items-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4 block">
              This Week In Crime Wire
            </span>
            <div className="w-full max-w-3xl border border-black bg-white p-10 sm:p-16 flex flex-col items-center gap-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-headline font-bold text-3xl sm:text-4xl uppercase tracking-widest">
                Latest Edition Coming Thursday
              </span>
              <Link href="/crime-wire" className="bg-black text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                Join the Thursday Drop
              </Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

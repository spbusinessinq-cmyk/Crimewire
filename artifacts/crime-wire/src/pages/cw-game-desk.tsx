import { useEffect } from "react";
import { Link } from "wouter";

const GAMES = [
  {
    id: "crossword",
    title: "The Crime Wire Crossword",
    desc: "A 15×15 crossword built from Los Angeles crime history, court vocabulary, investigative terminology, and Black Dahlia case lore. Clues range from straight definitions to noir misdirection.",
    status: "COMING NEXT THURSDAY",
    note: "The crossword runs in Section 10 of the paper alongside the Shell Shocker. An interactive version is in development.",
  },
  {
    id: "shell-shocker",
    title: "Shell Shocker",
    desc: "The cycle's most staggering verified crime story — sourced, documented, and stranger than fiction. Selected each week from active case files, court records, and archival reports.",
    status: "IN EACH ISSUE",
    note: "Shell Shocker appears in Section 10 alongside the crossword and weekly trivia clues.",
  },
  {
    id: "wirehunt",
    title: "Wire Hunt",
    desc: "A weekly scavenger hunt hidden across the Crime Wire — in bylines, issue metadata, classified ads, and the archive. First confirmed correct submission wins a mention in the following issue.",
    status: "ARCHIVE INTAKE",
    note: "The Wire Hunt is active in the print edition. Submit your answer via the Reader Desk.",
    cta: { label: "Submit Wire Hunt Answer →", href: "/crime-wire/reader-desk" },
  },
  {
    id: "trivia",
    title: "Live Trivia — The Bureau Room",
    desc: "Monthly live-trivia event built around Los Angeles crime history, cold cases, and investigative journalism. Hosted in coordination with the Press Club.",
    status: "DATE PENDING",
    note: "Next event date will be announced via the Thursday Drop. Join the mailing list to be notified.",
    cta: { label: "Join Thursday Drop →", href: "/crime-wire" },
  },
];

export default function CwGameDesk() {
  useEffect(() => {
    document.title = "Shell Shocker & Crossword | Los Angeles Crime Wire";
  }, []);

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire · Section 10</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Shell Shocker &amp; Crossword</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          The cycle's most staggering verified crime story. The case-file crossword, weekly trivia, and the Wire Hunt.
          Print-edition content ships in Section 10.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {GAMES.map((game) => (
          <div key={game.id} className="border-2 border-black p-6 flex flex-col">
            <div className="mb-4 pb-3 border-b border-black flex items-start justify-between gap-3">
              <h3 className="font-headline font-bold text-xl uppercase leading-tight">{game.title}</h3>
              <span className="text-[8px] font-bold uppercase tracking-widest bg-gray-100 border border-gray-300 px-2 py-1 whitespace-nowrap flex-shrink-0">
                {game.status}
              </span>
            </div>
            <p className="font-serif text-sm text-gray-700 leading-relaxed mb-4 flex-1">{game.desc}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">{game.note}</p>
            {game.cta && (
              <Link
                href={game.cta.href}
                className="text-xs font-bold uppercase tracking-widest border-b-2 border-black pb-0.5 hover:text-gray-600 transition-colors"
              >
                {game.cta.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 border-t border-black pt-8">
        <div className="border border-dashed border-black p-6 text-center">
          <p className="font-headline font-bold text-lg uppercase tracking-widest text-gray-500 mb-2">Puzzle Answer Submission</p>
          <p className="font-serif text-sm text-gray-600 mb-4">Submit crossword answers, Wire Hunt entries, and puzzle corrections via the Reader Desk.</p>
          <Link
            href="/crime-wire/reader-desk"
            className="inline-block border-2 border-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
          >
            Go to Reader Desk →
          </Link>
        </div>
      </div>
    </div>
  );
}

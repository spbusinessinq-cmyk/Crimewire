import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";

const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const subscriptionSchema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().optional(),
  zip: z.string().optional().refine(val => !val || /^\d{5}$/.test(val), "Must be a 5-digit zip code if provided"),
  editionType: z.enum(["digital", "mailed", "both"]),
  consent: z.literal(true, {
    errorMap: () => ({ message: "You must agree to receive the weekly edition." })
  })
});

type SubscriptionForm = z.infer<typeof subscriptionSchema>;

interface Issue {
  id: number;
  volume: number;
  number: string;
  title: string;
  tagline: string | null;
  headline: string | null;
  description: string | null;
  pdfUrl: string | null;
  pageCount: number;
  status: string;
  publishDate: string | null;
}

const TWELVE_SECTIONS = [
  { num: 1,  title: "Front Page / The Lead",    desc: "Lead investigation and principal headline — the primary story of the issue, bylined and sourced." },
  { num: 2,  title: "Main Investigation",        desc: "Continuation, reporting, and primary source chain for the running investigation." },
  { num: 3,  title: "Secondary Evidence",        desc: "Competing account, additional lead, or supporting evidence chain. Separate from the main case." },
  { num: 4,  title: "City Page",                 desc: "Los Angeles crime briefs and incident reporting: arrests, sentencing, and local court filings." },
  { num: 5,  title: "Courts & Records",          desc: "Filings, hearings, sentencing, and public records. Formal case status and verdicts." },
  { num: 6,  title: "Paper Trail",               desc: "Documents, FOIA work, timelines, and source analysis. Records requests and chain of custody." },
  { num: 7,  title: "Bureau Case Desk",          desc: "Active, developing, and pending Crime Division investigations. Cold case updates and file re-openings." },
  { num: 8,  title: "From the Morgue",           desc: "Archival highlights, throwbacks, and then-versus-now reporting from the historical record." },
  { num: 9,  title: "Reader Desk & Press Club",  desc: "Letters, community spotlight, Ask the Desk, tips, and Press Club membership." },
  { num: 10, title: "Shell Shocker & Crossword",  desc: "The cycle's most staggering verified crime story alongside the case-file crossword, trivia, and weekly clues." },
  { num: 11, title: "Ink & Alibi",               desc: "Recurring comic, Wire Hunt, and reader artwork." },
  { num: 12, title: "Market Page",               desc: "Vintage-style advertisements, Morning Joe comic, and Press Club QR." },
];

export default function CrimeWire() {
  useEffect(() => {
    document.title = "Los Angeles Crime Wire — Independent Weekly | RSR Crime Division";
  }, []);

  const [subSuccess, setSubSuccess] = useState(false);
  const [subDuplicate, setSubDuplicate] = useState(false);
  const [latestIssue, setLatestIssue] = useState<Issue | null>(null);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    Promise.all([
      fetch(`${base}/api/issues/latest`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${base}/api/issues`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([latest, all]) => {
      setLatestIssue(latest);
      setAllIssues(Array.isArray(all) ? all : []);
      setIssuesLoading(false);
    });
  }, []);

  const subForm = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      email: "",
      name: "",
      zip: "",
      editionType: "digital",
      // @ts-ignore
      consent: false
    }
  });

  const [subLoading, setSubLoading] = useState(false);

  const onSubSubmit = async (data: SubscriptionForm) => {
    setSubDuplicate(false);
    setSubLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          name: data.name || null,
          zip: data.zip || null,
          editionType: data.editionType,
          consent: data.consent,
        }),
      });
      if (res.ok) {
        setSubSuccess(true);
        subForm.reset();
      } else if (res.status === 409) {
        setSubDuplicate(true);
      }
    } catch { /* network error */ }
    finally { setSubLoading(false); }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Build archive list: all published + archived issues ordered by publishDate desc
  const archiveIssues = [...allIssues].sort((a, b) => {
    const da = a.publishDate ? new Date(a.publishDate).getTime() : 0;
    const db_ = b.publishDate ? new Date(b.publishDate).getTime() : 0;
    return db_ - da;
  });

  return (
    <div className="w-full bg-white text-black min-h-[100dvh]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">

        {/* Masthead */}
        <header className="text-center mb-12 border-b-4 border-black pb-8">
          <div className="w-full border-t-4 border-black mb-6"></div>
          <div className="mb-4">
            <h2 className="text-sm sm:text-base font-headline uppercase tracking-[0.4em] mb-2 font-bold">
              Los Angeles
            </h2>
            <h1 className="text-[80px] sm:text-[100px] md:text-[130px] font-display uppercase tracking-normal leading-[0.85] text-black">
              Crime Wire
            </h1>
          </div>

          <div className="flex flex-col items-center gap-4 mt-8">
            <div className="w-full border-t border-b border-black py-3 px-4 flex flex-col sm:flex-row justify-center items-center text-xs font-bold uppercase tracking-widest gap-4 sm:gap-6">
              <span>Independent Crime and Investigative Weekly</span>
              <span className="hidden sm:inline">·</span>
              <span>Published Every Thursday</span>
            </div>

            <div className="w-full h-[60px] max-w-lg mx-auto opacity-90 overflow-hidden flex justify-center mt-2">
              <svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMax meet" className="w-full h-full fill-black">
                <path d="M0,60 L0,50 L20,50 L20,40 L30,40 L30,30 L45,30 L45,45 L60,45 L60,20 L80,20 L80,10 L95,10 L95,25 L115,25 L115,15 L125,15 L125,35 L145,35 L145,5 L165,5 L165,25 L180,25 L180,45 L195,45 L195,20 L210,20 L210,35 L225,35 L225,15 L245,15 L245,40 L260,40 L260,25 L280,25 L280,10 L300,10 L300,30 L320,30 L320,45 L340,45 L340,20 L355,20 L355,35 L370,35 L370,50 L390,50 L390,40 L400,40 L400,60 Z" />
                <path d="M50,60 L52,40 M48,42 L52,40 L56,42 M50,38 L52,40 L54,38" stroke="black" strokeWidth="1" />
                <path d="M330,60 L328,35 M324,38 L328,35 L332,38 M326,32 L328,35 L330,32" stroke="black" strokeWidth="1" />
              </svg>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-12 mt-4">
              <span className="font-serif italic text-sm text-gray-700 font-bold">Victim first. Facts second. Theories last.</span>
              <span className="font-serif italic text-sm text-gray-700 font-bold">A red string is not evidence.</span>
            </div>
          </div>
        </header>

        {/* Section navigation strip */}
        <nav className="mb-10 border-t border-b border-black py-3 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max mx-auto justify-center flex-wrap gap-y-2">
            {[
              { href: "/crime-wire/archive", label: "Archive" },
              { href: "/crime-wire/reader-desk", label: "Reader Desk" },
              { href: "/crime-wire/press-club", label: "Press Club" },
              { href: "/crime-wire/ink-and-alibi", label: "Ink & Alibi" },
              { href: "/crime-wire/corrections", label: "Corrections" },
              { href: "/crime-wire/market", label: "Market Page" },
              { href: "/edition", label: "Current Edition" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-black hover:bg-black hover:text-white transition-colors whitespace-nowrap"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          <div className="lg:col-span-8 flex flex-col gap-12">

            {/* Latest Edition Area */}
            <section>
              <h3 className="font-headline font-bold text-2xl uppercase tracking-widest border-b border-black pb-2 mb-6">
                Latest Edition
              </h3>
              {issuesLoading ? (
                <div className="border-4 border-black p-10 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Loading edition record…</p>
                </div>
              ) : latestIssue ? (
                <div className="border-4 border-black bg-white">
                  <div className="border-b-2 border-black px-6 py-3 flex items-center justify-between">
                    <span className="font-sans font-bold uppercase tracking-widest text-[10px] text-gray-500">
                      Los Angeles Crime Wire · {latestIssue.publishDate ? new Date(latestIssue.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Current Issue"}
                    </span>
                    <span className="font-sans font-bold uppercase tracking-widest text-[10px] bg-black text-white px-2 py-0.5">Current</span>
                  </div>
                  <div className="p-8 sm:p-10">
                    <div className="mb-1">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                        Vol. {latestIssue.volume} · {latestIssue.number}
                      </span>
                    </div>
                    <h4 className="font-headline font-bold text-3xl sm:text-4xl uppercase leading-tight mb-2">
                      {latestIssue.title}
                    </h4>
                    <p className="font-serif italic text-gray-700 text-base mb-8">
                      {latestIssue.description || latestIssue.tagline}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {latestIssue.pdfUrl ? (
                        <a
                          href={latestIssue.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-black text-white border-2 border-black py-4 px-6 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors text-center"
                        >
                          Read the Latest Edition
                        </a>
                      ) : (
                        <span className="flex-1 bg-gray-100 border-2 border-black py-4 px-6 text-xs font-bold uppercase tracking-widest text-gray-500 text-center">
                          PDF Not Yet Available
                        </span>
                      )}
                      <button
                        onClick={() => scrollToSection("subscribe")}
                        className="flex-1 border-2 border-black bg-white py-4 px-6 text-xs font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors"
                      >
                        Join The Thursday Drop
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-4 border-black p-10 text-center">
                  <p className="font-headline font-bold text-xl uppercase tracking-widest text-gray-500 mb-2">Next Issue Incoming</p>
                  <p className="font-serif italic text-sm text-gray-600">The next edition publishes this Thursday.</p>
                </div>
              )}
            </section>

            {/* Archive */}
            <section>
              <div className="flex items-center justify-between border-b border-black pb-2 mb-6">
                <h3 className="font-headline font-bold text-2xl uppercase tracking-widest">Archive</h3>
                <Link href="/crime-wire/archive" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors">
                  Full Archive →
                </Link>
              </div>
              {issuesLoading ? (
                <div className="py-8 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading archive…</p>
                </div>
              ) : archiveIssues.length === 0 ? (
                <div className="border border-dashed border-black p-8 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">No issues in archive</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-black border border-black">
                  {archiveIssues.map((ed) => (
                    <div key={ed.id} className="flex items-start justify-between gap-6 px-5 py-4 hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">Vol. {ed.volume} · {ed.number}</span>
                          {ed.publishDate && (
                            <>
                              <span className="font-sans text-[9px] font-bold text-gray-400">·</span>
                              <span className="font-sans text-[9px] font-bold uppercase tracking-[0.2em] text-gray-400">
                                {new Date(ed.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                              </span>
                            </>
                          )}
                          {ed.status === "published" && (
                            <span className="text-[8px] font-bold uppercase tracking-widest bg-black text-white px-1.5 py-0.5">Current</span>
                          )}
                        </div>
                        <p className="font-headline font-bold text-lg uppercase leading-tight">{ed.title}</p>
                        {ed.description && <p className="font-serif text-xs text-gray-600 mt-1 leading-snug">{ed.description}</p>}
                      </div>
                      {ed.pdfUrl && (
                        <a
                          href={ed.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 border border-black px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors whitespace-nowrap self-center"
                        >
                          Open PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          <div className="lg:col-span-4 flex flex-col gap-8">

            {/* Subscription Form */}
            <div id="subscribe" className="border-4 border-black p-6 bg-white">
              <div className="border-b-2 border-black pb-4 mb-6">
                <h3 className="text-2xl font-serif font-bold uppercase tracking-wide mb-2">
                  The Thursday Drop
                </h3>
                <p className="text-sm font-serif italic text-gray-800">
                  Digital edition delivered every Thursday. Mailed copies: waitlist only — no payment taken.
                </p>
              </div>

              {subSuccess ? (
                <div className="text-center py-8">
                  <div className="inline-flex justify-center items-center w-16 h-16 border-2 border-black mb-4">
                    <CheckIcon />
                  </div>
                  <h4 className="text-xl font-bold uppercase tracking-widest mb-2">Recorded</h4>
                  <p className="text-sm font-serif">Your signup has been logged. Watch your inbox this Thursday.</p>
                  <button
                    onClick={() => setSubSuccess(false)}
                    className="mt-6 text-xs uppercase tracking-widest font-bold underline"
                  >
                    Register Another
                  </button>
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <form onSubmit={subForm.handleSubmit(onSubSubmit as any)} className="space-y-4">
                  {subDuplicate && (
                    <div className="bg-black text-white p-3 text-xs font-bold uppercase tracking-wider text-center">
                      This address is already on the list.
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1">Email Address *</label>
                    <input
                      type="email"
                      {...subForm.register("email")}
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    {subForm.formState.errors.email && (
                      <p className="text-xs text-red-600 font-bold mt-1 uppercase">{subForm.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1">Name / Alias</label>
                    <input
                      type="text"
                      {...subForm.register("name")}
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1">LA ZIP Code (Optional)</label>
                    <input
                      type="text"
                      {...subForm.register("zip")}
                      placeholder="e.g. 90014"
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black placeholder:text-gray-400"
                    />
                    {subForm.formState.errors.zip && (
                      <p className="text-xs text-red-600 font-bold mt-1 uppercase">{subForm.formState.errors.zip.message}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2">Edition Preference</label>
                    <div className="space-y-3">
                      {[
                        { id: "digital", label: "Digital Edition" },
                        { id: "mailed", label: "Mailed Copy — Waitlist Only" },
                        { id: "both", label: "Both (Digital + Waitlist)" }
                      ].map((opt) => (
                        <label key={opt.id} className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center justify-center pt-0.5">
                            <input
                              type="radio"
                              value={opt.id}
                              {...subForm.register("editionType")}
                              className="peer sr-only"
                            />
                            <div className="w-4 h-4 border-2 border-black rounded-none peer-checked:bg-black transition-all"></div>
                          </div>
                          <span className="text-sm font-serif">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-5 mt-2 border-t border-black">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="relative pt-0.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          {...subForm.register("consent")}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black flex items-center justify-center text-white">
                          <svg className="w-3 h-3 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-[11px] font-serif leading-tight text-gray-700">
                        I agree to receive the Crime Wire Thursday Drop by email. I can unsubscribe at any time. No payment required.
                      </span>
                    </label>
                    {subForm.formState.errors.consent && (
                      <p className="text-xs text-red-600 font-bold mt-2 uppercase">{subForm.formState.errors.consent.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={subLoading}
                    className="w-full bg-black text-white py-4 mt-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {subLoading ? "Transmitting..." : "Subscribe"}
                  </button>
                </form>
              )}
            </div>

            {/* Press Club */}
            <div className="border-2 border-black p-6 bg-gray-50">
              <h4 className="text-sm font-bold uppercase tracking-[0.15em] border-b border-black pb-3 mb-4">
                Press Club
              </h4>
              <p className="font-serif text-sm mb-4 text-gray-800">
                Support the paper. Join as a Press Club member, Founding Supporter, or join the print waitlist.
              </p>
              <Link
                href="/crime-wire/press-club"
                className="inline-block w-full text-center border-2 border-black px-4 py-3 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors"
              >
                Join Press Club
              </Link>
            </div>

            {/* Corrections shortcut */}
            <div className="border-2 border-black p-6 bg-gray-50 text-center">
              <h4 className="text-sm font-bold uppercase tracking-[0.1em] border-b border-black pb-3 mb-4">
                Corrections
              </h4>
              <p className="font-serif text-sm mb-4">
                Corrections are published openly with the original error and the correction on record.
              </p>
              <Link
                href="/crime-wire/corrections"
                className="inline-block border-b-2 border-black text-xs font-bold uppercase tracking-widest pb-1 hover:text-gray-600 transition-colors"
              >
                View Corrections Log
              </Link>
            </div>

          </div>
        </div>

        {/* What's In The Paper — 12 sections */}
        <section className="mt-20 border-t-2 border-black pt-16">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-headline font-bold uppercase tracking-widest mb-3">What's in the Paper</h2>
            <p className="text-xs uppercase tracking-widest font-bold text-gray-500">TWELVE PAGES, EVERY THURSDAY. ONE COHESIVE NEWSPAPER.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-y-10 gap-x-6 border-b-2 border-black pb-16">
            {TWELVE_SECTIONS.map((section) => (
              <div key={section.num} className="border-l-2 border-black pl-4 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest mb-2 text-gray-500">Page {section.num}</span>
                <h4 className="font-serif font-bold text-lg mb-2 leading-tight">{section.title}</h4>
                <p className="text-xs font-sans text-gray-700 leading-relaxed">{section.desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-4xl mx-auto text-center py-16 font-serif text-2xl leading-relaxed italic text-gray-800">
            "Crime Wire is a single cohesive weekly newspaper — not a podcast, not a newsletter, not a true-crime blog. The Black Dahlia investigation runs alongside current Los Angeles crime, court records, reader tips, puzzles, and genuine vintage-style classified advertisements. Nostalgia is the medium. Accountability is the mission."
          </div>
        </section>

        {/* How to Get It */}
        <section className="mt-8 border-t border-black pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="px-6 py-4 md:py-0">
              <h4 className="text-2xl font-headline font-bold uppercase tracking-widest mb-4">Digital Edition</h4>
              <p className="text-sm font-serif mb-6 text-gray-700">Read on screen or print at home. Formatted for standard letter paper.</p>
              <button onClick={() => scrollToSection("subscribe")} className="border-b-2 border-black text-xs font-bold uppercase tracking-widest pb-1 hover:bg-black hover:text-white transition-colors">Subscribe</button>
            </div>

            <div className="px-6 py-4 md:py-0">
              <h4 className="text-2xl font-headline font-bold uppercase tracking-widest mb-4">Mailed Copy</h4>
              <p className="text-sm font-serif mb-6 text-gray-700">Waitlist only. No payment taken. Priority to founding supporters and LA zip codes.</p>
              <Link href="/crime-wire/press-club" className="border-b-2 border-black text-xs font-bold uppercase tracking-widest pb-1 hover:bg-black hover:text-white transition-colors">Join Print Waitlist</Link>
            </div>

            <div className="px-6 py-4 md:py-0 flex flex-col items-center">
              <h4 className="text-2xl font-headline font-bold uppercase tracking-widest mb-6">Street Sheet QR</h4>
              <div className="w-32 h-32 border-4 border-black flex items-center justify-center mb-4 bg-gray-50">
                <div className="text-center">
                  <span className="font-bold text-2xl tracking-widest uppercase block">QR</span>
                  <Link href="/edition" className="text-[8px] font-bold uppercase tracking-widest text-gray-600 block mt-1">→ /edition</Link>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 text-center">Scan this code for the current edition</p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

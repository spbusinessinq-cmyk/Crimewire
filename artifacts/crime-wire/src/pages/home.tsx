import { useState, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeSVG } from "qrcode.react";

const EDITION_URL = import.meta.env.VITE_EDITION_URL || "";

// Icons (SVG inline for pure styling, no lucide generic icons unless simple)
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

const tipSchema = z.object({
  nameOrAlias: z.string().optional(),
  contactEmail: z.string().email("Valid email required for contact, or leave blank").optional().or(z.literal("")),
  message: z.string().min(10, "Message must be at least 10 characters"),
  provenance: z.string().optional(),
});

type SubscriptionForm = z.infer<typeof subscriptionSchema>;
type TipForm = z.infer<typeof tipSchema>;

export default function Home() {
  const [subSuccess, setSubSuccess] = useState(false);
  const [subDuplicate, setSubDuplicate] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  const subForm = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      email: "",
      name: "",
      zip: "",
      editionType: "digital",
      // @ts-ignore - react-hook-form wants a boolean, literal true is hard to set default for
      consent: false
    }
  });

  const tipForm = useForm<TipForm>({
    resolver: zodResolver(tipSchema),
    defaultValues: {
      nameOrAlias: "",
      contactEmail: "",
      message: "",
      provenance: ""
    }
  });

  const [subLoading, setSubLoading] = useState(false);
  const [tipLoading, setTipLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

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
    } catch { /* network error — form stays open */ }
    finally { setSubLoading(false); }
  };

  const onTipSubmit = async (data: TipForm) => {
    setTipLoading(true);
    try {
      const res = await fetch('/api/tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.nameOrAlias || null,
          contactEmail: data.contactEmail || null,
          message: data.message,
          source: data.provenance || null,
        }),
      });
      if (res.ok) {
        setTipSuccess(true);
        tipForm.reset();
      }
    } catch { /* silent */ }
    finally { setTipLoading(false); }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans w-full overflow-x-hidden selection:bg-black selection:text-white">
      
      {/* Top Banner */}
      <div className="w-full border-b border-black py-1 px-4 text-center">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-sans">
          RSR Crime Division Presents
        </span>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Masthead */}
        <header className="text-center mb-8 border-b-2 border-black pb-6">
          <div className="mb-2">
            <h2 className="text-sm sm:text-base font-serif uppercase tracking-[0.4em] mb-1">
              Los Angeles
            </h2>
            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display uppercase tracking-tight leading-none">
              Crime Wire
            </h1>
          </div>
          
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="w-full h-[60px] max-w-lg mx-auto opacity-90 mb-2 overflow-hidden flex justify-center">
              {/* Simple Skyline Silhouette SVG */}
              <svg viewBox="0 0 400 60" preserveAspectRatio="xMidYMax meet" className="w-full h-full fill-black">
                <path d="M0,60 L0,50 L20,50 L20,40 L30,40 L30,30 L45,30 L45,45 L60,45 L60,20 L80,20 L80,10 L95,10 L95,25 L115,25 L115,15 L125,15 L125,35 L145,35 L145,5 L165,5 L165,25 L180,25 L180,45 L195,45 L195,20 L210,20 L210,35 L225,35 L225,15 L245,15 L245,40 L260,40 L260,25 L280,25 L280,10 L300,10 L300,30 L320,30 L320,45 L340,45 L340,20 L355,20 L355,35 L370,35 L370,50 L390,50 L390,40 L400,40 L400,60 Z" />
                {/* Palm tree representations */}
                <path d="M50,60 L52,40 M48,42 L52,40 L56,42 M50,38 L52,40 L54,38" stroke="black" strokeWidth="1" />
                <path d="M330,60 L328,35 M324,38 L328,35 L332,38 M326,32 L328,35 L330,32" stroke="black" strokeWidth="1" />
              </svg>
            </div>
            
            <div className="w-full border-t border-b border-black py-2 px-4 flex flex-col sm:flex-row justify-between items-center text-xs font-bold uppercase tracking-widest gap-2">
              <span>Independent Crime and Investigative Weekly</span>
              <span className="hidden sm:inline">·</span>
              <span>Published Every Thursday</span>
              <span className="hidden sm:inline">·</span>
              <span>Free Digital Edition</span>
            </div>
          </div>
        </header>

        {/* Main Grid Layout - Newspaper Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative">
          
          {/* Main Article (Lead Story) */}
          <main className="lg:col-span-8">
            <article>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-black text-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest">
                    The Lead
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest border border-black px-2 py-1">
                    BDH-002 · The Black Dahlia Investigation
                  </span>
                </div>
                
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold leading-[1.1] mb-4 uppercase">
                  The Missing Exit
                </h2>
                
                <h3 className="text-xl sm:text-2xl font-serif italic text-gray-800 mb-6 leading-snug">
                  The Biltmore Hotel and the last confirmed location in the Black Dahlia movement record.
                </h3>
              </div>

              {/* Headline Image — collapses to a compact editorial line when no archival image is available */}
              <figure className="mb-8 border border-black p-1">
                {!imageError && (
                  <div className="aspect-[16/9] w-full bg-gray-100 overflow-hidden relative">
                    <img
                      src="/attached_assets/generated_images/biltmore.jpg"
                      alt="Biltmore Hotel exterior 1947"
                      className="w-full h-full object-cover object-center halftone"
                      onError={() => setImageError(true)}
                    />
                    <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none" />
                  </div>
                )}
                <figcaption className={`p-2 text-[10px] font-bold uppercase tracking-widest flex justify-between items-center${!imageError ? ' border-t border-black' : ''}`}>
                  <span>Biltmore Hotel · South Grand Avenue · 1947</span>
                  <span className={imageError ? 'text-gray-400 font-mono font-normal normal-case tracking-normal' : ''}>
                    {imageError ? 'Archival image — reference pending' : 'BDH-002 Archive'}
                  </span>
                </figcaption>
              </figure>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-serif text-base sm:text-lg leading-relaxed text-justify">
                <div>
                  <p className="mb-4">
                    <span className="float-left text-5xl font-serif leading-[0.8] pr-2 pt-1 font-bold">T</span>he Biltmore Hotel on South Grand Avenue is the last location in Elizabeth Short's known movement record that rests on reasonably firm contemporary ground. What the documentary record shows: she was seen in the lobby on the evening of January 9, 1947. Beyond that, the file becomes contested territory.
                  </p>
                  <p className="mb-4">
                    The working documentary floor — active research files, not institutional memory — reports an Olive Street exit and movement south around 10 p.m. that night. This lead is open: it has not been confirmed against a contemporaneous named source, but it is the current best-supported directional thread in the exit question.
                  </p>
                  <p className="mb-4">
                    A separate chain — drawn from Biltmore institutional oral history — describes a former doorman who recalled a waiting cab on the night. That account is noted in the record but remains unverified: neither the doorman's name nor the original record have been produced. It is held as an unconfirmed institutional memory, not an established fact.
                  </p>
                </div>
                <div>
                  <div className="border-t-2 border-b-2 border-black py-4 my-6 text-center">
                    <p className="text-xl font-serif italic font-bold">
                      "A red string is not evidence."
                    </p>
                  </div>
                  <p className="mb-4">
                    These are two distinct leads, and they are tracked separately. The working exit thread (Olive Street, south, ~10 p.m.) and the institutional cab account are not merged in the file.
                  </p>
                  <p className="mb-4">
                    A separate transportation lead, dated January 11 — involving Sixth and Main — is tracked independently and is not part of the Biltmore exit question.
                  </p>
                  <p className="text-sm font-bold mt-8 p-4 border border-black bg-gray-50 uppercase tracking-wide">
                    BDH-002 remains open. The Biltmore exit question is active. Sixth and Main, January 11, is a separate thread.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-col sm:flex-row gap-4 border-t border-black pt-8">
                {EDITION_URL ? (
                  <a
                    href={EDITION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 border-2 border-black py-4 px-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors text-center"
                  >
                    <span className="block mb-1">Read the Latest Edition</span>
                    <span className="block text-[10px] font-normal tracking-normal normal-case text-gray-600">Opens the current PDF edition</span>
                  </a>
                ) : (
                  <button
                    className="flex-1 border-2 border-black py-4 px-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-100 transition-colors relative group opacity-60 cursor-not-allowed"
                    disabled
                  >
                    <span className="block mb-1">Read the Latest Edition</span>
                    <span className="block text-[10px] font-normal tracking-normal normal-case text-gray-600">Edition coming — check back Thursday</span>
                  </button>
                )}
                <button 
                  onClick={() => scrollToSection("subscribe")}
                  className="flex-1 bg-black text-white border-2 border-black py-4 px-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                >
                  <span className="block mb-1">Join The Thursday Drop</span>
                  <span className="block text-[10px] font-normal tracking-normal normal-case text-gray-300">Free digital edition to your inbox</span>
                </button>
              </div>
            </article>
          </main>

          {/* Sidebar */}
          <aside className="lg:col-span-4 flex flex-col gap-8">
            
            {/* Subscription Form */}
            <div id="subscribe" className="border-4 border-black p-6 bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <div className="border-b-2 border-black pb-4 mb-6">
                <h3 className="text-2xl font-serif font-bold uppercase tracking-wide mb-2">
                  The Thursday Drop
                </h3>
                <p className="text-sm font-serif italic">
                  Free digital edition delivered every Thursday. Mailed copies: waitlist only — no payment taken.
                </p>
              </div>

              {subSuccess ? (
                <div className="text-center py-8">
                  <div className="inline-flex justify-center items-center w-16 h-16 border-2 border-black mb-4">
                    <CheckIcon />
                  </div>
                  <h4 className="text-xl font-bold uppercase tracking-widest mb-2">Confirmed</h4>
                  <p className="text-sm font-serif">Your name is on the list. Watch your inbox this Thursday.</p>
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
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
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
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-1">LA ZIP Code (Optional)</label>
                    <input 
                      type="text" 
                      {...subForm.register("zip")}
                      placeholder="e.g. 90014"
                      className="w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent placeholder:text-gray-400"
                    />
                    {subForm.formState.errors.zip && (
                      <p className="text-xs text-red-600 font-bold mt-1 uppercase">{subForm.formState.errors.zip.message}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2">Edition Preference</label>
                    <div className="space-y-2">
                      {[
                        { id: "digital", label: "Digital Edition (Free)" },
                        { id: "mailed", label: "Mailed Copy — Waitlist Only" },
                        { id: "both", label: "Both (Digital + Waitlist)" }
                      ].map((opt) => (
                        <label key={opt.id} className="flex items-start gap-2 cursor-pointer group">
                          <div className="relative flex items-center justify-center pt-0.5">
                            <input 
                              type="radio" 
                              value={opt.id}
                              {...subForm.register("editionType")}
                              className="peer sr-only" 
                            />
                            <div className="w-4 h-4 border-2 border-black rounded-none peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-black transition-all"></div>
                          </div>
                          <span className="text-sm font-serif group-hover:font-bold transition-all">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-black">
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
                      <span className="text-xs font-serif leading-tight text-gray-700">
                        I agree to receive the Crime Wire Thursday Drop by email. I understand this is a weekly publication and can unsubscribe at any time.
                      </span>
                    </label>
                    {subForm.formState.errors.consent && (
                      <p className="text-xs text-red-600 font-bold mt-2 uppercase">{subForm.formState.errors.consent.message}</p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={subLoading}
                    className="w-full bg-black text-white py-3 mt-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {subLoading ? "Transmitting..." : "Subscribe"}
                  </button>
                </form>
              )}
            </div>

            {/* Credo Box */}
            <div className="border border-black p-4 text-center">
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] border-b border-black pb-2 mb-3">
                Newsroom Policy
              </h4>
              <p className="font-serif text-lg font-bold italic leading-snug">
                "Victim first.<br/>Facts second.<br/>Theories last."
              </p>
            </div>

            {/* What the File Actually Says */}
            <div className="border-t-4 border-b-4 border-black py-6">
              <h3 className="text-xl font-bold uppercase tracking-wider mb-4 text-center border-b border-black pb-4">
                What the File Actually Says
              </h3>
              <ul className="space-y-3 text-sm font-serif list-none">
                <li className="flex gap-2">
                  <span className="font-bold">I.</span>
                  <span>The Biltmore is the last strong location in the known movement record.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">II.</span>
                  <span>The working documentary floor reports an Olive Street exit and movement south, ~10 p.m., January 9. This lead is active and unconfirmed.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">III.</span>
                  <span>A separate Biltmore oral-history chain describes a doorman and waiting cab. Named source and original record are not in evidence. This is noted but not established.</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">IV.</span>
                  <span>The January 11 Sixth and Main transportation lead is tracked separately.</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-black text-white text-xs font-bold uppercase tracking-widest text-center">
                Nothing in this section is represented as established fact. The file is open.
              </div>
            </div>

          </aside>
        </div>

        {/* Full width middle sections */}
        
        {/* What's In The Paper */}
        <section className="mt-16 border-t-2 border-black pt-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold uppercase tracking-widest mb-3">What's in the Paper</h2>
            <p className="text-sm uppercase tracking-widest font-bold text-gray-500">TWELVE PAGES, EVERY THURSDAY. ONE COHESIVE NEWSPAPER.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 border-b-2 border-black pb-12">
            {[
              { num: 1,  title: "Front Page / The Lead",      desc: "Lead investigation and principal headline." },
              { num: 2,  title: "Main Investigation",         desc: "Continuation, reporting, and primary source chain." },
              { num: 3,  title: "Secondary Evidence",         desc: "Competing account, additional lead, or supporting evidence chain." },
              { num: 4,  title: "City Page",                  desc: "Los Angeles crime briefs and incident reporting." },
              { num: 5,  title: "Courts & Records",           desc: "Filings, hearings, sentencing, and public records." },
              { num: 6,  title: "Paper Trail",                desc: "Documents, FOIA work, timelines, and source analysis." },
              { num: 7,  title: "Bureau Case Desk",           desc: "Active, developing, and pending Crime Division investigations." },
              { num: 8,  title: "From the Morgue",            desc: "Archival highlights, throwbacks, and then-versus-now reporting." },
              { num: 9,  title: "Reader Desk & Press Club",   desc: "Letters, community spotlight, Ask the Desk, tips, and membership." },
              { num: 10, title: "Puzzle Desk",                desc: "Crossword, Spot the Difference, trivia, and weekly clues." },
              { num: 11, title: "Ink & Alibi",                desc: "Recurring comic, Wire Hunt, and reader artwork." },
              { num: 12, title: "Market Page",                desc: "Vintage-style advertisements, Morning Joe comic, and Press Club QR." },
            ].map((section) => (
              <div key={section.num} className="border-l-2 border-black pl-3 flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Page {section.num}</span>
                <h4 className="font-serif font-bold text-lg mb-1 leading-tight">{section.title}</h4>
                <p className="text-xs font-sans text-gray-700 leading-snug">{section.desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto text-center py-10 font-serif text-lg leading-relaxed italic">
            "Crime Wire is a single cohesive weekly newspaper — not a podcast, not a newsletter, not a true-crime blog. The Black Dahlia investigation runs alongside current Los Angeles crime, court records, reader tips, puzzles, and genuine vintage-style classified advertisements. Nostalgia is the medium. Accountability is the mission."
          </div>
        </section>

        {/* How to Get It */}
        <section className="mt-8 border-t border-black pt-12 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-black">
            <div className="px-6 py-4 md:py-0">
              <h4 className="text-xl font-bold uppercase tracking-widest mb-3">Digital Edition</h4>
              <p className="text-sm font-serif mb-4">Print at home, read on screen. Formatted for standard letter paper. Always free.</p>
              <button onClick={() => scrollToSection("subscribe")} className="border-b-2 border-black text-xs font-bold uppercase tracking-widest pb-1 hover:bg-black hover:text-white transition-colors">Sign Up</button>
            </div>
            
            <div className="px-6 py-4 md:py-0">
              <h4 className="text-xl font-bold uppercase tracking-widest mb-3">Mailed Copy</h4>
              <p className="text-sm font-serif mb-4">Waitlist only. No payment taken. We'll contact you when the mailing program launches.</p>
              <button onClick={() => scrollToSection("subscribe")} className="border-b-2 border-black text-xs font-bold uppercase tracking-widest pb-1 hover:bg-black hover:text-white transition-colors">Join Waitlist</button>
            </div>
            
            <div className="px-6 py-4 md:py-0 flex flex-col items-center">
              <h4 className="text-xl font-bold uppercase tracking-widest mb-3">Street Sheet</h4>
              <div className="w-32 h-32 border-4 border-black flex items-center justify-center mb-2 bg-white print:border-2">
                {EDITION_URL ? (
                  <QRCodeSVG
                    value={EDITION_URL}
                    size={112}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                ) : (
                  <span className="font-bold text-[10px] text-center uppercase tracking-widest px-2 text-gray-400">Edition URL not set</span>
                )}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest">Scan for the current edition</p>
            </div>
          </div>
        </section>

        {/* Reader Desk Form */}
        <section className="mt-8 border-4 border-black p-6 sm:p-10 bg-gray-50 max-w-4xl mx-auto">
          <header className="text-center mb-8 border-b border-black pb-6">
            <h2 className="text-3xl font-serif font-bold uppercase tracking-widest mb-2">Reader Desk</h2>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-600">Tips, Corrections & Correspondence</p>
            <p className="mt-4 text-sm font-serif max-w-xl mx-auto">
              Crime Wire welcomes reader tips, document leads, corrections, and correspondence. We review all submissions.
            </p>
          </header>

          {tipSuccess ? (
            <div className="text-center py-12">
              <h3 className="text-2xl font-bold uppercase tracking-widest mb-2 border-y-2 border-black inline-block py-2">
                Tip Received — File Open
              </h3>
              <p className="mt-4 font-serif">Your message has been logged with the Bureau Desk.</p>
              <button 
                onClick={() => setTipSuccess(false)}
                className="mt-8 bg-black text-white px-6 py-2 text-xs font-bold uppercase tracking-widest"
              >
                Submit Another
              </button>
            </div>
          ) : (
            <form onSubmit={tipForm.handleSubmit(onTipSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2">Name or Alias</label>
                  <input 
                    type="text" 
                    {...tipForm.register("nameOrAlias")}
                    className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2">Contact Email</label>
                  <input 
                    type="email" 
                    {...tipForm.register("contactEmail")}
                    className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                  />
                  {tipForm.formState.errors.contactEmail && (
                    <p className="text-xs text-red-600 font-bold mt-1 uppercase">{tipForm.formState.errors.contactEmail.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2">Message *</label>
                <textarea 
                  {...tipForm.register("message")}
                  rows={5}
                  className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none"
                ></textarea>
                {tipForm.formState.errors.message && (
                  <p className="text-xs text-red-600 font-bold mt-1 uppercase">{tipForm.formState.errors.message.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-2">Provenance / Source</label>
                <input 
                  type="text" 
                  {...tipForm.register("provenance")}
                  placeholder="Describe the source, date, or origin of any documents"
                  className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white placeholder:text-gray-400"
                />
              </div>

              <div className="border border-black p-4 bg-white text-xs font-serif leading-relaxed">
                <strong className="uppercase font-sans font-bold">Notice:</strong> Crime Wire does not promise anonymity and does not operate a secure document drop. Do not submit documents you cannot share through ordinary channels. Contact information is used only to follow up on this tip. It is not shared, sold, or used for any other purpose.
              </div>

              <button 
                type="submit" 
                disabled={tipLoading}
                className="w-full border-2 border-black bg-black text-white py-4 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {tipLoading ? "Transmitting..." : "Submit to Desk"}
              </button>
            </form>
          )}
        </section>

      </div>

      {/* Footer */}
      <footer className="mt-16 border-t-4 border-black py-8 bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 text-center flex flex-col items-center">
          <h2 className="text-2xl font-display uppercase tracking-widest mb-4">Los Angeles Crime Wire</h2>
          <div className="space-y-1 text-xs font-bold uppercase tracking-widest text-gray-300">
            <p>A publication of RSR Crime Division</p>
            <p>Published every Thursday · Digital edition free</p>
            <p className="mt-4 text-gray-500">crimewire.rsrintel.com (coming soon)</p>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-6 text-[10px] uppercase tracking-widest text-gray-500 max-w-md">
            <p className="mb-2">We collect only what you give us. Email addresses are used for delivery only.</p>
            <p>© {new Date().getFullYear()} RSR Crime Division. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

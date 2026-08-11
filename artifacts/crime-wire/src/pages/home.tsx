import { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { QRCodeSVG } from "qrcode.react";

// ── Issue shape from /api/issues/latest ──────────────────────
interface LiveIssue {
  id: number;
  volume: number;
  number: string;
  title: string;
  headline: string | null;
  deck: string | null;
  description: string | null;
  caseLabel: string | null;
  pdfUrl: string | null;
  coverImageUrl: string | null;
  pageCount: number;
  status: string;
  publishDate: string | null;
  dropDate: string | null;
  countdownEnabled: boolean;
  publicStatus: string | null;
  readCtaLabel: string | null;
  readCtaUrl: string | null;
  downloadCtaLabel: string | null;
  downloadCtaUrl: string | null;
  joinCtaLabel: string | null;
}

// ── Fallback values (Vol. I, No. 2 edition) ──────────────────
const FALLBACK_HEADLINE  = "The Story Got Smaller. The Clues Got Better.";
const FALLBACK_DECK      = "As the 1947 headline count collapsed, what remained in the record grew more specific: names, addresses, drivers, bartenders, hotels, and at least four leads the investigation eliminated on the record.";
const FALLBACK_CASE      = "BDH-002 · The Black Dahlia Investigation";
const FALLBACK_COVER     = "/images/biltmore.jpg";
const FALLBACK_PAGES     = 12;
const FALLBACK_READ_CTA  = "Read Latest Issue";
const FALLBACK_DL_CTA    = "Download PDF";
const FALLBACK_JOIN_CTA  = "Join Thursday Drop";

// ── Countdown helpers ─────────────────────────────────────────
/** Returns the UTC epoch ms for next Thursday noon PT (or the issue's dropDate). */
function nextDropMs(dropDateOverride?: string | null): number {
  if (dropDateOverride) {
    const d = new Date(dropDateOverride);
    if (!isNaN(d.getTime()) && d.getTime() > Date.now()) return d.getTime();
  }
  const now = Date.now();
  for (let off = 0; off <= 7; off++) {
    const candidate = new Date(now + off * 86_400_000);
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", weekday: "short",
    }).format(candidate);
    if (wd !== "Thu") continue;
    // Determine UTC offset for that day
    const tzPart = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", timeZoneName: "shortOffset",
    }).formatToParts(candidate).find(p => p.type === "timeZoneName")?.value ?? "GMT-7";
    const m = tzPart.match(/GMT([+-])(\d+)/);
    const offsetH = m ? (m[1] === "+" ? parseInt(m[2]) : -parseInt(m[2])) : -7;
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(candidate);
    const y  = parseInt(parts.find(p => p.type === "year")!.value);
    const mo = parseInt(parts.find(p => p.type === "month")!.value) - 1;
    const dy = parseInt(parts.find(p => p.type === "day")!.value);
    const noonUtc = Date.UTC(y, mo, dy, 12 - offsetH, 0, 0, 0);
    if (noonUtc > now) return noonUtc;
  }
  return now + 7 * 86_400_000;
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00d · 00h · 00m · 00s";
  const s   = Math.floor(ms / 1000);
  const d   = Math.floor(s / 86_400);
  const h   = Math.floor((s % 86_400) / 3_600);
  const min = Math.floor((s % 3_600) / 60);
  const sec = s % 60;
  return `${pad(d)}d · ${pad(h)}h · ${pad(min)}m · ${pad(sec)}s`;
}

function toRoman(n: number): string {
  const map: [number, string][] = [[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
  let r = "";
  for (const [v, sym] of map) { while (n >= v) { r += sym; n -= v; } }
  return r || String(n);
}

// ── Schemas ──────────────────────────────────────────────────
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

// ── Icons ─────────────────────────────────────────────────────
const CheckIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─────────────────────────────────────────────────────────────
export default function Home() {
  // ── Form state ───────────────────────────────────────────────
  const [subSuccess,   setSubSuccess]   = useState(false);
  const [subDuplicate, setSubDuplicate] = useState(false);
  const [tipSuccess,   setTipSuccess]   = useState(false);
  const [subLoading,   setSubLoading]   = useState(false);
  const [tipLoading,   setTipLoading]   = useState(false);
  const [imageError,   setImageError]   = useState(false);

  // ── Live issue ───────────────────────────────────────────────
  const [issue, setIssue] = useState<LiveIssue | null>(null);

  // ── Countdown ────────────────────────────────────────────────
  const [remaining, setRemaining]       = useState<number>(0);
  const dropTarget  = useRef<number>(0);

  // ── Fetch latest published issue ─────────────────────────────
  useEffect(() => {
    fetch("/api/issues/latest", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: LiveIssue | null) => {
        setIssue(data);
        dropTarget.current = nextDropMs(data?.dropDate);
        setRemaining(Math.max(0, dropTarget.current - Date.now()));
      })
      .catch(() => {
        dropTarget.current = nextDropMs(null);
        setRemaining(Math.max(0, dropTarget.current - Date.now()));
      });
  }, []);

  // ── Tick every second ────────────────────────────────────────
  useEffect(() => {
    if (dropTarget.current === 0) {
      dropTarget.current = nextDropMs(null);
    }
    const id = setInterval(() => {
      const rem = Math.max(0, dropTarget.current - Date.now());
      setRemaining(rem);
      // When countdown expires, recalculate for next week
      if (rem === 0) {
        dropTarget.current = nextDropMs(null);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Derived content (live issue or fallbacks) ─────────────────
  const EDITION_URL      = import.meta.env.VITE_EDITION_URL || "";
  const issuePdf         = issue?.pdfUrl ?? EDITION_URL;
  const headline         = issue?.headline   ?? FALLBACK_HEADLINE;
  const deck             = issue?.deck ?? issue?.description ?? FALLBACK_DECK;
  const caseLabel        = issue?.caseLabel  ?? FALLBACK_CASE;
  const coverImg         = issue?.coverImageUrl ?? FALLBACK_COVER;
  const pageCount        = issue?.pageCount  ?? FALLBACK_PAGES;
  const readCtaLabel     = issue?.readCtaLabel ?? FALLBACK_READ_CTA;
  const readCtaUrl       = issue?.readCtaUrl || issuePdf;
  const dlCtaLabel       = issue?.downloadCtaLabel ?? FALLBACK_DL_CTA;
  const dlCtaUrl         = issue?.downloadCtaUrl   || issuePdf;
  const joinCtaLabel     = issue?.joinCtaLabel ?? FALLBACK_JOIN_CTA;
  const countdownOn      = issue?.countdownEnabled !== false;
  const pubStatus        = issue?.publicStatus ?? null;

  // Edition dateline
  const volStr  = issue ? `Volume ${toRoman(issue.volume)}, Number ${issue.number.replace(/^No\.\s*/i, "")}` : "Volume I, Number 2";
  const dateStr = issue?.publishDate
    ? new Date(issue.publishDate + (issue.publishDate.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "Thursday, August 14, 2026";
  const shortDateStr = issue?.publishDate
    ? new Date(issue.publishDate + (issue.publishDate.length === 10 ? "T12:00:00" : "")).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "Thursday, August 14, 2026";
  const pagesStr = `${pageCount} Pages`;

  // Top dateline strip values
  const stripVol = issue ? `Vol. ${toRoman(issue.volume)}, No. ${issue.number.replace(/^No\.\s*/i, "")}` : "Vol. I, No. 2";

  // Countdown bar state
  const expired = remaining === 0;
  const isLive  = expired && !!issue && issue.status === "published" &&
    !!issue.publishDate &&
    Date.now() - new Date(issue.publishDate).getTime() < 7 * 86_400_000;

  const pubInput = "w-full border-2 border-black p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black bg-white";

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const onSubSubmit = async (data: SubscriptionForm) => {
    setSubDuplicate(false);
    setSubLoading(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email, name: data.name || null, zip: data.zip || null,
          editionType: data.editionType, consent: data.consent,
        }),
      });
      if (res.ok) { setSubSuccess(true); subForm.reset(); }
      else if (res.status === 409) { setSubDuplicate(true); }
    } catch { /* network error — form stays open */ }
    finally { setSubLoading(false); }
  };

  const onTipSubmit = async (data: TipForm) => {
    setTipLoading(true);
    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.nameOrAlias || null, contactEmail: data.contactEmail || null,
          message: data.message, source: data.provenance || null,
        }),
      });
      if (res.ok) { setTipSuccess(true); tipForm.reset(); }
    } catch { /* silent */ }
    finally { setTipLoading(false); }
  };

  const subForm = useForm<SubscriptionForm>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: { email: "", name: "", zip: "", editionType: "digital", consent: false as unknown as true },
  });

  const tipForm = useForm<TipForm>({
    resolver: zodResolver(tipSchema),
    defaultValues: { nameOrAlias: "", contactEmail: "", message: "", provenance: "" },
  });

  return (
    <div className="min-h-[100dvh] bg-white text-black font-sans w-full overflow-x-hidden selection:bg-black selection:text-white">

      {/* ── Dateline strip ───────────────────────────────────── */}
      <div className="w-full border-b border-black py-1.5 px-4 bg-white">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-[0.22em]">RSR Crime Division · Los Angeles Bureau</span>
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] hidden md:block">
            {stripVol} · {pagesStr} · Free Digital Edition
          </span>
          <span className="text-[9px] font-bold uppercase tracking-[0.22em]">{shortDateStr}</span>
        </div>
      </div>

      {/* ── Thursday Drop countdown bar ──────────────────────── */}
      {countdownOn && (
        <div className="w-full bg-black text-white px-4 py-1.5">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] hidden sm:block whitespace-nowrap">
              {expired
                ? isLive ? "This Week's Crime Wire Is Live" : "Drop Window Open"
                : "Next Crime Wire Drop"}
            </span>
            <span className="text-[10px] font-mono font-bold tracking-widest tabular-nums text-center flex-1 sm:flex-none">
              {expired
                ? isLive
                  ? <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Read the Drop →</span>
                  : <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Check Back Shortly</span>
                : fmtCountdown(remaining)
              }
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] whitespace-nowrap">
              Thursday · {pagesStr}
            </span>
          </div>
        </div>
      )}

      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="border-b-2 border-black bg-white">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 text-center">
          <div className="flex items-center justify-center gap-6 lg:gap-10">
            {/* Left ear */}
            <div className="hidden lg:block text-left">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-relaxed text-gray-500">
                Independent<br/>Crime &amp;<br/>Investigative<br/>Weekly
              </p>
            </div>
            {/* Logotype */}
            <div>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.55em] mb-0.5 text-gray-600">Los Angeles</div>
              <div className="text-[56px] sm:text-[72px] md:text-[92px] lg:text-[108px] font-display uppercase leading-none tracking-tight">
                Crime Wire
              </div>
            </div>
            {/* Right ear */}
            <div className="hidden lg:block text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] leading-relaxed text-gray-500">
                Victim First<br/>Facts Second<br/>Theories Last<br/>&nbsp;<br/>A Red String<br/>Is Not Evidence
              </p>
            </div>
          </div>

          {/* Dateline rule */}
          <div className="mt-2 border-t border-b border-black py-1.5 text-[9px] font-bold uppercase tracking-[0.15em]">
            {dateStr}&nbsp;·&nbsp;{volStr}&nbsp;·&nbsp;{pagesStr}
            {caseLabel ? `\u00a0·\u00a0${caseLabel}` : ""}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Two-column newspaper grid ────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">

          {/* ── Lead story (8 cols) ──────────────────────────── */}
          <main className="lg:col-span-8 lg:border-r-2 lg:border-black lg:pr-8 py-7">

            {/* Slug / section labels */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="bg-black text-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest">The Lead</span>
              {caseLabel && (
                <span className="text-[9px] font-bold uppercase tracking-widest border border-black px-2 py-0.5">{caseLabel}</span>
              )}
            </div>

            {/* Headline — commanding but not swallowing */}
            <h2 className="text-[28px] sm:text-[38px] md:text-[46px] font-serif font-bold leading-[1.05] mb-3 uppercase whitespace-pre-line">
              {headline}
            </h2>

            {/* Deck */}
            {deck && (
              <p className="font-serif text-base sm:text-lg italic text-gray-800 mb-4 leading-snug border-l-[3px] border-black pl-4">
                {deck}
              </p>
            )}

            {/* Optional public status badge */}
            {pubStatus && (
              <div className="mb-4">
                <span className="text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2 py-1">
                  {pubStatus}
                </span>
              </div>
            )}

            {/* ── CTAs — above fold ──────────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 mb-7 pb-7 border-b-2 border-black">
              {readCtaUrl ? (
                <a href={readCtaUrl} target="_blank" rel="noopener noreferrer"
                  className="flex-1 bg-black text-white py-3 px-5 text-[11px] font-bold uppercase tracking-widest hover:bg-gray-900 transition-colors text-center border-2 border-black">
                  {readCtaLabel} →
                </a>
              ) : (
                <button disabled className="flex-1 py-3 px-5 text-[11px] font-bold uppercase tracking-widest border-2 border-black opacity-40 cursor-not-allowed">
                  {readCtaLabel}
                </button>
              )}
              {dlCtaUrl ? (
                <a href={dlCtaUrl} download target="_blank" rel="noopener noreferrer"
                  className="flex-1 py-3 px-5 text-[11px] font-bold uppercase tracking-widest border-2 border-black hover:bg-black hover:text-white transition-colors text-center">
                  {dlCtaLabel} →
                </a>
              ) : (
                <button disabled className="flex-1 py-3 px-5 text-[11px] font-bold uppercase tracking-widest border-2 border-black opacity-40 cursor-not-allowed">
                  {dlCtaLabel}
                </button>
              )}
              <button onClick={() => scrollToSection("subscribe")}
                className="flex-1 py-3 px-5 text-[11px] font-bold uppercase tracking-widest border-2 border-black hover:bg-black hover:text-white transition-colors text-center">
                {joinCtaLabel}
              </button>
            </div>

            {/* ── Cover / archival image ─────────────────────── */}
            <figure className="mb-7 border border-black p-0.5">
              {!imageError ? (
                <div className="w-full aspect-square overflow-hidden relative bg-gray-900">
                  <img
                    src={coverImg}
                    alt={coverImg === FALLBACK_COVER ? "Biltmore Hotel, South Grand Avenue, Los Angeles, 1947" : "Cover image"}
                    className="w-full h-full object-cover object-center"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none" />
                </div>
              ) : null}
              <figcaption className={`px-2 py-1.5 text-[9px] font-bold uppercase tracking-widest flex justify-between items-center${!imageError ? " border-t border-black" : ""}`}>
                <span>
                  {coverImg === FALLBACK_COVER
                    ? "Biltmore Hotel · South Grand Avenue · Los Angeles, 1947"
                    : "Cover · Los Angeles Crime Wire"}
                </span>
                <span className={imageError ? "text-gray-400 font-mono font-normal normal-case tracking-normal" : "text-gray-500"}>
                  {imageError ? "Archival image — reference pending" : "BDH-002 Archive"}
                </span>
              </figcaption>
            </figure>

            {/* ── Body copy ─────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7 font-serif text-sm sm:text-base leading-relaxed text-justify">
              <div>
                <p className="mb-4">
                  <span className="float-left text-5xl font-serif leading-[0.8] pr-2 pt-1 font-bold">T</span>he Biltmore Hotel on South Grand Avenue is the last location in Elizabeth Short's known movement record that rests on reasonably firm contemporary ground. What the documentary record shows: she was seen in the lobby on the evening of January 9, 1947. Beyond that, the file becomes contested territory.
                </p>
                <p className="mb-4">
                  The working documentary floor — active research files, not institutional memory — reports an Olive Street exit and movement south around 10 p.m. that night. This lead is open: it has not been confirmed against a contemporaneous named source, but it is the current best-supported directional thread in the exit question.
                </p>
                <p>
                  A separate chain — drawn from Biltmore institutional oral history — describes a former doorman who recalled a waiting cab on the night. That account is noted in the record but remains unverified: neither the doorman's name nor the original record have been produced. It is held as an unconfirmed institutional memory, not an established fact.
                </p>
              </div>
              <div>
                <div className="border-t-2 border-b-2 border-black py-4 mb-5 text-center">
                  <p className="text-lg font-serif italic font-bold leading-snug">"A red string is not evidence."</p>
                </div>
                <p className="mb-4">
                  These are two distinct leads, and they are tracked separately. The working exit thread (Olive Street, south, ~10 p.m.) and the institutional cab account are not merged in the file.
                </p>
                <p className="mb-5">
                  A separate transportation lead, dated January 11 — involving Sixth and Main — is tracked independently and is not part of the Biltmore exit question.
                </p>
                <div className="bg-black text-white text-[10px] font-bold uppercase tracking-wider text-center p-3">
                  BDH-002 remains open. The Biltmore exit question is active. Sixth and Main, January 11, is a separate thread.
                </div>
              </div>
            </div>

          </main>

          {/* ── Sidebar (4 cols) ──────────────────────────────── */}
          <aside className="lg:col-span-4 lg:pl-8 py-7 flex flex-col gap-6 border-t-2 border-black lg:border-t-0">

            {/* Thursday Drop signup — ALL LOGIC PRESERVED */}
            <div id="subscribe" className="border-2 border-black p-5">
              <div className="border-b-2 border-black pb-3 mb-4">
                <h3 className="text-base font-serif font-bold uppercase tracking-wide mb-1">The Thursday Drop</h3>
                <p className="text-xs font-serif text-gray-700 leading-snug">
                  Free digital edition, every Thursday. Mailed copies: waitlist only — no payment taken.
                </p>
              </div>

              {subSuccess ? (
                <div className="text-center py-6">
                  <div className="inline-flex justify-center items-center w-12 h-12 border-2 border-black mb-3">
                    <CheckIcon />
                  </div>
                  <h4 className="text-base font-bold uppercase tracking-widest mb-2">Confirmed</h4>
                  <p className="text-xs font-serif">Your name is on the list. Watch your inbox this Thursday.</p>
                  <button onClick={() => setSubSuccess(false)} className="mt-4 text-[10px] uppercase tracking-widest font-bold underline">
                    Register Another
                  </button>
                </div>
              ) : (
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                <form onSubmit={subForm.handleSubmit(onSubSubmit as any)} className="space-y-3">
                  {subDuplicate && (
                    <div className="bg-black text-white p-2 text-[10px] font-bold uppercase tracking-wider text-center">
                      This address is already on the list.
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Email Address *</label>
                    <input type="email" {...subForm.register("email")} className={pubInput} />
                    {subForm.formState.errors.email && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{subForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">Name / Alias</label>
                    <input type="text" {...subForm.register("name")} className={pubInput} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-1">LA ZIP Code (Optional)</label>
                    <input type="text" {...subForm.register("zip")} placeholder="90014"
                      className={pubInput + " placeholder:text-gray-400"} />
                    {subForm.formState.errors.zip && (
                      <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{subForm.formState.errors.zip.message}</p>
                    )}
                  </div>
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Edition Preference</label>
                    <div className="space-y-2">
                      {[
                        { id: "digital", label: "Digital Edition (Free)" },
                        { id: "mailed",  label: "Mailed Copy — Waitlist Only" },
                        { id: "both",    label: "Both (Digital + Waitlist)" },
                      ].map(opt => (
                        <label key={opt.id} className="flex items-center gap-2 cursor-pointer group">
                          <div className="relative flex items-center justify-center">
                            <input type="radio" value={opt.id} {...subForm.register("editionType")} className="peer sr-only" />
                            <div className="w-4 h-4 border-2 border-black rounded-none peer-checked:bg-black peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-black transition-all" />
                          </div>
                          <span className="text-xs font-serif group-hover:font-bold transition-all">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-black">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="relative pt-0.5 flex-shrink-0">
                        <input type="checkbox" {...subForm.register("consent")} className="peer sr-only" />
                        <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black flex items-center justify-center text-white">
                          <svg className="w-3 h-3 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                      <span className="text-[10px] font-serif leading-tight text-gray-700">
                        I agree to receive the Crime Wire Thursday Drop by email. I understand this is a weekly publication and can unsubscribe at any time.
                      </span>
                    </label>
                    {subForm.formState.errors.consent && (
                      <p className="text-[10px] text-red-600 font-bold mt-2 uppercase">{subForm.formState.errors.consent.message}</p>
                    )}
                  </div>
                  <button type="submit" disabled={subLoading}
                    className="w-full bg-black text-white py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed">
                    {subLoading ? "Transmitting..." : "Subscribe to Thursday Drop"}
                  </button>
                </form>
              )}
            </div>

            {/* BDH-002 case status */}
            <div className="border-t-4 border-b-4 border-black py-5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest mb-3 border-b border-black pb-2">
                Active Case — BDH-002
              </h3>
              <ul className="space-y-2.5 text-xs font-serif">
                {[
                  ["I.",   "The Biltmore is the last strong location in the known movement record."],
                  ["II.",  "Working floor: Olive Street exit, movement south, ~10 p.m., January 9. Lead open and unconfirmed."],
                  ["III.", "Biltmore oral-history chain — doorman, waiting cab — noted but not established. No named source on record."],
                  ["IV.",  "January 11 — Sixth and Main — tracked independently."],
                ].map(([n, text]) => (
                  <li key={n} className="flex gap-2">
                    <span className="font-bold uppercase text-[9px] tracking-widest mt-0.5 whitespace-nowrap w-5 shrink-0">{n}</span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 p-2 bg-black text-white text-[9px] font-bold uppercase tracking-widest text-center">
                File open. No established fact. Victim first.
              </div>
            </div>

            {/* Credo */}
            <div className="border border-black p-4 text-center">
              <h4 className="text-[9px] font-bold uppercase tracking-[0.3em] border-b border-black pb-2 mb-3">
                Newsroom Policy
              </h4>
              <p className="font-serif text-base font-bold italic leading-snug">
                "Victim first.<br/>Facts second.<br/>Theories last."
              </p>
            </div>

            {/* City Desk & Records Desk quick links */}
            <div className="border border-black">
              {[
                { label: "City Desk",     desc: "Los Angeles crime briefs, incident reporting, and open investigations.", href: "/city-desk" },
                { label: "Records Desk",  desc: "FOIA filings, court records, and document archive.",                    href: "/records-desk" },
              ].map((item, i) => (
                <a key={item.label} href={item.href}
                  className={`block px-4 py-3 hover:bg-black hover:text-white transition-colors group${i > 0 ? " border-t border-black" : ""}`}>
                  <span className="text-[10px] font-bold uppercase tracking-widest block mb-0.5 group-hover:text-white">{item.label} →</span>
                  <span className="text-[10px] text-gray-500 group-hover:text-gray-300 font-serif">{item.desc}</span>
                </a>
              ))}
            </div>

          </aside>
        </div>

        {/* ── What's in the Paper ──────────────────────────────── */}
        <section className="border-t-2 border-black pt-8 pb-8 mt-0">
          <div className="text-center mb-7">
            <h2 className="text-2xl sm:text-3xl font-serif font-bold uppercase tracking-widest mb-1">What's in the Paper</h2>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500">
              {pageCount} Pages, Every Thursday. One Cohesive Newspaper.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-y-5 gap-x-4 border-b-2 border-black pb-8">
            {[
              { num: 1,  title: "Front Page / The Lead",     desc: "Lead investigation and principal headline." },
              { num: 2,  title: "Main Investigation",        desc: "Continuation, reporting, and primary source chain." },
              { num: 3,  title: "Secondary Evidence",        desc: "Competing account or supporting evidence chain." },
              { num: 4,  title: "City Page",                 desc: "Los Angeles crime briefs and incident reporting." },
              { num: 5,  title: "Courts & Records",          desc: "Filings, hearings, sentencing, and public records." },
              { num: 6,  title: "Paper Trail",               desc: "Documents, FOIA work, timelines, and source analysis." },
              { num: 7,  title: "Bureau Case Desk",          desc: "Active, developing, and pending Crime Division investigations." },
              { num: 8,  title: "From the Morgue",           desc: "Archival highlights and then-versus-now reporting." },
              { num: 9,  title: "Reader Desk & Press Club",  desc: "Letters, tips, and membership." },
              { num: 10, title: "Shell Shocker & Crossword", desc: "The cycle's most staggering verified crime story — alongside the case-file crossword, trivia, and weekly clues." },
              { num: 11, title: "Ink & Alibi",               desc: "Recurring comic, Wire Hunt, and reader artwork." },
              { num: 12, title: "Market Page",               desc: "Vintage-style advertisements, Morning Joe comic, and Press Club QR." },
            ].map(s => (
              <div key={s.num} className="border-l-2 border-black pl-3">
                <span className="text-[9px] font-bold uppercase tracking-widest block mb-0.5 text-gray-500">Page {s.num}</span>
                <h4 className="font-serif font-bold text-sm mb-0.5 leading-tight">{s.title}</h4>
                <p className="text-[10px] text-gray-700 leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto text-center py-7 font-serif text-sm sm:text-base leading-relaxed italic border-b border-black">
            "Crime Wire is a single cohesive weekly newspaper — not a podcast, not a newsletter, not a true-crime blog. The Black Dahlia investigation runs alongside current Los Angeles crime, court records, reader tips, puzzles, and genuine vintage-style classified advertisements. Nostalgia is the medium. Accountability is the mission."
          </div>
        </section>

        {/* ── How to Get It ────────────────────────────────────── */}
        <section className="py-8 border-b-2 border-black">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 divide-y md:divide-y-0 md:divide-x divide-black border border-black">
            <div className="px-6 py-6 text-center">
              <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Digital Edition</h4>
              <p className="text-xs font-serif mb-4 text-gray-700">Print at home, read on screen. Formatted for standard letter paper. Always free.</p>
              <button onClick={() => scrollToSection("subscribe")}
                className="text-[10px] font-bold uppercase tracking-widest border-b-2 border-black pb-0.5 hover:bg-black hover:text-white transition-colors px-1">
                Sign Up →
              </button>
            </div>
            <div className="px-6 py-6 text-center">
              <h4 className="text-sm font-bold uppercase tracking-widest mb-2">Mailed Copy</h4>
              <p className="text-xs font-serif mb-4 text-gray-700">Waitlist only. No payment taken. We'll contact you when the mailing program launches.</p>
              <button onClick={() => scrollToSection("subscribe")}
                className="text-[10px] font-bold uppercase tracking-widest border-b-2 border-black pb-0.5 hover:bg-black hover:text-white transition-colors px-1">
                Join Waitlist →
              </button>
            </div>
            <div className="px-6 py-6 flex flex-col items-center text-center">
              <h4 className="text-sm font-bold uppercase tracking-widest mb-3">Street Sheet</h4>
              <div className="w-28 h-28 border-4 border-black flex items-center justify-center mb-2 bg-white">
                {readCtaUrl ? (
                  <QRCodeSVG value={readCtaUrl} size={96} bgColor="#ffffff" fgColor="#000000" level="M" />
                ) : (
                  <span className="font-bold text-[9px] text-center uppercase tracking-widest px-2 text-gray-400">Edition URL not set</span>
                )}
              </div>
              <p className="text-[9px] font-bold uppercase tracking-widest">Scan for the current edition</p>
            </div>
          </div>
        </section>

        {/* ── Reader Desk — ALL LOGIC PRESERVED ──────────────── */}
        <section className="my-10 border-4 border-black p-6 sm:p-10 max-w-4xl mx-auto">
          <header className="text-center mb-8 border-b border-black pb-5">
            <h2 className="text-2xl font-serif font-bold uppercase tracking-widest mb-2">Reader Desk</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-600">Tips, Corrections &amp; Correspondence</p>
            <p className="mt-3 text-sm font-serif max-w-xl mx-auto">
              Crime Wire welcomes reader tips, document leads, corrections, and correspondence. We review all submissions.
            </p>
          </header>

          {tipSuccess ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-bold uppercase tracking-widest mb-2 border-y-2 border-black inline-block py-2">
                Tip Received — File Open
              </h3>
              <p className="mt-4 font-serif text-sm">Your message has been logged with the Bureau Desk.</p>
              <button onClick={() => setTipSuccess(false)}
                className="mt-8 bg-black text-white px-6 py-2 text-xs font-bold uppercase tracking-widest">
                Submit Another
              </button>
            </div>
          ) : (
            <form onSubmit={tipForm.handleSubmit(onTipSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Name or Alias</label>
                  <input type="text" {...tipForm.register("nameOrAlias")}
                    className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Contact Email</label>
                  <input type="email" {...tipForm.register("contactEmail")}
                    className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white" />
                  {tipForm.formState.errors.contactEmail && (
                    <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{tipForm.formState.errors.contactEmail.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Message *</label>
                <textarea {...tipForm.register("message")} rows={5}
                  className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none" />
                {tipForm.formState.errors.message && (
                  <p className="text-[10px] text-red-600 font-bold mt-1 uppercase">{tipForm.formState.errors.message.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2">Provenance / Source</label>
                <input type="text" {...tipForm.register("provenance")}
                  placeholder="Describe the source, date, or origin of any documents"
                  className="w-full border border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white placeholder:text-gray-400" />
              </div>

              <div className="border border-black p-4 bg-white text-xs font-serif leading-relaxed">
                <strong className="uppercase font-sans font-bold">Notice:</strong> Crime Wire does not promise anonymity and does not operate a secure document drop. Do not submit documents you cannot share through ordinary channels. Contact information is used only to follow up on this tip. It is not shared, sold, or used for any other purpose.
              </div>

              <button type="submit" disabled={tipLoading}
                className="w-full border-2 border-black bg-black text-white py-4 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {tipLoading ? "Transmitting..." : "Submit to Desk"}
              </button>
            </form>
          )}
        </section>

      </div>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t-4 border-black bg-black text-white py-8 mt-0">
        <div className="max-w-4xl mx-auto px-4 text-center flex flex-col items-center">
          <div className="text-[9px] font-bold uppercase tracking-[0.35em] text-gray-500 mb-1">RSR Crime Division</div>
          <h2 className="text-xl font-display uppercase tracking-widest mb-3">Los Angeles Crime Wire</h2>
          <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 space-y-1">
            <p>Published every Thursday · Digital edition free · Mailed copies on waitlist</p>
            <p className="mt-2">lacrimewire.online</p>
          </div>
          <div className="mt-6 border-t border-gray-800 pt-4 text-[9px] uppercase tracking-widest text-gray-600 max-w-md">
            <p>We collect only what you give us. Email addresses are used for delivery only.</p>
            <p className="mt-1">© {new Date().getFullYear()} RSR Crime Division. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

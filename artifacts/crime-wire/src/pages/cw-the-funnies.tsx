import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";

interface Comic {
  id: number;
  series: string;
  episode: number | null;
  title: string | null;
  artworkUrl: string | null;
  caption: string | null;
  transcript: string | null;
  publishDate: string | null;
  status: string;
}

const SERIES_META: Record<string, { name: string; desc: string; page: string }> = {
  "ink-and-alibi": {
    name: "Ink & Alibi",
    desc: "Ink runs the paper. Alibi works the streets. Every week, another case neither of them asked for.",
    page: "Page 11 · Los Angeles Crime Wire",
  },
  "morning-joe": {
    name: "Morning Joe",
    desc: "Joe just wants a cup of coffee. Los Angeles has other plans. A weekly strip about the city's smallest battles.",
    page: "Page 12 · Market Page",
  },
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface SeriesSectionProps {
  seriesKey: string;
  strips: Comic[];
  currentIdx: number;
  setCurrentIdx: (i: number) => void;
  onLightbox: (c: Comic) => void;
}

function SeriesSection({
  seriesKey,
  strips,
  currentIdx,
  setCurrentIdx,
  onLightbox,
}: SeriesSectionProps) {
  const meta = SERIES_META[seriesKey] ?? { name: seriesKey, desc: "", page: "" };
  const strip = strips[currentIdx] ?? null;
  const hasOlder = currentIdx < strips.length - 1;
  const hasNewer = currentIdx > 0;
  const olderEp = strips[currentIdx + 1]?.episode;
  const newerEp = strips[currentIdx - 1]?.episode;

  return (
    <section className="border-t-2 border-black pt-10 pb-14">
      {/* Series masthead */}
      <div className="mb-8">
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gray-400 block mb-1">
          {meta.page}
        </span>
        <h2 className="text-[44px] sm:text-[60px] font-headline font-bold uppercase tracking-tight leading-[0.9] mb-3">
          {meta.name}
        </h2>
        <p className="font-serif italic text-sm text-gray-600 max-w-lg leading-relaxed">
          {meta.desc}
        </p>
      </div>

      {strips.length === 0 ? (
        /* Launch card — intentional, not a blank or 404 */
        <div className="border border-dashed border-black py-20 text-center">
          <p className="font-headline font-bold text-2xl uppercase tracking-widest text-gray-400 mb-3">
            First Strip Publishing Thursday
          </p>
          <p className="font-serif italic text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
            {meta.name} launches with the next edition.
            Check back after the Thursday Drop.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* Current strip — main */}
          <div className="lg:col-span-8">
            <div className="border-4 border-black">
              {/* Strip header bar */}
              <div className="border-b-2 border-black px-5 py-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  {strip.episode != null && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-0.5">
                      Week {strip.episode}
                    </span>
                  )}
                  <h3 className="font-headline font-bold text-xl sm:text-2xl uppercase leading-tight">
                    {strip.title || meta.name}
                  </h3>
                </div>
                {strip.publishDate && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                    {fmtDate(strip.publishDate)}
                  </span>
                )}
              </div>

              {/* Artwork — full width, no crop, tap to enlarge */}
              {strip.artworkUrl ? (
                <button
                  className="w-full block bg-gray-50 border-b-2 border-black focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black cursor-zoom-in"
                  onClick={() => onLightbox(strip)}
                  aria-label={`Enlarge: ${strip.title || meta.name}, Week ${strip.episode ?? ""}`}
                >
                  <img
                    src={strip.artworkUrl}
                    alt={
                      strip.transcript ||
                      `${meta.name}${strip.episode != null ? ` — Week ${strip.episode}` : ""}${strip.title ? `: ${strip.title}` : ""}`
                    }
                    className="w-full h-auto max-h-[540px] object-contain"
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="w-full h-56 sm:h-72 bg-gray-50 border-b-2 border-black flex items-center justify-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-400">
                    Artwork Coming Thursday
                  </span>
                </div>
              )}

              {/* Caption + transcript */}
              <div className="px-5 py-4">
                {strip.caption && (
                  <p className="font-serif italic text-sm text-gray-700 leading-relaxed mb-3">
                    {strip.caption}
                  </p>
                )}
                {strip.artworkUrl && (
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                    Click or tap the strip to enlarge
                  </p>
                )}
                {strip.transcript && (
                  <details className="mt-1 border border-gray-200">
                    <summary className="px-3 py-2 text-[9px] font-bold uppercase tracking-widest text-gray-400 cursor-pointer select-none hover:bg-gray-50 hover:text-black transition-colors">
                      Accessible Transcript ▾
                    </summary>
                    <p className="px-3 pb-3 pt-2 border-t border-gray-200 text-xs font-mono text-gray-700 leading-relaxed">
                      {strip.transcript}
                    </p>
                  </details>
                )}
              </div>

              {/* Prev / Next navigation */}
              {strips.length > 1 && (
                <div className="border-t-2 border-black flex divide-x-2 divide-black">
                  <button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    disabled={!hasOlder}
                    aria-label={hasOlder ? `Go to Week ${olderEp ?? "older"}` : "No older strips"}
                    className="flex-1 py-3 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-left"
                  >
                    ← {hasOlder
                      ? `Week ${olderEp ?? "Older"}`
                      : "Oldest"}
                  </button>
                  <button
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    disabled={!hasNewer}
                    aria-label={hasNewer ? `Go to Week ${newerEp ?? "newer"}` : "Already on latest"}
                    className="flex-1 py-3 px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-right"
                  >
                    {hasNewer
                      ? `Week ${newerEp ?? "Newer"}`
                      : "Latest"} →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Archive sidebar */}
          <aside className="lg:col-span-4">
            <div className="border-2 border-black">
              <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">All Strips</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  {strips.length} published
                </span>
              </div>
              <div
                className="divide-y divide-gray-200 overflow-y-auto"
                style={{ maxHeight: "460px" }}
              >
                {strips.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black ${
                      i === currentIdx
                        ? "bg-black text-white"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {s.artworkUrl && (
                      <img
                        src={s.artworkUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-10 h-10 flex-shrink-0 object-cover border border-gray-200"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span
                          className={`text-[8px] font-bold uppercase tracking-widest ${
                            i === currentIdx ? "text-gray-300" : "text-gray-400"
                          }`}
                        >
                          {s.episode != null ? `Week ${s.episode}` : "—"}
                        </span>
                        {i === 0 && (
                          <span
                            className={`text-[7px] font-bold uppercase tracking-widest px-1 ${
                              i === currentIdx
                                ? "bg-white text-black"
                                : "bg-black text-white"
                            }`}
                          >
                            Latest
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-xs font-bold uppercase leading-tight block truncate ${
                          i === currentIdx ? "text-white" : "text-black"
                        }`}
                      >
                        {s.title || meta.name}
                      </span>
                      {s.publishDate && (
                        <span
                          className={`text-[8px] ${
                            i === currentIdx ? "text-gray-400" : "text-gray-400"
                          }`}
                        >
                          {fmtDate(s.publishDate)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

export default function CwTheFunnies() {
  useEffect(() => {
    document.title = "The Funnies | Los Angeles Crime Wire";
  }, []);

  const [strips, setStrips] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [inkIdx, setInkIdx] = useState(0);
  const [joeIdx, setJoeIdx] = useState(0);
  const [lightbox, setLightbox] = useState<Comic | null>(null);

  useEffect(() => {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
    fetch(`${base}/api/comics`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((data: Comic[]) => {
        setStrips(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  // Close lightbox on Escape
  const closeLightbox = useCallback(() => setLightbox(null), []);
  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [lightbox, closeLightbox]);

  const inkStrips = strips.filter((s) => s.series === "ink-and-alibi");
  const joeStrips = strips.filter((s) => s.series === "morning-joe");

  return (
    <div className="w-full bg-white text-black min-h-[100dvh]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">

        {/* Page masthead */}
        <header className="mb-12 border-b-4 border-black pb-8">
          <div className="w-full border-t-4 border-black mb-6" />
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">
                Los Angeles Crime Wire
              </span>
              <h1 className="text-[60px] sm:text-[80px] font-headline font-bold uppercase leading-[0.88] tracking-tight">
                The<br className="sm:hidden" /> Funnies
              </h1>
            </div>
            <Link
              href="/crime-wire"
              className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5"
            >
              ← Crime Wire
            </Link>
          </div>
          <div className="mt-5 border-t border-b border-black py-3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-8">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Two recurring series · Published every Thursday
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Click or tap any strip to enlarge
            </span>
          </div>
          <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl leading-relaxed">
            Every edition of the Los Angeles Crime Wire carries two comic strips.
            Ink &amp; Alibi runs on page 11. Morning Joe closes out the Market Page.
            Both series are published in full in the Thursday Drop.
          </p>
        </header>

        {loading ? (
          <div className="py-24 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
              Loading strips…
            </p>
          </div>
        ) : (
          <>
            <SeriesSection
              seriesKey="ink-and-alibi"
              strips={inkStrips}
              currentIdx={inkIdx}
              setCurrentIdx={setInkIdx}
              onLightbox={setLightbox}
            />
            <SeriesSection
              seriesKey="morning-joe"
              strips={joeStrips}
              currentIdx={joeIdx}
              setCurrentIdx={setJoeIdx}
              onLightbox={setLightbox}
            />
          </>
        )}

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Link
            href="/crime-wire"
            className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors pb-0.5"
          >
            ← Back to Crime Wire
          </Link>
          <Link
            href="/crime-wire/press-club"
            className="text-[10px] font-bold uppercase tracking-widest border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
          >
            Press Club — Bonus Panels &amp; Archives
          </Link>
        </div>
      </div>

      {/* Lightbox overlay */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label={`Enlarged view: ${lightbox.title || SERIES_META[lightbox.series]?.name}`}
        >
          <button
            className="absolute top-4 right-5 text-white text-2xl leading-none font-bold hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white z-10"
            onClick={closeLightbox}
            aria-label="Close enlarged view (or press Escape)"
          >
            ✕
          </button>

          <div
            className="max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.artworkUrl!}
              alt={
                lightbox.transcript ||
                `${SERIES_META[lightbox.series]?.name}${
                  lightbox.episode != null ? ` — Week ${lightbox.episode}` : ""
                }${lightbox.title ? `: ${lightbox.title}` : ""}`
              }
              className="w-full h-auto max-h-[78vh] object-contain"
            />

            {(lightbox.title || lightbox.caption) && (
              <div className="mt-4 text-center">
                {lightbox.title && (
                  <p className="text-white text-sm font-bold uppercase tracking-widest">
                    {SERIES_META[lightbox.series]?.name}
                    {lightbox.episode != null ? ` — Week ${lightbox.episode}` : ""}
                    {lightbox.title !== SERIES_META[lightbox.series]?.name
                      ? `: ${lightbox.title}`
                      : ""}
                  </p>
                )}
                {lightbox.caption && (
                  <p className="text-gray-400 text-xs font-serif italic mt-1 max-w-xl mx-auto">
                    {lightbox.caption}
                  </p>
                )}
              </div>
            )}

            {lightbox.transcript && (
              <details className="mt-4 w-full max-w-xl">
                <summary className="text-[10px] font-bold uppercase tracking-widest text-gray-500 cursor-pointer text-center hover:text-gray-300">
                  Accessible Transcript
                </summary>
                <p className="mt-2 text-xs text-gray-300 font-mono leading-relaxed text-center max-w-xl mx-auto">
                  {lightbox.transcript}
                </p>
              </details>
            )}

            <p className="mt-5 text-[9px] font-bold uppercase tracking-widest text-gray-600">
              Click outside or press Escape to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

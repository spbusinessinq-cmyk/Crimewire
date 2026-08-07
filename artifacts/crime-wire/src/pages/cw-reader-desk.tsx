import { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const TABS = [
  { id: "letter", label: "Letter to the Desk", short: "Letter" },
  { id: "spotlight", label: "Community Spotlight", short: "Spotlight" },
  { id: "ask", label: "Ask the Desk", short: "Ask" },
  { id: "art", label: "Art Submission", short: "Art" },
  { id: "tip", label: "Tip / Lead", short: "Tip" },
  { id: "puzzle_answer", label: "Puzzle Answer", short: "Puzzle" },
  { id: "wire_hunt", label: "Wire Hunt", short: "Wire Hunt" },
] as const;

type TabType = typeof TABS[number]["id"];

const baseSchema = z.object({
  nameOrAlias: z.string().optional(),
  contactEmail: z
    .string()
    .email("Valid email required")
    .optional()
    .or(z.literal("")),
  body: z.string().min(5, "Please write at least 5 characters"),
  extra: z.string().optional(),
  consentToPublish: z.boolean().default(false),
});

type FormData = z.infer<typeof baseSchema>;

const PROMPTS: Record<TabType, { bodyLabel: string; bodyPlaceholder: string; extraLabel?: string; extraPlaceholder?: string; notice: string }> = {
  letter: {
    bodyLabel: "Your Letter",
    bodyPlaceholder: "Write your letter to the Crime Wire desk...",
    notice: "Letters may be edited for length and clarity. Publication is at the editors' discretion. Include your name or alias if you'd like attribution.",
  },
  spotlight: {
    bodyLabel: "Community Story",
    bodyPlaceholder: "Describe the person, organization, or story you'd like to spotlight...",
    extraLabel: "Name / Organization",
    extraPlaceholder: "Name of the person or group being spotlighted",
    notice: "Community Spotlights are reviewed before publication. Consent of the subject is required before names are printed.",
  },
  ask: {
    bodyLabel: "Your Question",
    bodyPlaceholder: "What would you like to ask the Crime Wire desk?",
    notice: "Selected questions are answered in the Reader Desk section of the next issue. We cannot guarantee a response to every question.",
  },
  art: {
    bodyLabel: "Description of Submission",
    bodyPlaceholder: "Describe your artwork, photograph, or illustration. Include subject matter, medium, and any relevant context...",
    extraLabel: "File / Contact Details",
    extraPlaceholder: "How to reach you with the artwork, or describe how you'll send it",
    notice: "Crime Wire accepts period-appropriate illustration, photography, and graphic work. Original files must be submitted by email after contact. We cannot guarantee publication.",
  },
  tip: {
    bodyLabel: "Tip / Lead",
    bodyPlaceholder: "Describe the tip, document lead, or investigative lead...",
    extraLabel: "Provenance / Source",
    extraPlaceholder: "Describe the source, date, or origin of any documents",
    notice: "Crime Wire does not promise anonymity and does not operate a secure document drop. Do not submit documents you cannot share through ordinary channels. Contact information is used only to follow up on this tip.",
  },
  puzzle_answer: {
    bodyLabel: "Your Answer",
    bodyPlaceholder: "Enter the crossword or puzzle answer. Include the clue or puzzle title if submitting a correction.",
    notice: "Puzzle answers are logged. Correct first submissions may be noted in the next issue.",
  },
  wire_hunt: {
    bodyLabel: "Wire Hunt Submission",
    bodyPlaceholder: "Enter your Wire Hunt answer or submission. Include the hunt edition date if known.",
    notice: "Wire Hunt submissions are logged per-edition. Winners are announced in the following issue.",
  },
};

export default function CwReaderDesk() {
  useEffect(() => {
    document.title = "Reader Desk | Los Angeles Crime Wire";
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>("letter");
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      nameOrAlias: "",
      contactEmail: "",
      body: "",
      extra: "",
      consentToPublish: false,
    },
  });


  // Reset form when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSuccess(false);
    setServerError("");
    form.reset({
      nameOrAlias: "",
      contactEmail: "",
      body: "",
      extra: "",
      consentToPublish: false,
    });
  };

  const onSubmit = async (data: FormData) => {
    setServerError("");
    setSubmitting(true);

    if (activeTab === "tip") {
      try {
        const tipRes = await fetch('/api/tips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.nameOrAlias || null,
            contactEmail: data.contactEmail || null,
            message: data.body,
            source: data.extra || null,
          }),
        });
        if (tipRes.ok) {
          setSuccess(true);
          form.reset();
        } else {
          setServerError("Unable to submit. Please try again.");
        }
        setSubmitting(false);
      } catch {
        setServerError("Unable to submit. Please try again.");
        setSubmitting(false);
      }
      return;
    }

    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/letters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          nameOrAlias: data.nameOrAlias || undefined,
          contactEmail: data.contactEmail || undefined,
          body: data.body,
          extra: data.extra || undefined,
          consentToPublish: data.consentToPublish,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setServerError((err as any).error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      form.reset();
    } catch {
      setServerError("Unable to submit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const prompt = PROMPTS[activeTab];

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire</span>
            <h1 className="text-4xl sm:text-5xl font-headline font-bold uppercase tracking-widest">Reader Desk</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif text-base text-gray-600 mt-4 max-w-2xl">
          Crime Wire welcomes reader tips, correspondence, corrections, puzzle answers, and community spotlights.
          All submissions are reviewed. This is not an anonymous or secure document system.
        </p>
      </header>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b-2 border-black pb-0 mb-8 -mb-[2px]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors border-b-2 -mb-[2px] ${
              activeTab === tab.id
                ? "border-black bg-black text-white"
                : "border-transparent hover:border-gray-400 bg-white text-black"
            }`}
          >
            {tab.short}
          </button>
        ))}
      </div>

      {/* Full tab title */}
      <div className="mb-6">
        <h2 className="font-headline font-bold text-2xl uppercase tracking-widest">
          {TABS.find((t) => t.id === activeTab)?.label}
        </h2>
      </div>

      <div className="border-4 border-black bg-white p-6 sm:p-10">
        {success ? (
          <div className="text-center py-12">
            <div className="inline-flex justify-center items-center w-16 h-16 border-2 border-black mb-6">
              <CheckIcon />
            </div>
            <h3 className="font-headline font-bold text-2xl uppercase tracking-widest mb-3">
              Submission Received
            </h3>
            <p className="font-serif text-base text-gray-700 max-w-sm mx-auto">
              Your {TABS.find((t) => t.id === activeTab)?.label.toLowerCase()} has been logged with the Bureau Desk.
              All submissions are reviewed before any action is taken.
            </p>
            <button
              onClick={() => { setSuccess(false); }}
              className="mt-8 bg-black text-white px-8 py-3 text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
            >
              Submit Another
            </button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {serverError && (
              <div className="border-2 border-red-600 text-red-700 p-4 text-xs font-bold uppercase tracking-wider">
                {serverError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Name or Alias</label>
                <input
                  type="text"
                  {...form.register("nameOrAlias")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Contact Email</label>
                <input
                  type="email"
                  {...form.register("contactEmail")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
                {form.formState.errors.contactEmail && (
                  <p className="text-xs text-red-600 font-bold mt-1 uppercase">{form.formState.errors.contactEmail.message}</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">{prompt.bodyLabel} *</label>
              <textarea
                {...form.register("body")}
                rows={7}
                placeholder={prompt.bodyPlaceholder}
                className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none placeholder:text-gray-400"
              />
              {form.formState.errors.body && (
                <p className="text-xs text-red-600 font-bold mt-1 uppercase">{form.formState.errors.body.message}</p>
              )}
            </div>

            {prompt.extraLabel && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">{prompt.extraLabel}</label>
                <input
                  type="text"
                  {...form.register("extra")}
                  placeholder={prompt.extraPlaceholder}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white placeholder:text-gray-400"
                />
              </div>
            )}

            {(activeTab !== "puzzle_answer" && activeTab !== "wire_hunt") && (
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="relative pt-0.5 flex-shrink-0">
                    <input type="checkbox" {...form.register("consentToPublish")} className="peer sr-only" />
                    <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black flex items-center justify-center text-white">
                      <svg className="w-3 h-3 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[11px] font-serif leading-tight text-gray-700">
                    I consent to this submission being considered for publication in the Los Angeles Crime Wire.
                    I understand publication is at the editors' discretion and my name/alias may be printed.
                  </span>
                </label>
              </div>
            )}

            <div className="border border-black p-4 bg-gray-50 text-xs font-serif leading-relaxed text-gray-700">
              <strong className="block mb-1.5 font-sans font-bold uppercase tracking-widest text-black">Notice:</strong>
              {prompt.notice}
            </div>

            <button
              type="submit"
              disabled={submitting || false}
              className="w-full bg-black text-white py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(submitting || false) ? "Transmitting…" : "Submit to Bureau Desk"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

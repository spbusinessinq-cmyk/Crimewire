import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const TIERS = [
  {
    id: "press_club",
    label: "Press Club Member",
    price: "Free",
    desc: "Digital edition access, Reader Desk priority, Press Club dispatch newsletter.",
    showAddress: false,
  },
  {
    id: "founding",
    label: "Founding Supporter",
    price: "Waitlist — No Payment Taken",
    desc: "Reserved founding credit. First print allocation when mailing begins. Your name in the masthead if you choose.",
    showAddress: false,
  },
  {
    id: "print_waitlist",
    label: "Print Edition Waitlist",
    price: "Waitlist — No Payment Taken",
    desc: "Mailed copy when the print run begins. Priority by Los Angeles zip code and founding date.",
    showAddress: true,
  },
];

const schema = z.object({
  email: z.string().email("A valid email is required"),
  name: z.string().optional(),
  tier: z.enum(["press_club", "founding", "print_waitlist"]),
  city: z.string().optional(),
  zip: z.string().optional().refine((v) => !v || /^\d{5}$/.test(v), "Must be a 5-digit ZIP"),
  mailingAddress: z.string().optional(),
  message: z.string().optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "You must agree to be contacted." }) }),
});

type FormData = z.infer<typeof schema>;

export default function CwPressClub() {
  useEffect(() => {
    document.title = "Press Club | Los Angeles Crime Wire";
  }, []);

  const [success, setSuccess] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedTier, setConfirmedTier] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      name: "",
      tier: "press_club",
      city: "",
      zip: "",
      mailingAddress: "",
      message: "",
      // @ts-ignore
      consent: false,
    },
  });

  const selectedTier = form.watch("tier");
  const tierInfo = TIERS.find((t) => t.id === selectedTier);

  const onSubmit = async (data: FormData) => {
    setDuplicate(false);
    setServerError("");
    setSubmitting(true);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
      const res = await fetch(`${base}/api/press-club`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          name: data.name || undefined,
          tier: data.tier,
          city: data.city || undefined,
          zip: data.zip || undefined,
          mailingAddress: data.mailingAddress || undefined,
          message: data.message || undefined,
          consent: data.consent,
        }),
      });

      if (res.status === 409) {
        setDuplicate(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setServerError((err as any).error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      setConfirmedTier(TIERS.find((t) => t.id === data.tier)?.label ?? data.tier);
      setSuccess(true);
      form.reset();
    } catch {
      setServerError("Unable to submit. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      <header className="mb-10 border-b-4 border-black pb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-2">Los Angeles Crime Wire</span>
            <h1 className="text-4xl font-headline font-bold uppercase tracking-widest">Press Club</h1>
          </div>
          <Link href="/crime-wire" className="text-[10px] font-bold uppercase tracking-widest border-b border-black hover:text-gray-600 transition-colors self-end pb-0.5">
            ← Crime Wire
          </Link>
        </div>
        <p className="font-serif italic text-sm text-gray-700 mt-4 max-w-2xl">
          Support independent investigative journalism in Los Angeles. No subscriptions, no payment required.
          Join as a Press Club member, reserve your founding credit, or get on the print waitlist.
        </p>
      </header>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => form.setValue("tier", tier.id as any)}
            className={`text-left p-5 border-2 transition-colors ${
              selectedTier === tier.id
                ? "border-black bg-black text-white"
                : "border-black bg-white hover:bg-gray-50"
            }`}
          >
            <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${selectedTier === tier.id ? "text-gray-300" : "text-gray-500"}`}>
              {tier.price}
            </p>
            <p className="font-headline font-bold text-lg uppercase leading-tight mb-2">{tier.label}</p>
            <p className={`text-xs leading-relaxed ${selectedTier === tier.id ? "text-gray-200" : "text-gray-600"}`}>{tier.desc}</p>
          </button>
        ))}
      </div>

      {success ? (
        <div className="border-4 border-black p-10 text-center">
          <div className="inline-flex justify-center items-center w-16 h-16 border-2 border-black mb-6">
            <CheckIcon />
          </div>
          <h3 className="font-headline font-bold text-2xl uppercase tracking-widest mb-3">Signup Recorded</h3>
          <p className="font-serif text-base text-gray-700 mb-2">
            Your <strong>{confirmedTier}</strong> signup has been logged.
          </p>
          <p className="font-serif text-sm text-gray-600 max-w-sm mx-auto">
            No payment has been taken. We'll be in touch when the relevant tier opens or mailing begins.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="mt-8 text-xs uppercase tracking-widest font-bold underline"
          >
            Register Another
          </button>
        </div>
      ) : (
        <div className="border-4 border-black p-6 sm:p-10 bg-white">
          {duplicate && (
            <div className="mb-6 bg-black text-white p-4 text-xs font-bold uppercase tracking-wider text-center">
              This email is already registered. If you need to change your tier, contact the desk.
            </div>
          )}
          {serverError && (
            <div className="mb-6 border-2 border-red-600 text-red-700 p-4 text-xs font-bold uppercase tracking-wider">
              {serverError}
            </div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register("tier")} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Email Address *</label>
                <input
                  type="email"
                  {...form.register("email")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-red-600 font-bold mt-1 uppercase">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Name / Alias</label>
                <input
                  type="text"
                  {...form.register("name")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">City</label>
                <input
                  type="text"
                  {...form.register("city")}
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">ZIP Code</label>
                <input
                  type="text"
                  {...form.register("zip")}
                  placeholder="e.g. 90014"
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white placeholder:text-gray-400"
                />
                {form.formState.errors.zip && (
                  <p className="text-xs text-red-600 font-bold mt-1 uppercase">{form.formState.errors.zip.message}</p>
                )}
              </div>
            </div>

            {tierInfo?.showAddress && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Mailing Address <span className="text-gray-400">(Print Waitlist)</span></label>
                <textarea
                  {...form.register("mailingAddress")}
                  rows={3}
                  placeholder="Street address, city, state, ZIP"
                  className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none placeholder:text-gray-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1.5">Message (Optional)</label>
              <textarea
                {...form.register("message")}
                rows={3}
                placeholder="Why you're signing up, any questions, or how you found us"
                className="w-full border-2 border-black p-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black bg-white resize-none placeholder:text-gray-400"
              />
            </div>

            <div className="border border-black p-4 bg-gray-50 text-xs font-serif leading-relaxed text-gray-700">
              <strong className="block mb-1.5 font-sans font-bold uppercase tracking-widest text-black">Notice:</strong>
              No payment is collected at any stage. Founding Supporter is a waitlist — your position is reserved
              but no charge is made until a payment system is operational, at which point you will be notified
              explicitly before any charge occurs. Your email is used only for Crime Wire communications.
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <div className="relative pt-0.5 flex-shrink-0">
                  <input type="checkbox" {...form.register("consent")} className="peer sr-only" />
                  <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black flex items-center justify-center text-white">
                    <svg className="w-3 h-3 opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <span className="text-[11px] font-serif leading-tight text-gray-700">
                  I agree to be contacted by Crime Wire regarding my signup tier. I understand no payment is taken and
                  I can withdraw at any time.
                </span>
              </label>
              {form.formState.errors.consent && (
                <p className="text-xs text-red-600 font-bold mt-2 uppercase">{form.formState.errors.consent.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-black text-white py-4 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Submitting…" : `Join — ${tierInfo?.label ?? "Press Club"}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

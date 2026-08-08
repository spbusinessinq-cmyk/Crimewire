// Shared utilities and micro-components for Admin Desk tabs
// Auth: HttpOnly cookie — credentials sent automatically; no token parameter needed.

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

/** Authenticated JSON fetch. Cookies sent automatically via credentials: "include". */
export async function api(
  path: string,
  opts: RequestInit = {}
): Promise<Response> {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
}

/** Authenticated multipart/form-data fetch (no Content-Type override — browser sets boundary). */
export async function apiForm(
  path: string,
  body: FormData,
  method = "POST"
): Promise<Response> {
  return fetch(`${BASE}/api${path}`, {
    method,
    credentials: "include",
    body,
  });
}

// Status badge colours
export const STATUS_COLORS: Record<string, string> = {
  // Report statuses
  draft: "bg-gray-100 text-gray-700 border border-gray-300",
  needs_review: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  scheduled: "bg-blue-100 text-blue-800 border border-blue-300",
  published: "bg-green-100 text-green-800 border border-green-300",
  developing: "bg-orange-100 text-orange-800 border border-orange-300",
  updated: "bg-teal-100 text-teal-800 border border-teal-300",
  corrected: "bg-red-100 text-red-700 border border-red-300",
  archived: "bg-gray-200 text-gray-500 border border-gray-300",
  // Subscriber / misc
  active: "bg-green-100 text-green-800 border border-green-300",
  unsubscribed: "bg-gray-200 text-gray-500 border border-gray-300",
  bounced: "bg-red-100 text-red-700 border border-red-300",
  // Approval
  pending: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  approved: "bg-green-100 text-green-800 border border-green-300",
  // Press Club
  waitlisted: "bg-purple-100 text-purple-800 border border-purple-300",
  confirmed: "bg-green-100 text-green-800 border border-green-300",
  // Tips / Letters
  new: "bg-blue-100 text-blue-800 border border-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  follow_up: "bg-orange-100 text-orange-800 border border-orange-300",
  verified_lead: "bg-green-100 text-green-800 border border-green-300",
  declined: "bg-red-100 text-red-700 border border-red-300",
  // Issues
  "draft-issue": "bg-gray-100 text-gray-700 border border-gray-300",
  // Records requests
  submitted: "bg-blue-100 text-blue-800 border border-blue-300",
  partial: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  fulfilled: "bg-green-100 text-green-800 border border-green-300",
  denied: "bg-red-100 text-red-700 border border-red-300",
};

// ── Tailwind class constants ──────────────────────────────────

export const inputCls =
  "w-full border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black rounded";
export const selectCls =
  "w-full border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black rounded";
export const textareaCls =
  "w-full border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-black rounded resize-y";
export const labelCls =
  "block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1";

// ── Micro-components ──────────────────────────────────────────

export function Badge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600 border border-gray-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-xs uppercase tracking-widest font-bold">{message}</p>
    </div>
  );
}

export function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm rounded">
      {message}
    </div>
  );
}

export function SuccessMsg({ message }: { message: string }) {
  return (
    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm rounded">
      {message}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
  size,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  /** "sm" | "md" (default) | "lg" */
  size?: string;
  className?: string;
}) {
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 border border-black",
    secondary: "bg-white text-black border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700 border border-red-600",
    ghost: "bg-transparent text-gray-600 hover:text-black border border-transparent hover:border-gray-200",
  };
  const sizes: Record<string, string> = {
    sm: "px-2 py-1 text-[10px]",
    md: "px-4 py-2 text-xs",
    lg: "px-6 py-3 text-sm",
  };
  const sizeCls = (size && sizes[size]) ? sizes[size] : sizes.md;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${sizeCls} font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  className = "",
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  /** Renders a red asterisk after the label */
  required?: boolean;
  /** Renders a helper line below the field */
  hint?: string;
}) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

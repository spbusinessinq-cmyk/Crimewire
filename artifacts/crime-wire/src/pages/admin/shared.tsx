// Shared utilities and micro-components for Admin Desk tabs

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export async function api(
  path: string,
  token: string,
  opts: RequestInit = {}
): Promise<Response> {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers ?? {}),
    },
  });
}

export async function apiForm(
  path: string,
  token: string,
  body: FormData,
  method = "POST"
): Promise<Response> {
  return fetch(`${BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
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
  rejected: "bg-red-100 text-red-700 border border-red-300",
  // Reader inbox
  new: "bg-blue-100 text-blue-800 border border-blue-300",
  reviewing: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  follow_up: "bg-orange-100 text-orange-800 border border-orange-300",
  verified_lead: "bg-green-100 text-green-800 border border-green-300",
  declined: "bg-gray-200 text-gray-500 border border-gray-300",
  // Records
  submitted: "bg-blue-100 text-blue-800 border border-blue-300",
  partial: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  fulfilled: "bg-green-100 text-green-800 border border-green-300",
  denied: "bg-red-100 text-red-700 border border-red-300",
  withdrawn: "bg-gray-200 text-gray-500 border border-gray-300",
};

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
    <div className="flex items-center justify-center py-12 text-gray-400">
      <div className="animate-spin h-5 w-5 border-2 border-gray-300 border-t-black rounded-full mr-2" />
      <span className="text-xs uppercase tracking-widest">Loading</span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-xs uppercase tracking-widest text-gray-400">
      {message}
    </div>
  );
}

export function ErrorMsg({ message }: { message: string }) {
  return (
    <div className="py-4 px-4 bg-red-50 border border-red-200 text-red-700 text-sm">
      {message}
    </div>
  );
}

export function SuccessMsg({ message }: { message: string }) {
  return (
    <div className="py-4 px-4 bg-green-50 border border-green-200 text-green-800 text-sm">
      {message}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h2>
      {action}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "sm",
  type = "button",
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "xs";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex items-center font-bold uppercase tracking-widest transition-colors focus:outline-none focus:ring-1 focus:ring-black";
  const sizes = {
    xs: "px-2 py-1 text-[10px]",
    sm: "px-3 py-1.5 text-xs",
  };
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 disabled:opacity-40",
    secondary: "bg-white text-black border border-black hover:bg-gray-50 disabled:opacity-40",
    danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-40",
    ghost: "bg-transparent text-gray-500 hover:text-black disabled:opacity-40",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest mb-1 text-gray-600">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

export const inputCls = "w-full border border-gray-300 px-2 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-black focus:border-black";
export const selectCls = "w-full border border-gray-300 px-2 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-black";
export const textareaCls = "w-full border border-gray-300 px-2 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-black font-mono";

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export function downloadCsv(data: object[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((r) =>
    headers.map((h) => {
      const v = (r as Record<string, unknown>)[h];
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

import { useState, useEffect } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, selectCls, textareaCls, fmtDateTime } from "./shared";

interface Props {}

interface Letter {
  id: number; type: string; nameOrAlias: string | null;
  contactEmail: string | null; body: string; extra: string | null;
  source: string | null; consentToPublish: boolean;
  status: string; adminNote: string | null; createdAt: string;
}

interface Tip {
  id: number; nameOrAlias: string | null; contactEmail: string | null;
  message: string; provenance: string | null; createdAt: string;
}

type TabId = "letters" | "tips";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "reviewing", label: "Reviewing" },
  { value: "follow_up", label: "Follow-Up Needed" },
  { value: "verified_lead", label: "Verified Lead" },
  { value: "published", label: "Published" },
  { value: "declined", label: "Declined" },
  { value: "archived", label: "Archived" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "letter", label: "Letters to the Desk" },
  { value: "spotlight", label: "Community Spotlight" },
  { value: "ask", label: "Ask the Desk" },
  { value: "art", label: "Reader Art" },
  { value: "tip", label: "Tip" },
  { value: "puzzle_answer", label: "Puzzle Answer" },
  { value: "wire_hunt", label: "Wire Hunt Entry" },
];

const TYPE_LABELS: Record<string, string> = {
  letter: "Letter", spotlight: "Spotlight", ask: "Ask",
  art: "Art", tip: "Tip", puzzle_answer: "Puzzle", wire_hunt: "Wire Hunt",
};

export default function AdminReaderInbox() {
  const [activeTab, setActiveTab] = useState<TabId>("letters");
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [note, setNote] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLetters = (type?: string) => {
    const q = type ? `?type=${type}` : "";
    api(`/letters${q}`).then(async (r) => {
      if (r.ok) setLetters(await r.json());
    }).finally(() => setLoading(false));
  };

  const loadTips = () => {
    api("/tips").then(async (r) => {
      if (r.ok) setTips(await r.json());
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === "letters") loadLetters(filterType || undefined);
    else loadTips();
  }, [activeTab, filterType]);

  async function updateLetter(id: number, updates: Partial<Letter>) {
    setSaving(true); setError(""); setSuccess("");
    const res = await api(`/letters/${id}`, {
      method: "PATCH", body: JSON.stringify(updates),
    });
    if (res.ok) {
      setSuccess("Submission updated.");
      loadLetters(filterType || undefined);
    } else {
      const d = await res.json();
      setError(d.error ?? "Update failed");
    }
    setSaving(false);
  }

  function filterLetters(ls: Letter[]) {
    let result = ls;
    if (filterStatus) result = result.filter((l) => l.status === filterStatus);
    return result;
  }

  const displayLetters = filterLetters(letters);

  const TABS: { id: TabId; label: string; count: number }[] = [
    { id: "letters", label: "Submissions", count: letters.length },
    { id: "tips", label: "Tips", count: tips.length },
  ];

  return (
    <div>
      {/* Tab nav */}
      <div className="flex items-center gap-0 mb-4 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors ${
              activeTab === t.id ? "border-black text-black" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      {activeTab === "letters" && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <div className="w-44">
              <select className={selectCls} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="w-44">
              <select className={selectCls} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400 self-center">{displayLetters.length} item{displayLetters.length !== 1 ? "s" : ""}</p>
          </div>

          {loading ? <Spinner /> : displayLetters.length === 0 ? (
            <EmptyState message="No submissions match these filters" />
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200">
              {displayLetters.map((l) => (
                <div key={l.id} className="px-4 py-3">
                  <div
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                          {TYPE_LABELS[l.type] ?? l.type}
                        </span>
                        <Badge status={l.status} />
                        {l.consentToPublish && (
                          <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest">Consent Given</span>
                        )}
                      </div>
                      <p className="text-sm font-medium">
                        {l.nameOrAlias || <span className="text-gray-400 italic">Anonymous</span>}
                        {l.contactEmail && <span className="text-gray-400 text-xs ml-2">{l.contactEmail}</span>}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{l.body}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{fmtDateTime(l.createdAt)}</p>
                    </div>
                    <span className="text-gray-400 text-xs">{expanded === l.id ? "▲" : "▼"}</span>
                  </div>

                  {expanded === l.id && (
                    <div className="mt-3 space-y-3 pt-3 border-t border-gray-100">
                      <div className="bg-gray-50 p-3">
                        <p className="text-sm whitespace-pre-wrap">{l.body}</p>
                        {l.extra && (
                          <p className="text-xs text-gray-500 mt-2 italic">{l.extra}</p>
                        )}
                      </div>

                      {l.adminNote && (
                        <p className="text-xs text-gray-500 italic">Note: {l.adminNote}</p>
                      )}

                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-[200px]">
                          <Field label="Status">
                            <select
                              className={selectCls}
                              value={l.status}
                              onChange={(e) => updateLetter(l.id, { status: e.target.value })}
                            >
                              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <Field label="Private Note">
                            <div className="flex gap-2">
                              <textarea
                                className={textareaCls}
                                rows={1}
                                value={note[l.id] ?? l.adminNote ?? ""}
                                onChange={(e) => setNote({ ...note, [l.id]: e.target.value })}
                                placeholder="Internal note…"
                              />
                              <Btn
                                size="xs"
                                variant="secondary"
                                onClick={() => updateLetter(l.id, { adminNote: note[l.id] ?? "" })}
                                disabled={saving}
                              >Save</Btn>
                            </div>
                          </Field>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "tips" && (
        <div>
          <div className="border border-gray-200 bg-yellow-50 p-3 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-800 mb-1">Tip Handling</p>
            <p className="text-xs text-yellow-900">
              Reader tips are not a secure document submission system. All tips are reviewed before any action is taken.
              Do not contact tip sources directly without editorial review.
            </p>
          </div>
          {loading ? <Spinner /> : tips.length === 0 ? (
            <EmptyState message="No tips received" />
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200">
              {tips.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {t.nameOrAlias || <span className="text-gray-400 italic">Anonymous</span>}
                        {t.contactEmail && <span className="text-gray-400 text-xs ml-2">{t.contactEmail}</span>}
                      </p>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{t.message}</p>
                      {t.provenance && <p className="text-xs text-gray-400 mt-1 italic">{t.provenance}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{fmtDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

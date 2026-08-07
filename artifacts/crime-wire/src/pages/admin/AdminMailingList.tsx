import { useState, useEffect } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, fmtDate, downloadCsv } from "./shared";

interface Props {}

interface Subscriber {
  id: number; email: string; name: string | null; zip: string | null;
  editionType: string; consent: boolean; createdAt: string;
}

interface PressClubMember {
  id: number; email: string; name: string | null; tier: string;
  city: string | null; zip: string | null; mailingAddress: string | null;
  status: string; adminNote: string | null; createdAt: string;
}

type TabId = "digital" | "press_club";

const EDITION_LABELS: Record<string, string> = {
  digital: "Digital Edition",
  mailed: "Mailed Copy (Waitlist)",
  both: "Both",
};

export default function AdminMailingList() {
  const [activeTab, setActiveTab] = useState<TabId>("digital");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [pressClub, setPressClub] = useState<PressClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEdition, setFilterEdition] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteVal, setNoteVal] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      api("/subscriptions").then((r) => r.ok ? r.json() : []),
      api("/press-club").then((r) => r.ok ? r.json() : []),
    ]).then(([subs, pc]) => {
      // Remove obvious test records
      const cleanSubs = (subs as Subscriber[]).filter(
        (s) => !s.email.includes("test") && !s.email.includes("audit@") && !s.email.includes("example.com")
      );
      const cleanPc = (pc as PressClubMember[]).filter(
        (m) => !m.email.includes("test") && !m.email.includes("audit@") && !m.email.includes("example.com")
      );
      setSubscribers(cleanSubs);
      setPressClub(cleanPc);
    }).finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  async function updatePressClub(id: number, updates: Partial<PressClubMember>) {
    setSaving(true); setError(""); setSuccess("");
    const res = await api(`/press-club/${id}`, {
      method: "PATCH", body: JSON.stringify(updates),
    });
    if (res.ok) {
      setSuccess("Member updated.");
      setEditingNote(null);
      loadAll();
    } else {
      const d = await res.json();
      setError(d.error ?? "Update failed");
    }
    setSaving(false);
  }

  // Filtered subscribers
  const filteredSubs = subscribers.filter((s) => {
    if (search && !s.email.toLowerCase().includes(search.toLowerCase()) &&
        !(s.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterEdition && s.editionType !== filterEdition) return false;
    return true;
  });

  // Filtered press club
  const filteredPc = pressClub.filter((m) => {
    if (search && !m.email.toLowerCase().includes(search.toLowerCase()) &&
        !(m.name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTier && m.tier !== filterTier) return false;
    return true;
  });

  const printWaitlist = filteredPc.filter((m) => m.tier === "print_waitlist");
  const pressClubMembers = filteredPc.filter((m) => m.tier !== "print_waitlist");

  return (
    <div>
      {/* Notice */}
      <div className="border border-gray-200 bg-gray-50 p-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Email Delivery Status</p>
        <p className="text-xs text-gray-600">
          No outbound email provider is connected. Signups are recorded but no confirmation or dispatch emails are sent.
          Connect Resend or SendGrid to activate delivery.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4 border-b border-gray-200">
        {([
          { id: "digital", label: "Digital Readers", count: subscribers.length },
          { id: "press_club", label: "Press Club", count: pressClub.length },
        ] as const).map((t) => (
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

      {/* Search + filters + export */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          className={inputCls + " w-56"}
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {activeTab === "digital" && (
          <select className={selectCls + " w-44"} value={filterEdition} onChange={(e) => setFilterEdition(e.target.value)}>
            <option value="">All editions</option>
            <option value="digital">Digital</option>
            <option value="mailed">Mailed (Waitlist)</option>
            <option value="both">Both</option>
          </select>
        )}
        {activeTab === "press_club" && (
          <select className={selectCls + " w-44"} value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
            <option value="">All tiers</option>
            <option value="press_club">Press Club</option>
            <option value="founding">Founding Supporter</option>
            <option value="print_waitlist">Print Waitlist</option>
          </select>
        )}
        <Btn
          variant="secondary"
          size="xs"
          onClick={() => downloadCsv(
            activeTab === "digital" ? filteredSubs : filteredPc,
            activeTab === "digital" ? "digital-readers.csv" : "press-club.csv"
          )}
        >
          Export CSV
        </Btn>
        <span className="text-xs text-gray-400 self-center">
          {activeTab === "digital" ? filteredSubs.length : filteredPc.length} results
        </span>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* Digital Readers */}
          {activeTab === "digital" && (
            filteredSubs.length === 0 ? (
              <EmptyState message="No digital subscribers match this filter" />
            ) : (
              <div className="divide-y divide-gray-100 border border-gray-200">
                {filteredSubs.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{s.email}</span>
                        {s.name && <span className="text-xs text-gray-500">{s.name}</span>}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                          {EDITION_LABELS[s.editionType] ?? s.editionType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[10px] text-gray-400">Signed up {fmtDate(s.createdAt)}</span>
                        {s.zip && <span className="text-[10px] text-gray-400">ZIP {s.zip}</span>}
                        {s.consent && <span className="text-[10px] text-green-600">Consent recorded</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Press Club */}
          {activeTab === "press_club" && (
            <div className="space-y-6">
              {/* Press Club + Founding */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Press Club & Founding Supporters ({pressClubMembers.length})
                </h3>
                {pressClubMembers.length === 0 ? (
                  <EmptyState message="No members match this filter" />
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200">
                    {pressClubMembers.map((m) => (
                      <div key={m.id} className="px-4 py-3">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="font-medium text-sm">{m.email}</span>
                              {m.name && <span className="text-xs text-gray-500">{m.name}</span>}
                              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                {m.tier === "founding" ? "Founding" : "Press Club"}
                              </span>
                              <Badge status={m.status} />
                            </div>
                            {m.city && <p className="text-[10px] text-gray-400">{m.city}{m.zip ? `, ${m.zip}` : ""}</p>}
                            <p className="text-[10px] text-gray-400 mt-0.5">Joined {fmtDate(m.createdAt)}</p>
                            {m.adminNote && editingNote !== m.id && (
                              <p className="text-xs text-gray-500 italic mt-1">Note: {m.adminNote}</p>
                            )}
                            {editingNote === m.id && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  className={inputCls + " flex-1 text-xs"}
                                  value={noteVal}
                                  onChange={(e) => setNoteVal(e.target.value)}
                                  placeholder="Add internal note…"
                                />
                                <Btn size="xs" onClick={() => updatePressClub(m.id, { adminNote: noteVal })} disabled={saving}>Save</Btn>
                                <Btn size="xs" variant="secondary" onClick={() => setEditingNote(null)}>Cancel</Btn>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <Btn size="xs" variant="ghost" onClick={() => { setEditingNote(m.id); setNoteVal(m.adminNote ?? ""); }}>Note</Btn>
                            {m.status === "active" && (
                              <Btn size="xs" variant="secondary" onClick={() => updatePressClub(m.id, { status: "inactive" })} disabled={saving}>
                                Deactivate
                              </Btn>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Print Waitlist */}
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                  Print Edition Waitlist ({printWaitlist.length})
                </h3>
                <p className="text-xs text-gray-400 mb-3">
                  Ordered by signup date. Priority by LA zip code when print run begins.
                </p>
                {printWaitlist.length === 0 ? (
                  <EmptyState message="Print waitlist is empty" />
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-200">
                    {printWaitlist.map((m, idx) => (
                      <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                        <span className="text-lg font-serif font-bold text-gray-300 w-6 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{m.email}</span>
                            {m.name && <span className="text-xs text-gray-500">{m.name}</span>}
                            <Badge status={m.status} />
                          </div>
                          {(m.city || m.zip) && (
                            <p className="text-[10px] text-gray-400">{[m.city, m.zip].filter(Boolean).join(" · ")}</p>
                          )}
                          {m.mailingAddress && (
                            <p className="text-[10px] text-gray-400">{m.mailingAddress}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{fmtDate(m.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { api, Badge, Spinner, EmptyState, ErrorMsg, SuccessMsg, Btn, Field, inputCls, selectCls, textareaCls, fmtDate } from "./shared";

interface Props { token: string }

interface Advertiser {
  id: number; businessName: string; contactName: string | null;
  contactEmail: string | null; placementDesc: string | null;
  campaignStartDate: string | null; campaignEndDate: string | null;
  destinationUrl: string | null; campaignSource: string | null;
  disclosureLabel: string; approvalStatus: string;
  assetsDescription: string | null; active: boolean;
  internalNotes: string | null; createdAt: string; updatedAt: string;
}

const EMPTY: Partial<Advertiser> = {
  businessName: "", contactName: "", contactEmail: "", placementDesc: "",
  destinationUrl: "", campaignSource: "", disclosureLabel: "ADVERTISEMENT",
  approvalStatus: "pending", assetsDescription: "", active: false, internalNotes: "",
};

export default function AdminAdvertisers({ token }: Props) {
  const [items, setItems] = useState<Advertiser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Advertiser> | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api("/advertisers", token).then(async (r) => {
      if (r.ok) setItems(await r.json());
    }).finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  async function save() {
    if (!editing) return;
    setSaving(true); setError(""); setSuccess("");
    const isNew = !editing.id;
    const res = await api(
      isNew ? "/advertisers" : `/advertisers/${editing.id}`,
      token,
      { method: isNew ? "POST" : "PATCH", body: JSON.stringify(editing) }
    );
    if (res.ok) {
      setSuccess(isNew ? "Advertiser created." : "Advertiser updated.");
      setEditing(null);
      load();
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  function set(key: keyof Advertiser, value: unknown) {
    setEditing((e) => e ? { ...e, [key]: value } : e);
  }

  if (loading) return <Spinner />;

  if (editing !== null) {
    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            {editing.id ? "Edit Advertiser" : "New Advertiser"}
          </h2>
          <Btn variant="ghost" onClick={() => setEditing(null)}>← Back</Btn>
        </div>

        {error && <div className="mb-4"><ErrorMsg message={error} /></div>}

        <div className="space-y-4">
          <Field label="Business Name" required>
            <input className={inputCls} value={editing.businessName ?? ""} onChange={(e) => set("businessName", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <input className={inputCls} value={editing.contactName ?? ""} onChange={(e) => set("contactName", e.target.value)} />
            </Field>
            <Field label="Contact Email">
              <input type="email" className={inputCls} value={editing.contactEmail ?? ""} onChange={(e) => set("contactEmail", e.target.value)} />
            </Field>
          </div>
          <Field label="Placement Description" hint="Where and how the ad will appear (Market Page, classified section, etc.)">
            <textarea className={textareaCls} rows={2} value={editing.placementDesc ?? ""} onChange={(e) => set("placementDesc", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Campaign Start">
              <input type="date" className={inputCls} value={editing.campaignStartDate?.slice(0, 10) ?? ""} onChange={(e) => set("campaignStartDate", e.target.value)} />
            </Field>
            <Field label="Campaign End">
              <input type="date" className={inputCls} value={editing.campaignEndDate?.slice(0, 10) ?? ""} onChange={(e) => set("campaignEndDate", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Destination URL">
              <input className={inputCls} value={editing.destinationUrl ?? ""} onChange={(e) => set("destinationUrl", e.target.value)} />
            </Field>
            <Field label="Campaign Source (?src=)" hint="QR/link tracking parameter value">
              <input className={inputCls} value={editing.campaignSource ?? ""} onChange={(e) => set("campaignSource", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Required Disclosure Label" hint="Must be displayed on all paid content">
              <select className={selectCls} value={editing.disclosureLabel ?? "ADVERTISEMENT"} onChange={(e) => set("disclosureLabel", e.target.value)}>
                <option value="ADVERTISEMENT">ADVERTISEMENT</option>
                <option value="PAID_COMIC">PAID COMIC</option>
                <option value="SPONSORED">SPONSORED</option>
              </select>
            </Field>
            <Field label="Approval Status">
              <select className={selectCls} value={editing.approvalStatus ?? "pending"} onChange={(e) => set("approvalStatus", e.target.value)}>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </Field>
          </div>
          <Field label="Supplied Assets" hint="Description of materials received (files, copy, artwork)">
            <textarea className={textareaCls} rows={2} value={editing.assetsDescription ?? ""} onChange={(e) => set("assetsDescription", e.target.value)} />
          </Field>
          <Field label="Internal Notes">
            <textarea className={textareaCls} rows={2} value={editing.internalNotes ?? ""} onChange={(e) => set("internalNotes", e.target.value)} />
          </Field>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!editing.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Mark Active</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
          <Btn type="submit" onClick={save} disabled={saving || !editing.businessName}>
            {saving ? "Saving…" : editing.id ? "Update Advertiser" : "Create Advertiser"}
          </Btn>
          <Btn variant="secondary" onClick={() => setEditing(null)}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
          Advertisers ({items.length})
        </h2>
        <Btn onClick={() => setEditing({ ...EMPTY })}>+ New Advertiser</Btn>
      </div>

      {error && <div className="mb-4"><ErrorMsg message={error} /></div>}
      {success && <div className="mb-4"><SuccessMsg message={success} /></div>}

      <div className="border border-gray-200 p-4 bg-gray-50 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Disclosure Policy</p>
        <p className="text-xs text-gray-600">
          All paid content must display its disclosure label prominently. Market Page (Section 12) is the only section
          that carries advertising. No advertiser influences editorial content.
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState message="No advertisers on file" />
      ) : (
        <div className="divide-y divide-gray-100 border border-gray-200">
          {items.map((item) => (
            <div key={item.id} className="px-4 py-3 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-sm">{item.businessName}</span>
                  <Badge status={item.approvalStatus} />
                  {item.active && <span className="text-[10px] font-bold uppercase tracking-widest text-green-700">● Live</span>}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{item.disclosureLabel}</span>
                </div>
                {item.placementDesc && <p className="text-xs text-gray-500 truncate">{item.placementDesc}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {item.campaignStartDate ? fmtDate(item.campaignStartDate) : "—"} → {item.campaignEndDate ? fmtDate(item.campaignEndDate) : "—"}
                </p>
              </div>
              <Btn variant="secondary" size="xs" onClick={() => setEditing(item)}>Edit</Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

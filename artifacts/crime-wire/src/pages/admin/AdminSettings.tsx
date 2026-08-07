import { useState, useEffect } from "react";
import { api, Spinner, ErrorMsg, SuccessMsg, Field, inputCls, Btn } from "./shared";

interface Props { token: string }

const SETTING_DEFS: { key: string; label: string; hint: string; multiline?: boolean }[] = [
  { key: "newsroom_status", label: "Newsroom Status", hint: 'Public status line shown in the footer. E.g. "RSR Crime Division — Active Bureau."' },
  { key: "thursday_release_info", label: "Thursday Release Info", hint: 'Thursday Drop schedule note. E.g. "Published every Thursday. Digital edition by 9 AM."' },
  { key: "standard_byline", label: "Standard Byline", hint: 'Default byline for unsigned reports. E.g. "RSR Crime Division Staff"' },
  { key: "contact_email", label: "Public Contact Email", hint: "Shown on the public site for editorial contact. Do not enter credentials here." },
  { key: "tagline", label: "Bureau Tagline", hint: 'Short tagline shown in the masthead. E.g. "Victim first. Facts second. Theories last."' },
  { key: "edition_schedule", label: "Edition Schedule", hint: 'Current edition cadence. E.g. "Weekly — Every Thursday."' },
  { key: "city_desk_notice", label: "City Desk Notice", hint: "Optional notice shown at the top of the public City Desk page." },
  { key: "records_desk_notice", label: "Records Desk Notice", hint: "Optional notice shown at the top of the public Records Desk page." },
  { key: "homepage_notice", label: "Homepage Notice", hint: "Optional notice shown on the Crime Division homepage." },
];

export default function AdminSettings({ token }: Props) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api("/settings", token).then(async (res) => {
      if (res.ok) setSettings(await res.json());
    }).finally(() => setLoading(false));
  }, [token]);

  async function saveSetting(key: string, value: string) {
    setSaving(key);
    setError("");
    setSuccess("");
    const res = await api("/settings", token, {
      method: "PUT",
      body: JSON.stringify({ key, value }),
    });
    if (res.ok) {
      setSuccess(`${key} saved.`);
      setTimeout(() => setSuccess(""), 3000);
    } else {
      const d = await res.json();
      setError(d.error ?? "Save failed");
    }
    setSaving(null);
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Editorial Settings</h2>
        <p className="text-xs text-gray-400">
          Safe editorial configuration. Do not store credentials, passwords, or API keys here — use environment secrets.
        </p>
      </div>

      {error && <ErrorMsg message={error} />}
      {success && <SuccessMsg message={success} />}

      <div className="space-y-6">
        {SETTING_DEFS.map((def) => (
          <SettingRow
            key={def.key}
            def={def}
            value={settings[def.key] ?? ""}
            onSave={(v) => saveSetting(def.key, v)}
            saving={saving === def.key}
          />
        ))}
      </div>

      <div className="border border-gray-200 p-4 bg-gray-50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Security Note</p>
        <p className="text-xs text-gray-600">
          Credentials, API keys, and passwords are stored as Replit environment secrets, not in this settings panel.
          Contact Replit support or your developer to rotate secrets.
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  def,
  value,
  onSave,
  saving,
}: {
  def: typeof SETTING_DEFS[number];
  value: string;
  onSave: (v: string) => void;
  saving: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div>
      <Field label={def.label} hint={def.hint}>
        {def.multiline ? (
          <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-black"
          />
        ) : (
          <input
            type="text"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className={inputCls}
          />
        )}
      </Field>
      <div className="mt-1">
        <Btn onClick={() => onSave(local)} disabled={saving || local === value} size="xs">
          {saving ? "Saving…" : "Save"}
        </Btn>
      </div>
    </div>
  );
}

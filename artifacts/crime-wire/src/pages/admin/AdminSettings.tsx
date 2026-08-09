import { useState, useEffect } from "react";
import { api, Spinner, ErrorMsg, SuccessMsg, Field, inputCls, Btn } from "./shared";

const SETTING_DEFS: { key: string; label: string; hint: string; multiline?: boolean }[] = [
  { key: "newsroom_status", label: "Newsroom Status", hint: 'Public status line. E.g. "RSR Crime Division — Active Bureau."' },
  { key: "thursday_release_info", label: "Thursday Release Info", hint: 'Thursday Drop schedule note.' },
  { key: "standard_byline", label: "Standard Byline", hint: 'Default byline for unsigned reports.' },
  { key: "contact_email", label: "Public Contact Email", hint: "Shown on the public site. Do not put credentials here." },
  { key: "tagline", label: "Bureau Tagline", hint: 'Short tagline. E.g. "Victim first. Facts second. Theories last."' },
  { key: "edition_schedule", label: "Edition Schedule", hint: 'E.g. "Weekly — Every Thursday."' },
  { key: "city_desk_notice", label: "City Desk Notice", hint: "Optional notice shown at the top of the public City Desk page." },
  { key: "records_desk_notice", label: "Records Desk Notice", hint: "Optional notice shown at the top of the public Records Desk page." },
  { key: "homepage_notice", label: "Homepage Notice", hint: "Optional notice shown on the Crime Division homepage." },
];

interface EmailStatus {
  configured: boolean;
  missing: string[];
  optional: string[];
  hasNewsroom: boolean;
  siteUrl: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [emailLoading, setEmailLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api("/settings").then(async (res) => {
      if (res.ok) setSettings(await res.json());
    }).finally(() => setLoading(false));

    api("/admin/email/status").then(async (res) => {
      if (res.ok) setEmailStatus(await res.json());
    }).finally(() => setEmailLoading(false));
  }, []);

  async function saveSetting(key: string, value: string) {
    setSaving(key); setError(""); setSuccess("");
    const res = await api("/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
    if (res.ok) { setSuccess(`${key} saved.`); setTimeout(() => setSuccess(""), 3000); }
    else { const d = await res.json(); setError(d.error ?? "Save failed"); }
    setSaving(null);
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-8">

      {/* ── Service Status ──── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Service Status</h2>

        {emailLoading ? (
          <div className="border border-gray-200 p-4 bg-gray-50 text-xs text-gray-400">Checking services…</div>
        ) : emailStatus ? (
          <div className={`border p-4 ${emailStatus.configured ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${emailStatus.configured ? "text-green-700" : "text-amber-700"}`}>
                  {emailStatus.configured ? "✓ Email — Fully Connected" : "⚠ Email — Configuration Incomplete"}
                </p>
                {emailStatus.configured ? (
                  <p className="text-xs text-green-700">
                    Resend connected. Thursday Drop delivery, welcome emails, and newsroom notifications active.
                    {!emailStatus.hasNewsroom && " EMAIL_NEWSROOM not set — contact-form copies go nowhere."}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-amber-700 mb-2">
                      Signups are stored. No emails are sent until these Replit Secrets are set:
                    </p>
                    <ul className="space-y-1">
                      {emailStatus.missing.map((k) => (
                        <li key={k} className="text-xs font-mono font-bold text-amber-800">{k}</li>
                      ))}
                    </ul>
                    {emailStatus.optional.length > 0 && (
                      <p className="text-[10px] text-amber-600 mt-2">
                        Also recommended: {emailStatus.optional.join(", ")}
                      </p>
                    )}
                    <div className="mt-3 pt-3 border-t border-amber-200 text-[10px] text-amber-700 space-y-1">
                      <p><strong>1.</strong> Create a free account at <strong>resend.com</strong></p>
                      <p><strong>2.</strong> Add and verify your sender domain (lacrimewire.online)</p>
                      <p><strong>3.</strong> Create an API key and copy it</p>
                      <p><strong>4.</strong> In Replit → Secrets, add <code className="bg-amber-100 px-1">RESEND_API_KEY</code> and <code className="bg-amber-100 px-1">EMAIL_FROM</code></p>
                      <p><strong>5.</strong> Add <code className="bg-amber-100 px-1">EMAIL_NEWSROOM</code> (your internal address) and <code className="bg-amber-100 px-1">EMAIL_REPLY_TO</code></p>
                      <p><strong>6.</strong> Redeploy — use Mailing List → Dispatch to send a test email</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-gray-200 p-4 bg-gray-50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Service status unavailable</p>
          </div>
        )}

        {/* Auth status */}
        <div className="border border-green-200 bg-green-50 p-4 mt-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-green-700">✓ Auth — Configured</p>
          <p className="text-xs text-green-700">Admin access code and session secret are set.</p>
        </div>
      </section>

      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Editorial Settings</h2>
        <p className="text-xs text-gray-400 mb-4">
          Safe editorial configuration. Do not store credentials, passwords, or API keys here — use Replit Secrets.
        </p>

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
      </div>

      <div className="border border-gray-200 p-4 bg-gray-50">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Security Note</p>
        <p className="text-xs text-gray-600">
          Credentials, API keys, and secrets live in Replit Secrets, not here.
          Set RESEND_API_KEY, EMAIL_FROM, EMAIL_NEWSROOM, EMAIL_REPLY_TO, and SITE_URL there.
        </p>
      </div>
    </div>
  );
}

function SettingRow({
  def, value, onSave, saving,
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
          <textarea value={local} onChange={(e) => setLocal(e.target.value)} rows={3}
            className="w-full border border-gray-300 px-2 py-1.5 text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-black" />
        ) : (
          <input type="text" value={local} onChange={(e) => setLocal(e.target.value)} className={inputCls} />
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

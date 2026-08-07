import { useState } from "react";
import { Link } from "wouter";
import { useListSubscriptions, useListTips, Subscription, Tip } from "@workspace/api-client-react";

export default function Admin() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "tips">("subscriptions");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      setIsAuthenticated(true);
    }
  };

  const { data: subscriptions, error: subError, isLoading: subLoading } = useListSubscriptions(
    undefined,
    {
      query: {
        enabled: isAuthenticated && activeTab === "subscriptions",
        retry: false,
      },
      request: {
        headers: {
          Authorization: `Bearer ${password}`,
        },
      },
    }
  );

  const { data: tips, error: tipsError, isLoading: tipsLoading } = useListTips({
    query: {
      enabled: isAuthenticated && activeTab === "tips",
      retry: false,
    },
    request: {
      headers: {
        Authorization: `Bearer ${password}`,
      },
    },
  });

  const handleDownloadCsv = async () => {
    try {
      const res = await fetch("/api/subscriptions?format=csv", {
        headers: { Authorization: `Bearer ${password}` },
      });
      if (!res.ok) throw new Error("Failed to fetch CSV");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "subscriptions.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to download CSV");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white text-black p-4 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-sm border border-black p-8">
          <h1 className="text-3xl font-serif font-bold mb-6 text-center">BUREAU LOGIN</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest mb-1">Access Code</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-black px-3 py-2 text-black bg-white focus:outline-none focus:ring-1 focus:ring-black"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-black text-white px-4 py-2 font-bold uppercase tracking-wider text-sm hover:bg-gray-800 transition-colors"
            >
              Access Admin
            </button>
          </form>
          <div className="mt-6 text-center border-t border-black pt-4">
            <Link href="/" className="text-xs uppercase tracking-widest hover:underline">
              ← Return to Front Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAuthError =
    (subError as any)?.response?.status === 401 ||
    (subError as any)?.response?.status === 403 ||
    (tipsError as any)?.response?.status === 401 ||
    (tipsError as any)?.response?.status === 403;

  if (isAuthError) {
    return (
      <div className="min-h-screen bg-white text-black p-4 flex flex-col items-center justify-center font-sans">
        <div className="w-full max-w-sm border border-black p-8 text-center">
          <h1 className="text-2xl font-serif font-bold mb-4">ACCESS DENIED</h1>
          <p className="mb-6 text-sm">Invalid authorization credentials.</p>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="bg-black text-white px-6 py-2 font-bold uppercase tracking-wider text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="border-b-4 border-black pb-4 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-serif font-black uppercase">Admin Desk</h1>
            <p className="text-sm font-bold uppercase tracking-widest mt-1">RSR Crime Division</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs font-bold uppercase tracking-widest hover:underline">
              Public Site
            </Link>
            <button
              onClick={() => setIsAuthenticated(false)}
              className="text-xs font-bold uppercase tracking-widest border border-black px-3 py-1 hover:bg-black hover:text-white transition-colors"
            >
              Log Out
            </button>
          </div>
        </header>

        <div className="flex gap-4 border-b border-black mb-8">
          <button
            onClick={() => setActiveTab("subscriptions")}
            className={`px-4 py-2 font-bold uppercase tracking-wider text-sm ${
              activeTab === "subscriptions" ? "bg-black text-white" : "hover:bg-gray-100"
            }`}
          >
            Subscriptions
          </button>
          <button
            onClick={() => setActiveTab("tips")}
            className={`px-4 py-2 font-bold uppercase tracking-wider text-sm ${
              activeTab === "tips" ? "bg-black text-white" : "hover:bg-gray-100"
            }`}
          >
            Reader Tips
          </button>
        </div>

        {activeTab === "subscriptions" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-serif font-bold">Mailing List</h2>
              <button
                onClick={handleDownloadCsv}
                className="bg-black text-white px-4 py-2 text-xs font-bold uppercase tracking-widest"
              >
                Download CSV
              </button>
            </div>
            
            {subLoading ? (
              <div className="py-8 text-center text-sm uppercase tracking-widest">Loading records...</div>
            ) : subscriptions && subscriptions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-black">
                  <thead>
                    <tr className="border-b-2 border-black bg-gray-50">
                      <th className="text-left p-3 font-bold uppercase tracking-wider">ID</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider">Email</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider">Name</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider">ZIP</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider">Type</th>
                      <th className="text-left p-3 font-bold uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((sub: Subscription) => (
                      <tr key={sub.id} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="p-3">{sub.id}</td>
                        <td className="p-3 font-mono">{sub.email}</td>
                        <td className="p-3">{sub.name || "—"}</td>
                        <td className="p-3">{sub.zip || "—"}</td>
                        <td className="p-3 uppercase">{sub.editionType}</td>
                        <td className="p-3 whitespace-nowrap">{new Date(sub.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-black">
                <p className="text-sm uppercase tracking-widest font-bold">No subscriptions found</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "tips" && (
          <div>
            <h2 className="text-2xl font-serif font-bold mb-4">Reader Tips</h2>
            
            {tipsLoading ? (
              <div className="py-8 text-center text-sm uppercase tracking-widest">Loading records...</div>
            ) : tips && tips.length > 0 ? (
              <div className="space-y-4">
                {tips.map((tip: Tip) => (
                  <div key={tip.id} className="border border-black p-4">
                    <div className="flex justify-between items-start mb-4 pb-2 border-b border-black">
                      <div>
                        <div className="font-bold uppercase tracking-wider">
                          From: {tip.nameOrAlias || "ANONYMOUS"}
                        </div>
                        {tip.contactEmail && (
                          <div className="text-xs font-mono mt-1">Contact: {tip.contactEmail}</div>
                        )}
                      </div>
                      <div className="text-xs text-right">
                        <div>ID: #{tip.id}</div>
                        <div>{new Date(tip.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      <div className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-500">Message</div>
                      <div className="font-serif leading-relaxed whitespace-pre-wrap">{tip.message}</div>
                    </div>
                    
                    {tip.provenance && (
                      <div className="bg-gray-50 p-3 border border-gray-300">
                        <div className="text-xs font-bold uppercase tracking-widest mb-1 text-gray-500">Provenance / Source</div>
                        <div className="text-sm font-serif">{tip.provenance}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center border border-dashed border-black">
                <p className="text-sm uppercase tracking-widest font-bold">No tips found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

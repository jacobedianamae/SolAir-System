import { useState, type FormEvent } from "react";
import { CircleHelp, Flag } from "lucide-react";
import { api } from "./api";

export function HelpSupport({ go }: { go: (page: string) => void }) {
  return <section className="panel support-panel">
    <h2><CircleHelp size={23} /> How can we help?</h2>
    <p>Find a quick answer or contact your TODA through SOLAIR.</p>
    <details open><summary>My vehicle readings are missing or old</summary><p>Check the data mode and the measurement time. Real hardware needs a connected, registered ESP32. Demonstration readings are simulated records and can become stale. Try Refresh after the connection returns.</p></details>
    <details><summary>The map is showing Malabon but no vehicle</summary><p>Malabon is the reference view. A vehicle marker needs a valid reported GPS fix. Choose Show vehicles to find recorded positions outside the current view.</p></details>
    <details><summary>I need vehicle or roadside assistance</summary><p>Use SOS &amp; Assistance to contact your TODA. A queued request has not reached the server; check for the operator's acknowledgment.</p><button onClick={() => go("SOS & Assistance")}>Open assistance</button></details>
    <details><summary>How do I change appearance or sign out?</summary><p>Open your initial in the top-right corner. Choose Light, Dark or System. System follows your device's appearance. Log out is available there and directly below Settings in the left navigation (Profile for drivers).</p></details>
    <div className="button-row"><button onClick={() => go("Messages")}>Open TODA messages</button><button onClick={() => go("Report a problem")}><Flag size={16} />Report a problem</button></div>
  </section>;
}
export function ProblemReport({ page, mode, vehicleId }: { page: string; mode: string; vehicleId?: string }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [receipt, setReceipt] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, fields = new FormData(form);
    setBusy(true); setError(""); setReceipt("");
    try {
      const result = await api("/problem-reports", "POST", { summary: fields.get("summary"), details: fields.get("details"), page, mode, vehicle_id: vehicleId || null });
      setReceipt(result.id); form.reset();
    } catch (cause) { setError((cause as Error).message + ". Your report was not confirmed. You can retry."); }
    finally { setBusy(false); }
  }
  return <section className="panel support-panel">
    <h2><Flag size={23} /> Report a problem</h2>
    <p>Describe an issue with SOLAIR. Your report is saved for your administrator in the audit trail. For vehicle emergencies, use SOS &amp; Assistance.</p>
    {receipt && <div className="report-receipt" role="status"><strong>Report received</strong><p>Reference: {receipt}</p></div>}
    <form onSubmit={submit}>
      <label>Summary<input name="summary" minLength={5} maxLength={120} required placeholder="What went wrong?" /></label>
      <label>What happened?<textarea name="details" minLength={10} maxLength={4000} required placeholder="What were you trying to do, and what happened instead?" /></label>
      <p className="subtle">Do not include passwords or device tokens. Your account, selected vehicle and data mode are included.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy ? "Submitting…" : "Submit report"}</button>
    </form>
  </section>;
}

/**
 * DEMO page - a dummy GHMC (Greater Hyderabad Municipal Corporation)
 * complaint portal used to demonstrate the receiving side of the CivicFix
 * pipeline. All data is hardcoded and this page is NOT affiliated with
 * GHMC. It mirrors the shape the Routing Agent will produce: issue type,
 * ward, department, status, and a CF- tracking ID.
 */

type Status = "New" | "Assigned" | "In Progress" | "Resolved";

type Complaint = {
  trackingId: string;
  issue: string;
  location: string;
  department: string;
  status: Status;
  reported: string;
  severity: "Low" | "Medium" | "High" | "Critical";
};

const complaints: Complaint[] = [
  {
    trackingId: "CF-2026-F7G9XM",
    issue: "Pothole",
    location: "Madhapur · Hitec City Main Road",
    department: "Roads & Infrastructure",
    status: "Assigned",
    reported: "2026-09-04",
    severity: "High",
  },
  {
    trackingId: "CF-2026-KQJH99",
    issue: "Garbage",
    location: "Kukatpally · KPHB Colony",
    department: "Solid Waste Management",
    status: "In Progress",
    reported: "2026-09-04",
    severity: "Medium",
  },
  {
    trackingId: "CF-2026-4MW2TX",
    issue: "Broken Streetlight",
    location: "Jubilee Hills · Road No. 36",
    department: "Street Lighting",
    status: "New",
    reported: "2026-09-03",
    severity: "Low",
  },
  {
    trackingId: "CF-2026-RB8C5P",
    issue: "Water Leakage",
    location: "Ameerpet · Srinagar Colony",
    department: "Water & Sewerage",
    status: "In Progress",
    reported: "2026-09-03",
    severity: "Critical",
  },
  {
    trackingId: "CF-2026-Z7NK2D",
    issue: "Open Manhole",
    location: "Begumpet · Prakash Nagar",
    department: "Drainage & Sanitation",
    status: "Assigned",
    reported: "2026-09-02",
    severity: "Critical",
  },
  {
    trackingId: "CF-2026-HQ3V8J",
    issue: "Garbage",
    location: "Secunderabad · MG Road",
    department: "Solid Waste Management",
    status: "Resolved",
    reported: "2026-09-01",
    severity: "Medium",
  },
  {
    trackingId: "CF-2026-TY6E2A",
    issue: "Fallen Tree",
    location: "Gachibowli · Near DLF",
    department: "Parks & Horticulture",
    status: "Resolved",
    reported: "2026-08-31",
    severity: "Medium",
  },
  {
    trackingId: "CF-2026-9PWK4M",
    issue: "Pothole",
    location: "Uppal · Main Road",
    department: "Roads & Infrastructure",
    status: "New",
    reported: "2026-08-31",
    severity: "High",
  },
];

const statusStyles: Record<Status, string> = {
  New: "bg-blue-50 text-blue-700 ring-blue-200",
  Assigned: "bg-amber-50 text-amber-700 ring-amber-200",
  "In Progress": "bg-violet-50 text-violet-700 ring-violet-200",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const severityStyles: Record<Complaint["severity"], string> = {
  Low: "text-slate-500",
  Medium: "text-amber-600",
  High: "text-orange-600",
  Critical: "text-rose-600",
};

const stats = [
  { label: "Total complaints", value: complaints.length, color: "text-slate-900" },
  {
    label: "Resolved",
    value: complaints.filter((c) => c.status === "Resolved").length,
    color: "text-emerald-600",
  },
  {
    label: "In progress",
    value: complaints.filter((c) => c.status === "In Progress").length,
    color: "text-violet-600",
  },
  {
    label: "New",
    value: complaints.filter((c) => c.status === "New").length,
    color: "text-blue-600",
  },
];

export default function GhmcPortalPage() {
  return (
    <main className="min-h-screen bg-slate-100">
      {/* Demo notice */}
      <div className="bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-amber-950">
        ⚠️ DEMO PAGE — not affiliated with GHMC. Hardcoded sample data to
        demonstrate the CivicFix → department flow.
      </div>

      {/* Government header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-full bg-blue-700 text-center text-[10px] font-bold leading-tight text-white ring-2 ring-blue-200">
              GHMC
              <br />
              HYD
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Greater Hyderabad Municipal Corporation
              </h1>
              <p className="text-sm text-slate-500">
                Civic Complaint Portal · Citizen Grievance Cell
              </p>
            </div>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-4 py-1.5 text-xs font-medium text-slate-600 sm:inline-block">
            Complaint No. {complaints.length.toString().padStart(4, "0")}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <p className={`text-3xl font-extrabold ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Live complaints feed */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Complaints received from CivicFix
            </h2>
            <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE (demo)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Tracking ID</th>
                  <th className="px-4 py-3 font-semibold">Issue</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Severity</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Reported</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {complaints.map((c) => (
                  <tr key={c.trackingId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                      {c.trackingId}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.issue}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.location}</td>
                    <td className="px-4 py-3 text-slate-600">{c.department}</td>
                    <td className={`px-4 py-3 font-semibold ${severityStyles[c.severity]}`}>
                      {c.severity}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyles[c.status]}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.reported}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Demo explanation */}
        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-semibold">What you're looking at</p>
          <p className="mt-1 leading-relaxed">
            A mock government intake screen showing what complaints look like
            after CivicFix's Routing Agent maps each issue to a GHMC division.
            In the real product, rows like these will be created by{" "}
            <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-xs">
              POST /complaints
            </code>{" "}
            and the statuses tracked via each complaint's CF- tracking ID.
          </p>
        </section>
      </div>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Demo only · Not the official GHMC website · Made for the CivicFix
        hackathon demo
      </footer>
    </main>
  );
}

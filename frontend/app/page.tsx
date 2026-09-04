import Link from "next/link";
import HealthCheck from "@/components/health-check";

const plannedFeatures = [
  {
    emoji: "📷",
    title: "AI Photo Analysis",
    description:
      "Upload a photo of a pothole, garbage pile, broken streetlight or water leakage. Our Vision Agent identifies the issue instantly.",
  },
  {
    emoji: "🧭",
    title: "Smart Department Routing",
    description:
      "CivicFix automatically routes every complaint to the correct Hyderabad civic department.",
  },
  {
    emoji: "🔎",
    title: "Live Complaint Tracking",
    description:
      "Receive a tracking ID and monitor your complaint from submission to resolution.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 font-bold text-white">
              CF
            </div>

            <div>
              <h1 className="text-lg font-bold text-slate-900">CivicFix</h1>
              <p className="text-xs text-slate-500">Hyderabad</p>
            </div>
          </div>

          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            AI Powered
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-16">
        <section className="text-center">
          <div className="mb-4 inline-flex rounded-full bg-blue-100 px-4 py-1 text-sm font-medium text-blue-700">
            Autonomous Civic Complaint Platform
          </div>

          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Report Civic Issues
            <span className="block text-blue-600">With One Photo</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-600">
            Upload a photo of a civic issue and let our AI identify the problem,
            locate it, route it to the correct department, and generate a
            complaint automatically.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/report"
              className="rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-blue-700"
            >
              📷 Report an Issue
            </Link>

            <Link
              href="/track"
              className="rounded-xl border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              🔎 Track Complaint
            </Link>
          </div>
        </section>

        {/* Backend Health */}
        <section className="mx-auto mt-12 w-full max-w-xl">
          <HealthCheck />
        </section>

        {/* Features */}
        <section className="mt-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              How CivicFix Works
            </h2>
            <p className="mt-2 text-slate-500">
              Five autonomous AI agents process every complaint.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {plannedFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="text-4xl">{feature.emoji}</div>

                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Workflow */}
        <section className="mt-20 rounded-3xl bg-slate-900 p-8 text-white">
          <h2 className="text-center text-2xl font-bold">
            Autonomous Workflow
          </h2>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {[
              "Upload",
              "Vision AI",
              "Location",
              "Routing",
              "Tracking ID",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-xl bg-slate-800 p-4 text-center"
              >
                <div className="text-sm font-semibold text-blue-400">
                  Step {index + 1}
                </div>
                <div className="mt-2 text-sm">{step}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-sm text-slate-500">
        Built for Build by Sunset • CivicFix Hyderabad
      </footer>
    </div>
  );
}
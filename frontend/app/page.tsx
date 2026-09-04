import Link from "next/link";
import { Camera, Compass, Radar, Search } from "lucide-react";
import HealthCheck from "@/components/health-check";

const plannedFeatures = [
  {
    Icon: Camera,
    tint: "text-saffron-400 bg-saffron-500/10 ring-saffron-500/30",
    title: "AI Photo Analysis",
    description:
      "Upload a photo of a pothole, garbage pile, broken streetlight or water leakage. Our Vision Agent identifies the issue instantly.",
  },
  {
    Icon: Compass,
    tint: "text-chakra-400 bg-chakra-500/10 ring-chakra-500/30",
    title: "Smart Department Routing",
    description:
      "CivicFix automatically routes every complaint to the correct Hyderabad civic department.",
  },
  {
    Icon: Radar,
    tint: "text-india-400 bg-india-500/10 ring-india-500/30",
    title: "Live Complaint Tracking",
    description:
      "Receive a tracking ID and monitor your complaint from submission to resolution.",
  },
] as const;

const WORKFLOW_STEPS = [
  "Upload",
  "Vision AI",
  "Location",
  "Routing",
  "Tracking ID",
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
      {/* Hero */}
      <section className="text-center">
        <div className="mx-auto inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-medium text-slate-300 backdrop-blur">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-saffron-500"
          />
          Autonomous Civic Complaint Platform
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-india-400"
          />
        </div>

        <h1 className="mx-auto mt-8 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Report Civic Issues
          <span className="text-tricolor block pb-1">With One Photo</span>
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
          Upload a photo of a civic issue and let our AI identify the problem,
          locate it, route it to the correct department, and generate a
          complaint automatically.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/report"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-[0_8px_30px_rgba(37,99,235,0.35)] transition hover:-translate-y-0.5 hover:bg-blue-500 hover:shadow-[0_12px_36px_rgba(37,99,235,0.45)] sm:w-auto"
          >
            <Camera className="size-5" aria-hidden="true" />
            Report an Issue
          </Link>

          <Link
            href="/track"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-slate-200 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 sm:w-auto"
          >
            <Search className="size-5" aria-hidden="true" />
            Track Complaint
          </Link>

          <Link
            href="/nearby"
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-slate-200 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/10 sm:w-auto"
          >
            <Radar className="size-5" aria-hidden="true" />
            Nearby Activity
          </Link>
        </div>
      </section>

      {/* Backend Health */}
      <section className="mx-auto mt-14 w-full max-w-xl">
        <HealthCheck />
      </section>

      {/* Features */}
      <section className="mt-24">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            How it works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Five autonomous AI agents,
            <span className="text-slate-400"> one complaint</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plannedFeatures.map((feature) => {
            const Icon = feature.Icon;
            return (
              <div
                key={feature.title}
                className="glass group rounded-2xl p-6 transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]"
              >
                <div
                  className={`grid size-12 place-items-center rounded-xl ring-1 ${feature.tint}`}
                >
                  <Icon className="size-6" aria-hidden="true" />
                </div>

                <h3 className="mt-5 font-display text-lg font-semibold text-white">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workflow */}
      <section className="glass mt-20 rounded-3xl p-8 sm:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Pipeline
          </p>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Autonomous Workflow
          </h2>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {WORKFLOW_STEPS.map((step, index) => {
            const hues = [
              "from-saffron-500/80 to-saffron-400/60",
              "from-ivory-100/80 to-ivory-200/60",
              "from-chakra-500/80 to-chakra-400/60",
              "from-india-500/80 to-india-400/60",
              "from-chakra-500/80 to-india-400/60",
            ];
            return (
              <li key={step} className="relative">
                <div className="glass flex h-full flex-col items-center rounded-2xl px-4 py-6 text-center transition duration-300 hover:-translate-y-0.5 hover:border-white/25">
                  <span
                    aria-hidden="true"
                    className={`grid size-9 place-items-center rounded-full bg-gradient-to-br font-display text-sm font-bold text-navy-950 ${hues[index % hues.length]}`}
                  >
                    {index + 1}
                  </span>
                  <span className="mt-3 text-sm font-medium text-slate-200">
                    {step}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="mt-8 text-center text-xs text-slate-500">
          Vision → Location → Routing run live through a LangGraph pipeline —
          see real per-stage progress on the{" "}
          <Link
            href="/report"
            className="font-semibold text-chakra-400 transition hover:text-chakra-400/80"
          >
            report page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
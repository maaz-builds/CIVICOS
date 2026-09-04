import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  Compass,
  FileText,
  HeartPulse,
  Radar,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
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

const NATIONAL_STATS = [
  {
    Icon: AlertTriangle,
    value: "5,432",
    label: "Road accidents",
    note: "Caused by potholes",
    valueClass: "text-saffron-400",
  },
  {
    Icon: HeartPulse,
    value: "2,385",
    label: "Deaths",
    note: "≈ 6–7 deaths every day",
    valueClass: "text-rose-400",
  },
  {
    Icon: Users,
    value: "4,643",
    label: "People injured",
    note: "Grievous + minor injuries",
    valueClass: "text-chakra-400",
  },
  {
    Icon: TrendingUp,
    value: "+53%",
    label: "5-year trend",
    note: "Increase in pothole deaths since 2020",
    valueClass: "text-purple-400",
  },
] as const;

const TELANGANA_STATS = [
  { metric: "Pothole-related accidents", value: "86" },
  { metric: "Deaths", value: "27" },
  { metric: "Injured", value: "86" },
] as const;

const HYDERABAD_STATS = [
  { value: "3,058", text: "total road accidents in Hyderabad during 2024." },
  { value: "286", text: "people lost their lives." },
  {
    value: "Most accident-prone",
    text: "metro in India — ACKO Accident Index 2024.",
  },
] as const;

function SourcePill({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 align-middle text-[11px] font-medium text-slate-300">
      <FileText className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}

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
          <span className="text-tricolor">Report Civic Issues</span>
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

      {/* Statistics - official public data for the pitch. */}
      <section className="mt-24">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Why it matters
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Pothole accident statistics
            <span className="text-slate-400"> — India &amp; Telangana</span>
          </h2>
        </div>

        <div className="glass rounded-3xl p-8 sm:p-10">
          {/* National impact */}
          <div>
            <h3 className="font-display text-lg font-semibold text-white">
              National impact (2024)
            </h3>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {NATIONAL_STATS.map((stat) => {
                const Icon = stat.Icon;
                return (
                  <div
                    key={stat.label}
                    className="glass rounded-2xl p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/25"
                  >
                    <Icon className="size-5 text-slate-400" aria-hidden="true" />
                    <p className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                      <span className={stat.valueClass}>{stat.value}</span>
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-200">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{stat.note}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Source: Ministry of Road Transport &amp; Highways, Government of
              India.
              <SourcePill label="Digital Sansad +1" />
            </p>
          </div>

          <div
            aria-hidden="true"
            className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />

          {/* Telangana */}
          <div className="mt-10">
            <h3 className="font-display text-lg font-semibold text-white">
              Telangana (2024)
            </h3>
            <table className="mt-5 w-full max-w-xl text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="pb-2 font-semibold">
                    Metric
                  </th>
                  <th scope="col" className="pb-2 text-right font-semibold">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {TELANGANA_STATS.map((row) => (
                  <tr key={row.metric}>
                    <td className="py-3 text-slate-400">{row.metric}</td>
                    <td className="py-3 text-right font-display text-lg font-bold text-white">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-slate-500">
              Official state-wise parliamentary data.
              <SourcePill label="Digital Sansad" />
            </p>
          </div>

          <div
            aria-hidden="true"
            className="mt-10 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />

          {/* Hyderabad */}
          <div className="mt-10">
            <h3 className="font-display text-lg font-semibold text-white">
              Hyderabad road safety
            </h3>
            <ul className="mt-5 max-w-xl space-y-3 text-sm leading-relaxed text-slate-300">
              {HYDERABAD_STATS.map((item) => (
                <li key={item.value} className="flex gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-3 shrink-0 rounded-full bg-saffron-500/70"
                  />
                  <span>
                    <strong className="font-display font-bold text-white">
                      {item.value}{" "}
                    </strong>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-slate-500">
              ACKO Accident Index 2024.
              <SourcePill label="NewsMeter +1" />
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
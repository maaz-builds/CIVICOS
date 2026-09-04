import HealthCheck from "@/components/health-check";

const plannedFeatures = [
  {
    emoji: "📷",
    title: "AI photo analysis",
    description:
      "Snap a photo of the problem - the vision agent recognizes the issue type and how severe it is.",
  },
  {
    emoji: "🧭",
    title: "Smart department routing",
    description:
      "Every complaint is sent straight to the responsible civic body - no guessing which office to contact.",
  },
  {
    emoji: "🔎",
    title: "Live tracking",
    description:
      "Get a tracking ID and follow your complaint from submitted to resolved.",
  },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-rose-600 to-amber-500 text-sm font-bold text-white shadow-sm">
              CF
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              CivicFix{" "}
              <span className="font-normal text-slate-500">Hyderabad</span>
            </span>
          </div>
          <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 sm:inline-block">
            Coming soon
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:py-24">
        <section className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            CivicFix Hyderabad
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg font-medium text-slate-600 sm:text-xl">
            An AI-powered civic issue reporting platform.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
            Snap a photo of a pothole, garbage pile, or broken street light.
            CivicFix identifies the issue, routes it to the right civic
            department, and keeps you updated until it is fixed.
          </p>
        </section>

        {/* Backend health check - the only live feature in the scaffold */}
        <section className="mt-12 flex justify-center">
          <div className="w-full max-w-xl">
            <HealthCheck />
          </div>
        </section>

        {/* Planned capabilities - static preview only */}
        <section className="mt-20 grid gap-6 sm:grid-cols-3">
          {plannedFeatures.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm"
            >
              <p className="text-2xl" aria-hidden="true">
                {feature.emoji}
              </p>
              <h2 className="mt-3 font-semibold text-slate-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {feature.description}
              </p>
              <span className="mt-4 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Planned
              </span>
            </article>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Built for the Greater Hyderabad community · Foundation scaffold
      </footer>
    </div>
  );
}

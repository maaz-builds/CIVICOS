export default function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div
        aria-hidden="true"
        className="h-px w-full bg-gradient-to-r from-transparent via-chakra-500/50 to-transparent"
      />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-center text-xs text-slate-500 sm:flex-row sm:text-left">
        <p>
          CivicFix Hyderabad — AI civic issue reporting, built for Build by
          Sunset.
        </p>
        <p className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-full bg-saffron-500/70"
          />
          Demo-grade platform · complaints stored in Supabase
        </p>
      </div>
    </footer>
  );
}
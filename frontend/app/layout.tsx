import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "CivicFix Hyderabad - An AI-powered civic issue reporting platform",
  description:
    "Report potholes, garbage, and broken street lights in Hyderabad. AI identifies the issue, routes it to the right department, and tracks the fix.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

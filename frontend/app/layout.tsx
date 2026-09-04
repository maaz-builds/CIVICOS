import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import SplashProvider from "@/components/SplashProvider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

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
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} flex min-h-screen flex-col bg-navy-950 font-sans text-slate-300 antialiased`}
      >
        <SplashProvider>
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </SplashProvider>
      </body>
    </html>
  );
}
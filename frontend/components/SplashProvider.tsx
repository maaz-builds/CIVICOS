"use client";

import { useState } from "react";
import StartupSplash from "./StartupSplash";

/**
 * Mounts the startup splash from the (server) root layout.
 *
 * The splash is shown once per full page load — it manages its own 3.5 s
 * timer and fade, then this wrapper unmounts it entirely so it never
 * intercepts clicks or lingers in the DOM. Client-side route changes do
 * not remount the layout, so it only appears on a real load, not on
 * every navigation.
 */
export default function SplashProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <StartupSplash onComplete={() => setShowSplash(false)} />}
      {children}
    </>
  );
}
import { useEffect, useReducer } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Tangkap event seawal mungkin (module-level) agar tidak terlewat sebelum React mount.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = isStandalone();
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    notify();
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePwaInstall() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => void subs.delete(force);
  }, []);

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !/(crios|fxios)/i.test(ua); // Safari iOS
  const isAndroid = /android/i.test(ua);

  async function promptInstall(): Promise<boolean> {
    if (!deferred) return false;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") installed = true;
    deferred = null;
    notify();
    return choice.outcome === "accepted";
  }

  return { installed, canPrompt: !!deferred, isIOS, isAndroid, promptInstall };
}

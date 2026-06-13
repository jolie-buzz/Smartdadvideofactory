import { useEffect, useMemo, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosSafari, isNativeApp, isPwaStandalone } from "@/lib/pwa";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "buzzly:pwa-install-dismissed";

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === "true");
  const [standalone, setStandalone] = useState(false);
  const nativeApp = useMemo(() => (typeof window === "undefined" ? false : isNativeApp()), []);
  const iosSafari = useMemo(() => (typeof window === "undefined" ? false : isIosSafari()), []);

  useEffect(() => {
    setStandalone(isPwaStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setStandalone(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (nativeApp || dismissed || standalone || (!installEvent && !iosSafari)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") dismiss();
    setInstallEvent(null);
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+82px)] z-[70] rounded-xl border border-white/10 bg-[#101620]/95 p-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur md:bottom-5 md:left-auto md:right-5 md:max-w-sm">
      <button
        type="button"
        aria-label="Close install prompt"
        className="absolute right-2 top-2 rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
        onClick={dismiss}
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-8">
        <p className="text-sm font-semibold">Install Buzzly</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {iosSafari
            ? "Open it like a native iPhone app: tap Share, then Add to Home Screen."
            : "Add Buzzly to your home screen for fullscreen editing and faster launch."}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        {installEvent ? (
          <Button className="h-10 flex-1 gap-2 bg-[#ffc400] text-black hover:bg-[#ffd84a]" onClick={install}>
            <Download className="h-4 w-4" />
            Install
          </Button>
        ) : (
          <Button className="h-10 flex-1 gap-2 bg-[#ffc400] text-black hover:bg-[#ffd84a]" onClick={dismiss}>
            <Share className="h-4 w-4" />
            Got it
          </Button>
        )}
      </div>
    </div>
  );
}

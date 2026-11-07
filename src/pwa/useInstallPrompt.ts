'use client';
import { useEffect, useState } from 'react';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
export function isStandalone(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [ios, setIos] = useState(false),
    [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    let hidden = false;
    try {
      hidden = localStorage.getItem('install-dismissed') === 'yes';
    } catch {
      /* Optional UI flag. */
    }
    setDismissed(hidden);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !isStandalone());
    const before = (event: Event) => {
      event.preventDefault();
      if (!isStandalone()) setPrompt(event as InstallEvent);
    };
    const installed = () => {
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', before);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);
  return {
    canInstall: !dismissed && (prompt !== null || ios),
    ios,
    dismiss() {
      setDismissed(true);
      try {
        localStorage.setItem('install-dismissed', 'yes');
      } catch {
        /* Optional UI flag. */
      }
    },
    async promptInstall() {
      const event = prompt;
      setPrompt(null);
      if (event) {
        await event.prompt();
        await event.userChoice;
      }
    },
  };
}

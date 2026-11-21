'use client';
import { useEffect, useRef, useState } from 'react';
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
  const promptOwner = useRef<InstallEvent | null>(null);
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
      if (!isStandalone()) {
        promptOwner.current = event as InstallEvent;
        setPrompt(event as InstallEvent);
      }
    };
    const installed = () => {
      promptOwner.current = null;
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener('beforeinstallprompt', before);
    window.addEventListener('appinstalled', installed);
    return () => {
      promptOwner.current = null;
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
      const event = promptOwner.current;
      promptOwner.current = null;
      setPrompt(null);
      if (event) {
        try {
          await event.prompt();
          await event.userChoice;
        } catch {
          /* Browser prompts are single-use. A later install event permits retry. */
        }
      }
    },
  };
}

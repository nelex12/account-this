// useInstallPrompt — "install the app".
//   Chrome/Edge/Android: the browser fires `beforeinstallprompt`; we keep it and show our own button.
//   iOS Safari has no such event: the only way is Share -> "На экран «Домой»" (we show that hint).
//   Already installed (standalone window): nothing to offer.
import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallState =
  | { kind: 'installed' }
  | { kind: 'available'; install: () => Promise<void> }
  | { kind: 'ios-hint' }
  | { kind: 'unavailable' };

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt(): InstallState {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // no automatic mini-bar: we offer the button ourselves
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null); // the event can be used once
  }, [event]);

  if (installed) return { kind: 'installed' };
  if (event) return { kind: 'available', install };
  if (isIos()) return { kind: 'ios-hint' };
  return { kind: 'unavailable' };
}

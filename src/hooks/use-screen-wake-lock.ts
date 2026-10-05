import { useEffect, useRef } from "react";

/**
 * Screen Wake Lock hook for mission-critical staff screens (Kitchen KDS & Cashier POS).
 * Automatically requests a 'screen' wake lock to keep tablets and displays active during
 * work and shift hours, preventing screens from dimming or locking.
 * Handles automatic re-acquisition on 'visibilitychange' when returning to the tab.
 */
export function useScreenWakeLock(enabled: boolean = true) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let isMounted = true;

    const requestLock = async () => {
      // Don't request lock if tab is in background or lock is already active
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        return;
      }

      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!isMounted) {
          void lock.release();
          return;
        }
        wakeLockRef.current = lock;

        lock.addEventListener("release", () => {
          if (wakeLockRef.current === lock) {
            wakeLockRef.current = null;
          }
        });
      } catch (err) {
        // Can fail if battery saver is on or document not active
        console.warn("[ScreenWakeLock] could not acquire screen wake lock:", err);
      }
    };

    void requestLock();

    // Re-acquire lock when user switches back to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [enabled]);
}

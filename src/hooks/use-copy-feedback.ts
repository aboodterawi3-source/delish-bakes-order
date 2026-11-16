import { useCallback, useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

/** Manages transient "copied" feedback state with clipboard copy and unmount cleanup. */
export function useCopyFeedback<T extends string = "default">(durationMs = 2500) {
  const [copied, setCopied] = useState<T | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const clear = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setCopied(null);
  }, []);

  const copy = useCallback(
    async (text: string, key: T): Promise<boolean> => {
      const ok = await copyToClipboard(text);
      if (!ok) return false;
      setCopied(key);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(null), durationMs);
      return true;
    },
    [durationMs],
  );

  return { copied, copy, clear };
}

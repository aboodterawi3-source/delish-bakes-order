let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioCtx() {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();

      // KDS-01: Auto-resume audio context on user interaction to bypass autoplay policy
      const unlockAudio = () => {
        if (sharedAudioCtx?.state === "suspended") {
          void sharedAudioCtx.resume();
        }
      };
      window.addEventListener("click", unlockAudio, { once: true, capture: true });
      window.addEventListener("touchstart", unlockAudio, { once: true, capture: true });
    } catch {
      return null;
    }
  }
  return sharedAudioCtx;
}

/** Audio synth chime fallback to guarantee alert sound. */
export function playKitchenChimeSound() {
  try {
    const ctx = getSharedAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.error("Audio synth error:", e);
  }
}

/** Distinctive double-tone chime for kitchen order modifications. */
export function playKitchenModificationChimeSound() {
  try {
    const ctx = getSharedAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, ctx.currentTime);
    gain1.gain.setValueAtTime(0.35, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.2);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(987.77, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.error("Audio synth mod error:", e);
  }
}

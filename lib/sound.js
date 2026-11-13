/**
 * Tiny synthesized UI sounds. The AudioContext is created lazily on first use
 * (browsers require a user gesture), and nothing here ever throws.
 */
export function createSound(AudioCtxClass) {
  let ctx = null;
  let muted = false;

  function getCtx() {
    if (ctx) return ctx;
    if (!AudioCtxClass) return null;
    try {
      ctx = new AudioCtxClass();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function note(freq, { start = 0, duration = 0.25, volume = 0.05, type = "sine" } = {}) {
    if (muted) return;
    const c = getCtx();
    if (!c) return;
    try {
      if (c.state === "suspended") c.resume?.();
      const t = c.currentTime + start;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    } catch {
      /* audio is decoration; ignore failures */
    }
  }

  return {
    tick() {
      note(660, { duration: 0.18, volume: 0.04 });
    },
    chime() {
      [523.25, 659.25, 783.99].forEach((f, i) => note(f, { start: i * 0.14, duration: 0.7, volume: 0.045 }));
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}

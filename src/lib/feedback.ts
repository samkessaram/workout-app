/** Best-effort buzz and beep; both may be blocked by the browser. */
export function buzz() {
  try {
    navigator.vibrate?.([300, 150, 300])
  } catch {
    /* blocked */
  }
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new C()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.value = 0.2
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    /* blocked */
  }
}

/** Holds a screen wake lock until the returned release function is called. */
export function holdWakeLock(): () => void {
  let lock: WakeLockSentinel | null = null
  let released = false
  const acquire = async () => {
    try {
      if (!released && document.visibilityState === 'visible') lock = (await navigator.wakeLock?.request('screen')) ?? null
    } catch {
      /* unsupported or denied */
    }
  }
  const onVisible = () => void acquire()
  document.addEventListener('visibilitychange', onVisible)
  void acquire()
  return () => {
    released = true
    document.removeEventListener('visibilitychange', onVisible)
    void lock?.release().catch(() => {})
  }
}

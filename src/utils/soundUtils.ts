// High-performance Web Audio API sound synthesis for Barcode Attendance
// Works across all modern browsers with 0 external dependencies

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

/**
 * Pleasant melodic 2-tone success chime (E5 -> B5)
 * Triggered when a student is paid and marked Present
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Tone 1: 659.25 Hz (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    // Tone 2: 987.77 Hz (B5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.1);
    gain2.gain.setValueAtTime(0.22, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.4);
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
}

/**
 * Loud, distinct warning buzzer alert (Double Sawtooth Pulse)
 * Triggered when a scanned student is NOT PAID / HAS DEBT
 */
export function playWarningAlert() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Double pulse buzzer at 320 Hz and 280 Hz
    [0, 0.18].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(idx === 0 ? 340 : 280, now + delay);
      gain.gain.setValueAtTime(0.38, now + delay);
      gain.gain.linearRampToValueAtTime(0.01, now + delay + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.13);
    });
  } catch (err) {
    console.warn('Audio alert failed:', err);
  }
}

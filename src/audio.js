// src/audio.js — Pure Web Audio API synthesized Chimes & Focus Sound Generator

let audioCtx = null;
let ambientSource = null;
let ambientGain = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a warm, soothing completion chime (singing bowl / bell harmonics)
 */
export function playCompletionChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const frequencies = [528, 792, 1056]; // 528Hz Solfeggio "clarity" frequency + harmonics

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Warm attack and long exponential decay
      const peak = 0.25 / (idx + 1);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8 - idx * 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 3.0);
    });
  } catch (err) {
    console.warn('Audio chime playback issue:', err);
  }
}

/**
 * Subtle tactile click for UI button interactions
 */
export function playClickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch (e) {
    // Silent fallback
  }
}

/**
 * Procedural ambient focus sound generator (White / Pink Noise / Soft Rain)
 */
export function setAmbientSound(type = 'none', volume = 0.5) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Stop current ambient sound if running
    if (ambientSource) {
      try {
        ambientSource.stop();
        ambientSource.disconnect();
      } catch (e) {}
      ambientSource = null;
    }

    if (type === 'none') {
      return;
    }

    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'rain') {
      // Pink / brown filtered noise simulating rain drops
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.2;
      }
    } else if (type === 'stream') {
      // Gentle stream / river texture
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        output[i] = lastOut * 2.5;
      }
    }

    ambientSource = ctx.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;

    // Filter to soften the sound
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'rain' ? 1200 : 800, ctx.currentTime);

    ambientGain = ctx.createGain();
    ambientGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1.0)) * 0.15, ctx.currentTime);

    ambientSource.connect(filter);
    filter.connect(ambientGain);
    ambientGain.connect(ctx.destination);

    ambientSource.start();
  } catch (err) {
    console.warn('Could not start ambient focus audio:', err);
  }
}

export function updateAmbientVolume(volume) {
  if (ambientGain && audioCtx) {
    try {
      ambientGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1.0)) * 0.15, audioCtx.currentTime);
    } catch (e) {}
  }
}

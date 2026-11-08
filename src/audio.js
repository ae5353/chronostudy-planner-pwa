// Pure Web Audio API Soundscape & Notification Synthesizer (100% offline capable)

class SoundscapeEngine {
  constructor() {
    this.ctx = null;
    this.activeNodes = [];
    this.currentMode = 'off'; // 'off' | 'brown' | 'rain' | 'gamma'
    this.volume = 0.35;
    this.masterGain = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, Number(val)));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  stop() {
    this.activeNodes.forEach((node) => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (_) {}
    });
    this.activeNodes = [];
    this.currentMode = 'off';
  }

  play(mode) {
    if (mode === 'off' || mode === this.currentMode) {
      this.stop();
      return 'off';
    }
    this.stop();
    this.ensureContext();
    this.currentMode = mode;

    if (mode === 'brown') {
      this.startBrownNoise();
    } else if (mode === 'rain') {
      this.startRainSound();
    } else if (mode === 'gamma') {
      this.startGammaBinaural();
    }
    return this.currentMode;
  }

  startBrownNoise() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 0.18;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start(0);
    this.activeNodes.push(whiteNoise, filter);
  }

  startRainSound() {
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.018;
      b6 = white * 0.115926;
    }

    const pinkNoise = this.ctx.createBufferSource();
    pinkNoise.buffer = noiseBuffer;
    pinkNoise.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 0.7;

    pinkNoise.connect(bandpass);
    bandpass.connect(this.masterGain);
    pinkNoise.start(0);
    this.activeNodes.push(pinkNoise, bandpass);
  }

  startGammaBinaural() {
    // 200Hz left + 240Hz right = 40Hz Gamma Focus beat
    const oscLeft = this.ctx.createOscillator();
    const oscRight = this.ctx.createOscillator();
    const panLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const panRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    const toneGain = this.ctx.createGain();
    toneGain.gain.value = 0.14;

    oscLeft.type = 'sine';
    oscRight.type = 'sine';
    oscLeft.frequency.value = 200;
    oscRight.frequency.value = 240;

    if (panLeft && panRight) {
      panLeft.pan.value = -0.8;
      panRight.pan.value = 0.8;
      oscLeft.connect(panLeft);
      oscRight.connect(panRight);
      panLeft.connect(toneGain);
      panRight.connect(toneGain);
    } else {
      oscLeft.connect(toneGain);
      oscRight.connect(toneGain);
    }

    toneGain.connect(this.masterGain);
    oscLeft.start();
    oscRight.start();
    this.activeNodes.push(oscLeft, oscRight, toneGain);
  }

  playChime() {
    try {
      this.ensureContext();
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        gain.gain.setValueAtTime(0.001, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.11 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.9);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.95);
      });
    } catch (_) {}
  }
}

export const soundEngine = new SoundscapeEngine();

// All sound is synthesized with WebAudio: short oscillator/noise bursts for
// effects, and a scheduled bass arpeggio for the music loop. Nothing is
// loaded from a file. Audio starts only after a user gesture (the click
// that starts the game), so browsers allow it.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let noiseBuf = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;
  let nextNoteTime = 0;

  const BASS = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  const ARP = [220, 261.63, 329.63, 440, 329.63, 261.63];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (lowpass) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function scheduleMusic() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.18) {
      const step = musicStep % 16;
      const bass = BASS[Math.floor(step / 2) % BASS.length];
      const t = nextNoteTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = bass;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t);
      osc.stop(t + 0.24);
      if (step % 4 === 2) {
        const arp = ARP[(musicStep >> 2) % ARP.length];
        const aosc = ctx.createOscillator();
        const again = ctx.createGain();
        aosc.type = 'sine';
        aosc.frequency.value = arp * 2;
        again.gain.setValueAtTime(0.16, t);
        again.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        aosc.connect(again);
        again.connect(musicGain);
        aosc.start(t);
        aosc.stop(t + 0.16);
      }
      nextNoteTime += 0.125;
      musicStep += 1;
    }
  }

  return {
    // Call from the first user gesture; also starts the music.
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!musicTimer) {
        nextNoteTime = ctx.currentTime + 0.05;
        musicTimer = window.setInterval(scheduleMusic, 90);
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    shoot(weaponId) {
      if (!ctx) return;
      if (weaponId === 'rail') tone(880, 0.16, 'sawtooth', 0.16, 120);
      else if (weaponId === 'spread') noise(0.09, 0.2, 2400);
      else tone(660, 0.07, 'square', 0.1, 320);
    },
    hit() {
      if (!ctx) return;
      tone(190, 0.05, 'triangle', 0.12, 120);
    },
    kill() {
      if (!ctx) return;
      tone(320, 0.14, 'sawtooth', 0.14, 60);
      noise(0.12, 0.14, 1800);
    },
    hurt() {
      if (!ctx) return;
      tone(110, 0.22, 'sawtooth', 0.2, 55);
      noise(0.15, 0.16, 900);
    },
    pickup() {
      if (!ctx) return;
      tone(880, 0.09, 'sine', 0.14, 1320);
    },
    dash() {
      if (!ctx) return;
      noise(0.14, 0.12, 3200);
    },
    wave() {
      if (!ctx) return;
      tone(220, 0.12, 'square', 0.12);
      window.setTimeout(() => tone(330, 0.12, 'square', 0.12), 110);
      window.setTimeout(() => tone(440, 0.18, 'square', 0.12), 220);
    },
    buy() {
      if (!ctx) return;
      tone(520, 0.08, 'sine', 0.14, 780);
      window.setTimeout(() => tone(780, 0.12, 'sine', 0.14), 80);
    },
    denied() {
      if (!ctx) return;
      tone(160, 0.12, 'square', 0.12, 110);
    },
    gameOver() {
      if (!ctx) return;
      tone(220, 0.5, 'sawtooth', 0.16, 55);
      window.setTimeout(() => tone(165, 0.6, 'sawtooth', 0.16, 49), 320);
    },
    victory() {
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.3, 'triangle', 0.16), i * 140);
      });
    },
  };
}

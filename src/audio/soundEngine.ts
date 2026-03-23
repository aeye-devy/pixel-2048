import { createBgmEngine } from './bgmEngine.js'

const MUTE_KEY = 'pixel2048-muted'

type SoundName = 'slide' | 'merge' | 'spawn' | 'gameOver' | 'win' | 'buttonTap' | 'combo'

export interface SoundEngine {
  /** Resume AudioContext (call on first user gesture for mobile). */
  unlock(): void
  /** Play a named sound effect. mergeValue optional for pitch scaling. */
  play(name: SoundName, mergeValue?: number): void
  /** Toggle mute state. Returns new muted value. */
  toggleMute(): boolean
  /** Current mute state. */
  isMuted(): boolean
  /** Request BGM playback (starts after AudioContext is unlocked). */
  startBgm(): void
  /** Stop BGM. */
  stopBgm(): void
  /** Set BGM tension level 0–1 (board fill → tempo/intensity). */
  setBgmTension(level: number): void
}

export function createSoundEngine(): SoundEngine {
  let ctx: AudioContext | null = null
  let muted = localStorage.getItem(MUTE_KEY) === '1'
  const bgm = createBgmEngine()
  let bgmWanted = false

  function getCtx(): AudioContext {
    ctx ??= new AudioContext()
    return ctx
  }

  function tryStartBgm(): void {
    if (!bgmWanted || muted) return
    const ac = getCtx()
    if (ac.state === 'running' && !bgm.isPlaying()) {
      bgm.start(ac, ac.destination)
    }
  }

  function unlock(): void {
    const ac = getCtx()
    if (ac.state === 'suspended') {
      void ac.resume().then(() => { tryStartBgm() })
    } else {
      tryStartBgm()
    }
  }

  function toggleMute(): boolean {
    muted = !muted
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
    if (muted) {
      bgm.stop()
    } else {
      tryStartBgm()
    }
    return muted
  }

  function isMuted(): boolean {
    return muted
  }

  // -- Oscillator helpers --

  function osc(
    ac: AudioContext,
    type: OscillatorType,
    freq: number,
    startTime: number,
    duration: number,
    gain: number,
    freqEnd?: number,
  ): void {
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, startTime)
    if (freqEnd !== undefined) {
      o.frequency.linearRampToValueAtTime(freqEnd, startTime + duration)
    }
    g.gain.setValueAtTime(gain, startTime)
    g.gain.linearRampToValueAtTime(0, startTime + duration)
    o.connect(g)
    g.connect(ac.destination)
    o.start(startTime)
    o.stop(startTime + duration)
  }

  function noise(
    ac: AudioContext,
    startTime: number,
    duration: number,
    gain: number,
  ): void {
    const sampleRate = ac.sampleRate
    const length = Math.floor(sampleRate * duration)
    const buffer = ac.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const src = ac.createBufferSource()
    src.buffer = buffer
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, startTime)
    g.gain.linearRampToValueAtTime(0, startTime + duration)
    src.connect(g)
    g.connect(ac.destination)
    src.start(startTime)
    src.stop(startTime + duration)
  }

  // -- Sound definitions --

  function playSlide(ac: AudioContext): void {
    const t = ac.currentTime
    // Quick square wave sweep down — snappy tile movement
    osc(ac, 'square', 280, t, 0.06, 0.08, 180)
    noise(ac, t, 0.04, 0.02)
  }

  function playMerge(ac: AudioContext, value: number): void {
    const t = ac.currentTime
    // Base pitch scales with tile value: log2(value) maps 4→2, 2048→11
    const logVal = Math.log2(Math.max(value, 2))
    const basePitch = 220 + (logVal - 1) * 60 // ~280Hz for 4, ~820Hz for 2048
    // Satisfying pop: triangle up-sweep + square ding
    osc(ac, 'triangle', basePitch * 0.8, t, 0.08, 0.12, basePitch * 1.2)
    osc(ac, 'square', basePitch * 1.5, t + 0.03, 0.1, 0.06)
    // Subtle noise click
    noise(ac, t, 0.02, 0.03)
  }

  function playSpawn(ac: AudioContext): void {
    const t = ac.currentTime
    // Gentle high blip — triangle wave
    osc(ac, 'triangle', 600, t, 0.05, 0.04, 800)
  }

  function playGameOver(ac: AudioContext): void {
    const t = ac.currentTime
    // Descending tone sequence: 4 notes falling
    osc(ac, 'square', 440, t, 0.12, 0.1, 420)
    osc(ac, 'square', 370, t + 0.14, 0.12, 0.1, 350)
    osc(ac, 'square', 294, t + 0.28, 0.12, 0.1, 270)
    osc(ac, 'triangle', 220, t + 0.42, 0.25, 0.12, 160)
    noise(ac, t + 0.42, 0.15, 0.03)
  }

  function playWin(ac: AudioContext): void {
    const t = ac.currentTime
    // Triumphant ascending chiptune fanfare
    osc(ac, 'square', 523, t, 0.1, 0.1) // C5
    osc(ac, 'square', 659, t + 0.1, 0.1, 0.1) // E5
    osc(ac, 'square', 784, t + 0.2, 0.1, 0.1) // G5
    osc(ac, 'square', 1047, t + 0.3, 0.2, 0.12) // C6 (hold)
    // Harmony layer
    osc(ac, 'triangle', 392, t + 0.3, 0.2, 0.06) // G4
    osc(ac, 'triangle', 523, t + 0.3, 0.2, 0.06) // C5
    // Sparkle
    osc(ac, 'triangle', 1568, t + 0.35, 0.15, 0.04, 2093)
  }

  function playCombo(ac: AudioContext, comboCount: number): void {
    const t = ac.currentTime
    // Ascending arpeggio — higher pitch for bigger combos
    const baseFreq = 523 + (comboCount - 2) * 80 // C5 base, scales up
    osc(ac, 'square', baseFreq, t, 0.08, 0.1)
    osc(ac, 'square', baseFreq * 1.25, t + 0.06, 0.08, 0.1) // major 3rd
    osc(ac, 'square', baseFreq * 1.5, t + 0.12, 0.12, 0.12) // perfect 5th (hold)
    // Sparkle layer
    osc(ac, 'triangle', baseFreq * 2, t + 0.15, 0.1, 0.05)
    noise(ac, t, 0.03, 0.02)
  }

  function playButtonTap(ac: AudioContext): void {
    const t = ac.currentTime
    // Quick UI click: short square pulse
    osc(ac, 'square', 800, t, 0.03, 0.06, 600)
    noise(ac, t, 0.02, 0.02)
  }

  function play(name: SoundName, mergeValue?: number): void {
    if (muted) return
    const ac = getCtx()
    if (ac.state === 'suspended') return
    switch (name) {
      case 'slide':
        playSlide(ac)
        break
      case 'merge':
        playMerge(ac, mergeValue ?? 4)
        break
      case 'spawn':
        playSpawn(ac)
        break
      case 'gameOver':
        playGameOver(ac)
        break
      case 'win':
        playWin(ac)
        break
      case 'buttonTap':
        playButtonTap(ac)
        break
      case 'combo':
        playCombo(ac, mergeValue ?? 2)
        break
    }
  }

  function startBgm(): void {
    bgmWanted = true
    tryStartBgm()
  }

  function stopBgm(): void {
    bgmWanted = false
    bgm.stop()
  }

  function setBgmTension(level: number): void {
    bgm.setTension(level)
  }

  return { unlock, play, toggleMute, isMuted, startBgm, stopBgm, setBgmTension }
}

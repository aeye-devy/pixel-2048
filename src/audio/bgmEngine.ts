// Look-ahead scheduler constants
const SCHEDULE_AHEAD_SEC = 0.1
const SCHEDULE_INTERVAL_MS = 25
const BPM_RELAXED = 108
const BPM_TENSE = 138
const TOTAL_STEPS = 128
const R = 0 // rest marker

function midiFreq(note: number): number {
  return 440 * 2 ** ((note - 69) / 12)
}

// -- Musical Patterns: 16-bar loop (Am → F → C → G, 4 bars each) --
// Each bar = 8 eighth-note steps. Total = 128 steps.
// At 108 BPM: ~35.5s loop. At 138 BPM: ~27.8s loop.

// Arpeggio: triangle wave, flowing broken chords
// Am: A3(57) C4(60) E4(64) A4(69)
// F:  F3(53) A3(57) C4(60) F4(65)
// C:  C4(60) E4(64) G4(67) C5(72)
// G:  G3(55) B3(59) D4(62) G4(67)
const ARP: readonly number[] = [
  // Am (bars 1-4)
  57, 64, 60, 64, 69, 64, 60, 64,
  57, 60, 64, 60, 69, 64, 60, 57,
  57, 64, 60, 64, 69, 64, 60, 64,
  57, 60, 64, 69, 64, 60, 57, 60,
  // F (bars 5-8)
  53, 60, 57, 60, 65, 60, 57, 60,
  53, 57, 60, 57, 65, 60, 57, 53,
  53, 60, 57, 60, 65, 60, 57, 60,
  53, 57, 60, 65, 60, 57, 53, 57,
  // C (bars 9-12)
  60, 67, 64, 67, 72, 67, 64, 67,
  60, 64, 67, 64, 72, 67, 64, 60,
  60, 67, 64, 67, 72, 67, 64, 67,
  60, 64, 67, 72, 67, 64, 60, 64,
  // G (bars 13-16)
  55, 62, 59, 62, 67, 62, 59, 62,
  55, 59, 62, 59, 67, 62, 59, 55,
  55, 62, 59, 62, 67, 62, 59, 62,
  55, 59, 62, 67, 62, 59, 55, 57,
]

// Bass: triangle wave, quarter notes with rests on off-beats
const BASS: readonly number[] = [
  // Am (bars 1-4): A2(45), E2(40), E3(52)
  45, R, 40, R, 45, R, 40, R,
  45, R, 40, R, 45, R, 40, R,
  45, R, 52, R, 45, R, 40, R,
  45, R, 40, R, 45, R, 40, R,
  // F (bars 5-8): F2(41), C3(48), F1(29)
  41, R, 48, R, 41, R, 48, R,
  41, R, 48, R, 41, R, 48, R,
  41, R, 36, R, 41, R, 48, R,
  41, R, 48, R, 41, R, 48, R,
  // C (bars 9-12): C3(48), G2(43), G3(55)
  48, R, 43, R, 48, R, 43, R,
  48, R, 43, R, 48, R, 55, R,
  48, R, 43, R, 48, R, 43, R,
  48, R, 55, R, 48, R, 43, R,
  // G (bars 13-16): G2(43), D3(50), B2(47), A2(45)
  43, R, 50, R, 43, R, 50, R,
  43, R, 50, R, 43, R, 47, R,
  43, R, 50, R, 43, R, 50, R,
  43, R, 47, R, 50, R, 45, R,
]

// Melody: square wave, sparse Am pentatonic (A C D E G)
// Silent in bars 1-4, gentle phrases in bars 5-16
const MELODY: readonly number[] = [
  // Bars 1-4: silence
  R, R, R, R, R, R, R, R,
  R, R, R, R, R, R, R, R,
  R, R, R, R, R, R, R, R,
  R, R, R, R, R, R, R, R,
  // Bars 5-8 (F section): first melody entrance
  R, R, R, R, 72, R, 69, R,
  R, R, R, R, R, R, R, R,
  69, R, R, R, 67, R, 64, R,
  R, R, R, R, R, R, R, R,
  // Bars 9-12 (C section): melody develops
  R, R, R, R, 67, R, 69, R,
  72, R, R, R, R, R, R, R,
  R, R, R, R, 74, R, 72, R,
  69, R, R, R, R, R, R, R,
  // Bars 13-16 (G section): resolve back to Am
  R, R, R, R, 64, R, 67, R,
  69, R, R, R, R, R, 67, R,
  R, R, R, R, 64, R, R, R,
  R, R, R, R, R, R, R, R,
]

export interface BgmEngine {
  /** Start BGM playback. */
  start(ctx: AudioContext, destination: AudioNode): void
  /** Stop BGM with a short fade-out. */
  stop(): void
  /** Set tension level 0–1 (affects tempo and adds percussion). */
  setTension(level: number): void
  /** Set master BGM volume 0–1. */
  setVolume(volume: number): void
  /** Whether BGM is currently active. */
  isPlaying(): boolean
}

export function createBgmEngine(): BgmEngine {
  let playing = false
  let tension = 0
  let masterGain: GainNode | null = null
  let schedulerTimer: ReturnType<typeof setInterval> | null = null
  let currentStep = 0
  let nextStepTime = 0
  let ac: AudioContext | null = null

  function eighthNoteDuration(): number {
    const bpm = BPM_RELAXED + (BPM_TENSE - BPM_RELAXED) * tension
    return 60 / bpm / 2
  }

  function playTone(
    type: OscillatorType,
    midiNote: number,
    time: number,
    duration: number,
    gain: number,
  ): void {
    if (!ac || !masterGain || midiNote === R) return
    const o = ac.createOscillator()
    const g = ac.createGain()
    o.type = type
    o.frequency.setValueAtTime(midiFreq(midiNote), time)
    g.gain.setValueAtTime(gain, time)
    g.gain.setValueAtTime(gain, time + duration * 0.7)
    g.gain.linearRampToValueAtTime(0, time + duration)
    o.connect(g)
    g.connect(masterGain)
    o.start(time)
    o.stop(time + duration + 0.02)
  }

  function playNoise(time: number, duration: number, gain: number): void {
    if (!ac || !masterGain) return
    const len = Math.floor(ac.sampleRate * duration)
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const src = ac.createBufferSource()
    src.buffer = buf
    const g = ac.createGain()
    g.gain.setValueAtTime(gain, time)
    g.gain.linearRampToValueAtTime(0, time + duration)
    src.connect(g)
    g.connect(masterGain)
    src.start(time)
    src.stop(time + duration + 0.01)
  }

  function scheduleStep(step: number, time: number): void {
    const idx = step % TOTAL_STEPS
    const dur = eighthNoteDuration()
    const arpNote = ARP[idx]
    if (arpNote !== undefined && arpNote !== R) {
      playTone('triangle', arpNote, time, dur * 0.85, 0.07)
    }
    const bassNote = BASS[idx]
    if (bassNote !== undefined && bassNote !== R) {
      playTone('triangle', bassNote, time, dur * 1.9, 0.09)
    }
    const melNote = MELODY[idx]
    if (melNote !== undefined && melNote !== R) {
      playTone('square', melNote, time, dur * 1.6, 0.04)
    }
    // Subtle hi-hat at higher tension levels
    if (tension > 0.4 && idx % 2 === 0) {
      playNoise(time, dur * 0.3, 0.012 * tension)
    }
  }

  function tick(): void {
    if (!ac || !playing) return
    const lookAhead = ac.currentTime + SCHEDULE_AHEAD_SEC
    while (nextStepTime < lookAhead) {
      scheduleStep(currentStep, nextStepTime)
      nextStepTime += eighthNoteDuration()
      currentStep++
    }
  }

  function start(ctx: AudioContext, destination: AudioNode): void {
    if (playing) return
    ac = ctx
    masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0.5, ctx.currentTime)
    masterGain.connect(destination)
    playing = true
    currentStep = 0
    nextStepTime = ctx.currentTime + 0.05
    schedulerTimer = setInterval(tick, SCHEDULE_INTERVAL_MS)
  }

  function stop(): void {
    playing = false
    if (schedulerTimer !== null) {
      clearInterval(schedulerTimer)
      schedulerTimer = null
    }
    if (masterGain && ac) {
      const now = ac.currentTime
      masterGain.gain.setValueAtTime(masterGain.gain.value, now)
      masterGain.gain.linearRampToValueAtTime(0, now + 0.2)
      const ref = masterGain
      setTimeout(() => { ref.disconnect() }, 300)
    }
    masterGain = null
    ac = null
  }

  function setTension(level: number): void {
    tension = Math.max(0, Math.min(1, level))
  }

  function setVolume(volume: number): void {
    if (masterGain && ac) {
      masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        ac.currentTime,
        0.05,
      )
    }
  }

  return { start, stop, setTension, setVolume, isPlaying: () => playing }
}

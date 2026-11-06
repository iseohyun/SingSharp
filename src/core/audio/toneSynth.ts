/**
 * Reference Tone & Sequence Audio Synthesizer
 * - 외부 음원 파일 없이 Web Audio API만으로 따뜻한 피아노/보컬 유사 음색(기본파 + 배음 ADSR 엔벨로프)과 메트로놈 클릭음을 생성합니다.
 * - 설정에서 지정한 마스터 볼륨(0 ~ 100%)을 모든 출력음에 반영합니다.
 */
import { TargetNote } from '../../types/vocal';

export interface SequenceGuideOptions {
  speedMultiplier?: number;
  onNotePlay?: (note: TargetNote) => void;
  onComplete?: () => void;
}

class ToneSynthesizer {
  private ctx: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private scheduledTimers: number[] = [];
  private masterVolumeRatio = 0.75; // 기본 75% (0.0 ~ 1.0)

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 마스터 볼륨 설정 (0 ~ 100%) */
  public setMasterVolume(volumePercent: number): void {
    const clamped = Math.max(0, Math.min(100, volumePercent));
    this.masterVolumeRatio = clamped / 100;
  }

  public getMasterVolume(): number {
    return Math.round(this.masterVolumeRatio * 100);
  }

  private stopOscillatorsOnly(): void {
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // 이미 종료된 오실레이터 무시
      }
    });
    this.activeOscillators = [];
  }

  private playToneInternal(frequency: number, durationSec = 1.2, baseVolume = 0.25): void {
    this.stopOscillatorsOnly();
    const effectiveVolume = baseVolume * this.masterVolumeRatio * 1.35;
    if (effectiveVolume <= 0.0005) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(effectiveVolume, now + 0.035);
    masterGain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, effectiveVolume * 0.65),
      now + durationSec * 0.72
    );
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    masterGain.connect(ctx.destination);

    // 기본파(Triangle) + 2배음(Sine) 조합
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(frequency, now);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(frequency * 2, now);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.18, now);

    osc1.connect(masterGain);
    osc2.connect(harmonicGain);
    harmonicGain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + durationSec);
    osc2.stop(now + durationSec);

    this.activeOscillators.push(osc1, osc2);
  }

  /** 단일 기준음(예: 440Hz A4)을 지정된 시간(초) 동안 재생 */
  public playReferenceTone(frequency: number, durationSec = 1.2, volume = 0.25): void {
    this.stopAll();
    this.playToneInternal(frequency, durationSec, volume);
  }

  /** 메트로놈 짧은 클릭음 재생 */
  public playMetronomeClick(isAccent = false): void {
    const baseGain = isAccent ? 0.18 : 0.1;
    const effectiveGain = baseGain * this.masterVolumeRatio * 1.35;
    if (effectiveGain <= 0.0005) return;

    const ctx = this.getContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isAccent ? 1100 : 750, now);

    gain.gain.setValueAtTime(effectiveGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * 악보의 모든 노트를 스케줄에 맞춰 순서대로 미리 들려주기 (난이도 3, 4, 5 가이드 재생)
   */
  public playSequenceGuide(
    notes: TargetNote[],
    optionsOrCallback?: SequenceGuideOptions | (() => void)
  ): void {
    this.stopAll();
    const opts: SequenceGuideOptions =
      typeof optionsOrCallback === 'function'
        ? { onComplete: optionsOrCallback }
        : optionsOrCallback ?? {};

    if (notes.length === 0) {
      opts.onComplete?.();
      return;
    }

    const speed = opts.speedMultiplier ?? 1.0;

    notes.forEach((note) => {
      const startMs = (note.startTimeSec / speed) * 1000;
      const playDurSec = Math.max(0.22, (note.durationSec / speed) * 0.9);
      const timerId = window.setTimeout(() => {
        opts.onNotePlay?.(note);
        this.playToneInternal(note.frequency, playDurSec, 0.24);
      }, startMs);
      this.scheduledTimers.push(timerId);
    });

    const lastNote = notes[notes.length - 1];
    const totalMs = ((lastNote.startTimeSec + lastNote.durationSec) / speed) * 1000 + 180;
    const endTimer = window.setTimeout(() => {
      opts.onComplete?.();
    }, totalMs);
    this.scheduledTimers.push(endTimer);
  }

  public stopAll(): void {
    this.scheduledTimers.forEach((id) => clearTimeout(id));
    this.scheduledTimers = [];
    this.stopOscillatorsOnly();
  }
}

export const toneSynth = new ToneSynthesizer();

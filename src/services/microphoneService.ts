/**
 * Microphone & Simulated Vocal Stream Service
 * - 실제 마이크 입력(Web Audio API AnalyserNode)을 실시간 60fps로 분석하여 PitchFrame을 방출합니다.
 * - 마이크가 없거나 조용한 환경에서도 모든 훈련 기능을 즉시 검증할 수 있도록 '가상 보컬 시뮬레이터(Demo Synth Mode)'도 내장합니다.
 */
import { analyzeAudioBuffer } from '../core/audio/pitchDetector';
import {
  frequencyToNearestMidi,
  getCentsDifference,
  midiToFrequency,
  midiToNoteName,
} from '../core/music/pitchUtils';
import { PitchFrame } from '../types/vocal';

export type PitchFrameListener = (frame: PitchFrame) => void;

export interface SimulationConfig {
  enabled: boolean;
  targetFrequency: number;
  centsOffset: number;     // 의도적 음정 오차 시뮬레이션 (-60 ~ +60 cents)
  volumeLevel: number;     // 가상 성량 (0 ~ 100)
  vibratoEnabled: boolean; // 가상 바이브레이션 켜기
}

class MicrophoneService {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array = new Float32Array(2048);
  private rafId: number | null = null;
  private listeners: Set<PitchFrameListener> = new Set();
  private isRunning = false;
  private noiseGate = 8;

  private simConfig: SimulationConfig = {
    enabled: false,
    targetFrequency: 440,
    centsOffset: 0,
    volumeLevel: 68,
    vibratoEnabled: false,
  };

  public setNoiseGate(level: number): void {
    this.noiseGate = Math.max(2, Math.min(40, level));
  }

  public updateSimulationConfig(partial: Partial<SimulationConfig>): void {
    this.simConfig = { ...this.simConfig, ...partial };
  }

  public getSimulationConfig(): SimulationConfig {
    return this.simConfig;
  }

  public subscribe(listener: PitchFrameListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async startMicrophone(): Promise<{ success: boolean; error?: string }> {
    this.stop();
    this.simConfig.enabled = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
        },
      });
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);

      this.mediaStream = stream;
      this.buffer = new Float32Array(this.analyser.fftSize);
      this.isRunning = true;
      this.loop();
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : '마이크 권한을 얻을 수 없습니다.';
      return { success: false, error: message };
    }
  }

  public startSimulator(initialTargetFreq = 440): void {
    this.stop();
    this.simConfig.enabled = true;
    this.simConfig.targetFrequency = initialTargetFreq;
    this.isRunning = true;
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    let frame: PitchFrame;

    if (this.simConfig.enabled) {
      frame = this.generateSimulatedFrame();
    } else if (this.analyser && this.audioCtx) {
      this.analyser.getFloatTimeDomainData(this.buffer);
      frame = analyzeAudioBuffer(this.buffer, this.audioCtx.sampleRate, this.noiseGate);
    } else {
      return;
    }

    this.listeners.forEach((listener) => listener(frame));
    this.rafId = requestAnimationFrame(this.loop);
  };

  private generateSimulatedFrame(): PitchFrame {
    const now = performance.now();
    const vol = this.simConfig.volumeLevel;

    if (vol < this.noiseGate) {
      return {
        timestamp: now,
        frequency: null,
        midi: null,
        noteName: null,
        centsOff: 0,
        clarity: 0,
        volumeNormalized: vol,
        rmsDb: -55,
        isVoiced: false,
      };
    }

    // 자연스러운 인간 미세 흔들림(±3 cents) + 설정된 오프셋 + 바이브레이션(5.8Hz, ±42 cents)
    const microJitter = Math.sin(now * 0.013) * 3;
    const vibratoWave = this.simConfig.vibratoEnabled
      ? Math.sin((2 * Math.PI * 5.8 * now) / 1000) * 42
      : 0;
    const totalCentsShift = this.simConfig.centsOffset + microJitter + vibratoWave;

    const simulatedFreq =
      this.simConfig.targetFrequency * Math.pow(2, totalCentsShift / 1200);
    const nearestMidi = frequencyToNearestMidi(simulatedFreq);
    const nearestFreq = midiToFrequency(nearestMidi);
    const centsOff = getCentsDifference(simulatedFreq, nearestFreq);
    const rmsDb = -60 + (vol / 100) * 55;

    return {
      timestamp: now,
      frequency: Math.round(simulatedFreq * 100) / 100,
      midi: nearestMidi,
      noteName: midiToNoteName(nearestMidi),
      centsOff: Math.round(centsOff),
      clarity: 0.96,
      volumeNormalized: Math.round(vol),
      rmsDb: Math.round(rmsDb * 10) / 10,
      isVoiced: true,
    };
  }
}

export const microphoneService = new MicrophoneService();

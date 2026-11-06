import { PitchFrame, VibratoMetrics } from '../../types/vocal';
import {
  frequencyToNearestMidi,
  getCentsDifference,
  midiToFrequency,
  midiToNoteName,
} from '../music/pitchUtils';

/**
 * Normalized Square Difference Function (NSDF / YIN 계열 보정) 기반 실시간 피치 및 음량 추출기
 * - 배음(Harmonics)으로 인한 옥타브 점프 오류를 억제하고 포물선 보간(Parabolic Interpolation)으로 정밀 Hz를 계산합니다.
 */
export function analyzeAudioBuffer(
  buffer: Float32Array,
  sampleRate: number,
  noiseGateNormalized = 8
): PitchFrame {
  const n = buffer.length;
  let sumSquares = 0;
  for (let i = 0; i < n; i++) {
    sumSquares += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSquares / n);
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-7));

  // -60dB ~ -5dB 구간을 0 ~ 100 성량 스케일로 정규화
  const volumeNormalized = Math.max(0, Math.min(100, ((rmsDb + 60) / 55) * 100));

  // 무음 또는 배경 소음 이하인 경우
  if (volumeNormalized < noiseGateNormalized) {
    return {
      timestamp: performance.now(),
      frequency: null,
      midi: null,
      noteName: null,
      centsOff: 0,
      clarity: 0,
      volumeNormalized: Math.round(volumeNormalized),
      rmsDb: Math.round(rmsDb * 10) / 10,
      isVoiced: false,
    };
  }

  // 인간 보컬 유효 주파수 범위: 65Hz (C2) ~ 1100Hz (C6)
  const minFreq = 65;
  const maxFreq = 1100;
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.min(Math.floor(sampleRate / minFreq), Math.floor(n / 2));

  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = minLag; tau <= maxLag; tau++) {
    let acf = 0;
    let divisorM = 0;
    for (let i = 0; i < n - tau; i++) {
      acf += buffer[i] * buffer[i + tau];
      divisorM += buffer[i] * buffer[i] + buffer[i + tau] * buffer[i + tau];
    }
    nsdf[tau] = divisorM > 0 ? (2 * acf) / divisorM : 0;
  }

  // 첫 번째 양의 피크 탐색 (McLeod Peak Picking 원리: 최대 피크의 85% 이상인 첫 번째 주요 피크를 선택해 옥타브 오류 방지)
  let maxPeakVal = 0;
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (nsdf[tau] > maxPeakVal) {
      maxPeakVal = nsdf[tau];
    }
  }

  const clarityThreshold = 0.62; // 무성자음(ㅅ, ㅊ, ㅍ 등) 필터링 임계값
  if (maxPeakVal < clarityThreshold) {
    return {
      timestamp: performance.now(),
      frequency: null,
      midi: null,
      noteName: null,
      centsOff: 0,
      clarity: Math.max(0, maxPeakVal),
      volumeNormalized: Math.round(volumeNormalized),
      rmsDb: Math.round(rmsDb * 10) / 10,
      isVoiced: false,
    };
  }

  const peakSelectionThreshold = maxPeakVal * 0.88;
  let chosenLag = -1;

  for (let tau = minLag + 1; tau < maxLag - 1; tau++) {
    if (nsdf[tau] > 0 && nsdf[tau] >= nsdf[tau - 1] && nsdf[tau] >= nsdf[tau + 1]) {
      if (nsdf[tau] >= peakSelectionThreshold) {
        chosenLag = tau;
        break;
      }
    }
  }

  if (chosenLag === -1) {
    return {
      timestamp: performance.now(),
      frequency: null,
      midi: null,
      noteName: null,
      centsOff: 0,
      clarity: maxPeakVal,
      volumeNormalized: Math.round(volumeNormalized),
      rmsDb: Math.round(rmsDb * 10) / 10,
      isVoiced: false,
    };
  }

  // Parabolic Interpolation (소수점 단위 정밀 주기 보간)
  const y1 = nsdf[chosenLag - 1];
  const y2 = nsdf[chosenLag];
  const y3 = nsdf[chosenLag + 1];
  const denom = y1 - 2 * y2 + y3;
  const delta = denom !== 0 ? (0.5 * (y1 - y3)) / denom : 0;
  const refinedLag = chosenLag + delta;

  const frequency = sampleRate / refinedLag;
  const midi = frequencyToNearestMidi(frequency);
  const nearestTargetFreq = midiToFrequency(midi);
  const centsOff = getCentsDifference(frequency, nearestTargetFreq);

  return {
    timestamp: performance.now(),
    frequency: Math.round(frequency * 100) / 100,
    midi,
    noteName: midiToNoteName(midi),
    centsOff: Math.round(centsOff),
    clarity: Math.round(y2 * 100) / 100,
    volumeNormalized: Math.round(volumeNormalized),
    rmsDb: Math.round(rmsDb * 10) / 10,
    isVoiced: true,
  };
}

/**
 * 최근 약 1.2초간의 피치 히스토리를 분석하여 바이브레이션(Vibrato) 속도(Hz), 진폭(Cents), 규칙성을 계산합니다.
 */
export function analyzeVibratoFromHistory(
  recentFrames: PitchFrame[],
  referenceFreq: number
): VibratoMetrics {
  const voiced = recentFrames.filter((f) => f.isVoiced && f.frequency !== null);
  if (voiced.length < 18) {
    return { isDetected: false, rateHz: 0, extentCents: 0, regularity: 0 };
  }

  const timeSpanSec = (voiced[voiced.length - 1].timestamp - voiced[0].timestamp) / 1000;
  if (timeSpanSec < 0.45) {
    return { isDetected: false, rateHz: 0, extentCents: 0, regularity: 0 };
  }

  const centsSeries = voiced.map((f) => getCentsDifference(f.frequency!, referenceFreq));
  const meanCents = centsSeries.reduce((a, b) => a + b, 0) / centsSeries.length;
  const centered = centsSeries.map((c) => c - meanCents);

  // Zero-crossing 횟수로 진동 주파수(Rate Hz) 추정
  let zeroCrossings = 0;
  let maxDeviation = 0;
  for (let i = 1; i < centered.length; i++) {
    if ((centered[i - 1] < 0 && centered[i] >= 0) || (centered[i - 1] >= 0 && centered[i] < 0)) {
      zeroCrossings++;
    }
    const absDev = Math.abs(centered[i]);
    if (absDev > maxDeviation) maxDeviation = absDev;
  }

  // 왕복 1주기는 2번의 zero-crossing
  const cycles = zeroCrossings / 2;
  const rateHz = Math.round((cycles / timeSpanSec) * 10) / 10;

  // RMS 기반 평균 진폭(Extent Cents)
  const rmsCents = Math.sqrt(centered.reduce((acc, v) => acc + v * v, 0) / centered.length);
  const extentCents = Math.round(rmsCents * 1.414);

  // 이상적인 보컬 바이브레이션: 속도 4.2 ~ 8.0 Hz, 진폭 18 ~ 110 cents
  const isRateGood = rateHz >= 4.2 && rateHz <= 8.0;
  const isExtentGood = extentCents >= 18 && extentCents <= 115;
  const isDetected = isRateGood && isExtentGood && cycles >= 2;

  let regularity = 0;
  if (cycles >= 1.5) {
    const ratePenalty = Math.abs(rateHz - 5.8) * 12;
    const extentPenalty = extentCents < 18 ? (18 - extentCents) * 3 : extentCents > 100 ? (extentCents - 100) * 1.5 : 0;
    regularity = Math.max(0, Math.min(100, Math.round(100 - ratePenalty - extentPenalty)));
  }

  return {
    isDetected,
    rateHz,
    extentCents,
    regularity,
  };
}

/**
 * Real-time Coaching & Topic-Specific Scoring Engine
 * - 입력이 없는 시간(무음 구간)에는 감점하지 않음 (유성음 입력 프레임만 평가)
 * - 현재 트레이닝 주제에 관련된 지표만 평가 (+음정):
 *   1. 음정 (pitch_accuracy): 음정 (100%)
 *   2. 유지 (sustain_duration): 음정 (50%) + 유지 (50%) — 음표 길이와 알맞고(오차만큼 감점) 세기를 잃지 않고 끝까지 발성되는지 평가
 *   3. 세기 (dynamics_volume): 음정 (50%) + 세기 (50%) — 발성 세기가 흔들림 없이 일정할 때 100점
 *   4. 템포 (tempo_rhythm): 음정 (50%) + 템포 (50%) — 다음 음이 정확한 타이밍에 발성되는지 평가
 *   5. 바이브레이션 (vibrato_control): 음정 (50%) + 바이브레이션 (50%)
 */
import { analyzeVibratoFromHistory } from '../audio/pitchDetector';
import { getCentsDifference } from '../music/pitchUtils';
import {
  PitchFrame,
  TargetNote,
  TrainingMode,
} from '../../types/vocal';

export interface SessionScoreSummary {
  overallScore: number;
  pitchAccuracy: number;
  sustainAccuracy: number;
  dynamicsAccuracy: number;
  tempoAccuracy: number;
  vibratoScore: number;
}

export interface RecordedNoteSample {
  noteId: string;
  relativeTimeSec: number;
  sessionElapsedSec?: number;
  frame: PitchFrame;
}

/**
 * 단일 유성음 프레임 피치 채점
 * - ±8 cents 이내: 100점
 * - ±20 cents: 80점
 * - ±35 cents: 50점
 * - ±50 cents (반음 경계): 25점
 * - 50 cents 초과: 급격히 0점
 */
function scoreSingleFramePitchStrict(userFreq: number, targetFreq: number): number {
  const absCents = Math.abs(getCentsDifference(userFreq, targetFreq));
  if (absCents <= 8) return 100;
  if (absCents <= 20) return Math.round(100 - ((absCents - 8) / 12) * 20);
  if (absCents <= 35) return Math.round(80 - ((absCents - 20) / 15) * 30);
  if (absCents <= 50) return Math.round(50 - ((absCents - 35) / 15) * 25);
  return Math.max(0, Math.round(25 - (absCents - 50) * 1.5));
}

/**
 * 최근 5초간의 유성음 입력 샘플을 바탕으로 현재 트레이닝 주제에 해당하는 지표(+음정)만 평가합니다.
 * - 입력이 없는 시간(무음 프레임)에는 감점하지 않습니다.
 */
export function evaluateRecent5SecWindow(
  mode: TrainingMode,
  notes: TargetNote[],
  samples: RecordedNoteSample[],
  currentElapsedSec: number
): SessionScoreSummary {
  const zeroSummary: SessionScoreSummary = {
    overallScore: 0,
    pitchAccuracy: 0,
    sustainAccuracy: 0,
    dynamicsAccuracy: 0,
    tempoAccuracy: 0,
    vibratoScore: 0,
  };

  if (notes.length === 0 || samples.length === 0) {
    return zeroSummary;
  }

  const windowStart = Math.max(0, currentElapsedSec - 5.0);
  const recentSamples = samples.filter((s) => {
    const t = s.sessionElapsedSec ?? s.relativeTimeSec;
    return t >= windowStart && t <= currentElapsedSec;
  });

  // 입력이 없는 시간에는 감점하지 않도록 실제 유성음 입력이 있는 프레임만 추출
  const voicedRecent = recentSamples.filter(
    (s) => s.frame.isVoiced && s.frame.frequency !== null && s.frame.clarity >= 0.72
  );

  // 최근 5초 내 유성음 입력이 없으면 이전 전체 유성음 샘플을 참조하되, 아예 입력이 없으면 0 반환
  const allVoiced = samples.filter(
    (s) => s.frame.isVoiced && s.frame.frequency !== null && s.frame.clarity >= 0.72
  );
  const evalVoiced = voicedRecent.length > 0 ? voicedRecent : allVoiced;

  if (evalVoiced.length === 0) {
    return zeroSummary;
  }

  const noteMap = new Map<string, TargetNote>();
  notes.forEach((n) => noteMap.set(n.id, n));

  // 1. 공통 기본 지표: 음정 정확도 (입력이 있는 유성음 프레임만 평가하여 무음 시간 무감점)
  const pitchScores = evalVoiced.map((s) => {
    const target = noteMap.get(s.noteId) ?? notes[0];
    return scoreSingleFramePitchStrict(s.frame.frequency!, target.frequency);
  });
  const pitchAccuracy = Math.round(
    pitchScores.reduce((a, b) => a + b, 0) / pitchScores.length
  );

  let sustainAccuracy = 0;
  let dynamicsAccuracy = 0;
  let tempoAccuracy = 0;
  let vibratoScore = 0;
  let overallScore = pitchAccuracy;

  // 2. 현재 트레이닝 주제에 관련된 지표만 선택적으로 평가
  if (mode === 'pitch_accuracy') {
    overallScore = pitchAccuracy;
  } else if (mode === 'sustain_duration') {
    // [유지]: (1) 음표 길이와 알맞을 때(오차만큼 감점) + (2) 해당 음이 세기를 잃지 않고 끝까지 발성되는지
    const voicedNoteIds = Array.from(new Set(allVoiced.map((s) => s.noteId)));
    let noteSustainSum = 0;

    voicedNoteIds.forEach((nId) => {
      const target = noteMap.get(nId) ?? notes[0];
      const noteVoiced = allVoiced.filter((s) => s.noteId === nId);
      if (noteVoiced.length === 0) return;

      const firstRel = noteVoiced[0].relativeTimeSec;
      const lastRel = noteVoiced[noteVoiced.length - 1].relativeTimeSec;
      const actualVoicedDur = Math.max(0.05, lastRel - firstRel + 0.04);

      // 현재 시점 기준 해당 음표가 진행된 목표 길이 (진행 중일 때는 현재까지 진행된 음표 시간과 비교하여 무음 대기시간 감점 방지)
      const noteElapsedSoFar = Math.min(
        target.durationSec,
        Math.max(0.2, currentElapsedSec - target.startTimeSec - firstRel)
      );
      const durErrorRatio =
        Math.abs(noteElapsedSoFar - actualVoicedDur) / Math.max(0.2, noteElapsedSoFar);
      const durationMatchScore = Math.max(0, Math.round(100 * (1 - durErrorRatio)));

      // 세기를 잃지 않고 끝까지 발성되는지 평가 (초반부 평균 성량 대비 후반부 성량 유지율)
      const midIdx = Math.max(1, Math.floor(noteVoiced.length / 2));
      const firstHalf = noteVoiced.slice(0, midIdx);
      const secondHalf = noteVoiced.slice(midIdx);

      const startVolAvg =
        firstHalf.reduce((acc, s) => acc + s.frame.volumeNormalized, 0) /
        firstHalf.length;
      const endVolAvg =
        secondHalf.length > 0
          ? secondHalf.reduce((acc, s) => acc + s.frame.volumeNormalized, 0) /
            secondHalf.length
          : startVolAvg;

      let energyKeepScore = 100;
      if (endVolAvg < startVolAvg * 0.92) {
        const dropRatio = (startVolAvg * 0.92 - endVolAvg) / Math.max(10, startVolAvg);
        energyKeepScore = Math.max(0, Math.round(100 - dropRatio * 180));
      }

      noteSustainSum += Math.round(durationMatchScore * 0.5 + energyKeepScore * 0.5);
    });

    sustainAccuracy =
      voicedNoteIds.length > 0
        ? Math.round(noteSustainSum / voicedNoteIds.length)
        : 0;
    overallScore = Math.round(pitchAccuracy * 0.5 + sustainAccuracy * 0.5);
  } else if (mode === 'dynamics_volume') {
    // [세기]: 발성 세기(성량)가 흔들림 없이 일정할 때 100점
    const vols = evalVoiced.map((s) => s.frame.volumeNormalized);
    const meanVol = vols.reduce((a, b) => a + b, 0) / vols.length;
    const meanAbsDev =
      vols.reduce((acc, v) => acc + Math.abs(v - meanVol), 0) / vols.length;

    // 평균 편차 2.0 이하이면 100점, 편차가 커질수록 감점
    dynamicsAccuracy =
      meanAbsDev <= 2.0
        ? 100
        : Math.max(0, Math.round(100 - (meanAbsDev - 2.0) * 6.5));
    overallScore = Math.round(pitchAccuracy * 0.5 + dynamicsAccuracy * 0.5);
  } else if (mode === 'tempo_rhythm') {
    // [템포]: 다음 음이 정확한 타이밍에 발성되는지 평가
    const targetNotesToEval =
      notes.length > 1
        ? notes.filter((n, idx) => idx >= 1 && currentElapsedSec >= n.startTimeSec)
        : notes;

    const evalNotesList = targetNotesToEval.length > 0 ? targetNotesToEval : [notes[0]];
    let tempoSum = 0;
    let evaluatedCount = 0;

    evalNotesList.forEach((note) => {
      const noteVoiced = allVoiced.filter((s) => s.noteId === note.id);
      if (noteVoiced.length === 0) return;

      // 해당 다음 음의 목표 피치(±45 cents 이내)로 실제 전환된 첫 시점 확인
      const firstMatched =
        noteVoiced.find(
          (s) =>
            Math.abs(getCentsDifference(s.frame.frequency!, note.frequency)) <= 45
        ) ?? noteVoiced[0];

      const timingErrorMs = Math.abs(firstMatched.relativeTimeSec * 1000);
      const tScore =
        timingErrorMs <= 80
          ? 100
          : Math.max(0, Math.round(100 - (timingErrorMs - 80) * 0.25));

      tempoSum += tScore;
      evaluatedCount += 1;
    });

    tempoAccuracy =
      evaluatedCount > 0 ? Math.round(tempoSum / evaluatedCount) : 0;
    overallScore = Math.round(pitchAccuracy * 0.5 + tempoAccuracy * 0.5);
  } else if (mode === 'vibrato_control') {
    // [바이브레이션]: 음정 + 바이브레이션 규칙성 평가
    const lastTarget =
      noteMap.get(evalVoiced[evalVoiced.length - 1].noteId) ?? notes[0];
    const vibMetrics = analyzeVibratoFromHistory(
      evalVoiced.map((s) => s.frame),
      lastTarget.frequency
    );
    vibratoScore = vibMetrics.isDetected
      ? vibMetrics.regularity
      : Math.min(20, Math.round(vibMetrics.regularity * 0.4));
    overallScore = Math.round(pitchAccuracy * 0.5 + vibratoScore * 0.5);
  }

  return {
    overallScore,
    pitchAccuracy,
    sustainAccuracy,
    dynamicsAccuracy,
    tempoAccuracy,
    vibratoScore,
  };
}

/**
 * 10초 훈련 라운드 종료 시 최종 점수를 산출합니다.
 */
export function evaluateTrainingSession(
  mode: TrainingMode,
  notes: TargetNote[],
  samples: RecordedNoteSample[]
): SessionScoreSummary {
  if (notes.length === 0 || samples.length === 0) {
    return {
      overallScore: 0,
      pitchAccuracy: 0,
      sustainAccuracy: 0,
      dynamicsAccuracy: 0,
      tempoAccuracy: 0,
      vibratoScore: 0,
    };
  }

  const maxElapsed = samples.reduce(
    (acc, s) => Math.max(acc, s.sessionElapsedSec ?? s.relativeTimeSec),
    5.0
  );
  return evaluateRecent5SecWindow(mode, notes, samples, maxElapsed);
}

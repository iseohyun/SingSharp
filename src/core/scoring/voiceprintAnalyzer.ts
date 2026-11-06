/**
 * Voiceprint & Per-Pitch Score Domain Analyzer
 * - 프로파일의 음정별 최고·최저·평균 점수(noteScoreStats) 누적 산출
 * - 유성음 피치 프레임(voicedFrames) 기반 음성지문(Voiceprint) 특성 가중 이동평균 분석
 */
import {
  NoteScoreStat,
  PitchFrame,
  UserVocalProfile,
  VoiceprintData,
} from '../../types/vocal';

export const DEFAULT_VOICEPRINT: VoiceprintData = {
  updatedAt: null,
  fundamentalFreqHz: 220.0,
  clarityAvg: 0,
  pitchStabilityCents: 0,
  dynamicRangeDb: -45,
  vibratoRateHz: 0,
  vibratoExtentCents: 0,
  vocalTimbreType: '미측정 (훈련 또는 테스트 시 자동 분석)',
  sampleCount: 0,
};

/**
 * 특정 음정(MIDI)에 대한 점수를 프로파일의 noteScoreStats에 누적 기록(최고·최저·평균)하고
 * 음성지문(voiceprint) 특성도 함께 갱신합니다.
 */
export function updateProfileWithNoteScoreAndVoiceprint(
  profile: UserVocalProfile,
  midiNotes: number[],
  score: number,
  voicedFrames: PitchFrame[],
  vibratoRateHz = 0,
  vibratoExtentCents = 0
): UserVocalProfile {
  const nextStats: Record<number, NoteScoreStat> = { ...(profile.noteScoreStats ?? {}) };
  const uniqueMidis = Array.from(new Set(midiNotes.map((m) => Math.round(m))));

  uniqueMidis.forEach((m) => {
    const prev = nextStats[m];
    if (!prev || prev.count === 0) {
      nextStats[m] = {
        midi: m,
        high: score,
        low: score,
        avg: score,
        count: 1,
        total: score,
      };
    } else {
      const nextCount = prev.count + 1;
      const nextTotal = prev.total + score;
      nextStats[m] = {
        midi: m,
        high: Math.max(prev.high, score),
        low: Math.min(prev.low, score),
        avg: Math.round(nextTotal / nextCount),
        count: nextCount,
        total: nextTotal,
      };
    }
  });

  const prevVp = profile.voiceprint ?? DEFAULT_VOICEPRINT;
  let nextVp: VoiceprintData = { ...prevVp };

  if (voicedFrames.length > 0) {
    const freqs = voicedFrames
      .map((f) => f.frequency)
      .filter((f): f is number => f !== null && f > 0);
    const avgFreq =
      freqs.length > 0
        ? freqs.reduce((a, b) => a + b, 0) / freqs.length
        : prevVp.fundamentalFreqHz;

    const avgClarity = Math.round(
      (voicedFrames.reduce((a, b) => a + b.clarity, 0) / voicedFrames.length) * 100
    );
    const avgAbsCents = Math.round(
      voicedFrames.reduce((a, b) => a + Math.abs(b.centsOff), 0) / voicedFrames.length
    );
    const avgDb =
      Math.round(
        (voicedFrames.reduce((a, b) => a + b.rmsDb, 0) / voicedFrames.length) * 10
      ) / 10;

    const prevCount = prevVp.sampleCount || 0;
    const wPrev = Math.min(0.75, prevCount / (prevCount + 1));
    const wCurr = 1 - wPrev;

    const blendedClarity = Math.round(prevVp.clarityAvg * wPrev + avgClarity * wCurr);
    const blendedStability = Math.round(
      prevVp.pitchStabilityCents * wPrev + avgAbsCents * wCurr
    );
    const blendedDb =
      Math.round((prevVp.dynamicRangeDb * wPrev + avgDb * wCurr) * 10) / 10;
    const blendedFreq =
      Math.round((prevVp.fundamentalFreqHz * wPrev + avgFreq * wCurr) * 10) / 10;

    let timbreType = '균형 잡힌 중음 보컬형';
    if (profile.comfortableCenterMidi <= 50) {
      timbreType = blendedClarity >= 82 ? '선명한 공명 중저음형' : '부드러운 중저음 보컬형';
    } else if (profile.comfortableCenterMidi >= 58) {
      timbreType = blendedClarity >= 82 ? '맑고 선명한 고음형' : '섬세한 미성 고음형';
    } else if (blendedClarity >= 85) {
      timbreType = '배음이 풍부한 탄탄한 발성형';
    }

    nextVp = {
      updatedAt: new Date().toISOString(),
      fundamentalFreqHz: blendedFreq,
      clarityAvg: blendedClarity,
      pitchStabilityCents: blendedStability,
      dynamicRangeDb: blendedDb,
      vibratoRateHz:
        vibratoRateHz > 0
          ? Math.round((prevVp.vibratoRateHz * wPrev + vibratoRateHz * wCurr) * 10) / 10
          : prevVp.vibratoRateHz,
      vibratoExtentCents:
        vibratoExtentCents > 0
          ? Math.round(prevVp.vibratoExtentCents * wPrev + vibratoExtentCents * wCurr)
          : prevVp.vibratoExtentCents,
      vocalTimbreType: timbreType,
      sampleCount: prevCount + 1,
    };
  }

  return {
    ...profile,
    noteScoreStats: nextStats,
    voiceprint: nextVp,
  };
}

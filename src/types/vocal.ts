/**
 * SingSharp Core Domain Types
 * - Web, Desktop, Mobile 공통으로 사용되는 도메인 모델 및 향후 외부/유튜브 음원 확장을 고려한 통합 스키마
 */

/** 5대 훈련 종류 (Training Modes) */
export type TrainingMode =
  | 'pitch_accuracy'   // 1. 음정을 정확히 낼 수 있다
  | 'sustain_duration' // 2. 음정을 정확한 길이까지 유지할 수 있다
  | 'dynamics_volume'  // 3. 음정을 정확한 세기로 낼 수 있다
  | 'tempo_rhythm'     // 4. 정확한 템포로 낼 수 있다
  | 'vibrato_control'; // 5. 바이브레이션을 할 수 있다

/** 5단계 훈련 난이도 (Difficulty Levels) */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface TrainingModeInfo {
  id: TrainingMode;
  number: number;
  title: string;
  subtitle: string;
  description: string;
  badgeColor: string;
}

export interface DifficultyLevelInfo {
  level: DifficultyLevel;
  title: string;
  description: string;
}

/** 개별 목표 음표 (악보 및 피아노 롤 렌더링 단위) */
export interface TargetNote {
  id: string;
  midi: number;          // MIDI 노트 번호 (예: 69 = A4 440Hz)
  frequency: number;     // 목표 주파수 (Hz)
  noteName: string;      // 영문 음이름 (예: "A4", "C#4")
  koreanSolfege: string; // 계이름 표기 (예: "라4", "도#4")
  startBeat: number;     // 시작 박자 위치 (0부터 시작)
  durationBeats: number; // 지속 박자 수
  startTimeSec: number;  // 시작 시간 (초)
  durationSec: number;   // 지속 시간 (초)
  lyric?: string;        // 가사 (난이도 5 또는 외부 음원 훈련 시 사용)
  targetDbMin?: number;  // 세기 훈련 시 최소 목표 볼륨 (0~100)
  targetDbMax?: number;  // 세기 훈련 시 최대 목표 볼륨 (0~100)
  requireVibrato?: boolean; // 바이브레이션 요구 여부
}

/** 통합 훈련 시퀀스 (TrainingSequence) */
export interface TrainingSequence {
  id: string;
  title: string;
  mode: TrainingMode;
  difficulty: DifficultyLevel;
  bpm: number;
  totalDurationSec: number;
  notes: TargetNote[];
  externalSource?: {
    type: 'youtube' | 'local_audio';
    sourceUrlOrName: string;
    loopStartSec: number;
    loopEndSec: number;
    keyShiftSemitones: number;
    tempoMultiplier: number;
  };
}

/** 실시간 마이크 오디오 분석 프레임 */
export interface PitchFrame {
  timestamp: number;
  frequency: number | null;
  midi: number | null;
  noteName: string | null;
  centsOff: number;
  clarity: number;
  volumeNormalized: number;
  rmsDb: number;
  isVoiced: boolean;
}

/** 바이브레이션 실시간 분석 지표 */
export interface VibratoMetrics {
  isDetected: boolean;
  rateHz: number;
  extentCents: number;
  regularity: number;
}

/** 개별 음정(MIDI)별 누적 최고/최저/평균 점수 통계 */
export interface NoteScoreStat {
  midi: number;
  high: number;
  low: number;
  avg: number;
  count: number;
  total: number;
}

/** 프로파일에 수록되는 음성지문(Voiceprint) 정보 */
export interface VoiceprintData {
  updatedAt: string | null;
  fundamentalFreqHz: number;   // 평균 중심 주파수 (Hz)
  clarityAvg: number;          // 배음 명료도 평균 (0 ~ 100%)
  pitchStabilityCents: number; // 음정 유지 안정도 편차 (cents)
  dynamicRangeDb: number;      // 평균 발성 데시벨 (dBFS)
  vibratoRateHz: number;       // 평균 바이브레이션 주기 (Hz)
  vibratoExtentCents: number;  // 평균 바이브레이션 진폭 (cents)
  vocalTimbreType: string;     // 분석된 음색/성부 특징
  sampleCount: number;         // 누적 분석 횟수
}

/** 사용자 음역대 및 음성지문 프로파일 */
export interface UserVocalProfile {
  id: string;                     // 'profile-1' | 'profile-2' | 'profile-3'
  name: string;                   // 프로파일 이름 (변경 가능)
  lowestMidi: number;             // 측정된 최저음 MIDI (예: 48 = C3)
  highestMidi: number;            // 측정된 최고음 MIDI (예: 72 = C5)
  comfortableCenterMidi: number;  // 부르기 편한 기본 음정 MIDI
  customOctaveSpan: 2 | 3;
  customBaseMidi: number;
  lastTestedAt: string | null;
  micNoiseFloor: number;
  micNormalLevel: number;
  bassClefThresholdMidi: number;
  defaultDemoDurationSec: number;
  masterVolume: number;           // 시범음 및 가이드 마스터 볼륨 (0 ~ 100)
  noteScoreStats: Record<number, NoteScoreStat>; // 음정별 최고·최저·평균 점수
  voiceprint: VoiceprintData;                    // 음성지문 정보
}

/** 구글 로그인 상태 정보 */
export interface GoogleAuthUser {
  isLoggedIn: boolean;
  displayName: string;
  email: string;
  lastSyncedAt: string | null;
}

/** 일일 훈련 성과 기록 아이템 (Daily Log) */
export interface TrainingRecord {
  id: string;
  profileId?: string;
  date: string;             // YYYY-MM-DD
  timestamp: string;        // ISO 문자열
  mode: TrainingMode;
  difficulty: DifficultyLevel;
  overallScore: number;     // 종합 점수 (0 ~ 100)
  pitchAccuracy: number;    // 음정 정확도 (0 ~ 100)
  sustainAccuracy: number;  // 길이 유지 정확도 (0 ~ 100)
  dynamicsAccuracy: number; // 세기 정확도 (0 ~ 100)
  tempoAccuracy: number;    // 템포 정확도 (0 ~ 100)
  vibratoScore: number;     // 바이브레이션 점수 (0 ~ 100)
  durationSec: number;      // 연습 소요 시간 (초)
  notesAttempted: number;
  targetMidi?: number;      // 훈련한 주요 음정 MIDI
  isCertification?: boolean;
  certGrade?: 'S' | 'A' | 'B' | 'C' | 'F';
}

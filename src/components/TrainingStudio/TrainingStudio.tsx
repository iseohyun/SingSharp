import React, { useState } from 'react';
import { toneSynth } from '../../core/audio/toneSynth';
import { TRAINING_MODES } from '../../core/music/sequenceGenerator';
import { SessionScoreSummary } from '../../core/scoring/trainingEvaluator';
import {
  TRAINING_DURATION_SEC,
  useTrainingSession,
} from '../../hooks/useTrainingSession';
import {
  DifficultyLevel,
  TrainingMode,
  TrainingRecord,
  UserVocalProfile,
} from '../../types/vocal';
import { PitchPianoRoll } from '../PitchPianoRoll/PitchPianoRoll';
import { SheetMusicView } from '../SheetMusic/SheetMusicView';
import { PitchScoreChart } from '../VoiceprintView/PitchScoreChart';
import { ScoringCriteriaTable } from './ScoringCriteriaTable';
import styles from './TrainingStudio.module.css';

interface TrainingStudioProps {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  onSaveRecord: (record: TrainingRecord) => void;
  isSimMode: boolean;
  selectedMode: TrainingMode;
  onSelectMode: (mode: TrainingMode) => void;
  selectedDiff: DifficultyLevel;
  isCertificationMode?: boolean;
}

function formatModeDetailScore(mode: TrainingMode, summary: SessionScoreSummary): string {
  if (mode === 'pitch_accuracy') {
    return `음정:${summary.pitchAccuracy}점`;
  }
  if (mode === 'sustain_duration') {
    return `음정:${summary.pitchAccuracy}점, 유지:${summary.sustainAccuracy}점`;
  }
  if (mode === 'dynamics_volume') {
    return `음정:${summary.pitchAccuracy}점, 세기:${summary.dynamicsAccuracy}점`;
  }
  if (mode === 'tempo_rhythm') {
    return `음정:${summary.pitchAccuracy}점, 템포:${summary.tempoAccuracy}점`;
  }
  if (mode === 'vibrato_control') {
    return `음정:${summary.pitchAccuracy}점, 바이브레이션:${summary.vibratoScore}점`;
  }
  return `음정:${summary.pitchAccuracy}점`;
}

export const TrainingStudio: React.FC<TrainingStudioProps> = ({
  profile,
  onUpdateProfile,
  onSaveRecord,
  isSimMode,
  selectedMode,
  onSelectMode,
  selectedDiff,
  isCertificationMode = false,
}) => {
  // 5선지 고정과 주파수 그래프 고정은 독립 동작
  const [isSheetPinned, setIsSheetPinned] = useState<boolean>(true);
  const [isRollPinned, setIsRollPinned] = useState<boolean>(true);

  const {
    sequence,
    activeNote,
    sessionState,
    restCountdown,
    elapsedSec,
    liveFrame,
    pitchTrace,
    liveScoreSummary,
    demoDurationSec,
    handleToggleTraining,
    handleReplay,
  } = useTrainingSession({
    profile,
    onUpdateProfile,
    onSaveRecord,
    isSimMode,
    selectedMode,
    selectedDiff,
    isCertificationMode,
  });

  const isRunning =
    sessionState === 'singing' ||
    sessionState === 'resting' ||
    sessionState === 'guide_playing';
  const remainingTrainSec = Math.max(0, TRAINING_DURATION_SEC - elapsedSec);

  return (
    <div className={styles.studioContainer}>
      {/* 1. 오선지 악보 (독립 고정 토글) */}
      <SheetMusicView
        notes={sequence.notes}
        activeNoteId={activeNote?.id ?? null}
        currentUserMidi={liveFrame?.isVoiced ? liveFrame.midi : null}
        onPlayNoteClick={(note) =>
          toneSynth.playReferenceTone(note.frequency, demoDurationSec, 0.26)
        }
        bassClefThresholdMidi={profile.bassClefThresholdMidi ?? 59}
        isPinned={isSheetPinned}
        onTogglePin={() => setIsSheetPinned((prev) => !prev)}
      />

      {/* 2. 실시간 주파수 그래프 (독립 고정 토글) */}
      <PitchPianoRoll
        notes={sequence.notes}
        totalDurationSec={sequence.totalDurationSec}
        elapsedSec={elapsedSec}
        pitchTrace={pitchTrace}
        centerTargetMidi={activeNote?.midi}
        isPinned={isRollPinned}
        isAbovePinned={isSheetPinned}
        onTogglePin={() => setIsRollPinned((prev) => !prev)}
      />

      {/* 테스트(점수인증) 모드일 때 평가 종목 선택 바 */}
      {isCertificationMode && (
        <div className={styles.panelCard}>
          <div className={styles.sectionTitle}>
            <span>점수인증 평가 종목 선택</span>
            <span style={{ fontSize: '0.8rem', color: '#e3b341' }}>
              95점 이상: S등급 | 85점 이상: A등급 | 75점 이상: B등급 | 60점 이상: C등급
            </span>
          </div>
          <div className={styles.modeList}>
            {TRAINING_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`${styles.modeBtn} ${
                  selectedMode === m.id ? styles.modeBtnActive : ''
                }`}
                onClick={() => onSelectMode(m.id)}
              >
                <div className={styles.modeBtnTitle}>{m.title}</div>
                <div className={styles.modeBtnSub}>{m.subtitle}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 훈련 컨트롤 툴바: "훈련시작" 최우선 노출 + "점수 N/100 점 (분야별 점수)" + "다시 재생" */}
      <div className={styles.controlToolbar}>
        <div className={styles.toolbarLeft}>
          <button
            type="button"
            className={isRunning ? styles.stopBtn : styles.startBtn}
            onClick={handleToggleTraining}
          >
            {isRunning ? '훈련 중지' : '훈련시작'}
          </button>

          <div className={styles.liveScoreBadge}>
            <span>점수</span>
            <span className={styles.liveScoreValue}>
              {liveScoreSummary.overallScore}/100 점
            </span>
            <span style={{ fontSize: '0.82rem', color: '#c9d1d9' }}>
              ({formatModeDetailScore(selectedMode, liveScoreSummary)})
            </span>
          </div>

          {sessionState === 'guide_playing' && (
            <div className={styles.timerBadge}>
              시범 멜로디 재생 중 (모든 음을 듣고 이어서 따라 부르세요)
            </div>
          )}

          {sessionState === 'singing' && (
            <div className={styles.timerBadge}>
              10초 훈련 중 · 남은 시간: <strong>{remainingTrainSec.toFixed(1)}초</strong>
            </div>
          )}

          {sessionState === 'resting' && (
            <div className={styles.restCountdownBadge}>
              3초 휴식 카운트다운: <strong>{restCountdown}초</strong> 후 다음 음 시작
            </div>
          )}
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleReplay}
          >
            다시 재생
          </button>
        </div>
      </div>

      {/* 각 음정마다 최고 · 최저 · 평균 점수 그래프 (세로축: 점수, 가로축: 음정) */}
      <PitchScoreChart profile={profile} />

      {/* 하단 세부 채점기준표 */}
      <ScoringCriteriaTable selectedMode={selectedMode} />
    </div>
  );
};

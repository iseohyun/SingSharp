import React, { useState } from 'react';
import { midiToNoteName } from '../../core/music/pitchUtils';
import { useVocalRangeTest } from '../../hooks/useVocalRangeTest';
import { UserVocalProfile } from '../../types/vocal';
import { PitchPianoRoll } from '../PitchPianoRoll/PitchPianoRoll';
import { SheetMusicView } from '../SheetMusic/SheetMusicView';
import { RangeComparisonChart } from './RangeComparisonChart';
import { RangeFeedbackBox } from './RangeFeedbackBox';
import styles from './VocalRangeTest.module.css';

interface VocalRangeTestProps {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  isSimMode: boolean;
}

export const VocalRangeTest: React.FC<VocalRangeTestProps> = ({
  profile,
  onUpdateProfile,
  isSimMode,
}) => {
  // 5선지 고정과 주파수 고정 그래프는 각각 독립적으로 동작
  const [isSheetPinned, setIsSheetPinned] = useState<boolean>(true);
  const [isRollPinned, setIsRollPinned] = useState<boolean>(true);

  const {
    comfortMidi,
    measuredHighMidi,
    measuredLowMidi,
    isRecordingComfort,
    step1Done,
    highStatus,
    highTargetMidi,
    step2Done,
    lowStatus,
    lowTargetMidi,
    failedLowMidi,
    step3Done,
    activeDirection,
    currentTargetMidi,
    holdProgress,
    liveFrame,
    elapsedSec,
    pitchTrace,
    showReport,
    selectedGender,
    setSelectedGender,
    step2Ref,
    step3Ref,
    reportRef,
    currentTargetNoteObj,
    pointerLeftPct,
    demoDurationSec,
    playDemoToneSafely,
    handleToggleComfortRecord,
    handleStep2Action,
    handleStep3Action,
    finishStep3AndShowReport,
  } = useVocalRangeTest({
    profile,
    onUpdateProfile,
    isSimMode,
  });

  return (
    <div className={styles.container}>
      {/* 1. 5선지 악보 (독립 고정 토글) */}
      <SheetMusicView
        notes={[currentTargetNoteObj]}
        activeNoteId={currentTargetNoteObj.id}
        currentUserMidi={liveFrame?.isVoiced ? liveFrame.midi : null}
        onPlayNoteClick={(note) =>
          playDemoToneSafely(note.frequency, demoDurationSec, 0.26)
        }
        bassClefThresholdMidi={profile.bassClefThresholdMidi ?? 59}
        isPinned={isSheetPinned}
        onTogglePin={() => setIsSheetPinned((prev) => !prev)}
      />

      {/* 2. 실시간 주파수 그래프 (독립 고정 토글) */}
      <PitchPianoRoll
        notes={[currentTargetNoteObj]}
        elapsedSec={elapsedSec}
        pitchTrace={pitchTrace}
        centerTargetMidi={currentTargetMidi}
        isPinned={isRollPinned}
        isAbovePinned={isSheetPinned}
        onTogglePin={() => setIsRollPinned((prev) => !prev)}
      />

      {/* Step 1: 편안한 음을 녹음하세요. + "녹음 시작" + 현재 기준음(C#3) */}
      <div
        className={`${styles.stepCard} ${
          step1Done && !isRecordingComfort ? styles.stepShaded : ''
        } ${isRecordingComfort ? styles.stepActive : ''}`}
      >
        <div className={styles.stepHeader}>
          <div className={styles.stepHeaderLeft}>
            <h3 className={styles.stepTitle}>Step1. 편안한 음을 녹음하세요.</h3>
            <button
              type="button"
              className={`${styles.actionBtn} ${
                isRecordingComfort ? styles.actionBtnActive : ''
              }`}
              onClick={handleToggleComfortRecord}
            >
              {isRecordingComfort ? '녹음 끝' : '녹음 시작'}
            </button>
            <span className={styles.noteBadge}>
              현재 기준음({midiToNoteName(comfortMidi)})
            </span>
          </div>
        </div>
      </div>

      {/* Step 2: 높은 음역 테스트 */}
      <div
        ref={step2Ref}
        className={`${styles.stepCard} ${
          step2Done && highStatus !== 'testing' ? styles.stepShaded : ''
        } ${highStatus === 'testing' ? styles.stepActive : ''}`}
      >
        <div className={styles.stepHeader}>
          <div className={styles.stepHeaderLeft}>
            <h3 className={styles.stepTitle}>Step2. 높은 음역 테스트</h3>
            <button
              type="button"
              className={`${styles.actionBtn} ${
                highStatus === 'testing'
                  ? styles.actionBtnActive
                  : highStatus === 'retry'
                  ? styles.actionBtnRetry
                  : ''
              }`}
              onClick={handleStep2Action}
            >
              {highStatus === 'idle'
                ? '테스트 시작'
                : highStatus === 'testing'
                ? '테스트 중'
                : '재도전'}
            </button>
          </div>
        </div>

        <RangeFeedbackBox
          stepMidi={highStatus === 'testing' ? currentTargetMidi : highTargetMidi}
          isStepActive={highStatus === 'testing' && activeDirection === 'up'}
          pointerLeftPct={pointerLeftPct}
          holdProgress={holdProgress}
          demoDurationSec={demoDurationSec}
          onReplayTone={playDemoToneSafely}
        />
      </div>

      {/* Step 3: 낮은 음역 테스트 */}
      <div
        ref={step3Ref}
        className={`${styles.stepCard} ${
          step3Done && lowStatus !== 'testing' ? styles.stepShaded : ''
        } ${lowStatus === 'testing' ? styles.stepActive : ''}`}
      >
        <div className={styles.stepHeader}>
          <div className={styles.stepHeaderLeft}>
            <h3 className={styles.stepTitle}>Step3. 낮은 음역 테스트</h3>
            <button
              type="button"
              className={`${styles.actionBtn} ${
                lowStatus === 'testing'
                  ? styles.actionBtnActive
                  : lowStatus === 'retry'
                  ? styles.actionBtnRetry
                  : ''
              }`}
              onClick={handleStep3Action}
            >
              {lowStatus === 'idle'
                ? '테스트 시작'
                : lowStatus === 'testing'
                ? '테스트 중'
                : '재도전'}
            </button>
            <button
              type="button"
              className={styles.endBtn}
              onClick={() =>
                finishStep3AndShowReport(
                  lowStatus === 'testing' ? currentTargetMidi : failedLowMidi
                )
              }
            >
              테스트 종료
            </button>
          </div>
        </div>

        <RangeFeedbackBox
          stepMidi={lowStatus === 'testing' ? currentTargetMidi : lowTargetMidi}
          isStepActive={lowStatus === 'testing' && activeDirection === 'down'}
          pointerLeftPct={pointerLeftPct}
          holdProgress={holdProgress}
          demoDurationSec={demoDurationSec}
          onReplayTone={playDemoToneSafely}
        />
      </div>

      {/* 결과 보고 (남자/여자 예상 및 토글, 다중 세로축 비교 그래프) */}
      {showReport && (
        <RangeComparisonChart
          reportRef={reportRef}
          measuredLowMidi={measuredLowMidi}
          measuredHighMidi={measuredHighMidi}
          comfortMidi={comfortMidi}
          selectedGender={selectedGender}
          onSelectGender={setSelectedGender}
        />
      )}
    </div>
  );
};

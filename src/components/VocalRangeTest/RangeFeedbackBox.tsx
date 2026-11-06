import React from 'react';
import { midiToFrequency, midiToNoteName } from '../../core/music/pitchUtils';
import styles from './VocalRangeTest.module.css';

interface RangeFeedbackBoxProps {
  stepMidi: number;
  isStepActive: boolean;
  pointerLeftPct: number;
  holdProgress: number;
  demoDurationSec: number;
  onReplayTone: (freq: number, durationSec: number, gain: number) => void;
}

export const RangeFeedbackBox: React.FC<RangeFeedbackBoxProps> = ({
  stepMidi,
  isStepActive,
  pointerLeftPct,
  holdProgress,
  demoDurationSec,
  onReplayTone,
}) => {
  const freq = midiToFrequency(stepMidi);
  const pointerPct = isStepActive ? pointerLeftPct : 50;
  const progressPct = isStepActive ? holdProgress : 0;

  return (
    <div className={styles.feedbackRow}>
      <div className={styles.gaugeItem}>
        <div className={styles.gaugeLabelRow}>
          <span>통과 구간 그래프</span>
          <span>-50c ~ +50c</span>
        </div>
        <div className={styles.centsScale}>
          <div className={styles.safeZone} />
          <div
            className={styles.pointer}
            style={{ left: `calc(${pointerPct}% - 3px)` }}
          />
        </div>
      </div>

      <div className={styles.gaugeItem}>
        <div className={styles.gaugeLabelRow}>
          <span>유지 게이지</span>
          <span>{progressPct}%</span>
        </div>
        <div className={styles.holdBarTrack}>
          <div className={styles.holdBarFill} style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span className={styles.noteBadge}>현재음({midiToNoteName(stepMidi)})</span>
        <button
          type="button"
          className={styles.replayBtn}
          onClick={() => onReplayTone(freq, demoDurationSec, 0.27)}
        >
          🔁 시범음 다시재생
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { midiToKoreanSolfege, midiToNoteName } from '../../core/music/pitchUtils';
import { GenderType } from '../../hooks/useVocalRangeTest';
import styles from './VocalRangeTest.module.css';

const CHART_MIN_MIDI = 36; // C2 (0옥 도)
const CHART_MAX_MIDI = 84; // C6 (4옥 도)
const CHART_TICKS = [36, 43, 48, 55, 60, 67, 72, 79, 84];

interface BenchmarkRow {
  id: string;
  label: string;
  low: number;
  high: number;
  barClass: string;
}

/** 한국식 노래방 옥타브 표기 변환 (예: C4 -> 2옥 도, G2 -> 0옥 솔) */
export function midiToKoreanOctaveLabel(midi: number): string {
  const rounded = Math.round(midi);
  const korOctave = Math.floor(rounded / 12) - 3; // C2(36)=0옥, C3(48)=1옥, C4(60)=2옥, C5(72)=3옥
  const solfege = midiToKoreanSolfege(rounded).replace(/[-0-9]/g, '');
  return `${midiToNoteName(rounded)}(${korOctave}옥 ${solfege})`;
}

const GENDER_BENCHMARK_ROWS: Record<GenderType, BenchmarkRow[]> = {
  male: [
    { id: 'avg', label: '일반인 평균', low: 45, high: 64, barClass: 'barFillAvg' }, // A2 ~ E4
    { id: 'singer_std', label: '가수 (일반)', low: 43, high: 69, barClass: 'barFillSinger' }, // G2 ~ A4
    { id: 'singer_high', label: '가수 (고음)', low: 43, high: 74, barClass: 'barFillSingerHigh' }, // G2 ~ D5
    { id: 'vocal_bass', label: '성악 (베이스)', low: 40, high: 64, barClass: 'barFillVocalist' }, // E2 ~ E4
    { id: 'vocal_bari', label: '성악 (바리톤)', low: 43, high: 67, barClass: 'barFillVocalist' }, // G2 ~ G4
    { id: 'vocal_tenor', label: '성악 (테너)', low: 48, high: 72, barClass: 'barFillVocalistHigh' }, // C3 ~ C5
  ],
  female: [
    { id: 'avg', label: '일반인 평균', low: 55, high: 72, barClass: 'barFillAvg' }, // G3 ~ C5
    { id: 'singer_std', label: '가수 (일반)', low: 52, high: 76, barClass: 'barFillSinger' }, // E3 ~ E5
    { id: 'singer_high', label: '가수 (고음)', low: 55, high: 79, barClass: 'barFillSingerHigh' }, // G3 ~ G5
    { id: 'vocal_alto', label: '성악 (알토)', low: 53, high: 77, barClass: 'barFillVocalist' }, // F3 ~ F5
    { id: 'vocal_mezzo', label: '성악 (메조)', low: 57, high: 81, barClass: 'barFillVocalist' }, // A3 ~ A5
    { id: 'vocal_sop', label: '성악 (소프라노)', low: 60, high: 84, barClass: 'barFillVocalistHigh' }, // C4 ~ C6
  ],
};

interface RangeComparisonChartProps {
  reportRef: React.RefObject<HTMLDivElement>;
  measuredLowMidi: number;
  measuredHighMidi: number;
  comfortMidi: number;
  selectedGender: GenderType;
  onSelectGender: (gender: GenderType) => void;
}

export const RangeComparisonChart: React.FC<RangeComparisonChartProps> = ({
  reportRef,
  measuredLowMidi,
  measuredHighMidi,
  comfortMidi,
  selectedGender,
  onSelectGender,
}) => {
  const midiToChartPct = (midi: number): number => {
    const clamped = Math.max(CHART_MIN_MIDI, Math.min(CHART_MAX_MIDI, midi));
    return ((clamped - CHART_MIN_MIDI) / (CHART_MAX_MIDI - CHART_MIN_MIDI)) * 100;
  };

  const getRangeBarStyle = (low: number, high: number): React.CSSProperties => {
    const leftPct = midiToChartPct(Math.min(low, high));
    const rightPct = midiToChartPct(Math.max(low, high));
    const widthPct = Math.max(4, rightPct - leftPct);
    return {
      left: `${leftPct}%`,
      width: `${widthPct}%`,
    };
  };

  const benchmarkRows = GENDER_BENCHMARK_ROWS[selectedGender];

  return (
    <div ref={reportRef} className={styles.reportCard}>
      <div className={styles.reportHeader}>
        <div className={styles.stepHeaderLeft}>
          <h3 className={styles.stepTitle}>결과 보고</h3>
          <span className={styles.noteBadge}>
            내 음역대: {midiToKoreanOctaveLabel(measuredLowMidi)} ~{' '}
            {midiToKoreanOctaveLabel(measuredHighMidi)} (
            {Math.max(0, measuredHighMidi - measuredLowMidi)}반음)
          </span>
        </div>

        <div className={styles.genderToggleGroup}>
          <button
            type="button"
            className={`${styles.genderBtn} ${
              selectedGender === 'male' ? styles.genderBtnActive : ''
            }`}
            onClick={() => onSelectGender('male')}
          >
            남자
          </button>
          <button
            type="button"
            className={`${styles.genderBtn} ${
              selectedGender === 'female' ? styles.genderBtnActive : ''
            }`}
            onClick={() => onSelectGender('female')}
          >
            여자
          </button>
        </div>
      </div>

      <div className={styles.comparisonChart}>
        {/* 세로축 1: "나" */}
        <div className={styles.chartRow}>
          <div className={styles.yAxisLabel}>나</div>
          <div className={styles.barTrack}>
            <div
              className={styles.barFillMe}
              style={getRangeBarStyle(measuredLowMidi, measuredHighMidi)}
            >
              {midiToKoreanOctaveLabel(measuredLowMidi)} ~{' '}
              {midiToKoreanOctaveLabel(measuredHighMidi)}
            </div>
            <div
              className={styles.comfortMarker}
              style={{ left: `${midiToChartPct(comfortMidi)}%` }}
              title={`기준음 ${midiToKoreanOctaveLabel(comfortMidi)}`}
            />
          </div>
        </div>

        {/* 세로축 2~7: 일반인 평균 / 가수(일반·고음) / 성악가(성부별) */}
        {benchmarkRows.map((row) => (
          <div key={row.id} className={styles.chartRow}>
            <div className={styles.yAxisLabel}>{row.label}</div>
            <div className={styles.barTrack}>
              <div
                className={styles[row.barClass]}
                style={getRangeBarStyle(row.low, row.high)}
              >
                {midiToKoreanOctaveLabel(row.low)} ~ {midiToKoreanOctaveLabel(row.high)}
              </div>
            </div>
          </div>
        ))}

        {/* 가로축: 음역대 */}
        <div className={styles.xAxisRow}>
          <div
            className={styles.yAxisLabel}
            style={{ fontSize: '0.75rem', color: '#8b949e' }}
          >
            음역대
          </div>
          <div className={styles.xAxisTrack}>
            {CHART_TICKS.map((tickMidi) => (
              <span
                key={tickMidi}
                className={styles.xAxisTick}
                style={{ left: `${midiToChartPct(tickMidi)}%` }}
              >
                {midiToNoteName(tickMidi)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

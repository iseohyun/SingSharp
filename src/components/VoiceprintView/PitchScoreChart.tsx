import React, { useMemo } from 'react';
import { midiToKoreanSolfege, midiToNoteName } from '../../core/music/pitchUtils';
import { getCoreOneOctaveRange } from '../../core/music/sequenceGenerator';
import { UserVocalProfile } from '../../types/vocal';
import styles from './VoiceprintView.module.css';

interface PitchScoreChartProps {
  profile: UserVocalProfile;
  title?: string;
}

/**
 * 음정별 최고·최저·평균 점수 그래프
 * - 세로축: 점수 (0 ~ 100점)
 * - 가로축: 음정 (기본음정 1옥타브 이내 [난이도 1] 및 기본음정 외 [난이도 2] 구간 표시)
 */
export const PitchScoreChart: React.FC<PitchScoreChartProps> = ({
  profile,
  title = '음정별 최고 · 최저 · 평균 점수 그래프 (세로축: 점수 / 가로축: 음정)',
}) => {
  const { coreLowMidi, coreHighMidi } = getCoreOneOctaveRange(profile);
  const centerMidi = profile.comfortableCenterMidi || 55;

  const midiColumns = useMemo(() => {
    const statKeys = Object.keys(profile.noteScoreStats ?? {}).map(Number);
    const minStat = statKeys.length > 0 ? Math.min(...statKeys) : coreLowMidi - 3;
    const maxStat = statKeys.length > 0 ? Math.max(...statKeys) : coreHighMidi + 3;

    const startMidi = Math.max(
      36,
      Math.min(profile.lowestMidi || coreLowMidi - 3, coreLowMidi - 3, minStat)
    );
    const endMidi = Math.min(
      84,
      Math.max(profile.highestMidi || coreHighMidi + 3, coreHighMidi + 3, maxStat)
    );

    const list: number[] = [];
    for (let m = startMidi; m <= endMidi; m++) {
      list.push(m);
    }
    return list;
  }, [profile, coreLowMidi, coreHighMidi]);

  const colTemplate = `repeat(${midiColumns.length}, minmax(38px, 1fr))`;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{title}</h3>

        <div className={styles.badgeRow}>
          <span className={styles.zoneTagCore}>
            난이도 1 기본음정(1옥타브): {midiToNoteName(coreLowMidi)} ~{' '}
            {midiToNoteName(coreHighMidi)}
          </span>
          <span className={styles.zoneTagOuter}>난이도 2: 기본음정 외 영역</span>
          <span className={styles.legendItem}>
            <span className={styles.dotHigh} /> 최고
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dotAvg} /> 평균
          </span>
          <span className={styles.legendItem}>
            <span className={styles.dotLow} /> 최저
          </span>
        </div>
      </div>

      <div className={styles.chartBox}>
        {/* 세로축: 점수 (100 ~ 0) */}
        <div className={styles.yAxisCol}>
          <span>100점</span>
          <span>75점</span>
          <span>50점</span>
          <span>25점</span>
          <span>0점</span>
        </div>

        {/* 가로축: 음정 및 음정별 최고/최저/평균 막대·포인트 */}
        <div className={styles.plotScrollWrap}>
          <div className={styles.plotStage}>
            <div
              className={styles.gridArea}
              style={{ gridTemplateColumns: colTemplate }}
            >
              {/* 가로 보조선 (25, 50, 75, 100%) */}
              {[25, 50, 75, 100].map((pct) => (
                <div
                  key={pct}
                  className={styles.gridLineH}
                  style={{ bottom: `${pct}%` }}
                />
              ))}

              {midiColumns.map((midi) => {
                const isCore = midi >= coreLowMidi && midi <= coreHighMidi;
                const isCenter = midi === centerMidi;
                const stat = profile.noteScoreStats?.[midi];

                const colClass = isCenter
                  ? styles.noteColCenter
                  : isCore
                  ? styles.noteColCore
                  : styles.noteColOuter;

                return (
                  <div
                    key={midi}
                    className={`${styles.noteCol} ${colClass}`}
                    title={
                      stat
                        ? `${midiToNoteName(midi)} (${midiToKoreanSolfege(midi)}) — 최고 ${
                            stat.high
                          }점 / 평균 ${stat.avg}점 / 최저 ${stat.low}점 (${stat.count}회)`
                        : `${midiToNoteName(midi)} (${midiToKoreanSolfege(midi)}) — 기록 없음`
                    }
                  >
                    {stat && stat.count > 0 && (
                      <>
                        {/* 최저 ~ 최고 연결 수직 스틱 */}
                        <div
                          className={styles.rangeStick}
                          style={{
                            bottom: `${stat.low}%`,
                            height: `${Math.max(2, stat.high - stat.low)}%`,
                          }}
                        />

                        {/* 최고 점수 포인트 */}
                        <div
                          className={styles.pointHigh}
                          style={{ bottom: `${stat.high}%` }}
                        />

                        {/* 최저 점수 포인트 */}
                        <div
                          className={styles.pointLow}
                          style={{ bottom: `${stat.low}%` }}
                        />

                        {/* 평균 점수 포인트 및 수치 라벨 */}
                        <div
                          className={styles.pointAvg}
                          style={{ bottom: `${stat.avg}%` }}
                        />
                        <div
                          className={styles.scoreMiniLabel}
                          style={{ bottom: `${Math.min(92, Math.max(stat.high, stat.avg) + 4)}%` }}
                        >
                          {stat.avg}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 가로축: 음정 라벨 */}
            <div
              className={styles.xAxisRow}
              style={{ gridTemplateColumns: colTemplate }}
            >
              {midiColumns.map((midi) => {
                const isCore = midi >= coreLowMidi && midi <= coreHighMidi;
                const isCenter = midi === centerMidi;
                const stat = profile.noteScoreStats?.[midi];

                return (
                  <div
                    key={midi}
                    className={`${styles.xAxisCell} ${
                      isCenter
                        ? styles.xAxisCellCenter
                        : isCore
                        ? styles.xAxisCellCore
                        : ''
                    }`}
                  >
                    <span>{midiToNoteName(midi)}</span>
                    <span className={styles.xAxisSub}>
                      {stat ? `${stat.high}/${stat.avg}/${stat.low}` : midiToKoreanSolfege(midi)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

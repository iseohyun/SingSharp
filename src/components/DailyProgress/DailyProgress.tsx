import React, { useMemo } from 'react';
import { midiToKoreanSolfege, midiToNoteName } from '../../core/music/pitchUtils';
import { TRAINING_MODES } from '../../core/music/sequenceGenerator';
import { TrainingRecord, UserVocalProfile } from '../../types/vocal';
import styles from './DailyProgress.module.css';

interface DailyProgressProps {
  records: TrainingRecord[];
  profile: UserVocalProfile;
  onClearRecords: () => void;
}

/**
 * 일일 훈련 성과 기록 및 성장 통계 대시보드
 */
export const DailyProgress: React.FC<DailyProgressProps> = ({
  records,
  profile,
  onClearRecords,
}) => {
  // 날짜별 그룹화 통계
  const dailyGroups = useMemo(() => {
    const map = new Map<
      string,
      { date: string; count: number; totalScore: number; totalDuration: number }
    >();

    records.forEach((r) => {
      const existing = map.get(r.date) ?? {
        date: r.date,
        count: 0,
        totalScore: 0,
        totalDuration: 0,
      };
      existing.count += 1;
      existing.totalScore += r.overallScore;
      existing.totalDuration += r.durationSec;
      map.set(r.date, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [records]);

  const totalSessions = records.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(records.reduce((a, b) => a + b.overallScore, 0) / totalSessions)
      : 0;
  const totalMinutes = (
    records.reduce((a, b) => a + b.durationSec, 0) / 60
  ).toFixed(1);

  const getModeName = (modeId: string) =>
    TRAINING_MODES.find((m) => m.id === modeId)?.title ?? modeId;

  return (
    <div className={styles.dashboard}>
      {/* 상단 핵심 요약 지표 */}
      <div className={styles.summaryGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>총 누적 훈련 세션</div>
          <div className={styles.statValue}>{totalSessions}회</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>평균 종합 점수</div>
          <div className={styles.statValue} style={{ color: '#3fb950' }}>
            {avgScore}점
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>누적 발성 훈련 시간</div>
          <div className={styles.statValue}>{totalMinutes}분</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>현재 측정 음역대</div>
          <div className={styles.statValue} style={{ fontSize: '1.2rem' }}>
            {midiToNoteName(profile.lowestMidi)}({midiToKoreanSolfege(profile.lowestMidi)}) ~{' '}
            {midiToNoteName(profile.highestMidi)}({midiToKoreanSolfege(profile.highestMidi)})
          </div>
        </div>
      </div>

      {/* 일자별 평균 성취도 차트 */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 style={{ fontSize: '1.05rem' }}>📅 일자별 훈련 성취도 추이 (매일매일 기록)</h3>
          {records.length > 0 && (
            <button className={styles.clearBtn} onClick={onClearRecords}>
              기록 초기화
            </button>
          )}
        </div>

        {dailyGroups.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: '0.9rem' }}>
            아직 기록된 일일 훈련 성과가 없습니다. [보컬 트레이닝 스튜디오]에서 훈련을 완료하면 매일 자동으로 이곳에 기록됩니다!
          </p>
        ) : (
          <div className={styles.dayBarList}>
            {dailyGroups.map((g) => {
              const avg = Math.round(g.totalScore / g.count);
              return (
                <div key={g.date} className={styles.dayRow}>
                  <strong>{g.date}</strong>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${avg}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', color: '#c9d1d9' }}>
                    평균 <strong>{avg}점</strong> ({g.count}회)
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 상세 훈련 이력 테이블 */}
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 style={{ fontSize: '1.05rem' }}>📝 최근 훈련 상세 기록</h3>
        </div>

        {records.length === 0 ? (
          <p style={{ color: '#8b949e', fontSize: '0.9rem' }}>기록이 없습니다.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.logTable}>
              <thead>
                <tr>
                  <th>날짜/시간</th>
                  <th>구분</th>
                  <th>훈련 종류</th>
                  <th>난이도</th>
                  <th>종합 점수</th>
                  <th>음정</th>
                  <th>유지</th>
                  <th>세기</th>
                  <th>템포</th>
                  <th>바이브레이션</th>
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 30).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.date}{' '}
                      <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>
                        {new Date(r.timestamp).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td>
                      {r.isCertification ? (
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            background: 'rgba(210, 153, 34, 0.2)',
                            color: '#e3b341',
                            border: '1px solid rgba(210, 153, 34, 0.45)',
                          }}
                        >
                          🏆 점수인증 ({r.certGrade ?? 'A'}등급)
                        </span>
                      ) : (
                        <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>일반 트레이닝</span>
                      )}
                    </td>
                    <td>{getModeName(r.mode)}</td>
                    <td>Level {r.difficulty}</td>
                    <td>
                      <strong style={{ color: '#3fb950' }}>{r.overallScore}점</strong>
                    </td>
                    <td>{r.pitchAccuracy}%</td>
                    <td>{r.sustainAccuracy}%</td>
                    <td>{r.dynamicsAccuracy}%</td>
                    <td>{r.tempoAccuracy}%</td>
                    <td>{r.vibratoScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { TrainingMode } from '../../types/vocal';
import styles from './TrainingStudio.module.css';

const SCORING_CRITERIA_ROWS: Array<{
  mode: TrainingMode;
  name: string;
  formula: string;
  perfectRule: string;
  detailRule: string;
}> = [
  {
    mode: 'pitch_accuracy',
    name: '1. 음정 정확도 훈련',
    formula: '음정 (100%)',
    perfectRule: '유성음 입력 시 목표음 ±8 cents 이내 유지 시 100점 (입력이 없는 시간은 무감점)',
    detailRule: '±8c(100점), ±20c(80점), ±35c(50점), ±50c(25점), 반음 초과 시 감점',
  },
  {
    mode: 'sustain_duration',
    name: '2. 음정 유지 훈련',
    formula: '음정 (50%) + 유지 (50%)',
    perfectRule: '음표 길이와 알맞게 발성하고 해당 음이 끝까지 세기를 잃지 않을 때 100점',
    detailRule: '목표 음표 길이와의 오차만큼 감점, 음 끝부분에서 세기가 약해지면 감점',
  },
  {
    mode: 'dynamics_volume',
    name: '3. 음정 세기 조절 훈련',
    formula: '음정 (50%) + 세기 (50%)',
    perfectRule: '발성하는 동안 세기(성량)가 흔들림 없이 일정할 때 100점',
    detailRule: '평균 성량 대비 편차가 커질수록 감점 (입력이 없는 시간은 무감점)',
  },
  {
    mode: 'tempo_rhythm',
    name: '4. 정확한 템포 훈련',
    formula: '음정 (50%) + 템포 (50%)',
    perfectRule: '다음 음이 악보의 정확한 타이밍(±80ms 이내)에 발성될 때 100점',
    detailRule: '다음 음 전환 타이밍 오차(ms)에 비례하여 감점',
  },
  {
    mode: 'vibrato_control',
    name: '5. 바이브레이션 훈련',
    formula: '음정 (50%) + 바이브레이션 (50%)',
    perfectRule: '중심음 유지(50%) + 4.2~8.0Hz 규칙적 파동(50%) 달성 시 100점',
    detailRule: '진동 속도(Hz)와 진폭(±18~110 cents)의 규칙성에 따라 채점',
  },
];

interface ScoringCriteriaTableProps {
  selectedMode: TrainingMode;
}

export const ScoringCriteriaTable: React.FC<ScoringCriteriaTableProps> = ({
  selectedMode,
}) => {
  return (
    <div className={styles.criteriaCard}>
      <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>
        <span>훈련 종목별 세부 채점 기준표</span>
      </div>
      <div className={styles.criteriaTableWrap}>
        <table className={styles.criteriaTable}>
          <thead>
            <tr>
              <th>훈련 종목</th>
              <th>채점 구성 (반영 비율)</th>
              <th>100점 만점 기준</th>
              <th>세부 판정 및 감점 기준</th>
            </tr>
          </thead>
          <tbody>
            {SCORING_CRITERIA_ROWS.map((row) => {
              const isActive = row.mode === selectedMode;
              return (
                <tr
                  key={row.mode}
                  className={isActive ? styles.criteriaRowActive : undefined}
                >
                  <td>{row.name}</td>
                  <td>{row.formula}</td>
                  <td>{row.perfectRule}</td>
                  <td>{row.detailRule}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

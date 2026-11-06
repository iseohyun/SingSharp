import React from 'react';
import { toneSynth } from '../../core/audio/toneSynth';
import {
  midiToFrequency,
  midiToKoreanSolfege,
  midiToNoteName,
} from '../../core/music/pitchUtils';
import { microphoneService } from '../../services/microphoneService';
import { UserVocalProfile } from '../../types/vocal';
import { BassClefStaffEditor } from './BassClefStaffEditor';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  isSimMode: boolean;
  onToggleSimMode: (enableSim: boolean) => void;
  simCentsOffset: number;
  onChangeSimCentsOffset: (val: number) => void;
  simVolume: number;
  onChangeSimVolume: (val: number) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  profile,
  onUpdateProfile,
  isSimMode,
  onToggleSimMode,
  simCentsOffset,
  onChangeSimCentsOffset,
  simVolume,
  onChangeSimVolume,
}) => {
  return (
    <div className={styles.settingsContainer}>
      {/* 1. 낮은음자리표 출력 기준 인터랙티브 오선지 설정 카드 */}
      <BassClefStaffEditor
        profile={profile}
        onUpdateProfile={onUpdateProfile}
      />

      {/* 2. 오디오 입력 모드 및 트레이닝 환경 설정 */}
      <div className={styles.grid2Col}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>🎙️ 오디오 입력 및 시뮬레이터 설정</div>
          <div className={styles.formGroup}>
            <label className={styles.settingRow} style={{ cursor: 'pointer' }}>
              <span>실제 마이크 입력 (Web Audio API)</span>
              <input
                type="radio"
                checked={!isSimMode}
                onChange={() => onToggleSimMode(false)}
              />
            </label>
            <label className={styles.settingRow} style={{ cursor: 'pointer' }}>
              <span>🧪 가상 보컬 시뮬레이터 모드 (마이크 없이 테스트)</span>
              <input
                type="radio"
                checked={isSimMode}
                onChange={() => onToggleSimMode(true)}
              />
            </label>

            {isSimMode && (
              <>
                <div className={styles.settingRow}>
                  <span>
                    가상 음정 오차 ({simCentsOffset >= 0 ? '+' : ''}
                    {simCentsOffset} cents)
                  </span>
                  <input
                    type="range"
                    min={-75}
                    max={75}
                    value={simCentsOffset}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onChangeSimCentsOffset(val);
                      microphoneService.updateSimulationConfig({ centsOffset: val });
                    }}
                  />
                </div>
                <div className={styles.settingRow}>
                  <span>가상 성량 레벨 ({simVolume}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={simVolume}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onChangeSimVolume(val);
                      microphoneService.updateSimulationConfig({ volumeLevel: val });
                    }}
                  />
                </div>
              </>
            )}

            <div className={styles.settingRow}>
              <span>마이크 노이즈 게이트 임계값 ({profile.micNoiseFloor}%)</span>
              <input
                type="range"
                min={2}
                max={35}
                value={profile.micNoiseFloor}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  microphoneService.setNoiseGate(val);
                  onUpdateProfile({ ...profile, micNoiseFloor: val });
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>🎯 트레이닝 & 시범음 기본 설정</div>
          <div className={styles.formGroup}>
            <div className={styles.settingRow}>
              <span>
                시범음 / 가이드 볼륨 조절:{' '}
                <strong>{profile.masterVolume ?? 75}%</strong>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={profile.masterVolume ?? 75}
                onChange={(e) => {
                  const nextVol = Number(e.target.value);
                  toneSynth.setMasterVolume(nextVol);
                  onUpdateProfile({
                    ...profile,
                    masterVolume: nextVol,
                  });
                }}
                onMouseUp={() =>
                  toneSynth.playReferenceTone(
                    midiToFrequency(profile.comfortableCenterMidi || 60),
                    0.4,
                    0.25
                  )
                }
              />
            </div>

            <div className={styles.settingRow}>
              <span>
                시범음 기본 재생 길이:{' '}
                <strong>{(profile.defaultDemoDurationSec ?? 1.5).toFixed(1)}초</strong>
              </span>
              <input
                type="range"
                min={1.0}
                max={3.0}
                step={0.1}
                value={profile.defaultDemoDurationSec ?? 1.5}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    defaultDemoDurationSec: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className={styles.settingRow}>
              <span>난이도 2 목표 옥타브 폭</span>
              <select
                className={styles.selectInput}
                value={profile.customOctaveSpan}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    customOctaveSpan: Number(e.target.value) as 2 | 3,
                  })
                }
              >
                <option value={2}>2옥타브 확장 훈련</option>
                <option value={3}>3옥타브 고난도 훈련</option>
              </select>
            </div>

            <div className={styles.settingRow}>
              <span>난이도 2 시작 기준음</span>
              <select
                className={styles.selectInput}
                value={profile.customBaseMidi}
                onChange={(e) =>
                  onUpdateProfile({
                    ...profile,
                    customBaseMidi: Number(e.target.value),
                  })
                }
              >
                {[48, 53, 57, 60, 65, 69].map((m) => (
                  <option key={m} value={m}>
                    {midiToNoteName(m)} ({midiToKoreanSolfege(m)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

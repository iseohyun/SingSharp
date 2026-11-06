import React, { useEffect, useRef, useState } from 'react';
import { analyzeVibratoFromHistory } from '../../core/audio/pitchDetector';
import {
  midiToFrequency,
  midiToKoreanSolfege,
  midiToNoteName,
} from '../../core/music/pitchUtils';
import { getCoreOneOctaveRange } from '../../core/music/sequenceGenerator';
import { microphoneService } from '../../services/microphoneService';
import {
  DEFAULT_VOICEPRINT,
  updateProfileWithNoteScoreAndVoiceprint,
} from '../../services/storageService';
import { PitchFrame, UserVocalProfile } from '../../types/vocal';
import { PitchScoreChart } from './PitchScoreChart';
import styles from './VoiceprintView.module.css';

interface VoiceprintViewProps {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  isSimMode: boolean;
}

/**
 * 프로파일별 음성지문(Voiceprint) 상세 분석 및 음정별 최고·최저·평균 점수 그래프 뷰
 */
export const VoiceprintView: React.FC<VoiceprintViewProps> = ({
  profile,
  onUpdateProfile,
  isSimMode,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanRemainSec, setScanRemainSec] = useState<number>(3.0);
  const scanFramesRef = useRef<PitchFrame[]>([]);
  const scanStartMsRef = useRef<number>(0);

  const vp = profile.voiceprint ?? DEFAULT_VOICEPRINT;
  const { coreLowMidi, coreHighMidi } = getCoreOneOctaveRange(profile);

  useEffect(() => {
    if (!isScanning) return;

    const unsubscribe = microphoneService.subscribe((frame) => {
      const elapsed = (performance.now() - scanStartMsRef.current) / 1000;
      const remain = Math.max(0, 3.0 - elapsed);
      setScanRemainSec(remain);

      if (frame.isVoiced && frame.frequency !== null && frame.clarity >= 0.7) {
        scanFramesRef.current.push(frame);
      }

      if (elapsed >= 3.0) {
        setIsScanning(false);
        const collected = scanFramesRef.current;
        if (collected.length > 0) {
          const midis = collected
            .map((f) => f.midi)
            .filter((m): m is number => m !== null)
            .sort((a, b) => a - b);
          const medianMidi =
            midis.length > 0
              ? midis[Math.floor(midis.length / 2)]
              : profile.comfortableCenterMidi;
          const vib = analyzeVibratoFromHistory(
            collected,
            midiToFrequency(medianMidi)
          );
          const updated = updateProfileWithNoteScoreAndVoiceprint(
            profile,
            [],
            0,
            collected,
            vib.rateHz,
            vib.extentCents
          );
          onUpdateProfile(updated);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isScanning, profile, onUpdateProfile]);

  const handleStartVoiceprintScan = async () => {
    if (isScanning) {
      setIsScanning(false);
      return;
    }

    if (!microphoneService.getIsRunning()) {
      if (isSimMode) {
        microphoneService.startSimulator(midiToFrequency(profile.comfortableCenterMidi || 55));
      } else {
        const res = await microphoneService.startMicrophone();
        if (!res.success) {
          alert(`마이크 연결 실패: ${res.error}`);
          return;
        }
      }
    }

    scanFramesRef.current = [];
    scanStartMsRef.current = performance.now();
    setScanRemainSec(3.0);
    setIsScanning(true);
  };

  return (
    <div className={styles.container}>
      {/* 1. 프로파일 음성지문 요약 카드 */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>
              🔍 [{profile.name}] 음성지문 (Vocal Fingerprint) 프로파일
            </h3>
            <div style={{ fontSize: '0.8rem', color: '#8b949e', marginTop: '4px' }}>
              {vp.updatedAt
                ? `최근 갱신: ${new Date(vp.updatedAt).toLocaleString('ko-KR')} (누적 분석 ${
                    vp.sampleCount
                  }회)`
                : '훈련을 진행하거나 우측 [음성지문 3초 측정] 버튼을 누르면 프로파일에 고유 음성지문이 수록됩니다.'}
            </div>
          </div>

          <button
            type="button"
            className={`${styles.scanBtn} ${isScanning ? styles.scanBtnActive : ''}`}
            onClick={handleStartVoiceprintScan}
          >
            {isScanning
              ? `🎙️ 음성지문 분석 중... (${scanRemainSec.toFixed(1)}초)`
              : '🎙️ 음성지문 3초 측정'}
          </button>
        </div>

        <div className={styles.vpGrid}>
          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>음색 / 발성 유형</span>
            <span className={styles.vpMetricValue} style={{ fontSize: '1.02rem', color: '#3fb950' }}>
              {vp.vocalTimbreType}
            </span>
            <span className={styles.vpMetricSub}>
              기준음: {midiToNoteName(profile.comfortableCenterMidi)} (
              {midiToKoreanSolfege(profile.comfortableCenterMidi)})
            </span>
          </div>

          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>중심 기본주파수 (F0)</span>
            <span className={styles.vpMetricValue}>{vp.fundamentalFreqHz} Hz</span>
            <span className={styles.vpMetricSub}>
              기본음정(1옥타브): {midiToNoteName(coreLowMidi)} ~ {midiToNoteName(coreHighMidi)}
            </span>
          </div>

          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>배음 명료도 (Harmonic Clarity)</span>
            <span className={styles.vpMetricValue}>{vp.clarityAvg}%</span>
            <span className={styles.vpMetricSub}>성대 접촉 및 공명 선명도 지표</span>
          </div>

          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>음정 유지 안정도 (Pitch Jitter)</span>
            <span className={styles.vpMetricValue}>±{vp.pitchStabilityCents} cents</span>
            <span className={styles.vpMetricSub}>낮을수록 흔들림 없는 발성</span>
          </div>

          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>평균 발성 성량 (RMS Level)</span>
            <span className={styles.vpMetricValue}>{vp.dynamicRangeDb} dBFS</span>
            <span className={styles.vpMetricSub}>
              측정 음역대: {midiToNoteName(profile.lowestMidi)} ~{' '}
              {midiToNoteName(profile.highestMidi)}
            </span>
          </div>

          <div className={styles.vpMetricCard}>
            <span className={styles.vpMetricLabel}>고유 바이브레이션 파형</span>
            <span className={styles.vpMetricValue} style={{ color: '#f778ba' }}>
              {vp.vibratoRateHz > 0 ? `${vp.vibratoRateHz} Hz` : '미검출'}
            </span>
            <span className={styles.vpMetricSub}>
              진폭 깊이: ±{vp.vibratoExtentCents} cents
            </span>
          </div>
        </div>
      </div>

      {/* 2. 음정별 최고·최저·평균 점수 그래프 (세로축: 점수, 가로축: 음정) */}
      <PitchScoreChart profile={profile} />
    </div>
  );
};

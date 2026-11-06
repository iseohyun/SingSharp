import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  frequencyToExactMidi,
  midiToFrequency,
  midiToNoteName,
} from '../../core/music/pitchUtils';
import { PitchFrame, TargetNote } from '../../types/vocal';
import styles from './PitchPianoRoll.module.css';

export interface TimedPitchPoint {
  elapsedSec: number;
  frame: PitchFrame;
}

interface PitchPianoRollProps {
  notes: TargetNote[];
  totalDurationSec?: number;
  elapsedSec: number;
  pitchTrace: TimedPitchPoint[];
  centerTargetMidi?: number;
  isPinned?: boolean;
  isAbovePinned?: boolean;
  onTogglePin?: () => void;
}

/**
 * 실시간 주파수-시간 그래프 (Pitch Graph & Piano Roll)
 * - 모든 설명 문구 제거, 세로축은 영문 음정(예: G#2, A4)만 출력
 * - 우상단에 확대/축소/초기화 및 상단 고정(📌) 아이콘만 노출
 * - 가로: 과거 5초 ~ 현재, 세로: 출력음 기준 기본 ±반옥타브(6반음)
 * - 현재 지점 disc 강조 + 퍼지는 원 애니메이션
 */
export const PitchPianoRoll: React.FC<PitchPianoRollProps> = ({
  notes,
  elapsedSec,
  pitchTrace,
  centerTargetMidi,
  isPinned = false,
  isAbovePinned = false,
  onTogglePin,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 기본 보기: 위로 1온음(2반음), 아래로 1온음(2반음)
  const [halfRangeSemitones, setHalfRangeSemitones] = useState<number>(2);
  const [animTick, setAnimTick] = useState<number>(0);

  const zoomIn = useCallback(() => {
    setHalfRangeSemitones((prev) => Math.max(1, prev - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setHalfRangeSemitones((prev) => Math.min(18, prev + 1));
  }, []);

  const resetZoom = useCallback(() => {
    setHalfRangeSemitones(2);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom]);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setAnimTick(performance.now());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const activeNote =
      notes.find(
        (n) => elapsedSec >= n.startTimeSec && elapsedSec <= n.startTimeSec + n.durationSec
      ) ??
      notes[0] ??
      null;

    const centerMidi = centerTargetMidi ?? (activeNote ? activeNote.midi : 69);
    const minMidi = centerMidi - halfRangeSemitones;
    const maxMidi = centerMidi + halfRangeSemitones;
    const midiSpan = Math.max(1, maxMidi - minMidi);

    const leftAxisWidth = 48;
    const rightPadding = 22;
    const topPadding = 16;
    const bottomPadding = 24;
    const plotWidth = width - leftAxisWidth - rightPadding;
    const plotHeight = height - topPadding - bottomPadding;

    const windowSec = 5.0;
    const currentNowSec = Math.max(0, elapsedSec);
    const windowStartSec = currentNowSec - windowSec;
    const windowEndSec = currentNowSec;

    const midiToY = (midi: number): number => {
      const ratio = (midi - minMidi) / midiSpan;
      return height - bottomPadding - ratio * plotHeight;
    };

    const timeToX = (sec: number): number => {
      const ratio = (sec - windowStartSec) / windowSec;
      return leftAxisWidth + ratio * plotWidth;
    };

    // 1. 가로 반음 그리드 및 세로축 음정(예: G#2)만 표시
    const minMidiInt = Math.ceil(minMidi);
    const maxMidiInt = Math.floor(maxMidi);

    for (let m = minMidiInt; m <= maxMidiInt; m++) {
      const y = midiToY(m);
      const isCenter = m === Math.round(centerMidi);
      const isHalfOctaveBoundary =
        m === Math.round(centerMidi + 6) || m === Math.round(centerMidi - 6);

      ctx.strokeStyle = isCenter
        ? 'rgba(88, 166, 255, 0.55)'
        : isHalfOctaveBoundary
        ? 'rgba(163, 113, 247, 0.3)'
        : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = isCenter ? 1.8 : 1;
      ctx.beginPath();
      ctx.moveTo(leftAxisWidth, y);
      ctx.lineTo(width - rightPadding, y);
      ctx.stroke();

      const showLabel =
        halfRangeSemitones <= 8 || isCenter || isHalfOctaveBoundary || m % 2 === 0;
      if (showLabel) {
        ctx.fillStyle = isCenter
          ? '#58a6ff'
          : isHalfOctaveBoundary
          ? '#a371f7'
          : '#8b949e';
        ctx.font = isCenter ? 'bold 11px sans-serif' : '10.5px sans-serif';
        ctx.fillText(midiToNoteName(m), 8, y + 4);
      }
    }

    // 2. 세로 시간축 그리드 (-5s ~ 0s)
    for (let offset = -5; offset <= 0; offset++) {
      const t = currentNowSec + offset;
      const x = timeToX(t);
      ctx.strokeStyle =
        offset === 0 ? 'rgba(63, 185, 80, 0.45)' : 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = offset === 0 ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, topPadding);
      ctx.lineTo(x, height - bottomPadding);
      ctx.stroke();

      ctx.fillStyle = offset === 0 ? '#3fb950' : '#6e7681';
      ctx.font = offset === 0 ? 'bold 10px sans-serif' : '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${offset}s`, x, height - 7);
    }
    ctx.textAlign = 'left';

    // 3. 목표(출력) 음표 가이드 바 렌더링
    const halfSemitonePx = Math.abs(midiToY(minMidi + 0.5) - midiToY(minMidi));

    if (notes.length <= 1) {
      const centerY = midiToY(centerMidi);
      ctx.fillStyle = 'rgba(88, 166, 255, 0.13)';
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.fillRect(leftAxisWidth, centerY - halfSemitonePx, plotWidth, halfSemitonePx * 2);
      ctx.strokeRect(leftAxisWidth, centerY - halfSemitonePx, plotWidth, halfSemitonePx * 2);

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(88, 166, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(leftAxisWidth, centerY);
      ctx.lineTo(width - rightPadding, centerY);
      ctx.stroke();
      ctx.restore();
    } else {
      notes.forEach((note) => {
        const noteStart = note.startTimeSec;
        const noteEnd = note.startTimeSec + note.durationSec;
        if (noteEnd < windowStartSec || noteStart > windowEndSec) return;

        const x1 = Math.max(leftAxisWidth, timeToX(noteStart));
        const x2 = Math.min(width - rightPadding, timeToX(noteEnd));
        const w = Math.max(6, x2 - x1);
        const centerY = midiToY(note.midi);

        ctx.fillStyle = 'rgba(88, 166, 255, 0.16)';
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.65)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(x1, centerY - halfSemitonePx, w, halfSemitonePx * 2, 5);
        ctx.fill();
        ctx.stroke();
      });
    }

    // 4. 과거 5초 ~ 현재 사용자 피치 궤적
    const visiblePoints = pitchTrace.filter(
      (p) => p.elapsedSec >= windowStartSec - 0.2 && p.elapsedSec <= windowEndSec + 0.05
    );

    let latestVoicedPoint: { x: number; y: number; color: string; freq: number } | null = null;

    if (visiblePoints.length > 0) {
      ctx.lineWidth = 3;
      for (let i = 0; i < visiblePoints.length; i++) {
        const curr = visiblePoints[i];
        if (!curr.frame.isVoiced || curr.frame.frequency === null) continue;

        const currMidi = frequencyToExactMidi(curr.frame.frequency);
        const x2 = Math.max(leftAxisWidth, Math.min(width - rightPadding, timeToX(curr.elapsedSec)));
        const y2 = Math.max(topPadding, Math.min(height - bottomPadding, midiToY(currMidi)));

        const semitoneDiff = Math.abs(currMidi - centerMidi);
        let strokeColor = '#3fb950';
        if (semitoneDiff <= 0.5) strokeColor = '#3fb950';
        else if (semitoneDiff <= 1.0) strokeColor = '#d29922';
        else strokeColor = '#f85149';

        if (i > 0) {
          const prev = visiblePoints[i - 1];
          if (
            prev.frame.isVoiced &&
            prev.frame.frequency !== null &&
            curr.elapsedSec - prev.elapsedSec <= 0.25
          ) {
            const prevMidi = frequencyToExactMidi(prev.frame.frequency);
            const x1 = Math.max(
              leftAxisWidth,
              Math.min(width - rightPadding, timeToX(prev.elapsedSec))
            );
            const y1 = Math.max(
              topPadding,
              Math.min(height - bottomPadding, midiToY(prevMidi))
            );

            ctx.strokeStyle = strokeColor;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }

        if (currentNowSec - curr.elapsedSec <= 0.35) {
          latestVoicedPoint = {
            x: x2,
            y: y2,
            color: strokeColor,
            freq: curr.frame.frequency,
          };
        }
      }
    }

    // 5. 현재 지점 Disc 강조 및 퍼지는 원(Expanding Ripple) 애니메이션
    const discPoint = latestVoicedPoint ?? {
      x: timeToX(currentNowSec),
      y: midiToY(centerMidi),
      color: '#58a6ff',
      freq: midiToFrequency(centerMidi),
    };

    const phase1 = (animTick % 1200) / 1200;
    const phase2 = ((animTick + 600) % 1200) / 1200;

    [phase1, phase2].forEach((phase) => {
      const rippleRadius = 6 + phase * 22;
      const alpha = (1 - phase) * 0.65;
      ctx.save();
      ctx.beginPath();
      ctx.arc(discPoint.x, discPoint.y, rippleRadius, 0, Math.PI * 2);
      ctx.strokeStyle = latestVoicedPoint
        ? `rgba(63, 185, 80, ${alpha})`
        : `rgba(88, 166, 255, ${alpha * 0.6})`;
      ctx.lineWidth = 2.2;
      ctx.stroke();
      ctx.restore();
    });

    ctx.save();
    ctx.beginPath();
    ctx.arc(discPoint.x, discPoint.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = latestVoicedPoint ? '#3fb950' : '#58a6ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.restore();
  }, [notes, elapsedSec, pitchTrace, centerTargetMidi, halfRangeSemitones, animTick]);

  return (
    <div
      className={`${styles.rollContainer} ${isPinned ? styles.rollPinned : ''}`}
      style={isPinned ? { top: isAbovePinned ? '154px' : '8px' } : undefined}
    >
      {/* 우상단 아이콘 전용 컨트롤러 (+, -, ↺, 📌) */}
      <div className={styles.overlayControls}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={zoomIn}
          title="확대 (+)"
          aria-label="주파수 확대"
        >
          ＋
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={zoomOut}
          title="축소 (-)"
          aria-label="주파수 축소"
        >
          －
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={resetZoom}
          title="기본 ±1온음 초기화 (0)"
          aria-label="기본 배율 초기화"
        >
          ↺
        </button>
        {onTogglePin && (
          <button
            type="button"
            className={`${styles.iconBtn} ${isPinned ? styles.iconBtnActive : ''}`}
            onClick={onTogglePin}
            title={isPinned ? '상단 고정 해제' : '상단 고정'}
            aria-label="주파수 그래프 상단 고정 토글"
          >
            고정
          </button>
        )}
      </div>

      <div className={styles.canvasBox}>
        <canvas ref={canvasRef} width={780} height={245} className={styles.canvas} />
      </div>
    </div>
  );
};

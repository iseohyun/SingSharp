import React, { useEffect, useRef, useState } from 'react';
import { toneSynth } from '../../core/audio/toneSynth';
import {
  midiToFrequency,
  midiToKoreanSolfege,
  midiToNoteName,
  midiToStaffStep,
} from '../../core/music/pitchUtils';
import { UserVocalProfile } from '../../types/vocal';
import styles from './SettingsView.module.css';

// D3 ~ G5 범위의 온음계(자연음) MIDI 목록 (오선지 스텝과 1:1 매칭되어 드래그/방향키 조작이 직관적)
const NATURAL_MIDIS = [
  50, 52, 53, 55, 57, 59, // D3, E3, F3, G3, A3, B3
  60, 62, 64, 65, 67, 69, 71, // C4, D4, E4, F4, G4, A4, B4
  72, 74, 76, // C5, D5, E5
];

interface BassClefStaffEditorProps {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
}

export const BassClefStaffEditor: React.FC<BassClefStaffEditorProps> = ({
  profile,
  onUpdateProfile,
}) => {
  const thresholdMidi = profile.bassClefThresholdMidi ?? 59; // 기본 B3 (59)
  const [isNoteSelected, setIsNoteSelected] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const trebleStepToY = (stepFromC4: number): number => 132 - (stepFromC4 - 2) * 6;
  const bassStepToY = (stepFromC4: number): number => 132 - (stepFromC4 - -10) * 6;

  const trebleLineSteps = [2, 4, 6, 8, 10]; // E4, G4, B4, D5, F5
  const bassLineSteps = [-10, -8, -6, -4, -2]; // G2, B2, D3, F3, A3

  const getLedgerSteps = (stepFromC4: number, lineSteps: number[]): number[] => {
    const ledgers: number[] = [];
    const minLine = lineSteps[0];
    const maxLine = lineSteps[4];
    if (stepFromC4 <= minLine - 2) {
      for (let s = minLine - 2; s >= stepFromC4; s -= 2) {
        ledgers.push(s);
      }
    } else if (stepFromC4 >= maxLine + 2) {
      for (let s = maxLine + 2; s <= stepFromC4; s += 2) {
        ledgers.push(s);
      }
    }
    return ledgers;
  };

  const updateThresholdMidi = (nextMidi: number, playPreview = true) => {
    const clamped = Math.max(48, Math.min(74, nextMidi));
    if (clamped === thresholdMidi) return;
    onUpdateProfile({
      ...profile,
      bassClefThresholdMidi: clamped,
    });
    if (playPreview) {
      toneSynth.playReferenceTone(midiToFrequency(clamped), 0.55, 0.2);
    }
  };

  useEffect(() => {
    if (!isNoteSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (e.shiftKey) {
          updateThresholdMidi(thresholdMidi + 1, true);
        } else {
          const nextNatural =
            NATURAL_MIDIS.find((m) => m > thresholdMidi) ?? thresholdMidi + 1;
          updateThresholdMidi(nextNatural, true);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (e.shiftKey) {
          updateThresholdMidi(thresholdMidi - 1, true);
        } else {
          const prevNatural =
            [...NATURAL_MIDIS].reverse().find((m) => m < thresholdMidi) ??
            thresholdMidi - 1;
          updateThresholdMidi(prevNatural, true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNoteSelected, thresholdMidi, profile]);

  const handlePointerMoveOnSvg = (clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleY = 215 / rect.height;
    const svgY = (clientY - rect.top) * scaleY;

    const targetStep = Math.round(2 + (132 - svgY) / 6);

    let bestMidi = NATURAL_MIDIS[0];
    let minDiff = 999;
    for (const m of NATURAL_MIDIS) {
      const st = midiToStaffStep(m).stepFromC4;
      const diff = Math.abs(st - targetStep);
      if (diff < minDiff) {
        minDiff = diff;
        bestMidi = m;
      }
    }
    updateThresholdMidi(bestMidi, true);
  };

  const currentStaff = midiToStaffStep(thresholdMidi);
  const trebleNoteX = 240;
  const trebleNoteY = Math.max(25, Math.min(190, trebleStepToY(currentStaff.stepFromC4)));
  const trebleLedgers = getLedgerSteps(currentStaff.stepFromC4, trebleLineSteps);

  const bassClefX = 435;
  const bassNoteX = 565;
  const bassNoteY = Math.max(25, Math.min(190, bassStepToY(currentStaff.stepFromC4)));
  const bassLedgers = getLedgerSteps(currentStaff.stepFromC4, bassLineSteps);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>
            🎼 낮은음자리표(𝄢) 출력 기준 설정 (오선지 음표 클릭 · 위/아래 방향키 · 마우스 드래그)
          </div>
          <div className={styles.cardSub}>
            왼쪽 높은음자리표(𝄞)의 음표를 클릭하거나 위/아래로 드래그(또는 키보드 ↑/↓ 방향키)하여 기준음을 변경하세요. 오른쪽에 낮은음자리표(𝄢)와 동일한 기준음이 실시간으로 그려집니다.
          </div>
        </div>
        <div className={styles.thresholdBadge}>
          현재 전환 기준: {midiToNoteName(thresholdMidi)} ({midiToKoreanSolfege(thresholdMidi)},{' '}
          {midiToFrequency(thresholdMidi).toFixed(1)}Hz) 이하일 때 낮은음자리표 출력
        </div>
      </div>

      <div
        className={`${styles.staffEditorBox} ${
          isNoteSelected ? styles.staffEditorFocused : ''
        }`}
        onClick={() => setIsNoteSelected(true)}
      >
        <div className={styles.editorHintRow}>
          <span>
            {isNoteSelected ? (
              <strong style={{ color: '#58a6ff' }}>
                ● 높은음자리표 기준 음표 선택됨 — 키보드 [↑ / ↓ 방향키] 또는 마우스 위/아래 드래그로 조절하세요!
              </strong>
            ) : (
              '오선지의 음표를 클릭하면 방향키로 조절할 수 있습니다.'
            )}
          </span>

          <div className={styles.stepBtnGroup}>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => updateThresholdMidi(thresholdMidi + 1, true)}
            >
              ▲ 한 반음 올리기 (↑)
            </button>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => updateThresholdMidi(thresholdMidi - 1, true)}
            >
              ▼ 한 반음 내리기 (↓)
            </button>
            <button
              type="button"
              className={styles.stepBtn}
              onClick={() => updateThresholdMidi(59, true)}
            >
              초기값 복원 (B3 · 가온 도 미만)
            </button>
          </div>
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 760 215"
          className={styles.svgInteractive}
          onPointerDown={(e) => {
            setIsNoteSelected(true);
            setIsDragging(true);
            handlePointerMoveOnSvg(e.clientY);
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            handlePointerMoveOnSvg(e.clientY);
          }}
          onPointerUp={() => setIsDragging(false)}
          onPointerLeave={() => setIsDragging(false)}
        >
          <text x={55} y={28} fill="#58a6ff" fontSize="12.5" fontWeight="700">
            [왼쪽] 높은음자리표(𝄞) 기준 음표 (클릭 후 ↑/↓ 또는 드래그)
          </text>
          <text x={425} y={28} fill="#a371f7" fontSize="12.5" fontWeight="700">
            [오른쪽] 낮은음자리표(𝄢)에서의 동일 기준음 표시
          </text>

          {[0, 1, 2, 3, 4].map((lineIdx) => {
            const y = 132 - lineIdx * 12;
            return (
              <line
                key={lineIdx}
                x1={35}
                y1={y}
                x2={725}
                y2={y}
                stroke="#485262"
                strokeWidth={1.4}
              />
            );
          })}

          <line
            x1={385}
            y1={72}
            x2={385}
            y2={144}
            stroke="#6e7681"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />

          <text x={48} y={122} fontSize="52" fill="#58a6ff" fontFamily="serif">
            𝄞
          </text>

          {trebleLedgers.map((ls) => {
            const ly = trebleStepToY(ls);
            return (
              <line
                key={`t-ledger-${ls}`}
                x1={trebleNoteX - 18}
                y1={ly}
                x2={trebleNoteX + 18}
                y2={ly}
                stroke="#58a6ff"
                strokeWidth={1.8}
              />
            );
          })}

          {isNoteSelected && (
            <circle
              cx={trebleNoteX}
              cy={trebleNoteY}
              r={19}
              fill="rgba(88, 166, 255, 0.16)"
              stroke="rgba(88, 166, 255, 0.55)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
          )}

          {currentStaff.isSharp && (
            <text
              x={trebleNoteX - 24}
              y={trebleNoteY + 5}
              fill="#58a6ff"
              fontSize="16"
              fontWeight="bold"
            >
              ♯
            </text>
          )}

          <ellipse
            cx={trebleNoteX}
            cy={trebleNoteY}
            rx={10}
            ry={7}
            transform={`rotate(-18 ${trebleNoteX} ${trebleNoteY})`}
            fill="#58a6ff"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <line
            x1={currentStaff.stepFromC4 >= 6 ? trebleNoteX - 9 : trebleNoteX + 9}
            y1={trebleNoteY}
            x2={currentStaff.stepFromC4 >= 6 ? trebleNoteX - 9 : trebleNoteX + 9}
            y2={currentStaff.stepFromC4 >= 6 ? trebleNoteY + 34 : trebleNoteY - 34}
            stroke="#58a6ff"
            strokeWidth={2.4}
          />

          <text
            x={trebleNoteX}
            y={trebleNoteY - 24}
            textAnchor="middle"
            fill="#58a6ff"
            fontSize="11"
            fontWeight="700"
          >
            ▲
          </text>
          <text
            x={trebleNoteX}
            y={trebleNoteY + 32}
            textAnchor="middle"
            fill="#58a6ff"
            fontSize="11"
            fontWeight="700"
          >
            ▼
          </text>

          <text
            x={trebleNoteX}
            y={198}
            textAnchor="middle"
            fill="#58a6ff"
            fontSize="13"
            fontWeight="800"
          >
            높은음자리표 표기: {midiToNoteName(thresholdMidi)} (
            {midiToKoreanSolfege(thresholdMidi)})
          </text>

          <path
            d={`M ${trebleNoteX + 35} ${trebleNoteY} C 350 ${trebleNoteY}, 490 ${bassNoteY}, ${
              bassNoteX - 30
            } ${bassNoteY}`}
            fill="none"
            stroke="rgba(163, 113, 247, 0.45)"
            strokeWidth={1.8}
            strokeDasharray="5 4"
          />

          <text x={bassClefX} y={116} fontSize="46" fill="#a371f7" fontFamily="serif">
            𝄢
          </text>

          {bassLedgers.map((ls) => {
            const ly = bassStepToY(ls);
            return (
              <line
                key={`b-ledger-${ls}`}
                x1={bassNoteX - 18}
                y1={ly}
                x2={bassNoteX + 18}
                y2={ly}
                stroke="#a371f7"
                strokeWidth={1.8}
              />
            );
          })}

          {currentStaff.isSharp && (
            <text
              x={bassNoteX - 24}
              y={bassNoteY + 5}
              fill="#a371f7"
              fontSize="16"
              fontWeight="bold"
            >
              ♯
            </text>
          )}

          <ellipse
            cx={bassNoteX}
            cy={bassNoteY}
            rx={10}
            ry={7}
            transform={`rotate(-18 ${bassNoteX} ${bassNoteY})`}
            fill="#a371f7"
            stroke="#ffffff"
            strokeWidth={2}
          />
          <line
            x1={currentStaff.stepFromC4 >= -6 ? bassNoteX - 9 : bassNoteX + 9}
            y1={bassNoteY}
            x2={currentStaff.stepFromC4 >= -6 ? bassNoteX - 9 : bassNoteX + 9}
            y2={currentStaff.stepFromC4 >= -6 ? bassNoteY + 34 : bassNoteY - 34}
            stroke="#a371f7"
            strokeWidth={2.4}
          />

          <text
            x={bassNoteX}
            y={198}
            textAnchor="middle"
            fill="#d2a8ff"
            fontSize="13"
            fontWeight="800"
          >
            낮은음자리표 표기: {midiToNoteName(thresholdMidi)} (
            {midiToKoreanSolfege(thresholdMidi)})
          </text>
        </svg>
      </div>
    </div>
  );
};

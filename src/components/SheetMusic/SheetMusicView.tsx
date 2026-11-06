import React from 'react';
import {
  midiToNoteName,
  midiToStaffStep,
} from '../../core/music/pitchUtils';
import { TargetNote } from '../../types/vocal';
import styles from './SheetMusicView.module.css';

interface SheetMusicViewProps {
  notes: TargetNote[];
  activeNoteId: string | null;
  currentUserMidi: number | null;
  onPlayNoteClick?: (note: TargetNote) => void;
  bassClefThresholdMidi?: number;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

/**
 * 오선지 악보(Standard 5-Line Staff) 렌더러
 * - 불필요한 설명 텍스트 및 '1선~5선' 문구 없이 순수 5선지와 음표만 렌더링
 * - 우상단에 상단 고정(📌) 아이콘만 노출
 * - 목표 음역이 설정된 기준음(bassClefThresholdMidi) 이하로 내려가면 낮은음자리표(𝄢)로 자동 전환
 * - 현재 녹음되는 목소리의 가장 가까운 음표를 목표 음표 옆에 녹색(#3fb950) 음표로 표시
 */
export const SheetMusicView: React.FC<SheetMusicViewProps> = ({
  notes,
  activeNoteId,
  currentUserMidi,
  onPlayNoteClick,
  bassClefThresholdMidi = 59,
  isPinned = false,
  onTogglePin,
}) => {
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? notes[0] ?? null;
  const referenceMidi = activeNote ? activeNote.midi : 60;
  const useBassClef = referenceMidi <= bassClefThresholdMidi;

  const baseLineStep = useBassClef ? -10 : 2;
  const staffLineSteps = useBassClef ? [-10, -8, -6, -4, -2] : [2, 4, 6, 8, 10];
  const middleLineStep = useBassClef ? -6 : 6;

  const stepToY = (stepFromC4: number): number => {
    return 90 - (stepFromC4 - baseLineStep) * 6;
  };

  const getLedgerSteps = (stepFromC4: number): number[] => {
    const ledgers: number[] = [];
    const minLine = staffLineSteps[0];
    const maxLine = staffLineSteps[4];
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

  const totalBeats = notes.reduce((acc, n) => Math.max(acc, n.startBeat + n.durationBeats), 4);
  const startX = 95;
  const usableWidth = 600;

  return (
    <div className={`${styles.sheetContainer} ${isPinned ? styles.sheetPinned : ''}`}>
      {onTogglePin && (
        <div className={styles.overlayControls}>
          <button
            type="button"
            className={`${styles.iconBtn} ${isPinned ? styles.iconBtnActive : ''}`}
            onClick={onTogglePin}
            title={isPinned ? '상단 고정 해제' : '상단 고정'}
            aria-label="오선지 상단 고정 토글"
          >
            고정
          </button>
        </div>
      )}

      <svg viewBox="0 0 760 125" className={styles.svgWrap}>
        {/* 순수 5선지 줄 */}
        {staffLineSteps.map((step) => {
          const y = stepToY(step);
          return (
            <line
              key={step}
              x1={20}
              y1={y}
              x2={740}
              y2={y}
              stroke="#485262"
              strokeWidth={1.3}
            />
          );
        })}

        {/* 음자리표 기호 (높은음자리표 𝄞 / 낮은음자리표 𝄢) */}
        {useBassClef ? (
          <text x={30} y={76} fontSize="44" fill="#a371f7" fontFamily="serif">
            𝄢
          </text>
        ) : (
          <text x={30} y={80} fontSize="50" fill="#58a6ff" fontFamily="serif">
            𝄞
          </text>
        )}

        {/* 각 목표 음표 렌더링 */}
        {notes.map((note) => {
          const { stepFromC4, isSharp } = midiToStaffStep(note.midi);
          const cy = Math.max(16, Math.min(110, stepToY(stepFromC4)));
          const cx =
            notes.length === 1
              ? 320
              : startX +
                ((note.startBeat + note.durationBeats * 0.35) / Math.max(totalBeats, 1)) * usableWidth;
          const isActive = note.id === activeNoteId;
          const noteColor = isActive ? '#58a6ff' : '#6e7681';
          const isHollow = note.durationBeats >= 2;
          const ledgerSteps = getLedgerSteps(stepFromC4);

          return (
            <g
              key={note.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onPlayNoteClick?.(note)}
            >
              {/* 목표 음표 덧줄(Ledger Lines) */}
              {ledgerSteps.map((ls) => (
                <line
                  key={`ledger-${ls}`}
                  x1={cx - 15}
                  y1={Math.max(16, Math.min(110, stepToY(ls)))}
                  x2={cx + 15}
                  y2={Math.max(16, Math.min(110, stepToY(ls)))}
                  stroke="#8b949e"
                  strokeWidth={1.5}
                />
              ))}

              {/* 샵(#) 기호 */}
              {isSharp && (
                <text
                  x={cx - 21}
                  y={cy + 5}
                  fill={noteColor}
                  fontSize="15"
                  fontWeight="bold"
                >
                  ♯
                </text>
              )}

              {/* 음표 머리 */}
              <ellipse
                cx={cx}
                cy={cy}
                rx={9}
                ry={6.5}
                transform={`rotate(-18 ${cx} ${cy})`}
                fill={isHollow ? '#161b22' : noteColor}
                stroke={noteColor}
                strokeWidth={2.5}
              />

              {/* 음표 기둥 */}
              <line
                x1={stepFromC4 >= middleLineStep ? cx - 8 : cx + 8}
                y1={cy}
                x2={stepFromC4 >= middleLineStep ? cx - 8 : cx + 8}
                y2={stepFromC4 >= middleLineStep ? cy + 30 : cy - 30}
                stroke={noteColor}
                strokeWidth={2}
              />

              {/* 8분음표 꼬리 */}
              {note.durationBeats <= 0.5 && (
                <path
                  d={
                    stepFromC4 >= middleLineStep
                      ? `M ${cx - 8} ${cy + 30} Q ${cx + 4} ${cy + 24} ${cx + 6} ${cy + 16}`
                      : `M ${cx + 8} ${cy - 30} Q ${cx + 20} ${cy - 22} ${cx + 18} ${cy - 12}`
                  }
                  stroke={noteColor}
                  strokeWidth={2}
                  fill="none"
                />
              )}

              {/* 하단 가사(Lyrics) */}
              {note.lyric && (
                <text
                  x={cx}
                  y={118}
                  textAnchor="middle"
                  fill={isActive ? '#ffffff' : '#8b949e'}
                  fontSize="12"
                  fontWeight={isActive ? '700' : '500'}
                >
                  {note.lyric}
                </text>
              )}

              {/* 현재 활성 노트 옆에 녹음되는 목소리의 가장 가까운 음표를 녹색(#3fb950)으로 그리기 */}
              {isActive && currentUserMidi !== null && (
                <g>
                  {(() => {
                    const userStaff = midiToStaffStep(currentUserMidi);
                    const userStep = userStaff.stepFromC4;
                    const userY = Math.max(16, Math.min(110, stepToY(userStep)));
                    const userX = cx + 48;
                    const userLedgers = getLedgerSteps(userStep);
                    const voiceColor = '#3fb950';

                    return (
                      <>
                        {userLedgers.map((uls) => (
                          <line
                            key={`u-ledger-${uls}`}
                            x1={userX - 14}
                            y1={Math.max(16, Math.min(110, stepToY(uls)))}
                            x2={userX + 14}
                            y2={Math.max(16, Math.min(110, stepToY(uls)))}
                            stroke={voiceColor}
                            strokeWidth={1.5}
                            strokeDasharray="3 2"
                          />
                        ))}

                        {userStaff.isSharp && (
                          <text
                            x={userX - 20}
                            y={userY + 5}
                            fill={voiceColor}
                            fontSize="15"
                            fontWeight="bold"
                          >
                            ♯
                          </text>
                        )}

                        <ellipse
                          cx={userX}
                          cy={userY}
                          rx={9}
                          ry={6.5}
                          transform={`rotate(-18 ${userX} ${userY})`}
                          fill={voiceColor}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />

                        <line
                          x1={userStep >= middleLineStep ? userX - 8 : userX + 8}
                          y1={userY}
                          x2={userStep >= middleLineStep ? userX - 8 : userX + 8}
                          y2={userStep >= middleLineStep ? userY + 28 : userY - 28}
                          stroke={voiceColor}
                          strokeWidth={2.2}
                        />

                        <text
                          x={userX + 14}
                          y={userY + 4}
                          fill={voiceColor}
                          fontSize="11"
                          fontWeight="800"
                        >
                          {midiToNoteName(currentUserMidi)}
                        </text>
                      </>
                    );
                  })()}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

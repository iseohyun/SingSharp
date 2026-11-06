/**
 * Music Theory & Frequency Conversion Engine
 * - 기준음 A4 = 440Hz (MIDI 69)
 * - 반음(Semitone) = 100 Cents
 */

export const A4_FREQUENCY = 440.0;
export const A4_MIDI = 69;

const NOTE_NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_KO = ['도', '도#', '레', '레#', '미', '파', '파#', '솔', '솔#', '라', '라#', '시'];

/** MIDI 번호를 주파수(Hz)로 변환 */
export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** 주파수(Hz)를 실수형 MIDI 번호로 변환 */
export function frequencyToExactMidi(frequency: number): number {
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
}

/** 주파수(Hz)를 가장 가까운 정수 MIDI 번호로 변환 */
export function frequencyToNearestMidi(frequency: number): number {
  return Math.round(frequencyToExactMidi(frequency));
}

/** 두 주파수 간의 Cents 오차 계산 (양수: user가 높음, 음수: user가 낮음) */
export function getCentsDifference(userFreq: number, targetFreq: number): number {
  return 1200 * Math.log2(userFreq / targetFreq);
}

/** MIDI 번호를 영문 음이름(예: A4, C4)으로 변환 */
export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES_EN[noteIndex]}${octave}`;
}

/** MIDI 번호를 한국어 계이름(예: 라4, 도4)으로 변환 */
export function midiToKoreanSolfege(midi: number): string {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES_KO[noteIndex]}${octave}`;
}

/**
 * 옥타브 보정 포함 Cents 오차 계산
 * - 초반 성별/옥타브 차이로 인해 정확히 1옥타브 아래/위로 부를 경우 또는 절대 목표 주파수 비교 지원
 */
export function evaluatePitchAgainstTarget(
  userFreq: number,
  targetFreq: number,
  allowOctaveFold = false
): { centsOff: number; isWithinSemitone: boolean } {
  let centsOff = getCentsDifference(userFreq, targetFreq);

  if (allowOctaveFold) {
    // 1옥타브(1200 cents) 차이를 보정해 반음 오차만 평가할 때 사용
    while (centsOff > 600) centsOff -= 1200;
    while (centsOff < -600) centsOff += 1200;
  }

  return {
    centsOff,
    isWithinSemitone: Math.abs(centsOff) <= 50, // 반음(±50 cents) 이내인지 판정
  };
}

/** 오선지(Treble/Bass Clef) 렌더링을 위한 다이어토닉 스텝 위치 반환 (C4 = 0 기준) */
export function midiToStaffStep(midi: number): { stepFromC4: number; isSharp: boolean } {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  const semitoneInOctave = ((rounded % 12) + 12) % 12;

  // C=0, C#=0, D=1, D#=1, E=2, F=3, F#=3, G=4, G#=4, A=5, A#=5, B=6
  const diatonicMap = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const sharpMap = [false, true, false, true, false, false, true, false, true, false, true, false];

  const stepInOctave = diatonicMap[semitoneInOctave];
  const stepFromC4 = (octave - 4) * 7 + stepInOctave;

  return {
    stepFromC4,
    isSharp: sharpMap[semitoneInOctave],
  };
}

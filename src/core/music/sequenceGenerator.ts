import {
  DifficultyLevel,
  DifficultyLevelInfo,
  TargetNote,
  TrainingMode,
  TrainingModeInfo,
  TrainingSequence,
  UserVocalProfile,
} from '../../types/vocal';
import {
  midiToFrequency,
  midiToKoreanSolfege,
  midiToNoteName,
} from './pitchUtils';

export const TRAINING_MODES: TrainingModeInfo[] = [
  {
    id: 'pitch_accuracy',
    number: 1,
    title: '1. 음정 정확도 훈련',
    subtitle: '음정을 정확히 낼 수 있다',
    description: '목표 음정과의 오차(Cents)를 줄여 흔들림 없이 정확한 피치로 소리 내는 훈련입니다.',
    badgeColor: '#3fb950',
  },
  {
    id: 'sustain_duration',
    number: 2,
    title: '2. 음정 유지 훈련',
    subtitle: '음정을 세기를 잃지 않고 끝까지 유지할 수 있다',
    description: '호흡 지지를 통해 음표 길이에 맞춰 끝까지 세기와 피치를 잃지 않고 유지합니다.',
    badgeColor: '#58a6ff',
  },
  {
    id: 'dynamics_volume',
    number: 3,
    title: '3. 음정 세기 조절 훈련',
    subtitle: '음정을 정확한 세기로 낼 수 있다',
    description: '성량(데시벨/강약)을 목표 범위 내에 맞추면서 음정이 흔들리지 않도록 조절합니다.',
    badgeColor: '#d29922',
  },
  {
    id: 'tempo_rhythm',
    number: 4,
    title: '4. 정확한 템포 훈련',
    subtitle: '음정을 정확한 템포로 낼 수 있다',
    description: '메트로놈 비트에 맞추어 정확한 타이밍(Onset/Offset)에 음정을 시작하고 맺습니다.',
    badgeColor: '#a371f7',
  },
  {
    id: 'vibrato_control',
    number: 5,
    title: '5. 바이브레이션 훈련',
    subtitle: '바이브레이션을 할 수 있다',
    description: '일정한 주기(5~7Hz)와 깊이로 자연스럽고 규칙적인 바이브레이션 파형을 만듭니다.',
    badgeColor: '#f778ba',
  },
];

export const DIFFICULTY_LEVELS: DifficultyLevelInfo[] = [
  {
    level: 1,
    title: '난이도 1 — 1음정',
    description: '현재 프로파일에서 부르기 편한 기준음 중심 1옥타브 이내(기본음정)에서 무작위로 선택합니다.',
  },
  {
    level: 2,
    title: '난이도 2 — 1음정++',
    description: '기본음정(1옥타브 이내) 외의 확장 저음·고음 영역에서 무작위로 선택하여 테스트합니다.',
  },
  {
    level: 3,
    title: '난이도 3 — 3음정',
    description: '도-레-미 또는 도-미-솔 등 3개의 연속된 음정을 자연스럽게 연결하여 부릅니다.',
  },
  {
    level: 4,
    title: '난이도 4 — 5음정+박자',
    description: '서로 다른 길이(8분음표, 4분음표, 2분음표 등)를 가진 5개 음정을 리듬에 맞춰 부릅니다.',
  },
  {
    level: 5,
    title: '난이도 5 — +가사',
    description: '실제 한국어 가사 프레이즈를 발음하면서도 모음 구간의 음정과 발성을 흔들림 없이 유지합니다.',
  },
];

const LYRIC_PHRASES_5 = [
  ['나', '비', '야', '날', '아'],
  ['하', '늘', '위로', '높', '이'],
  ['빛', '나', '는', '별', '들'],
  ['노', '래', '해', '우', '리'],
];

function seededRandomInt(seed: number, min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  if (low >= high) return low;
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  const frac = x - Math.floor(x);
  return low + Math.floor(frac * (high - low + 1));
}

/**
 * 현재 프로파일의 부르기 편한 기준음(comfortableCenterMidi)에서 1옥타브 이내(±6반음)의 기본음정 범위를 반환합니다.
 */
export function getCoreOneOctaveRange(profile: UserVocalProfile): {
  coreLowMidi: number;
  coreHighMidi: number;
} {
  const center = profile.comfortableCenterMidi || 55;
  return {
    coreLowMidi: Math.max(36, center - 6),
    coreHighMidi: Math.min(84, center + 6),
  };
}

function createNote(
  index: number,
  midi: number,
  startBeat: number,
  durationBeats: number,
  bpm: number,
  mode: TrainingMode,
  lyric?: string
): TargetNote {
  const beatDurationSec = 60 / bpm;
  const startTimeSec = startBeat * beatDurationSec;
  const durationSec = durationBeats * beatDurationSec;

  let targetDbMin = 35;
  let targetDbMax = 80;
  if (mode === 'dynamics_volume') {
    if (index % 2 === 0) {
      targetDbMin = 58;
      targetDbMax = 84;
    } else {
      targetDbMin = 32;
      targetDbMax = 54;
    }
  }

  return {
    id: `note-${index}-${midi}-${Math.round(startTimeSec * 10)}`,
    midi,
    frequency: midiToFrequency(midi),
    noteName: midiToNoteName(midi),
    koreanSolfege: midiToKoreanSolfege(midi),
    startBeat,
    durationBeats,
    startTimeSec,
    durationSec,
    lyric,
    targetDbMin,
    targetDbMax,
    requireVibrato: mode === 'vibrato_control',
  };
}

/**
 * 훈련 종류(Mode) + 난이도(Difficulty) + 사용자 프로파일(Profile)을 조합하여
 * 10초 분량의 맞춤형 악보 시퀀스를 생성합니다.
 */
export function generateTrainingSequence(
  mode: TrainingMode,
  difficulty: DifficultyLevel,
  profile: UserVocalProfile,
  variationSeed = 0
): TrainingSequence {
  const bpm = 60; // 1박 = 1초, 총 10초
  const { coreLowMidi, coreHighMidi } = getCoreOneOctaveRange(profile);

  // 기본음정(1옥타브 이내)에서 무작위 선택
  const baseCoreMidi = seededRandomInt(variationSeed + 1, coreLowMidi, coreHighMidi);

  const notes: TargetNote[] = [];

  if (difficulty === 1) {
    // a. 난이도 1 ("1음정"): 부르기 편한 기본 음정에서 1옥타브 이내(기본음정)에서 무작위 선택
    notes.push(
      createNote(0, baseCoreMidi, 0, 10, bpm, mode, `아 (기본음정 ${midiToNoteName(baseCoreMidi)})`)
    );
  } else if (difficulty === 2) {
    // b. 난이도 2 ("1음정++"): 기본음정(1옥타브 이내) 외의 음역에서 무작위 선택
    const outerLowMin = Math.max(36, Math.min(profile.lowestMidi || coreLowMidi - 6, coreLowMidi - 6));
    const outerHighMax = Math.min(84, Math.max(profile.highestMidi || coreHighMidi + 6, coreHighMidi + 6));

    const outerCandidates: number[] = [];
    for (let m = outerLowMin; m < coreLowMidi; m++) {
      outerCandidates.push(m);
    }
    for (let m = coreHighMidi + 1; m <= outerHighMax; m++) {
      outerCandidates.push(m);
    }

    const pickedOuterMidi =
      outerCandidates.length > 0
        ? outerCandidates[
            seededRandomInt(variationSeed + 7, 0, outerCandidates.length - 1)
          ]
        : Math.min(84, coreHighMidi + 2);

    notes.push(
      createNote(
        0,
        pickedOuterMidi,
        0,
        10,
        bpm,
        mode,
        `아 (기본음정 외 ${midiToNoteName(pickedOuterMidi)})`
      )
    );
  } else if (difficulty === 3) {
    // c. "3음정" (총 10초: 3초 + 3초 + 4초)
    const patterns = [
      [0, 2, 4],
      [0, 4, 7],
      [4, 2, 0],
      [0, 2, 0],
      [0, 5, 7],
    ];
    const chosenPattern = patterns[Math.abs(variationSeed) % patterns.length];
    const durations = [3, 3, 4];
    const vowels = ['아', '에', '이'];
    let currentBeat = 0;

    chosenPattern.forEach((interval, idx) => {
      const midi = Math.min(84, Math.max(36, baseCoreMidi + interval));
      const dur = durations[idx];
      notes.push(createNote(idx, midi, currentBeat, dur, bpm, mode, vowels[idx]));
      currentBeat += dur;
    });
  } else if (difficulty === 4) {
    // d. "5음정+박자" (총 10초: 1.5 + 1.0 + 1.5 + 2.5 + 3.5 = 10초)
    const patterns = [
      [0, 2, 4, 5, 7],
      [7, 5, 4, 2, 0],
      [0, 4, 2, 5, 4],
      [0, 2, 4, 2, 0],
    ];
    const intervals = patterns[Math.abs(variationSeed) % patterns.length];
    const durations = [1.5, 1.0, 1.5, 2.5, 3.5];
    const syllables = ['라', '라', '라', '라', '아~'];
    let currentBeat = 0;

    intervals.forEach((interval, idx) => {
      const midi = Math.min(84, Math.max(36, baseCoreMidi + interval));
      const dur = durations[idx];
      notes.push(createNote(idx, midi, currentBeat, dur, bpm, mode, syllables[idx]));
      currentBeat += dur;
    });
  } else if (difficulty === 5) {
    // e. "+가사" (총 10초: 1.5 + 1.5 + 2.0 + 1.5 + 3.5 = 10초)
    const melodies = [
      [7, 4, 4, 5, 2],
      [0, 2, 4, 7, 9],
      [0, 0, 7, 7, 9],
      [4, 2, 0, 2, 4],
    ];
    const durations = [1.5, 1.5, 2.0, 1.5, 3.5];
    const chosenMelody = melodies[Math.abs(variationSeed) % melodies.length];
    const chosenLyrics = LYRIC_PHRASES_5[Math.abs(variationSeed) % LYRIC_PHRASES_5.length];
    let currentBeat = 0;

    chosenMelody.forEach((interval, idx) => {
      const midi = Math.min(84, Math.max(36, baseCoreMidi + interval));
      const dur = durations[idx];
      notes.push(createNote(idx, midi, currentBeat, dur, bpm, mode, chosenLyrics[idx]));
      currentBeat += dur;
    });
  }

  const totalDurationSec = 10;

  const modeInfo = TRAINING_MODES.find((m) => m.id === mode)!;
  const diffInfo = DIFFICULTY_LEVELS.find((d) => d.level === difficulty)!;

  return {
    id: `seq-${mode}-lv${difficulty}-${variationSeed}`,
    title: `${modeInfo.title} · ${diffInfo.title}`,
    mode,
    difficulty,
    bpm,
    totalDurationSec,
    notes,
  };
}

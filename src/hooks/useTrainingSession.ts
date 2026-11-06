import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeVibratoFromHistory } from '../core/audio/pitchDetector';
import { toneSynth } from '../core/audio/toneSynth';
import { generateTrainingSequence } from '../core/music/sequenceGenerator';
import {
  evaluateRecent5SecWindow,
  evaluateTrainingSession,
  RecordedNoteSample,
  SessionScoreSummary,
} from '../core/scoring/trainingEvaluator';
import { updateProfileWithNoteScoreAndVoiceprint } from '../core/scoring/voiceprintAnalyzer';
import { TimedPitchPoint } from '../components/PitchPianoRoll/PitchPianoRoll';
import { microphoneService } from '../services/microphoneService';
import {
  DifficultyLevel,
  PitchFrame,
  TargetNote,
  TrainingMode,
  TrainingRecord,
  UserVocalProfile,
} from '../types/vocal';

export const TRAINING_DURATION_SEC = 10.0;
export const REST_COUNTDOWN_SEC = 3;

export type TrainingSessionState =
  | 'idle'
  | 'guide_playing'
  | 'singing'
  | 'resting'
  | 'completed';

interface UseTrainingSessionParams {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  onSaveRecord: (record: TrainingRecord) => void;
  isSimMode: boolean;
  selectedMode: TrainingMode;
  selectedDiff: DifficultyLevel;
  isCertificationMode: boolean;
}

function computeGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'F' {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'F';
}

export function useTrainingSession({
  profile,
  onUpdateProfile,
  onSaveRecord,
  isSimMode,
  selectedMode,
  selectedDiff,
  isCertificationMode,
}: UseTrainingSessionParams) {
  const [variationSeed, setVariationSeed] = useState<number>(0);
  const demoDurationSec = profile.defaultDemoDurationSec ?? 1.5;

  const [sessionState, setSessionState] = useState<TrainingSessionState>('idle');
  const [guideActiveNoteId, setGuideActiveNoteId] = useState<string | null>(null);
  const [restCountdown, setRestCountdown] = useState<number>(REST_COUNTDOWN_SEC);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [liveFrame, setLiveFrame] = useState<PitchFrame | null>(null);
  const [pitchTrace, setPitchTrace] = useState<TimedPitchPoint[]>([]);
  const [liveScoreSummary, setLiveScoreSummary] = useState<SessionScoreSummary>({
    overallScore: 0,
    pitchAccuracy: 0,
    sustainAccuracy: 0,
    dynamicsAccuracy: 0,
    tempoAccuracy: 0,
    vibratoScore: 0,
  });

  const startTimeMsRef = useRef<number>(0);
  const recordedSamplesRef = useRef<RecordedNoteSample[]>([]);
  const lastMetronomeBeatRef = useRef<number>(-1);
  const restIntervalRef = useRef<number | null>(null);

  const clearRestTimers = () => {
    if (restIntervalRef.current !== null) {
      window.clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  };

  useEffect(() => {
    clearRestTimers();
    toneSynth.stopAll();
    setSessionState('idle');
    setGuideActiveNoteId(null);
    setPitchTrace([]);
    setElapsedSec(0);
    setLiveScoreSummary({
      overallScore: 0,
      pitchAccuracy: 0,
      sustainAccuracy: 0,
      dynamicsAccuracy: 0,
      tempoAccuracy: 0,
      vibratoScore: 0,
    });
    return () => {
      clearRestTimers();
      toneSynth.stopAll();
    };
  }, [selectedMode, selectedDiff, isCertificationMode]);

  const sequence = useMemo(
    () => generateTrainingSequence(selectedMode, selectedDiff, profile, variationSeed),
    [selectedMode, selectedDiff, profile, variationSeed]
  );

  const activeNote: TargetNote | null = useMemo(() => {
    if (sessionState === 'guide_playing' && guideActiveNoteId) {
      return (
        sequence.notes.find((n) => n.id === guideActiveNoteId) ??
        sequence.notes[0] ??
        null
      );
    }
    if (sessionState !== 'singing') {
      return sequence.notes[0] ?? null;
    }
    return (
      sequence.notes.find(
        (n) => elapsedSec >= n.startTimeSec && elapsedSec <= n.startTimeSec + n.durationSec
      ) ??
      sequence.notes[sequence.notes.length - 1] ??
      null
    );
  }, [sequence, elapsedSec, sessionState, guideActiveNoteId]);

  useEffect(() => {
    if (isSimMode && activeNote) {
      microphoneService.updateSimulationConfig({
        targetFrequency: activeNote.frequency,
        vibratoEnabled: selectedMode === 'vibrato_control',
      });
    }
  }, [isSimMode, activeNote, selectedMode]);

  const beginSingingPhase = useCallback(() => {
    setGuideActiveNoteId(null);
    recordedSamplesRef.current = [];
    lastMetronomeBeatRef.current = -1;
    setPitchTrace([]);
    setElapsedSec(0);
    startTimeMsRef.current = performance.now();
    setSessionState('singing');
  }, []);

  useEffect(() => {
    if (sessionState !== 'guide_playing') return;

    toneSynth.playSequenceGuide(sequence.notes, {
      speedMultiplier: 1.0,
      onNotePlay: (note) => {
        setGuideActiveNoteId(note.id);
      },
      onComplete: () => {
        beginSingingPhase();
      },
    });

    return () => {
      toneSynth.stopAll();
    };
  }, [sessionState, sequence, beginSingingPhase]);

  useEffect(() => {
    if (sessionState !== 'resting') return;

    setRestCountdown(REST_COUNTDOWN_SEC);
    if (selectedDiff <= 2) {
      const firstNote = sequence.notes[0];
      if (firstNote) {
        toneSynth.playReferenceTone(firstNote.frequency, 1.0, 0.24);
      }
    }

    let remaining = REST_COUNTDOWN_SEC;
    restIntervalRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setRestCountdown(remaining);
      } else {
        clearRestTimers();
        if (selectedDiff >= 3) {
          setSessionState('guide_playing');
        } else {
          beginSingingPhase();
        }
      }
    }, 1000);

    return () => {
      clearRestTimers();
    };
  }, [sessionState, sequence, selectedDiff, beginSingingPhase]);

  const completeRoundAndEnterRest = useCallback(() => {
    const summary = evaluateTrainingSession(
      selectedMode,
      sequence.notes,
      recordedSamplesRef.current
    );
    setLiveScoreSummary(summary);

    const trainedMidis = sequence.notes.map((n) => n.midi);
    const voicedFrames = recordedSamplesRef.current
      .map((s) => s.frame)
      .filter((f) => f.isVoiced && f.frequency !== null && f.clarity >= 0.72);
    const refFreq = sequence.notes[0]?.frequency ?? 220;
    const vib = analyzeVibratoFromHistory(voicedFrames, refFreq);

    const updatedProfile = updateProfileWithNoteScoreAndVoiceprint(
      profile,
      trainedMidis,
      summary.overallScore,
      voicedFrames,
      vib.rateHz,
      vib.extentCents
    );
    onUpdateProfile(updatedProfile);

    const todayStr = new Date().toISOString().slice(0, 10);
    const grade = computeGrade(summary.overallScore);
    const newRecord: TrainingRecord = {
      id: `rec-${Date.now()}`,
      profileId: profile.id,
      date: todayStr,
      timestamp: new Date().toISOString(),
      mode: selectedMode,
      difficulty: selectedDiff,
      overallScore: summary.overallScore,
      pitchAccuracy: summary.pitchAccuracy,
      sustainAccuracy: summary.sustainAccuracy,
      dynamicsAccuracy: summary.dynamicsAccuracy,
      tempoAccuracy: summary.tempoAccuracy,
      vibratoScore: summary.vibratoScore,
      durationSec: Math.round(TRAINING_DURATION_SEC),
      notesAttempted: sequence.notes.length,
      targetMidi: sequence.notes[0]?.midi,
      isCertification: isCertificationMode,
      certGrade: isCertificationMode ? grade : undefined,
    };
    onSaveRecord(newRecord);

    setVariationSeed((prev) => prev + Math.floor(Math.random() * 17) + 1);
    setSessionState('resting');
  }, [
    selectedMode,
    sequence.notes,
    profile,
    onUpdateProfile,
    selectedDiff,
    isCertificationMode,
    onSaveRecord,
  ]);

  useEffect(() => {
    if (sessionState !== 'singing') return;

    const unsubscribe = microphoneService.subscribe((frame) => {
      const now = performance.now();
      const elapsed = (now - startTimeMsRef.current) / 1000;
      setElapsedSec(elapsed);
      setLiveFrame(frame);

      setPitchTrace((prev) => [
        ...prev.filter((p) => elapsed - p.elapsedSec <= 6.0),
        { elapsedSec: elapsed, frame },
      ]);

      if (selectedMode === 'tempo_rhythm') {
        const beatIndex = Math.floor(elapsed / (60 / sequence.bpm));
        if (beatIndex > lastMetronomeBeatRef.current) {
          lastMetronomeBeatRef.current = beatIndex;
          toneSynth.playMetronomeClick(beatIndex % 4 === 0);
        }
      }

      const currNote =
        sequence.notes.find(
          (n) => elapsed >= n.startTimeSec && elapsed <= n.startTimeSec + n.durationSec
        ) ?? sequence.notes[sequence.notes.length - 1];

      if (currNote) {
        const relSec = Math.max(0, elapsed - currNote.startTimeSec);
        recordedSamplesRef.current.push({
          noteId: currNote.id,
          relativeTimeSec: relSec,
          sessionElapsedSec: elapsed,
          frame,
        });
      }

      const recentSummary = evaluateRecent5SecWindow(
        selectedMode,
        sequence.notes,
        recordedSamplesRef.current,
        elapsed
      );
      setLiveScoreSummary(recentSummary);

      if (elapsed >= TRAINING_DURATION_SEC) {
        completeRoundAndEnterRest();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [sessionState, sequence, selectedMode, completeRoundAndEnterRest]);

  const handleToggleTraining = async () => {
    if (
      sessionState === 'singing' ||
      sessionState === 'resting' ||
      sessionState === 'guide_playing'
    ) {
      clearRestTimers();
      toneSynth.stopAll();
      setGuideActiveNoteId(null);
      setSessionState('idle');
      return;
    }

    clearRestTimers();
    toneSynth.stopAll();
    setPitchTrace([]);
    setElapsedSec(0);
    recordedSamplesRef.current = [];
    lastMetronomeBeatRef.current = -1;

    if (!microphoneService.getIsRunning()) {
      if (isSimMode) {
        microphoneService.startSimulator(sequence.notes[0]?.frequency ?? 440);
      } else {
        const res = await microphoneService.startMicrophone();
        if (!res.success) {
          alert(
            `마이크를 시작할 수 없습니다 (${res.error}). 좌측 메뉴 하단 [세팅]에서 가상 보컬 시뮬레이터를 켜거나 마이크 권한을 확인해 주세요.`
          );
          return;
        }
      }
    }

    if (selectedDiff >= 3) {
      setSessionState('guide_playing');
    } else {
      beginSingingPhase();
    }
  };

  const handleReplay = () => {
    if (selectedDiff >= 3) {
      toneSynth.playSequenceGuide(sequence.notes, {
        speedMultiplier: 1.0,
        onNotePlay: (note) => setGuideActiveNoteId(note.id),
        onComplete: () => setGuideActiveNoteId(null),
      });
    } else {
      const target = activeNote ?? sequence.notes[0];
      if (target) {
        toneSynth.playReferenceTone(target.frequency, demoDurationSec, 0.27);
      }
    }
  };

  return {
    sequence,
    activeNote,
    sessionState,
    restCountdown,
    elapsedSec,
    liveFrame,
    pitchTrace,
    liveScoreSummary,
    demoDurationSec,
    handleToggleTraining,
    handleReplay,
  };
}

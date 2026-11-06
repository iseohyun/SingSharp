import { useEffect, useMemo, useRef, useState } from 'react';
import { toneSynth } from '../core/audio/toneSynth';
import {
  evaluatePitchAgainstTarget,
  midiToFrequency,
  midiToKoreanSolfege,
  midiToNoteName,
} from '../core/music/pitchUtils';
import { updateProfileWithNoteScoreAndVoiceprint } from '../core/scoring/voiceprintAnalyzer';
import { TimedPitchPoint } from '../components/PitchPianoRoll/PitchPianoRoll';
import { microphoneService } from '../services/microphoneService';
import { PitchFrame, TargetNote, UserVocalProfile } from '../types/vocal';

export type TestDirection = 'up' | 'down';
export type StepRunStatus = 'idle' | 'testing' | 'retry';
export type GenderType = 'male' | 'female';

interface UseVocalRangeTestParams {
  profile: UserVocalProfile;
  onUpdateProfile: (next: UserVocalProfile) => void;
  isSimMode: boolean;
}

export function predictGenderFromRange(
  low: number,
  high: number,
  center: number
): GenderType {
  const mid = (low + high) / 2;
  if (center >= 55 || mid >= 58) return 'female';
  return 'male';
}

export function useVocalRangeTest({
  profile,
  onUpdateProfile,
  isSimMode,
}: UseVocalRangeTestParams) {
  const hasExistingTest = Boolean(profile.lastTestedAt);
  const demoDurationSec = profile.defaultDemoDurationSec ?? 1.5;

  const [comfortMidi, setComfortMidi] = useState<number>(
    profile.comfortableCenterMidi || 49
  );
  const [measuredHighMidi, setMeasuredHighMidi] = useState<number>(
    hasExistingTest
      ? profile.highestMidi
      : Math.max(profile.highestMidi || 60, profile.comfortableCenterMidi || 49)
  );
  const [measuredLowMidi, setMeasuredLowMidi] = useState<number>(
    hasExistingTest
      ? profile.lowestMidi
      : Math.min(profile.lowestMidi || 48, profile.comfortableCenterMidi || 49)
  );

  const [isRecordingComfort, setIsRecordingComfort] = useState<boolean>(false);
  const [step1Done, setStep1Done] = useState<boolean>(hasExistingTest);

  const [highStatus, setHighStatus] = useState<StepRunStatus>(
    hasExistingTest ? 'retry' : 'idle'
  );
  const [highTargetMidi, setHighTargetMidi] = useState<number>(
    hasExistingTest ? profile.highestMidi + 1 : profile.comfortableCenterMidi || 49
  );
  const [failedHighMidi, setFailedHighMidi] = useState<number | null>(
    hasExistingTest ? profile.highestMidi + 1 : null
  );
  const [step2Done, setStep2Done] = useState<boolean>(hasExistingTest);

  const [lowStatus, setLowStatus] = useState<StepRunStatus>(
    hasExistingTest ? 'retry' : 'idle'
  );
  const [lowTargetMidi, setLowTargetMidi] = useState<number>(
    hasExistingTest ? profile.lowestMidi - 1 : profile.comfortableCenterMidi || 49
  );
  const [failedLowMidi, setFailedLowMidi] = useState<number | null>(
    hasExistingTest ? profile.lowestMidi - 1 : null
  );
  const [step3Done, setStep3Done] = useState<boolean>(hasExistingTest);

  const [activeDirection, setActiveDirection] = useState<TestDirection>('up');
  const [currentTargetMidi, setCurrentTargetMidi] = useState<number>(
    profile.comfortableCenterMidi || 49
  );
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [liveFrame, setLiveFrame] = useState<PitchFrame | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [pitchTrace, setPitchTrace] = useState<TimedPitchPoint[]>([]);

  const [showReport, setShowReport] = useState<boolean>(hasExistingTest);
  const [selectedGender, setSelectedGender] = useState<GenderType>(() =>
    predictGenderFromRange(
      profile.lowestMidi,
      profile.highestMidi,
      profile.comfortableCenterMidi || 49
    )
  );

  // 스크롤 이동용 Ref
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const voicedFramesRef = useRef<PitchFrame[]>([]);
  const holdAccumMsRef = useRef<number>(0);
  const outOfTuneMsRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const streamStartMsRef = useRef<number>(performance.now());
  const comfortSamplesRef = useRef<number[]>([]);
  const demoMuteUntilMsRef = useRef<number>(0);

  const targetFreq = midiToFrequency(currentTargetMidi);

  // 프로파일 전환 시 해당 프로파일에 저장된 테스트 정보를 즉시 반영
  useEffect(() => {
    const tested = Boolean(profile.lastTestedAt);
    setIsTesting(false);
    setIsRecordingComfort(false);
    setComfortMidi(profile.comfortableCenterMidi || 49);
    setCurrentTargetMidi(profile.comfortableCenterMidi || 49);
    setMeasuredHighMidi(profile.highestMidi);
    setMeasuredLowMidi(profile.lowestMidi);
    setStep1Done(tested);
    setStep2Done(tested);
    setStep3Done(tested);
    setHighStatus(tested ? 'retry' : 'idle');
    setLowStatus(tested ? 'retry' : 'idle');
    setHighTargetMidi(
      tested ? profile.highestMidi + 1 : profile.comfortableCenterMidi || 49
    );
    setLowTargetMidi(
      tested ? profile.lowestMidi - 1 : profile.comfortableCenterMidi || 49
    );
    setFailedHighMidi(tested ? profile.highestMidi + 1 : null);
    setFailedLowMidi(tested ? profile.lowestMidi - 1 : null);
    setShowReport(tested);
    setSelectedGender(
      predictGenderFromRange(
        profile.lowestMidi,
        profile.highestMidi,
        profile.comfortableCenterMidi || 49
      )
    );
  }, [profile.id]);

  useEffect(() => {
    if (isSimMode) {
      microphoneService.updateSimulationConfig({ targetFrequency: targetFreq });
    }
  }, [currentTargetMidi, targetFreq, isSimMode]);

  const scrollToElement = (el: HTMLElement | null) => {
    if (!el) return;
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
  };

  const playDemoToneSafely = (
    freq: number,
    durationSec = demoDurationSec,
    gain = 0.25
  ) => {
    if (!isSimMode) {
      demoMuteUntilMsRef.current = performance.now() + durationSec * 1000 + 250;
    } else {
      demoMuteUntilMsRef.current = performance.now() + 200;
    }
    holdAccumMsRef.current = 0;
    outOfTuneMsRef.current = 0;
    setHoldProgress(0);
    toneSynth.playReferenceTone(freq, durationSec, gain);
  };

  const finishStep2AndScrollToStep3 = (failMidi: number) => {
    holdAccumMsRef.current = 0;
    outOfTuneMsRef.current = 0;
    setHoldProgress(0);
    setIsTesting(false);
    setFailedHighMidi(failMidi);
    setHighTargetMidi(failMidi);
    setHighStatus('retry');
    setStep2Done(true);
    scrollToElement(step3Ref.current);
  };

  const finishStep3AndShowReport = (failMidi: number | null) => {
    holdAccumMsRef.current = 0;
    outOfTuneMsRef.current = 0;
    setHoldProgress(0);
    setIsTesting(false);
    if (failMidi !== null) {
      setFailedLowMidi(failMidi);
      setLowTargetMidi(failMidi);
    }
    setLowStatus('retry');
    setStep3Done(true);
    setSelectedGender(
      predictGenderFromRange(measuredLowMidi, measuredHighMidi, comfortMidi)
    );
    const updatedWithVp = updateProfileWithNoteScoreAndVoiceprint(
      {
        ...profile,
        lowestMidi: Math.min(measuredLowMidi, comfortMidi),
        highestMidi: Math.max(measuredHighMidi, comfortMidi),
        comfortableCenterMidi: comfortMidi,
        lastTestedAt: new Date().toISOString(),
      },
      [],
      0,
      voicedFramesRef.current
    );
    onUpdateProfile(updatedWithVp);
    setShowReport(true);
    scrollToElement(reportRef.current);
  };

  const handlePassCurrentNote = (passedMidi: number, dir: TestDirection) => {
    holdAccumMsRef.current = 0;
    outOfTuneMsRef.current = 0;
    setHoldProgress(0);

    if (dir === 'up') {
      const nextHigh = Math.max(measuredHighMidi, passedMidi);
      setMeasuredHighMidi(nextHigh);
      onUpdateProfile({
        ...profile,
        lowestMidi: Math.min(measuredLowMidi, comfortMidi),
        highestMidi: nextHigh,
        comfortableCenterMidi: comfortMidi,
        lastTestedAt: new Date().toISOString(),
      });

      const nextMidi = passedMidi + 1;
      if (nextMidi > 88) {
        finishStep2AndScrollToStep3(passedMidi);
        return;
      }
      setHighTargetMidi(nextMidi);
      setCurrentTargetMidi(nextMidi);
      playDemoToneSafely(midiToFrequency(nextMidi), demoDurationSec, 0.25);
    } else {
      const nextLow = Math.min(measuredLowMidi, passedMidi);
      setMeasuredLowMidi(nextLow);
      onUpdateProfile({
        ...profile,
        lowestMidi: nextLow,
        highestMidi: Math.max(measuredHighMidi, comfortMidi),
        comfortableCenterMidi: comfortMidi,
        lastTestedAt: new Date().toISOString(),
      });

      const nextMidi = passedMidi - 1;
      if (nextMidi < 36) {
        finishStep3AndShowReport(passedMidi);
        return;
      }
      setLowTargetMidi(nextMidi);
      setCurrentTargetMidi(nextMidi);
      playDemoToneSafely(midiToFrequency(nextMidi), demoDurationSec, 0.25);
    }
  };

  useEffect(() => {
    if (!isTesting && !isRecordingComfort) return;

    const unsubscribe = microphoneService.subscribe((frame) => {
      const now = performance.now();
      const dt = Math.min(100, now - lastFrameTimeRef.current);
      lastFrameTimeRef.current = now;
      const elapsed = (now - streamStartMsRef.current) / 1000;

      setLiveFrame(frame);
      setElapsedSec(elapsed);
      setPitchTrace((prev) => [
        ...prev.filter((p) => elapsed - p.elapsedSec <= 6.0),
        { elapsedSec: elapsed, frame },
      ]);

      if (isRecordingComfort) {
        if (frame.isVoiced && frame.midi !== null && frame.clarity >= 0.72) {
          comfortSamplesRef.current.push(frame.midi);
          voicedFramesRef.current.push(frame);
          const sorted = [...comfortSamplesRef.current].sort((a, b) => a - b);
          const liveMedian = Math.max(
            36,
            Math.min(84, sorted[Math.floor(sorted.length / 2)])
          );
          setComfortMidi(liveMedian);
          setCurrentTargetMidi(liveMedian);
        }
        return;
      }

      if (now < demoMuteUntilMsRef.current) {
        holdAccumMsRef.current = 0;
        outOfTuneMsRef.current = 0;
        setHoldProgress(0);
        return;
      }

      if (!frame.isVoiced || frame.frequency === null || frame.clarity < 0.72) {
        holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt * 0.4);
        setHoldProgress(Math.round((holdAccumMsRef.current / 950) * 100));
        return;
      }

      voicedFramesRef.current.push(frame);

      const { isWithinSemitone } = evaluatePitchAgainstTarget(
        frame.frequency,
        targetFreq,
        false
      );

      if (isWithinSemitone) {
        holdAccumMsRef.current += dt;
        outOfTuneMsRef.current = 0;
        const pct = Math.min(100, Math.round((holdAccumMsRef.current / 950) * 100));
        setHoldProgress(pct);

        if (holdAccumMsRef.current >= 950) {
          handlePassCurrentNote(currentTargetMidi, activeDirection);
        }
      } else {
        holdAccumMsRef.current = Math.max(0, holdAccumMsRef.current - dt * 0.6);
        outOfTuneMsRef.current += dt;
        setHoldProgress(Math.round((holdAccumMsRef.current / 950) * 100));

        if (outOfTuneMsRef.current >= 2200) {
          if (activeDirection === 'up') {
            finishStep2AndScrollToStep3(currentTargetMidi);
          } else {
            finishStep3AndShowReport(currentTargetMidi);
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    isTesting,
    isRecordingComfort,
    currentTargetMidi,
    activeDirection,
    targetFreq,
    demoDurationSec,
    comfortMidi,
    measuredHighMidi,
    measuredLowMidi,
    profile,
    isSimMode,
  ]);

  const ensureAudioStream = async (initialFreq: number): Promise<boolean> => {
    if (!microphoneService.getIsRunning()) {
      if (isSimMode) {
        microphoneService.startSimulator(initialFreq);
      } else {
        const res = await microphoneService.startMicrophone();
        if (!res.success) {
          return false;
        }
      }
    }
    return true;
  };

  const handleToggleComfortRecord = async () => {
    if (!isRecordingComfort) {
      toneSynth.stopAll();
      const ok = await ensureAudioStream(midiToFrequency(comfortMidi));
      if (!ok) return;
      setIsTesting(false);
      setStep1Done(false);
      comfortSamplesRef.current = [];
      setHoldProgress(0);
      streamStartMsRef.current = performance.now();
      lastFrameTimeRef.current = performance.now();
      setPitchTrace([]);
      setElapsedSec(0);
      setIsRecordingComfort(true);
    } else {
      setIsRecordingComfort(false);
      let finalComfort = comfortMidi;
      if (comfortSamplesRef.current.length > 0) {
        const sorted = [...comfortSamplesRef.current].sort((a, b) => a - b);
        finalComfort = Math.max(
          36,
          Math.min(84, sorted[Math.floor(sorted.length / 2)])
        );
        comfortSamplesRef.current = [];
      }
      setComfortMidi(finalComfort);
      setCurrentTargetMidi(finalComfort);
      setHighTargetMidi(finalComfort);
      setLowTargetMidi(finalComfort);
      setMeasuredHighMidi(finalComfort);
      setMeasuredLowMidi(finalComfort);
      setFailedHighMidi(null);
      setFailedLowMidi(null);
      setHighStatus('idle');
      setLowStatus('idle');
      setStep2Done(false);
      setStep3Done(false);
      setSelectedGender(finalComfort >= 55 ? 'female' : 'male');

      const updatedWithVp = updateProfileWithNoteScoreAndVoiceprint(
        {
          ...profile,
          comfortableCenterMidi: finalComfort,
          lowestMidi: finalComfort,
          highestMidi: finalComfort,
          lastTestedAt: new Date().toISOString(),
        },
        [],
        0,
        voicedFramesRef.current
      );
      onUpdateProfile(updatedWithVp);

      setStep1Done(true);
      scrollToElement(step2Ref.current);
    }
  };

  const handleStep2Action = async () => {
    if (highStatus === 'testing') {
      finishStep2AndScrollToStep3(currentTargetMidi);
      return;
    }

    const startMidi =
      highStatus === 'retry' && failedHighMidi !== null ? failedHighMidi : comfortMidi;

    setIsRecordingComfort(false);
    setActiveDirection('up');
    setHighTargetMidi(startMidi);
    setCurrentTargetMidi(startMidi);
    setStep2Done(false);

    const freq = midiToFrequency(startMidi);
    const ok = await ensureAudioStream(freq);
    if (!ok) return;

    if (pitchTrace.length === 0) {
      streamStartMsRef.current = performance.now();
    }
    lastFrameTimeRef.current = performance.now();

    playDemoToneSafely(freq, demoDurationSec, 0.26);
    setLowStatus((prev) => (prev === 'testing' ? 'retry' : prev));
    setHighStatus('testing');
    setIsTesting(true);
  };

  const handleStep3Action = async () => {
    if (lowStatus === 'testing') {
      finishStep3AndShowReport(currentTargetMidi);
      return;
    }

    const startMidi =
      lowStatus === 'retry' && failedLowMidi !== null ? failedLowMidi : comfortMidi;

    setIsRecordingComfort(false);
    setActiveDirection('down');
    setLowTargetMidi(startMidi);
    setCurrentTargetMidi(startMidi);
    setStep3Done(false);

    const freq = midiToFrequency(startMidi);
    const ok = await ensureAudioStream(freq);
    if (!ok) return;

    if (pitchTrace.length === 0) {
      streamStartMsRef.current = performance.now();
    }
    lastFrameTimeRef.current = performance.now();

    playDemoToneSafely(freq, demoDurationSec, 0.26);
    setHighStatus((prev) => (prev === 'testing' ? 'retry' : prev));
    setLowStatus('testing');
    setIsTesting(true);
  };

  const currentTargetNoteObj: TargetNote = useMemo(
    () => ({
      id: `range-target-${currentTargetMidi}`,
      midi: currentTargetMidi,
      frequency: targetFreq,
      noteName: midiToNoteName(currentTargetMidi),
      koreanSolfege: midiToKoreanSolfege(currentTargetMidi),
      startBeat: 0,
      durationBeats: 2,
      startTimeSec: 0,
      durationSec: demoDurationSec,
      lyric: `${midiToNoteName(currentTargetMidi)} (${midiToKoreanSolfege(
        currentTargetMidi
      )})`,
    }),
    [currentTargetMidi, targetFreq, demoDurationSec]
  );

  const currentCentsDiff =
    liveFrame?.isVoiced && liveFrame.frequency
      ? Math.max(
          -100,
          Math.min(
            100,
            Math.round(evaluatePitchAgainstTarget(liveFrame.frequency, targetFreq).centsOff)
          )
        )
      : 0;
  const pointerLeftPct = 50 + (currentCentsDiff / 100) * 50;

  return {
    comfortMidi,
    measuredHighMidi,
    measuredLowMidi,
    isRecordingComfort,
    step1Done,
    highStatus,
    highTargetMidi,
    step2Done,
    lowStatus,
    lowTargetMidi,
    failedLowMidi,
    step3Done,
    activeDirection,
    currentTargetMidi,
    holdProgress,
    liveFrame,
    elapsedSec,
    pitchTrace,
    showReport,
    selectedGender,
    setSelectedGender,
    step2Ref,
    step3Ref,
    reportRef,
    currentTargetNoteObj,
    pointerLeftPct,
    demoDurationSec,
    playDemoToneSafely,
    handleToggleComfortRecord,
    handleStep2Action,
    handleStep3Action,
    finishStep3AndShowReport,
  };
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, History, House } from "lucide-react";
import "./App.css";
import { BottomNav } from "./components/BottomNav";
import { HeroHeader } from "./components/HeroHeader";
import { HistoryTab } from "./components/HistoryTab";
import { SessionTab } from "./components/SessionTab";
import { TodayTab } from "./components/TodayTab";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { usePersistentState } from "./hooks/usePersistentState";
import { useSupabaseAuth } from "./hooks/useSupabaseAuth";
import { useWorkoutSync } from "./hooks/useWorkoutSync";
import { clearSyncOutbox, createOperationId } from "./lib/syncOutbox";
import { clearStateBackup } from "./lib/stateBackup";
import {
  getNextStageTransition,
  getProgramStartPatch,
  getSessionFinishPatch,
  getSessionResetPatch,
  getSessionStartPatch,
} from "./lib/sessionEngine";
import {
  getAvailableVoices,
  getPreferredVoice,
  playCountdownBeep,
  runHaptic,
  speakWithStyle,
} from "./lib/workoutAudio";
import {
  DEFAULT_REST_SECONDS,
  DEFAULT_STATE,
  getProgramDisplayName,
  PROGRAMS,
  REP_PHASE_DURATIONS,
  REP_PHASES,
  SHEET_HEADERS,
  STORAGE_KEY,
} from "./lib/workoutData";
import {
  clampRpe,
  getCoachingRecommendation,
  normalizeActualLoadKg,
} from "./lib/progressionCoach";
import {
  confirmAction,
  downloadCsv,
  formatSeconds,
  getExerciseReferenceImageCandidates,
  getPhaseCue,
  getNextDayType,
  isAlternateExercise,
  loadState,
  resolveWeightGuide,
  summarizeSessionLogs,
  todayDateLabel,
} from "./lib/workoutUtils";

function deferStateUpdate(callback) {
  queueMicrotask(callback);
}

export default function App() {
  const [state, setState, storageError] = usePersistentState(STORAGE_KEY, loadState);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [repGuideCountdown, setRepGuideCountdown] = useState(0);
  const [repGuideVisualElapsedMs, setRepGuideVisualElapsedMs] = useState(0);
  const [setTimerVisualElapsedMs, setSetTimerVisualElapsedMs] = useState(0);
  const [exerciseImageIndexes, setExerciseImageIndexes] = useState({});
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState(null);
  const { installApp, installReady } = useInstallPrompt();
  const {
    authConfigured,
    authEmail,
    authSession,
    authStatus,
    setAuthEmail,
    signInWithGoogle,
    signInWithMagicLink,
    signOut: signOutFromAuth,
  } = useSupabaseAuth();
  const setTimerRef = useRef(null);
  const restTimerRef = useRef(null);
  const repGuideRef = useRef(null);
  const repGuideCountdownTimeoutsRef = useRef([]);
  const countdownAudioContextRef = useRef(null);
  const repGuideStartPendingRef = useRef(false);
  const repGuidePhaseStartedAtRef = useRef(0);
  const repGuidePhasePausedElapsedRef = useRef(0);
  const repGuidePrevStateRef = useRef({ running: false, phaseIndex: 0, side: "left", rep: 0, exerciseName: "" });
  const setTimerStartedAtRef = useRef(0);
  const setTimerPausedElapsedRef = useRef(0);
  const setTimerPrevStateRef = useRef({ running: false, remaining: 0, exerciseName: "" });

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;

    const syncVoices = () => {
      const voices = getAvailableVoices();
      setAvailableVoices(voices);
      if (!voices.length) return;
      if (!state.selectedVoiceName || !voices.some((voice) => voice.name === state.selectedVoiceName)) {
        const fallbackVoice = getPreferredVoice("");
        if (fallbackVoice?.name && fallbackVoice.name !== state.selectedVoiceName) {
          setState((prev) => ({ ...prev, selectedVoiceName: fallbackVoice.name }));
        }
      }
    };

    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [state.selectedVoiceName, setState]);

  const {
    activeOwnerEmail,
    activeOwnerId,
    clearSyncStatus,
    deleteSessionRemote,
    displayedSyncStatus,
    entryBelongsToActiveUser,
    saveSetLocally,
    syncConnected,
    syncSessionToRemote,
    updateSessionRemote,
  } = useWorkoutSync({
    authSession,
    syncApiUrl: state.syncApiUrl,
    setState,
  });

  useEffect(() => {
    if (!state.setTimerRunning || state.setDurationRemaining <= 0) return undefined;

    if (!state.setTimerDeadline) {
      setState((prev) => ({
        ...prev,
        setTimerDeadline: Date.now() + Math.max(0, prev.setDurationRemaining) * 1000,
      }));
      return undefined;
    }

    const deadline = Number(state.setTimerDeadline);
    let announced = false;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === 0 && !announced) {
        announced = true;
        speakWithStyle("time", state.soundEnabled, state.selectedVoiceName);
      }
      setState((prev) => {
        if (!prev.setTimerRunning || Number(prev.setTimerDeadline) !== deadline) return prev;
        if (remaining === 0) {
          return { ...prev, setDurationRemaining: 0, setTimerRunning: false, setTimerDeadline: null };
        }
        return prev.setDurationRemaining === remaining ? prev : { ...prev, setDurationRemaining: remaining };
      });
    };

    tick();
    setTimerRef.current = window.setInterval(tick, 500);
    return () => window.clearInterval(setTimerRef.current);
  }, [state.setDurationRemaining, state.setTimerDeadline, state.setTimerRunning, state.soundEnabled, state.selectedVoiceName, setState]);

  useEffect(() => {
    if (!state.restTimerRunning || state.restRemaining <= 0) return undefined;

    if (!state.restTimerDeadline) {
      setState((prev) => ({
        ...prev,
        restTimerDeadline: Date.now() + Math.max(0, prev.restRemaining) * 1000,
      }));
      return undefined;
    }

    const deadline = Number(state.restTimerDeadline);
    let announced = false;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === 0 && !announced) {
        announced = true;
        speakWithStyle("rest over", state.soundEnabled, state.selectedVoiceName);
      }
      setState((prev) => {
        if (!prev.restTimerRunning || Number(prev.restTimerDeadline) !== deadline) return prev;
        if (remaining === 0) {
          return { ...prev, restRemaining: 0, restTimerRunning: false, restTimerDeadline: null };
        }
        return prev.restRemaining === remaining ? prev : { ...prev, restRemaining: remaining };
      });
    };

    tick();
    restTimerRef.current = window.setInterval(tick, 500);
    return () => window.clearInterval(restTimerRef.current);
  }, [state.restRemaining, state.restTimerDeadline, state.restTimerRunning, state.soundEnabled, state.selectedVoiceName, setState]);

  useEffect(() => {
    if (!state.repGuideRunning || state.sessionStage !== "exercise") return;

    const activeExercise = PROGRAMS[state.activeProgram][state.dayType]?.[state.exerciseIndex];
    if (!activeExercise || activeExercise.isTime) return;

    repGuideRef.current = setTimeout(() => {
      setState((prev) => {
        const exercise = PROGRAMS[prev.activeProgram][prev.dayType]?.[prev.exerciseIndex];
        if (!exercise || exercise.isTime || !prev.repGuideRunning) return prev;

        if (prev.repGuidePhaseIndex < REP_PHASES.length - 1) {
          const nextPhaseIndex = prev.repGuidePhaseIndex + 1;
          speakWithStyle(getPhaseCue(REP_PHASES[nextPhaseIndex], nextPhaseIndex), prev.soundEnabled, prev.selectedVoiceName, "set");
          return {
            ...prev,
            repGuidePhaseIndex: nextPhaseIndex,
            repGuidePhaseRemaining: REP_PHASE_DURATIONS[nextPhaseIndex],
          };
        }

        if (isAlternateExercise(exercise.name)) {
          if (prev.repGuideSide === "left") {
            speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, prev.selectedVoiceName, "set");
            return {
              ...prev,
              repGuideSide: "right",
              repGuidePhaseIndex: 0,
              repGuidePhaseRemaining: REP_PHASE_DURATIONS[0],
            };
          }

          const nextRep = prev.currentRep + 1;
          const done = nextRep >= exercise.reps;
          if (!done) speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, prev.selectedVoiceName, "set");

          return {
            ...prev,
            currentRep: nextRep,
            repGuideRunning: !done,
            repGuideSide: "left",
            repGuidePhaseIndex: 0,
            repGuidePhaseRemaining: done ? 0 : REP_PHASE_DURATIONS[0],
          };
        }

        const nextRep = prev.currentRep + 1;
        const done = nextRep >= exercise.reps;
        if (!done) speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, prev.selectedVoiceName, "set");

        return {
          ...prev,
          currentRep: nextRep,
          repGuideRunning: !done,
          repGuidePhaseIndex: 0,
          repGuidePhaseRemaining: done ? 0 : REP_PHASE_DURATIONS[0],
        };
      });
    }, (REP_PHASE_DURATIONS[state.repGuidePhaseIndex] || 1) * 1000);

    return () => clearTimeout(repGuideRef.current);
  }, [state.repGuideRunning, state.repGuidePhaseRemaining, state.repGuidePhaseIndex, state.sessionStage, state.activeProgram, state.dayType, state.exerciseIndex, setState, state.soundEnabled]);

  useEffect(() => {
    const exerciseName = PROGRAMS[state.activeProgram][state.dayType]?.[state.exerciseIndex]?.name || "";
    const activeExercise = PROGRAMS[state.activeProgram][state.dayType]?.[state.exerciseIndex];
    const prev = repGuidePrevStateRef.current;

    if (!activeExercise || activeExercise.isTime || state.sessionStage !== "exercise") {
      repGuidePhaseStartedAtRef.current = 0;
      repGuidePhasePausedElapsedRef.current = 0;
      deferStateUpdate(() => setRepGuideVisualElapsedMs(0));
      repGuidePrevStateRef.current = { running: false, phaseIndex: 0, side: "left", rep: 0, exerciseName };
      return;
    }

    const now = performance.now();
    const phaseChanged = prev.phaseIndex !== state.repGuidePhaseIndex || prev.side !== state.repGuideSide || prev.rep !== state.currentRep || prev.exerciseName !== exerciseName;

    if (state.repGuideRunning && (!prev.running || phaseChanged)) {
      repGuidePhaseStartedAtRef.current = now;
      repGuidePhasePausedElapsedRef.current = 0;
      deferStateUpdate(() => setRepGuideVisualElapsedMs(0));
    } else if (!state.repGuideRunning && prev.running) {
      repGuidePhasePausedElapsedRef.current = Math.max(0, now - repGuidePhaseStartedAtRef.current);
      deferStateUpdate(() => setRepGuideVisualElapsedMs(repGuidePhasePausedElapsedRef.current));
    }

    repGuidePrevStateRef.current = {
      running: state.repGuideRunning,
      phaseIndex: state.repGuidePhaseIndex,
      side: state.repGuideSide,
      rep: state.currentRep,
      exerciseName,
    };
  }, [state.activeProgram, state.currentRep, state.dayType, state.exerciseIndex, state.repGuidePhaseIndex, state.repGuideRunning, state.repGuideSide, state.sessionStage]);

  useEffect(() => {
    const activeExercise = PROGRAMS[state.activeProgram][state.dayType]?.[state.exerciseIndex];
    const exerciseName = activeExercise?.name || "";
    const prev = setTimerPrevStateRef.current;

    if (!activeExercise?.isTime || state.sessionStage !== "exercise") {
      setTimerStartedAtRef.current = 0;
      setTimerPausedElapsedRef.current = 0;
      deferStateUpdate(() => setSetTimerVisualElapsedMs(0));
      setTimerPrevStateRef.current = { running: false, remaining: 0, exerciseName };
      return;
    }

    const now = performance.now();
    const targetMs = activeExercise.reps * 1000;
    const elapsedFromRemaining = Math.max(0, targetMs - (state.setDurationRemaining || activeExercise.reps) * 1000);

    if (prev.exerciseName !== exerciseName || (!state.setTimerRunning && state.setDurationRemaining === activeExercise.reps)) {
      setTimerStartedAtRef.current = 0;
      setTimerPausedElapsedRef.current = 0;
      deferStateUpdate(() => setSetTimerVisualElapsedMs(0));
    }

    if (state.setTimerRunning && !prev.running) {
      setTimerPausedElapsedRef.current = elapsedFromRemaining;
      setTimerStartedAtRef.current = now - elapsedFromRemaining;
      deferStateUpdate(() => setSetTimerVisualElapsedMs(elapsedFromRemaining));
    } else if (!state.setTimerRunning && prev.running) {
      setTimerPausedElapsedRef.current = Math.max(0, now - setTimerStartedAtRef.current);
      deferStateUpdate(() => setSetTimerVisualElapsedMs(setTimerPausedElapsedRef.current));
    }

    if (!state.setTimerRunning && state.setDurationRemaining === 0) {
      setTimerPausedElapsedRef.current = targetMs;
      deferStateUpdate(() => setSetTimerVisualElapsedMs(targetMs));
    }

    setTimerPrevStateRef.current = {
      running: state.setTimerRunning,
      remaining: state.setDurationRemaining,
      exerciseName,
    };
  }, [state.activeProgram, state.dayType, state.exerciseIndex, state.sessionStage, state.setDurationRemaining, state.setTimerRunning]);

  useEffect(() => {
    const activeExercise = PROGRAMS[state.activeProgram][state.dayType]?.[state.exerciseIndex];
    const shouldAnimate = (state.repGuideRunning && state.sessionStage === "exercise" && activeExercise && !activeExercise.isTime)
      || (state.setTimerRunning && state.sessionStage === "exercise" && activeExercise?.isTime);
    if (!shouldAnimate) return undefined;

    let frameId = 0;
    const tick = (now) => {
      if (state.repGuideRunning) {
        setRepGuideVisualElapsedMs(Math.max(0, now - repGuidePhaseStartedAtRef.current));
      }
      if (state.setTimerRunning) {
        setSetTimerVisualElapsedMs(Math.max(0, now - setTimerStartedAtRef.current));
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [state.activeProgram, state.dayType, state.exerciseIndex, state.repGuideRunning, state.sessionStage, state.setTimerRunning]);

  const exercises = useMemo(() => PROGRAMS[state.activeProgram][state.dayType] || [], [state.activeProgram, state.dayType]);
  const visibleLogs = useMemo(() => state.logs.filter(entryBelongsToActiveUser), [state.logs, entryBelongsToActiveUser]);
  const visibleHistory = useMemo(() => state.history.filter(entryBelongsToActiveUser), [state.history, entryBelongsToActiveUser]);
  const currentProgramMeta = useMemo(() => PROGRAMS[state.activeProgram], [state.activeProgram]);
  const currentExercise = state.sessionStage === "exercise" ? exercises[state.exerciseIndex] || null : null;
  const sessionProgress = useMemo(() => {
    const totalSteps = exercises.length + 2;
    if (!totalSteps) return 0;
    if (state.sessionStage === "warmup") return 0;
    if (state.sessionStage === "exercise") {
      return ((1 + state.exerciseIndex + (state.currentSet - 1) / (currentExercise?.sets || 1)) / totalSteps) * 100;
    }
    if (state.sessionStage === "stretch") return ((exercises.length + 1) / totalSteps) * 100;
    if (state.sessionStage === "idle") return 0;
    return 100;
  }, [exercises.length, state.sessionStage, state.exerciseIndex, state.currentSet, currentExercise?.sets]);
  const completedTodaySets = useMemo(
    () => visibleLogs.filter((log) => log.date === todayDateLabel()).length,
    [visibleLogs],
  );
  const currentProgramName = getProgramDisplayName(state.activeProgram);
  const nextWorkout = `${currentProgramName} - Day ${state.dayType}`;
  const latestSession = visibleHistory[0] || null;
  const activeThemeClass = `${state.activeTab}-theme`;
  const resolvedCurrentWeight = currentExercise
    ? resolveWeightGuide(currentExercise.weight, state.availableWeights, currentExercise.loadMode || "pair")
    : "";
  const coachingRecommendation = useMemo(() => getCoachingRecommendation({
    exercise: currentExercise,
    logs: visibleLogs,
    history: visibleHistory,
    program: state.activeProgram,
    dayType: state.dayType,
    availableWeightsInput: state.availableWeights,
    readiness: state.todayReadiness,
    currentSessionId: state.sessionId || "",
  }), [
    currentExercise,
    state.activeProgram,
    state.availableWeights,
    state.dayType,
    state.sessionId,
    state.todayReadiness,
    visibleHistory,
    visibleLogs,
  ]);
  const currentExerciseImages = currentExercise ? getExerciseReferenceImageCandidates(currentExercise.name) : [];
  const currentExerciseImageIndex = currentExercise ? exerciseImageIndexes[currentExercise.name] || 0 : 0;
  const currentExerciseImage = currentExerciseImages[currentExerciseImageIndex] || currentExerciseImages.at(-1) || "";
  const sessionSummaries = useMemo(() => summarizeSessionLogs(visibleLogs, visibleHistory).slice(0, 8), [visibleLogs, visibleHistory]);
  const repGuideBorderProgress = useMemo(() => {
    if (!currentExercise || currentExercise.isTime || state.sessionStage !== "exercise") return null;
    const phaseDurationMs = (REP_PHASE_DURATIONS[state.repGuidePhaseIndex] || 1) * 1000;
    const elapsedMs = repGuideVisualElapsedMs;
    const phaseProgress = Math.min(1, phaseDurationMs > 0 ? elapsedMs / phaseDurationMs : 0);
    const phaseProgresses = REP_PHASES.map((_, index) => {
      if (index < state.repGuidePhaseIndex) return 1;
      if (index === state.repGuidePhaseIndex) return phaseProgress;
      return 0;
    });
    const segmentProgress = [
      (phaseProgresses[0] + phaseProgresses[1]) / 2,
      (phaseProgresses[2] + phaseProgresses[3]) / 2,
      (phaseProgresses[4] + phaseProgresses[5] + phaseProgresses[6]) / 3,
      phaseProgresses[7],
    ];
    return {
      active: state.repGuideRunning || repGuideVisualElapsedMs > 0,
      segmentProgress,
    };
  }, [currentExercise, repGuideVisualElapsedMs, state.repGuidePhaseIndex, state.repGuideRunning, state.sessionStage]);
  const setTimerBorderProgress = useMemo(() => {
    if (!currentExercise?.isTime || state.sessionStage !== "exercise") return null;
    const totalMs = currentExercise.reps * 1000;
    const elapsedMs = setTimerVisualElapsedMs;
    return {
      active: state.setTimerRunning || setTimerVisualElapsedMs > 0,
      progress: Math.min(1, totalMs > 0 ? elapsedMs / totalMs : 0),
    };
  }, [currentExercise, setTimerVisualElapsedMs, state.sessionStage, state.setTimerRunning]);
  const repGuideLabel = currentExercise?.isTime
    ? ""
    : isAlternateExercise(currentExercise?.name || "")
      ? `${state.repGuideSide === "left" ? "Left" : "Right"} side • ${REP_PHASES[state.repGuidePhaseIndex] || "Up"}`
      : REP_PHASES[state.repGuidePhaseIndex] || "Up";
  const authUserEmail = authSession?.user?.email || "";
  const tabs = [
    { id: "today", label: "Setup", icon: House },
    { id: "session", label: "Session", icon: Activity },
    { id: "history", label: "History", icon: History },
  ];

  const updateState = (patch) => setState((prev) => ({ ...prev, ...patch }));
  const toggleSoundEnabled = () => {
    setState((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  };
  const handleVoiceSelection = (voiceName) => {
    updateState({ selectedVoiceName: voiceName });
    speakWithStyle(`Hi there! I am ${voiceName}, your Workout Coach`, true, voiceName, "default");
  };
  const cancelRepGuideCountdown = () => {
    repGuideStartPendingRef.current = false;
    setRepGuideCountdown(0);
    repGuideCountdownTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    repGuideCountdownTimeoutsRef.current = [];
    repGuidePhaseStartedAtRef.current = 0;
    repGuidePhasePausedElapsedRef.current = 0;
    setRepGuideVisualElapsedMs(0);
  };
  const resetRestTimer = () => {
    setState((prev) => (prev.restTimerRunning || prev.restRemaining > 0
      ? { ...prev, restRemaining: 0, restTimerRunning: false, restTimerDeadline: null }
      : prev));
  };
  const handleTabChange = (tab) => {
    cancelRepGuideCountdown();
    resetRestTimer();
    updateState({ activeTab: tab });
  };
  const navigateToToday = () => {
    cancelRepGuideCountdown();
    resetRestTimer();
    updateState({ activeTab: "today" });
  };
  const startRepGuideWithCountdown = async (nextState) => {
    cancelRepGuideCountdown();
    repGuideStartPendingRef.current = true;
    setState((prev) => ({ ...prev, ...nextState, repGuideRunning: false, repGuidePhaseRemaining: 0 }));

    for (let step = 3; step >= 1; step -= 1) {
      setRepGuideCountdown(step);
      setState((prev) => ({ ...prev, repGuidePhaseRemaining: step }));
      await playCountdownBeep(countdownAudioContextRef);
      await new Promise((resolve) => {
        const timeoutId = setTimeout(resolve, 1000);
        repGuideCountdownTimeoutsRef.current.push(timeoutId);
      });
      if (!repGuideStartPendingRef.current) return;
    }

    setRepGuideCountdown(0);
    setState((prev) => ({
      ...prev,
      ...nextState,
      repGuideRunning: true,
      repGuidePhaseRemaining: REP_PHASE_DURATIONS[0],
    }));
    speakWithStyle(getPhaseCue(REP_PHASES[0], 0), state.soundEnabled, state.selectedVoiceName, "set");
    repGuideStartPendingRef.current = false;
  };

  useEffect(() => () => {
    repGuideStartPendingRef.current = false;
    repGuideCountdownTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    repGuideCountdownTimeoutsRef.current = [];
    countdownAudioContextRef.current?.close().catch(() => {});
  }, []);

  const handleExerciseImageError = () => {
    if (!currentExercise) return;
    setExerciseImageIndexes((prev) => ({
      ...prev,
      [currentExercise.name]: Math.min((prev[currentExercise.name] || 0) + 1, currentExerciseImages.length - 1),
    }));
  };

  const currentSessionDurationMinutes = () => {
    if (!state.sessionStartedAt) return "";
    return Math.max(1, Math.round((Date.now() - new Date(state.sessionStartedAt).getTime()) / 60000));
  };

  const signOut = async () => {
    const signedOut = await signOutFromAuth();
    if (signedOut) clearSyncStatus();
  };

  const startSession = () => {
    cancelRepGuideCountdown();
    const sessionOwnerKey = activeOwnerId || activeOwnerEmail || "guest";
    const sessionId = `${sessionOwnerKey}-${Date.now()}`;
    updateState(getSessionStartPatch({
      sessionId,
      startedAt: new Date().toISOString(),
    }));
    runHaptic("medium");
    speakWithStyle("warm up", state.soundEnabled, state.selectedVoiceName, "warmup");
  };

  const beginProgramAfterWarmup = () => {
    cancelRepGuideCountdown();
    const firstExercise = PROGRAMS[state.activeProgram][state.dayType]?.[0];
    const firstRecommendation = getCoachingRecommendation({
      exercise: firstExercise,
      logs: visibleLogs,
      history: visibleHistory,
      program: state.activeProgram,
      dayType: state.dayType,
      availableWeightsInput: state.availableWeights,
      readiness: state.todayReadiness,
      currentSessionId: state.sessionId || "",
    });
    updateState({
      ...getProgramStartPatch(firstExercise),
      currentLoadKg: firstRecommendation.recommendedLoadKg > 0 ? String(firstRecommendation.recommendedLoadKg) : "",
      currentRpe: 7,
      completedOverride: "",
    });
    speakWithStyle(firstExercise?.name || "begin", state.soundEnabled, state.selectedVoiceName, "set");
  };

  const finishSession = () => {
    cancelRepGuideCountdown();
    const sessionRecord = {
      sessionId: state.sessionId,
      date: todayDateLabel(),
      program: state.activeProgram,
      dayType: state.dayType,
      durationMinutes: currentSessionDurationMinutes(),
      setsCompleted: state.logs.filter((x) => x.sessionId === state.sessionId).length,
      ownerId: activeOwnerId,
      ownerEmail: activeOwnerEmail,
      note: state.todayNote,
      availableWeights: state.availableWeights,
      readiness: Number(state.todayReadiness) || 3,
      warmupCompleted: state.warmupDone,
      stretchCompleted: true,
    };

    updateState({
      history: [sessionRecord, ...state.history].slice(0, 200),
      ...getSessionFinishPatch(getNextDayType(state.dayType)),
    });
    syncSessionToRemote(sessionRecord);
    runHaptic("success");
    speakWithStyle("session complete", state.soundEnabled, state.selectedVoiceName, "stretch");
  };

  const moveToNextStage = (restSeconds) => {
    if (!currentExercise) return;
    cancelRepGuideCountdown();

    const transition = getNextStageTransition({
      state,
      currentExercise,
      exercises,
      restSeconds,
      nowMs: Date.now(),
    });
    if (!transition) return;

    const nextPatch = {
      ...transition.patch,
      currentRpe: 7,
      completedOverride: "",
    };

    if (Number.isInteger(transition.patch.exerciseIndex)) {
      const nextExercise = exercises[transition.patch.exerciseIndex];
      const nextRecommendation = getCoachingRecommendation({
        exercise: nextExercise,
        logs: visibleLogs,
        history: visibleHistory,
        program: state.activeProgram,
        dayType: state.dayType,
        availableWeightsInput: state.availableWeights,
        readiness: state.todayReadiness,
        currentSessionId: state.sessionId || "",
      });
      nextPatch.currentLoadKg = nextRecommendation.recommendedLoadKg > 0
        ? String(nextRecommendation.recommendedLoadKg)
        : "";
    } else if (transition.patch.sessionStage === "stretch") {
      nextPatch.currentLoadKg = "";
    }

    updateState(nextPatch);
    if (transition.announcement) {
      speakWithStyle(transition.announcement, state.soundEnabled, state.selectedVoiceName, "set");
    }
  };

  const completeSet = async () => {
    if (!currentExercise) return;

    const restSeconds = currentExercise.rest ?? DEFAULT_REST_SECONDS;
    const overrideText = String(state.completedOverride ?? "").trim();
    const overrideValue = overrideText === "" ? null : Math.max(0, Math.trunc(Number(overrideText) || 0));
    const completedValue = overrideValue ?? (currentExercise.isTime ? currentExercise.reps : state.currentRep || currentExercise.reps);
    const actualLoadKg = normalizeActualLoadKg(
      state.currentLoadKg === "" ? coachingRecommendation.recommendedLoadKg : state.currentLoadKg,
    );
    const effortRpe = clampRpe(state.currentRpe);
    const entry = {
      clientLogId: createOperationId("log"),
      timestamp: new Date().toISOString(),
      date: todayDateLabel(),
      program: state.activeProgram,
      dayType: state.dayType,
      exercise: currentExercise.name,
      setNumber: state.currentSet,
      target: currentExercise.reps,
      completed: completedValue,
      isTime: !!currentExercise.isTime,
      weightGuide: resolveWeightGuide(
        currentExercise.weight,
        state.availableWeights,
        currentExercise.loadMode || "pair",
      ),
      actualLoadKg,
      effortRpe,
      tempo: currentExercise.tempo,
      rest: restSeconds,
      sessionId: state.sessionId,
      durationMinutes: currentSessionDurationMinutes(),
      ownerId: activeOwnerId,
      ownerEmail: activeOwnerEmail,
    };

    await saveSetLocally(entry);
    moveToNextStage(restSeconds);
  };

  const resetSession = () => {
    resetRestTimer();
    cancelRepGuideCountdown();
    confirmAction("Reset the full session and clear current progress?", () => {
      runHaptic("light");
      updateState(getSessionResetPatch());
    });
  };

  const exportLogs = () => {
    const rows = [SHEET_HEADERS, ...visibleLogs.map((log) => SHEET_HEADERS.map((header) => log[header] ?? ""))];
    downloadCsv(`workout-log-${todayDateLabel()}.csv`, rows);
  };

  const clearAllData = () => {
    confirmAction("Clear all local workout data from this device?", async () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(`${STORAGE_KEY}:savedAt`);
      } catch (error) {
        console.error("Could not clear local workout storage.", error);
      }

      const results = await Promise.allSettled([
        clearStateBackup(STORAGE_KEY),
        clearSyncOutbox(),
      ]);
      results.filter((result) => result.status === "rejected").forEach((result) => {
        console.error("Could not clear a local workout data store.", result.reason);
      });

      setState({ ...DEFAULT_STATE });
      clearSyncStatus();
    });
  };

  const deleteSession = (sessionId) => {
    confirmAction("Delete this session and all of its logged sets?", async () => {
      setState((prev) => ({
        ...prev,
        history: prev.history.filter((session) => session.sessionId !== sessionId),
        logs: prev.logs.filter((log) => log.sessionId !== sessionId),
      }));
      await deleteSessionRemote(sessionId);
    });
  };

  const editSession = (session) => {
    const nextNote = window.prompt("Update session note", session.note || "");
    if (nextNote === null) return;

    const nextWeights = window.prompt("Update available weights", session.availableWeights || "");
    if (nextWeights === null) return;

    const nextWarmup = window.confirm("Mark warm up as completed? Click Cancel for not completed.");
    const nextStretch = window.confirm("Mark stretch as completed? Click Cancel for not completed.");

    const patch = {
      note: nextNote,
      availableWeights: nextWeights,
      warmupCompleted: nextWarmup,
      stretchCompleted: nextStretch,
    };

    setState((prev) => ({
      ...prev,
      history: prev.history.map((item) => item.sessionId === session.sessionId ? { ...item, ...patch } : item),
    }));
    setOpenHistoryMenuId(null);
    updateSessionRemote(session.sessionId, patch);
  };

  const toggleRepGuide = () => {
    if (!currentExercise || currentExercise.isTime) return;
    resetRestTimer();

    if (state.repGuideRunning || repGuideStartPendingRef.current) {
      cancelRepGuideCountdown();
      updateState({ repGuideRunning: false, repGuidePhaseRemaining: 0 });
      return;
    }

    const shouldRestart = state.currentRep >= currentExercise.reps;
    const nextSide = state.currentRep === 0 || shouldRestart ? "left" : state.repGuideSide;
    startRepGuideWithCountdown({
      currentRep: shouldRestart ? 0 : state.currentRep,
      repGuidePhaseIndex: 0,
      repGuideSide: nextSide,
    });
  };

  const restartRepGuide = () => {
    resetRestTimer();
    cancelRepGuideCountdown();
    confirmAction("Restart the guided rep count for this set?", () => {
      updateState({
        currentRep: 0,
        repGuideRunning: false,
        repGuidePhaseIndex: 0,
        repGuidePhaseRemaining: 0,
        repGuideSide: "left",
      });
    });
  };

  const toggleSetTimer = () => {
    if (!currentExercise?.isTime) return;
    resetRestTimer();
    cancelRepGuideCountdown();

    if (state.setTimerRunning) {
      const remaining = state.setTimerDeadline
        ? Math.max(0, Math.ceil((Number(state.setTimerDeadline) - Date.now()) / 1000))
        : state.setDurationRemaining;
      updateState({ setDurationRemaining: remaining, setTimerRunning: false, setTimerDeadline: null });
      return;
    }

    const remaining = state.setDurationRemaining || currentExercise.reps;
    updateState({
      setDurationRemaining: remaining,
      setTimerRunning: true,
      setTimerDeadline: Date.now() + remaining * 1000,
    });
  };

  const resetSetTimer = () => {
    resetRestTimer();
    cancelRepGuideCountdown();
    confirmAction("Reset this timer back to the full target time?", () => {
      updateState({ setDurationRemaining: currentExercise?.reps || 0, setTimerRunning: false, setTimerDeadline: null });
    });
  };

  const toggleRestTimer = () => {
    cancelRepGuideCountdown();
    const restSeconds = currentExercise?.rest ?? DEFAULT_REST_SECONDS;

    if (state.restTimerRunning) {
      const remaining = state.restTimerDeadline
        ? Math.max(0, Math.ceil((Number(state.restTimerDeadline) - Date.now()) / 1000))
        : state.restRemaining;
      updateState({ restRemaining: remaining, restTimerRunning: false, restTimerDeadline: null });
      return;
    }

    const remaining = state.restRemaining || restSeconds;
    updateState({
      restTimerRunning: true,
      restRemaining: remaining,
      restTimerDeadline: Date.now() + remaining * 1000,
    });
  };

  const skipRest = () => {
    cancelRepGuideCountdown();
    updateState({ restRemaining: 0, restTimerRunning: false, restTimerDeadline: null });
  };

  return (
    <div className={`app-shell ${activeThemeClass} min-h-screen bg-white text-black p-3 sm:p-6`}>
      <div className="app-stack max-w-md mx-auto space-y-4 pb-24">
        <HeroHeader todayLabel={todayDateLabel()} activeProgram={currentProgramName} dayType={state.dayType} />

        <BottomNav tabs={tabs} activeTab={state.activeTab} onTabChange={handleTabChange} />

        {storageError && (
          <div role="alert" className="border-4 border-black rounded-2xl p-3 bg-white text-black font-bold">
            Workout data could not be saved on this device. Keep this screen open and export your history before closing the app.
          </div>
        )}

        {state.activeTab === "today" && (
          <TodayTab
            state={state}
            authEmail={authEmail}
            authUserEmail={authUserEmail}
            authConfigured={authConfigured}
            authStatus={authStatus}
            installReady={installReady}
            programs={PROGRAMS}
            currentProgramMeta={currentProgramMeta}
            nextWorkout={nextWorkout}
            completedTodaySets={completedTodaySets}
            latestSession={latestSession}
            availableVoices={availableVoices}
            installApp={installApp}
            setAuthEmail={setAuthEmail}
            startSession={startSession}
            signInWithGoogle={signInWithGoogle}
            signInWithMagicLink={signInWithMagicLink}
            signOut={signOut}
            updateState={updateState}
            toggleSoundEnabled={toggleSoundEnabled}
            onVoiceSelect={handleVoiceSelection}
          />
        )}

        {state.activeTab === "session" && (
          <SessionTab
            state={state}
            exercises={exercises}
            currentExercise={currentExercise}
            sessionProgress={sessionProgress}
            resolvedCurrentWeight={resolvedCurrentWeight}
            coachingRecommendation={coachingRecommendation}
            updateSetFeedback={updateState}
            currentExerciseImage={currentExerciseImage}
            repGuideLabel={repGuideLabel}
            repGuideCountdown={repGuideCountdown}
            repGuideBorderProgress={repGuideBorderProgress}
            setTimerBorderProgress={setTimerBorderProgress}
            syncConnected={syncConnected}
            syncStatus={displayedSyncStatus}
            formatSeconds={formatSeconds}
              DEFAULT_REST_SECONDS={DEFAULT_REST_SECONDS}
              onExerciseImageError={handleExerciseImageError}
              isAlternateExercise={isAlternateExercise}
              toggleSound={toggleSoundEnabled}
              startSession={startSession}
             beginProgramAfterWarmup={beginProgramAfterWarmup}
             toggleRepGuide={toggleRepGuide}
             restartRepGuide={restartRepGuide}
             toggleSetTimer={toggleSetTimer}
             resetSetTimer={resetSetTimer}
             toggleRestTimer={toggleRestTimer}
             completeSet={completeSet}
             skipRest={skipRest}
             resetSession={resetSession}
             finishSession={finishSession}
             navigateToToday={navigateToToday}
           />
        )}

        {state.activeTab === "history" && (
          <HistoryTab
            sessionSummaries={sessionSummaries}
            openHistoryMenuId={openHistoryMenuId}
            setOpenHistoryMenuId={setOpenHistoryMenuId}
            editSession={editSession}
            deleteSession={deleteSession}
            exportLogs={exportLogs}
            resetSession={resetSession}
            clearAllData={clearAllData}
          />
        )}
      </div>
    </div>
  );
}

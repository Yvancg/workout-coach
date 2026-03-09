import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Activity, History, House } from "lucide-react";
import "./App.css";
import { BottomNav } from "./components/BottomNav";
import { HeroHeader } from "./components/HeroHeader";
import { HistoryTab } from "./components/HistoryTab";
import { SessionTab } from "./components/SessionTab";
import { TodayTab } from "./components/TodayTab";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { usePersistentState } from "./hooks/usePersistentState";
import { createRemoteLog, createRemoteSession, deleteRemoteSession, loadHistorySummary, updateRemoteSession } from "./lib/syncClient";
import { supabase, supabaseConfigured } from "./lib/supabaseClient";
import {
  DEFAULT_REST_SECONDS,
  DEFAULT_STATE,
  PROGRAMS,
  REP_PHASE_DURATIONS,
  REP_PHASES,
  SHEET_HEADERS,
  STORAGE_KEY,
} from "./lib/workoutData";
import {
  confirmAction,
  downloadCsv,
  formatSeconds,
  getExerciseReferenceImageCandidates,
  getPhaseCue,
  getNextDayType,
  getSyncApiBase,
  isAlternateExercise,
  loadState,
  resolveWeightGuide,
  summarizeSessionLogs,
  todayDateLabel,
} from "./lib/workoutUtils";

function getFemaleVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];

  const femaleMatcher = /Samantha|Karen|Moira|Tessa|Serena|Ava|Allison|Susan|Victoria|Fiona|Veena|Anna|Zira|Aria|Jenny|Emma|Olivia|Google UK English Female|Google US English Female/i;
  const maleMatcher = /Daniel|Alex|Guy|David|Thomas|Fred|Junior/i;

  return window.speechSynthesis.getVoices().filter((voice) => (
    /en-/i.test(voice.lang)
    && femaleMatcher.test(voice.name)
    && !maleMatcher.test(voice.name)
  ));
}

function getAvailableVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];

  const englishVoices = window.speechSynthesis.getVoices().filter((voice) => /en-/i.test(voice.lang));
  const preferredVoices = getFemaleVoices();
  return preferredVoices.length ? preferredVoices : englishVoices;
}

function getPreferredVoice(selectedVoiceName = "") {
  const availableVoices = getAvailableVoices();
  if (selectedVoiceName) {
    const selectedVoice = availableVoices.find((voice) => voice.name === selectedVoiceName);
    if (selectedVoice) return selectedVoice;
  }

  const voiceMatchers = [
    /Samantha|Karen|Moira|Google UK English Female|Google US English Female|Microsoft Aria|Microsoft Jenny/i,
    /Google.*English.*Female|Microsoft.*English|Victoria|Fiona|Anna/i,
  ];

  return voiceMatchers
    .map((matcher) => availableVoices.find((voice) => matcher.test(voice.name)))
    .find(Boolean)
    || availableVoices.find((voice) => !voice.localService)
    || availableVoices[0]
    || null;
}

function speakWithStyle(text, enabled, selectedVoiceName = "", mode = "default") {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text) return;

  const preferredVoice = getPreferredVoice(selectedVoiceName);

  window.speechSynthesis.resume();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = preferredVoice?.lang || "en-US";

  void mode;
  utterance.rate = 0.92;
  utterance.pitch = 0.96;

  window.speechSynthesis.speak(utterance);
}

async function playCountdownBeep(audioContextRef, beep = 880, duration = 0.12) {
  if (typeof window === "undefined") return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const context = audioContextRef.current || new AudioContextClass();
  audioContextRef.current = context;
  if (context.state === "suspended") {
    await context.resume().catch(() => {});
  }

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const startTime = context.currentTime + 0.01;
  const endTime = startTime + duration;

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(beep, startTime);
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.05, startTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
  oscillator.onended = () => {
    oscillator.disconnect();
    gainNode.disconnect();
  };
}

function deferStateUpdate(callback) {
  queueMicrotask(callback);
}

async function runHaptic(type = "light") {
  try {
    if (type === "success") {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    }

    await Haptics.impact({
      style: type === "medium" ? ImpactStyle.Medium : ImpactStyle.Light,
    });
  } catch {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(type === "success" ? [18, 20, 28] : type === "medium" ? 18 : 10);
    }
  }
}

export default function App() {
  const [state, setState] = usePersistentState(STORAGE_KEY, loadState);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [repGuideCountdown, setRepGuideCountdown] = useState(0);
  const [repGuideVisualElapsedMs, setRepGuideVisualElapsedMs] = useState(0);
  const [setTimerVisualElapsedMs, setSetTimerVisualElapsedMs] = useState(0);
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [exerciseImageIndexes, setExerciseImageIndexes] = useState({});
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState(null);
  const { installApp, installReady } = useInstallPrompt();
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

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setAuthSession(data.session || null);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session || null);
      setAuthStatus("");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const syncTarget = getSyncApiBase(state.syncApiUrl);
    if (syncTarget === null) return;
    if (!authSession?.access_token) {
      return;
    }

    let cancelled = false;

    async function loadRemoteSnapshot() {
      try {
        setSyncStatus("Loading sync...");
        const historyResult = await loadHistorySummary(state.syncApiUrl, authSession.access_token);
        if (historyResult.skipped) return;
        if (cancelled) return;
        const ownerId = authSession?.user?.id || "";
        const ownerEmail = authSession?.user?.email || "";

        setState((prev) => ({
          ...prev,
          history: [
            ...(Array.isArray(historyResult.data?.history)
              ? historyResult.data.history.map((session) => ({ ...session, ownerId, ownerEmail }))
              : []),
            ...prev.history.filter((session) => (session.ownerId || session.ownerEmail || "") !== (ownerId || ownerEmail)),
          ],
        }));
        setSyncStatus("Sync connected");
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 429) {
          setSyncStatus("Sync is temporarily rate limited.");
          return;
        }
        if (error?.status === 401 || error?.status === 403) {
          setSyncStatus("Supabase login required for sync.");
          return;
        }
        setSyncStatus("Sync unavailable. Local save only.");
      }
    }

    loadRemoteSnapshot();

    return () => {
      cancelled = true;
    };
  }, [authSession?.access_token, authSession?.user?.email, authSession?.user?.id, state.syncApiUrl, setState]);

  const activeOwnerId = authSession?.user?.id || "";
  const activeOwnerEmail = authSession?.user?.email || "";
  const activeOwnerKey = activeOwnerId || activeOwnerEmail;
  const entryBelongsToActiveUser = useCallback((entry) => {
    const entryOwnerId = entry?.ownerId || "";
    const entryOwnerEmail = entry?.ownerEmail || "";
    if (activeOwnerKey) return entryOwnerId === activeOwnerId || (!entryOwnerId && entryOwnerEmail === activeOwnerEmail);
    return !entryOwnerId && !entryOwnerEmail;
  }, [activeOwnerEmail, activeOwnerId, activeOwnerKey]);

  useEffect(() => {
    if (state.setTimerRunning && state.setDurationRemaining > 0) {
      setTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.setDurationRemaining <= 1) {
            speakWithStyle("time", prev.soundEnabled, prev.selectedVoiceName, prev.sessionStage === "stretch" ? "stretch" : "set");
            return { ...prev, setDurationRemaining: 0, setTimerRunning: false };
          }
          return { ...prev, setDurationRemaining: prev.setDurationRemaining - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(setTimerRef.current);
  }, [state.setTimerRunning, state.setDurationRemaining, state.soundEnabled, setState]);

  useEffect(() => {
    if (state.restTimerRunning && state.restRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.restRemaining <= 1) {
            speakWithStyle("rest over", prev.soundEnabled, prev.selectedVoiceName, "set");
            return { ...prev, restRemaining: 0, restTimerRunning: false };
          }
          return { ...prev, restRemaining: prev.restRemaining - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restTimerRef.current);
  }, [state.restTimerRunning, state.restRemaining, state.soundEnabled, setState]);

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
  const nextWorkout = `${state.activeProgram} - Day ${state.dayType}`;
  const latestSession = visibleHistory[0] || null;
  const activeThemeClass = `${state.activeTab}-theme`;
  const resolvedCurrentWeight = currentExercise ? resolveWeightGuide(currentExercise.weight, state.availableWeights) : "";
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
  const syncTarget = getSyncApiBase(state.syncApiUrl);
  const displayedSyncStatus = !authSession?.access_token && syncTarget !== null && syncTarget !== ""
    ? "Supabase login required for sync."
    : syncStatus;
  const syncConnected = syncTarget !== null && /connected|synced/i.test(syncStatus || "");
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
      ? { ...prev, restRemaining: 0, restTimerRunning: false }
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

  const syncSessionToRemote = async (sessionRecord) => {
    if (!authSession?.access_token) return;
    try {
      setSyncStatus("Saving session to sync...");
      const result = await createRemoteSession(state.syncApiUrl, authSession.access_token, sessionRecord);
      if (result.skipped) return;
      setSyncStatus("Synced");
    } catch (error) {
      setSyncStatus(error?.status === 429 ? "Sync is temporarily rate limited." : error?.status === 401 || error?.status === 403 ? "Supabase login required for sync." : "Sync failed. Local save only.");
    }
  };

  const deleteSessionRemote = async (sessionId) => {
    if (!authSession?.access_token) return true;
    try {
      setSyncStatus("Deleting session from sync...");
      const result = await deleteRemoteSession(state.syncApiUrl, authSession.access_token, sessionId);
      if (result.skipped) return true;
      setSyncStatus("Session deleted from sync");
      return true;
    } catch (error) {
      setSyncStatus(error?.status === 429 ? "Sync is temporarily rate limited." : error?.status === 401 || error?.status === 403 ? "Supabase login required for sync." : "Sync delete failed. Local session removed.");
      return false;
    }
  };

  const updateSessionRemote = async (sessionId, sessionPatch) => {
    if (!authSession?.access_token) return true;
    try {
      setSyncStatus("Updating session in sync...");
      const result = await updateRemoteSession(state.syncApiUrl, authSession.access_token, sessionId, sessionPatch);
      if (result.skipped) return true;
      setSyncStatus("Session updated in sync");
      return true;
    } catch (error) {
      setSyncStatus(error?.status === 429 ? "Sync is temporarily rate limited." : error?.status === 401 || error?.status === 403 ? "Supabase login required for sync." : "Sync update failed. Local session updated.");
      return false;
    }
  };

  const saveSetLocally = async (entry) => {
    const nextLogs = [...state.logs, entry];
    updateState({ logs: nextLogs });

    try {
      if (!authSession?.access_token) return;
      setSyncStatus("Saving set to sync...");
      const result = await createRemoteLog(state.syncApiUrl, authSession.access_token, entry);
      if (result.skipped) return;
      setSyncStatus("Synced");
    } catch (error) {
      setSyncStatus(error?.status === 429 ? "Sync is temporarily rate limited." : error?.status === 401 || error?.status === 403 ? "Supabase login required for sync." : "Sync failed. Local save only.");
    }
  };

  const signInWithMagicLink = async () => {
    if (!supabase || !authEmail.trim()) {
      setAuthStatus("Enter your email to receive a magic link.");
      return;
    }

    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: redirectTo },
    });

    setAuthStatus(error ? error.message : `Magic link sent to ${authEmail.trim()}.`);
  };

  const signInWithGoogle = async () => {
    if (!supabase) {
      setAuthStatus("Supabase auth is not configured.");
      return;
    }

    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setAuthStatus(error.message);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus(error.message);
      return;
    }
    setSyncStatus("");
    setAuthStatus("Signed out.");
  };

  const startSession = () => {
    cancelRepGuideCountdown();
    const sessionOwnerKey = activeOwnerId || activeOwnerEmail || "guest";
    const sessionId = `${sessionOwnerKey}-${Date.now()}`;
    updateState({
      sessionStartedAt: new Date().toISOString(),
      sessionId,
      activeTab: "session",
      sessionStage: "warmup",
      exerciseIndex: 0,
      currentSet: 1,
      currentRep: 0,
      repGuideRunning: false,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: 0,
      repGuideSide: "left",
      setDurationRemaining: 0,
      setTimerRunning: false,
      restRemaining: 0,
      restTimerRunning: false,
      warmupDone: false,
      stretchDone: false,
    });
    runHaptic("medium");
    speakWithStyle("warm up", state.soundEnabled, state.selectedVoiceName, "warmup");
  };

  const beginProgramAfterWarmup = () => {
    cancelRepGuideCountdown();
    const firstExercise = PROGRAMS[state.activeProgram][state.dayType]?.[0];
    updateState({
      warmupDone: true,
      sessionStage: "exercise",
      exerciseIndex: 0,
      currentSet: 1,
      currentRep: 0,
      repGuideRunning: false,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: 0,
      repGuideSide: "left",
      setDurationRemaining: firstExercise?.isTime ? firstExercise.reps : 0,
      setTimerRunning: false,
      restRemaining: 0,
      restTimerRunning: false,
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
      warmupCompleted: state.warmupDone,
      stretchCompleted: true,
    };

    updateState({
      history: [sessionRecord, ...state.history].slice(0, 200),
      activeTab: "history",
      sessionStage: "idle",
      restRemaining: 0,
      restTimerRunning: false,
      setDurationRemaining: 0,
      setTimerRunning: false,
      repGuideRunning: false,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: 0,
      repGuideSide: "left",
      currentRep: 0,
      currentSet: 1,
      exerciseIndex: 0,
      stretchDone: true,
      sessionStartedAt: null,
      sessionId: null,
      warmupDone: false,
      dayType: getNextDayType(state.dayType),
    });
    syncSessionToRemote(sessionRecord);
    runHaptic("success");
    speakWithStyle("session complete", state.soundEnabled, state.selectedVoiceName, "stretch");
  };

  const moveToNextStage = (restSeconds) => {
    if (!currentExercise) return;
    cancelRepGuideCountdown();

    if (state.currentSet < currentExercise.sets) {
      updateState({
        currentSet: state.currentSet + 1,
        currentRep: 0,
        repGuideRunning: false,
        repGuidePhaseIndex: 0,
        repGuidePhaseRemaining: 0,
        repGuideSide: "left",
        setDurationRemaining: currentExercise.isTime ? currentExercise.reps : 0,
        setTimerRunning: false,
        restRemaining: restSeconds,
        restTimerRunning: restSeconds > 0,
      });
      return;
    }

    if (state.exerciseIndex < exercises.length - 1) {
      const nextExercise = exercises[state.exerciseIndex + 1];
      updateState({
        exerciseIndex: state.exerciseIndex + 1,
        currentSet: 1,
        currentRep: 0,
        repGuideRunning: false,
        repGuidePhaseIndex: 0,
        repGuidePhaseRemaining: 0,
        repGuideSide: "left",
        setDurationRemaining: nextExercise?.isTime ? nextExercise.reps : 0,
        setTimerRunning: false,
        restRemaining: restSeconds,
        restTimerRunning: restSeconds > 0,
      });
      speakWithStyle(nextExercise?.name || "continue", state.soundEnabled, state.selectedVoiceName, "set");
      return;
    }

    updateState({
      sessionStage: "stretch",
      restRemaining: 0,
      restTimerRunning: false,
      setDurationRemaining: 0,
      setTimerRunning: false,
      repGuideRunning: false,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: 0,
      repGuideSide: "left",
    });
    speakWithStyle("stretch", state.soundEnabled, state.selectedVoiceName, "stretch");
  };

  const completeSet = async () => {
    if (!currentExercise) return;

    const restSeconds = currentExercise.rest || DEFAULT_REST_SECONDS;
    const completedValue = currentExercise.isTime ? currentExercise.reps : state.currentRep || currentExercise.reps;
    const entry = {
      timestamp: new Date().toISOString(),
      date: todayDateLabel(),
      program: state.activeProgram,
      dayType: state.dayType,
      exercise: currentExercise.name,
      setNumber: state.currentSet,
      target: currentExercise.reps,
      completed: completedValue,
      isTime: !!currentExercise.isTime,
      weightGuide: resolveWeightGuide(currentExercise.weight, state.availableWeights),
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
      updateState({
        exerciseIndex: 0,
        currentSet: 1,
        currentRep: 0,
        setDurationRemaining: 0,
        setTimerRunning: false,
        restRemaining: 0,
        restTimerRunning: false,
        warmupDone: false,
        stretchDone: false,
        sessionStage: "idle",
        sessionStartedAt: null,
        sessionId: null,
        repGuideRunning: false,
        repGuidePhaseIndex: 0,
        repGuidePhaseRemaining: 0,
        repGuideSide: "left",
      });
    });
  };

  const exportLogs = () => {
    const rows = [SHEET_HEADERS, ...visibleLogs.map((log) => SHEET_HEADERS.map((header) => log[header] ?? ""))];
    downloadCsv(`workout-log-${todayDateLabel()}.csv`, rows);
  };

  const clearAllData = () => {
    confirmAction("Clear all local workout data from this device?", () => {
      localStorage.removeItem(STORAGE_KEY);
      setState({ ...DEFAULT_STATE });
      setSyncStatus("");
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
    if (state.setDurationRemaining === 0) {
      updateState({ setDurationRemaining: currentExercise.reps, setTimerRunning: true });
      return;
    }
    updateState({ setTimerRunning: !state.setTimerRunning });
  };

  const resetSetTimer = () => {
    resetRestTimer();
    cancelRepGuideCountdown();
    confirmAction("Reset this timer back to the full target time?", () => {
      updateState({ setDurationRemaining: currentExercise?.reps || 0, setTimerRunning: false });
    });
  };

  const toggleRestTimer = () => {
    cancelRepGuideCountdown();
    const restSeconds = currentExercise?.rest || DEFAULT_REST_SECONDS;
    updateState({
      restTimerRunning: !state.restTimerRunning || state.restRemaining === 0,
      restRemaining: state.restRemaining || restSeconds,
    });
  };

  const skipRest = () => {
    cancelRepGuideCountdown();
    updateState({ restRemaining: 0, restTimerRunning: false });
  };

  return (
    <div className={`app-shell ${activeThemeClass} min-h-screen bg-white text-black p-3 sm:p-6`}>
      <div className="app-stack max-w-md mx-auto space-y-4 pb-24">
        <HeroHeader todayLabel={todayDateLabel()} activeProgram={state.activeProgram} dayType={state.dayType} />

        <BottomNav tabs={tabs} activeTab={state.activeTab} onTabChange={handleTabChange} />

        {state.activeTab === "today" && (
          <TodayTab
            state={state}
            authEmail={authEmail}
            authUserEmail={authUserEmail}
            authConfigured={supabaseConfigured}
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

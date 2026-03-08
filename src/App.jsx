import { useEffect, useMemo, useRef, useState } from "react";
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
import { createRemoteLog, createRemoteSession, deleteRemoteSession, loadHistorySummary, loadWhoAmI, updateRemoteSession } from "./lib/syncClient";
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

function speakWithStyle(text, enabled, mode = "default") {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!text) return;

  const voices = window.speechSynthesis.getVoices();
  const voiceMatchers = [
    /Samantha|Daniel|Karen|Moira|Google UK English Female|Google US English Female|Microsoft Aria|Microsoft Jenny|Microsoft Guy/i,
    /Google.*English|Microsoft.*English|Alex/i,
  ];
  const preferredVoice = voiceMatchers
    .map((matcher) => voices.find((voice) => matcher.test(voice.name)))
    .find(Boolean)
    || voices.find((voice) => /en-/i.test(voice.lang) && !voice.localService)
    || voices.find((voice) => /en-/i.test(voice.lang))
    || null;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = preferredVoice?.lang || "en-US";

  void mode;
  utterance.rate = 0.92;
  utterance.pitch = 0.96;

  window.speechSynthesis.speak(utterance);
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
  const [authEmail, setAuthEmail] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authSession, setAuthSession] = useState(null);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncIdentityEmail, setSyncIdentityEmail] = useState("");
  const [exerciseImageIndexes, setExerciseImageIndexes] = useState({});
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState(null);
  const { installApp, installReady } = useInstallPrompt();
  const setTimerRef = useRef(null);
  const restTimerRef = useRef(null);
  const repGuideRef = useRef(null);

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
      setAuthStatus(session ? "Logged in with Supabase." : "");
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
        const [historyResult, whoAmIResult] = await Promise.all([
          loadHistorySummary(state.syncApiUrl, authSession.access_token),
          loadWhoAmI(state.syncApiUrl, authSession.access_token),
        ]);
        if (historyResult.skipped || whoAmIResult.skipped) return;
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          history: Array.isArray(historyResult.data?.history) ? historyResult.data.history : prev.history,
        }));
        setSyncIdentityEmail(whoAmIResult.data?.email || "");
        setSyncStatus("Sync connected");
      } catch (error) {
        if (cancelled) return;
        if (error?.status === 429) {
          setSyncStatus("Sync is temporarily rate limited.");
          return;
        }
        if (error?.status === 401 || error?.status === 403) {
          setSyncIdentityEmail("");
          setSyncStatus("Supabase login required for sync.");
          return;
        }
        setSyncIdentityEmail("");
        setSyncStatus("Sync unavailable. Local save only.");
      }
    }

    loadRemoteSnapshot();

    return () => {
      cancelled = true;
    };
  }, [authSession?.access_token, state.syncApiUrl, setState]);

  useEffect(() => {
    if (state.setTimerRunning && state.setDurationRemaining > 0) {
      setTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.setDurationRemaining <= 1) {
            speakWithStyle("time", prev.soundEnabled, prev.sessionStage === "stretch" ? "stretch" : "set");
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
            speakWithStyle("rest over", prev.soundEnabled, "set");
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
          speakWithStyle(getPhaseCue(REP_PHASES[nextPhaseIndex], nextPhaseIndex), prev.soundEnabled, "set");
          return {
            ...prev,
            repGuidePhaseIndex: nextPhaseIndex,
            repGuidePhaseRemaining: REP_PHASE_DURATIONS[nextPhaseIndex],
          };
        }

        if (isAlternateExercise(exercise.name)) {
          if (prev.repGuideSide === "left") {
            speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, "set");
            return {
              ...prev,
              repGuideSide: "right",
              repGuidePhaseIndex: 0,
              repGuidePhaseRemaining: REP_PHASE_DURATIONS[0],
            };
          }

          const nextRep = prev.currentRep + 1;
          const done = nextRep >= exercise.reps;
          if (!done) speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, "set");

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
        if (!done) speakWithStyle(getPhaseCue(REP_PHASES[0], 0), prev.soundEnabled, "set");

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

  const exercises = useMemo(() => PROGRAMS[state.activeProgram][state.dayType] || [], [state.activeProgram, state.dayType]);
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
    () => state.logs.filter((log) => log.date === todayDateLabel()).length,
    [state.logs],
  );
  const nextWorkout = `${state.activeProgram} - Day ${state.dayType}`;
  const latestSession = state.history[0] || null;
  const activeThemeClass = `${state.activeTab}-theme`;
  const resolvedCurrentWeight = currentExercise ? resolveWeightGuide(currentExercise.weight, state.availableWeights) : "";
  const currentExerciseImages = currentExercise ? getExerciseReferenceImageCandidates(currentExercise.name) : [];
  const currentExerciseImageIndex = currentExercise ? exerciseImageIndexes[currentExercise.name] || 0 : 0;
  const currentExerciseImage = currentExerciseImages[currentExerciseImageIndex] || currentExerciseImages.at(-1) || "";
  const sessionSummaries = useMemo(() => summarizeSessionLogs(state.logs, state.history).slice(0, 8), [state.logs, state.history]);
  const repGuideLabel = currentExercise?.isTime
    ? ""
    : isAlternateExercise(currentExercise?.name || "")
      ? `${state.repGuideSide === "left" ? "Left" : "Right"} side • ${REP_PHASES[state.repGuidePhaseIndex] || "Up"}`
      : REP_PHASES[state.repGuidePhaseIndex] || "Up";
  const syncUrlLooksLikeSpreadsheet = /docs\.google\.com\/spreadsheets/i.test(state.syncApiUrl);
  const syncTarget = getSyncApiBase(state.syncApiUrl);
  const displayedSyncIdentityEmail = authSession?.access_token ? syncIdentityEmail : "";
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
  const resetRestTimer = () => {
    setState((prev) => (prev.restTimerRunning || prev.restRemaining > 0
      ? { ...prev, restRemaining: 0, restTimerRunning: false }
      : prev));
  };
  const handleTabChange = (tab) => {
    resetRestTimer();
    updateState({ activeTab: tab });
  };
  const navigateToToday = () => {
    resetRestTimer();
    updateState({ activeTab: "today" });
  };

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

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthStatus(error.message);
      return;
    }
    setSyncIdentityEmail("");
    setSyncStatus("");
    setAuthStatus("Signed out.");
  };

  const startSession = () => {
    const sessionId = `${Date.now()}`;
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
    speakWithStyle("warm up", state.soundEnabled, "warmup");
  };

  const beginProgramAfterWarmup = () => {
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
    speakWithStyle(firstExercise?.name || "begin", state.soundEnabled, "set");
  };

  const finishSession = () => {
    const sessionRecord = {
      sessionId: state.sessionId,
      date: todayDateLabel(),
      program: state.activeProgram,
      dayType: state.dayType,
      durationMinutes: currentSessionDurationMinutes(),
      setsCompleted: state.logs.filter((x) => x.sessionId === state.sessionId).length,
      note: state.todayNote,
      availableWeights: state.availableWeights,
      warmupCompleted: state.warmupDone,
      stretchCompleted: true,
    };

    updateState({
      history: [sessionRecord, ...state.history].slice(0, 50),
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
    speakWithStyle("session complete", state.soundEnabled, "stretch");
  };

  const moveToNextStage = (restSeconds) => {
    if (!currentExercise) return;

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
      speakWithStyle(nextExercise?.name || "continue", state.soundEnabled, "set");
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
    speakWithStyle("stretch", state.soundEnabled, "stretch");
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
    };

    await saveSetLocally(entry);
    moveToNextStage(restSeconds);
  };

  const resetSession = () => {
    resetRestTimer();
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
    const rows = [SHEET_HEADERS, ...state.logs.map((log) => SHEET_HEADERS.map((header) => log[header] ?? ""))];
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

    if (state.repGuideRunning) {
      updateState({ repGuideRunning: false });
      return;
    }

    const shouldRestart = state.currentRep >= currentExercise.reps;
    const nextSide = state.currentRep === 0 || shouldRestart ? "left" : state.repGuideSide;
    updateState({
      currentRep: shouldRestart ? 0 : state.currentRep,
      repGuideRunning: true,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: REP_PHASE_DURATIONS[0],
      repGuideSide: nextSide,
    });
    speakWithStyle(getPhaseCue(REP_PHASES[0], 0), state.soundEnabled, "set");
  };

  const restartRepGuide = () => {
    resetRestTimer();
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
    if (state.setDurationRemaining === 0) {
      updateState({ setDurationRemaining: currentExercise.reps, setTimerRunning: true });
      return;
    }
    updateState({ setTimerRunning: !state.setTimerRunning });
  };

  const resetSetTimer = () => {
    resetRestTimer();
    confirmAction("Reset this timer back to the full target time?", () => {
      updateState({ setDurationRemaining: currentExercise?.reps || 0, setTimerRunning: false });
    });
  };

  const toggleRestTimer = () => {
    const restSeconds = currentExercise?.rest || DEFAULT_REST_SECONDS;
    updateState({
      restTimerRunning: !state.restTimerRunning || state.restRemaining === 0,
      restRemaining: state.restRemaining || restSeconds,
    });
  };

  const skipRest = () => {
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
            syncIdentityEmail={displayedSyncIdentityEmail}
            installReady={installReady}
            programs={PROGRAMS}
            currentProgramMeta={currentProgramMeta}
            nextWorkout={nextWorkout}
            completedTodaySets={completedTodaySets}
            latestSession={latestSession}
            installApp={installApp}
            setAuthEmail={setAuthEmail}
            startSession={startSession}
            signInWithMagicLink={signInWithMagicLink}
            signOut={signOut}
            updateState={updateState}
            syncConnected={syncConnected}
            syncTarget={syncTarget}
            syncStatus={displayedSyncStatus}
            syncUrlLooksLikeSpreadsheet={syncUrlLooksLikeSpreadsheet}
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
            syncStatus={displayedSyncStatus}
             formatSeconds={formatSeconds}
             DEFAULT_REST_SECONDS={DEFAULT_REST_SECONDS}
             onExerciseImageError={handleExerciseImageError}
             isAlternateExercise={isAlternateExercise}
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

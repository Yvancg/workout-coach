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
import { createRemoteLog, createRemoteSession, deleteRemoteSession, loadHistorySummary, updateRemoteSession } from "./lib/syncClient";
import {
  DEFAULT_REST_SECONDS,
  DEFAULT_STATE,
  PLAYFUL_LINES,
  PROGRAMS,
  REP_PHASES,
  SHEET_HEADERS,
  STORAGE_KEY,
} from "./lib/workoutData";
import {
  confirmAction,
  downloadCsv,
  formatSeconds,
  getExerciseReferenceImageCandidates,
  getNextDayType,
  getPhaseCue,
  getSyncApiBase,
  isAlternateExercise,
  loadState,
  pickLine,
  resolveWeightGuide,
  summarizeSessionLogs,
  todayDateLabel,
} from "./lib/workoutUtils";

function speakWithStyle(text, enabled, mode = "default") {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) =>
    /Google UK English Female|Google US English|Samantha|Karen|Moira|Daniel/i.test(voice.name),
  ) || voices.find((voice) => /en-/i.test(voice.lang)) || null;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (preferredVoice) utterance.voice = preferredVoice;
  utterance.lang = preferredVoice?.lang || "en-US";

  if (mode === "warmup") {
    utterance.rate = 0.86;
    utterance.pitch = 0.88;
  } else if (mode === "stretch") {
    utterance.rate = 0.82;
    utterance.pitch = 0.85;
  } else if (mode === "set") {
    utterance.rate = 0.93;
    utterance.pitch = 0.92;
  } else {
    utterance.rate = 0.9;
    utterance.pitch = 0.9;
  }

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
  const [syncStatus, setSyncStatus] = useState("");
  const [exerciseImageIndexes, setExerciseImageIndexes] = useState({});
  const [openHistoryMenuId, setOpenHistoryMenuId] = useState(null);
  const { installApp, installReady } = useInstallPrompt();
  const setTimerRef = useRef(null);
  const restTimerRef = useRef(null);
  const repGuideRef = useRef(null);

  useEffect(() => {
    const syncTarget = getSyncApiBase(state.syncApiUrl);
    if (syncTarget === null) return;

    let cancelled = false;

    async function loadRemoteSnapshot() {
      try {
        setSyncStatus("Loading Cloudflare sync...");
        const result = await loadHistorySummary(state.syncApiUrl);
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          history: Array.isArray(result.data?.history) ? result.data.history : prev.history,
        }));
        setSyncStatus("Cloudflare sync connected");
      } catch {
        if (!cancelled) setSyncStatus("Cloudflare sync unavailable. Local save only.");
      }
    }

    loadRemoteSnapshot();

    return () => {
      cancelled = true;
    };
  }, [state.syncApiUrl, setState]);

  useEffect(() => {
    if (state.setTimerRunning && state.setDurationRemaining > 0) {
      setTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.setDurationRemaining <= 1) {
            speakWithStyle("Time. Nice control.", prev.soundEnabled, prev.sessionStage === "stretch" ? "stretch" : "set");
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
            speakWithStyle(pickLine(PLAYFUL_LINES.restDone, prev.currentSet), prev.soundEnabled, "set");
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
          const nextPhase = REP_PHASES[nextPhaseIndex];
          const nextCue = nextPhase === "Wait"
            ? `${getPhaseCue(nextPhase, prev.currentRep + nextPhaseIndex)} ${pickLine(PLAYFUL_LINES.repPush, prev.currentRep + nextPhaseIndex)}`
            : getPhaseCue(nextPhase, prev.currentRep + nextPhaseIndex);
          speakWithStyle(nextCue, prev.soundEnabled, "set");
          return {
            ...prev,
            repGuidePhaseIndex: nextPhaseIndex,
            repGuidePhaseRemaining: 1,
          };
        }

        if (isAlternateExercise(exercise.name)) {
          if (prev.repGuideSide === "left") {
            speakWithStyle(`${pickLine(PLAYFUL_LINES.repPraise, prev.currentRep)} Right side. ${getPhaseCue("Up", prev.currentRep + 1)}`, prev.soundEnabled, "set");
            return {
              ...prev,
              repGuideSide: "right",
              repGuidePhaseIndex: 0,
              repGuidePhaseRemaining: 1,
            };
          }

          const nextRep = prev.currentRep + 1;
          const done = nextRep >= exercise.reps;
          speakWithStyle(done ? `Rep ${nextRep} complete. Set complete. ${pickLine(PLAYFUL_LINES.repPraise, nextRep)}` : `Rep ${nextRep} complete. ${pickLine(PLAYFUL_LINES.repPraise, nextRep)} Left side. ${getPhaseCue("Up", nextRep)}`, prev.soundEnabled, "set");

          return {
            ...prev,
            currentRep: nextRep,
            repGuideRunning: !done,
            repGuideSide: "left",
            repGuidePhaseIndex: 0,
            repGuidePhaseRemaining: done ? 0 : 1,
          };
        }

        const nextRep = prev.currentRep + 1;
        const done = nextRep >= exercise.reps;
        speakWithStyle(done ? `Rep ${nextRep} complete. Set complete. ${pickLine(PLAYFUL_LINES.repPraise, nextRep)}` : `Rep ${nextRep} complete. ${pickLine(PLAYFUL_LINES.repPraise, nextRep)} ${getPhaseCue("Up", nextRep)}`, prev.soundEnabled, "set");

        return {
          ...prev,
          currentRep: nextRep,
          repGuideRunning: !done,
          repGuidePhaseIndex: 0,
          repGuidePhaseRemaining: done ? 0 : 1,
        };
      });
    }, 1000);

    return () => clearTimeout(repGuideRef.current);
  }, [state.repGuideRunning, state.repGuidePhaseRemaining, state.repGuidePhaseIndex, state.sessionStage, state.activeProgram, state.dayType, state.exerciseIndex, setState]);

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
  const syncConnected = syncTarget !== null && /connected|synced/i.test(syncStatus || "");
  const tabs = [
    { id: "today", label: "Setup", icon: House },
    { id: "session", label: "Session", icon: Activity },
    { id: "history", label: "History", icon: History },
  ];

  const updateState = (patch) => setState((prev) => ({ ...prev, ...patch }));

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

  const syncSessionToCloudflare = async (sessionRecord) => {
    try {
      setSyncStatus("Saving session to Cloudflare...");
      const result = await createRemoteSession(state.syncApiUrl, sessionRecord);
      if (result.skipped) return;
      setSyncStatus("Synced with Cloudflare");
    } catch {
      setSyncStatus("Cloudflare sync failed. Local save only.");
    }
  };

  const deleteSessionRemote = async (sessionId) => {
    try {
      setSyncStatus("Deleting session from Cloudflare...");
      const result = await deleteRemoteSession(state.syncApiUrl, sessionId);
      if (result.skipped) return true;
      setSyncStatus("Session deleted from Cloudflare");
      return true;
    } catch {
      setSyncStatus("Cloudflare delete failed. Local session removed.");
      return false;
    }
  };

  const updateSessionRemote = async (sessionId, sessionPatch) => {
    try {
      setSyncStatus("Updating session in Cloudflare...");
      const result = await updateRemoteSession(state.syncApiUrl, sessionId, sessionPatch);
      if (result.skipped) return true;
      setSyncStatus("Session updated in Cloudflare");
      return true;
    } catch {
      setSyncStatus("Cloudflare update failed. Local session updated.");
      return false;
    }
  };

  const saveSetLocally = async (entry) => {
    const nextLogs = [...state.logs, entry];
    updateState({ logs: nextLogs });

    try {
      setSyncStatus("Saving set to Cloudflare...");
      const result = await createRemoteLog(state.syncApiUrl, entry);
      if (result.skipped) return;
      setSyncStatus("Synced with Cloudflare");
    } catch {
      setSyncStatus("Cloudflare sync failed. Local save only.");
    }
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
    speakWithStyle(`${pickLine(PLAYFUL_LINES.sessionStart, 0)} ${state.activeProgram}, day ${state.dayType}.`, state.soundEnabled, "warmup");
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
    speakWithStyle(`${pickLine(PLAYFUL_LINES.firstExercise, 0)} ${firstExercise?.name || "Begin"}.`, state.soundEnabled, "set");
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
    syncSessionToCloudflare(sessionRecord);
    runHaptic("success");
    speakWithStyle(pickLine(PLAYFUL_LINES.sessionComplete, state.history.length), state.soundEnabled, "stretch");
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
      speakWithStyle(`${pickLine(PLAYFUL_LINES.nextExercise, state.exerciseIndex)} ${nextExercise?.name || "Continue"}.`, state.soundEnabled, "set");
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
    speakWithStyle(`${pickLine(PLAYFUL_LINES.stretch, state.exerciseIndex)} ${pickLine(PLAYFUL_LINES.stretchCue, state.exerciseIndex)}`, state.soundEnabled, "stretch");
  };

  const completeSet = async () => {
    if (!currentExercise) return;

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
      tempo: currentExercise.isTime ? currentExercise.tempo : "2-2-3 voice",
      rest: DEFAULT_REST_SECONDS,
      sessionId: state.sessionId,
      durationMinutes: currentSessionDurationMinutes(),
    };

    await saveSetLocally(entry);
    moveToNextStage(DEFAULT_REST_SECONDS);
  };

  const resetSession = () => {
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
      repGuidePhaseRemaining: 1,
      repGuideSide: nextSide,
    });
    speakWithStyle(
      isAlternateExercise(currentExercise.name)
        ? `${pickLine(PLAYFUL_LINES.repPraise, state.currentRep)} ${nextSide === "left" ? "Left side" : "Right side"}. ${getPhaseCue("Up", state.currentRep)}`
        : `${pickLine(PLAYFUL_LINES.repPraise, state.currentRep)} ${getPhaseCue("Up", state.currentRep)}`,
      state.soundEnabled,
      "set",
    );
  };

  const restartRepGuide = () => {
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
    if (state.setDurationRemaining === 0) {
      updateState({ setDurationRemaining: currentExercise.reps, setTimerRunning: true });
      return;
    }
    updateState({ setTimerRunning: !state.setTimerRunning });
  };

  const resetSetTimer = () => {
    confirmAction("Reset this timer back to the full target time?", () => {
      updateState({ setDurationRemaining: currentExercise?.reps || 0, setTimerRunning: false });
    });
  };

  const skipRest = () => {
    updateState({ restRemaining: 0, restTimerRunning: false });
  };

  return (
    <div className={`app-shell ${activeThemeClass} min-h-screen bg-white text-black p-3 sm:p-6`}>
      <div className="app-stack max-w-md mx-auto space-y-4 pb-24">
        <HeroHeader todayLabel={todayDateLabel()} activeProgram={state.activeProgram} dayType={state.dayType} />

        <BottomNav tabs={tabs} activeTab={state.activeTab} onTabChange={(tab) => updateState({ activeTab: tab })} />

        {state.activeTab === "today" && (
          <TodayTab
            state={state}
            installReady={installReady}
            programs={PROGRAMS}
            currentProgramMeta={currentProgramMeta}
            nextWorkout={nextWorkout}
            completedTodaySets={completedTodaySets}
            latestSession={latestSession}
            installApp={installApp}
            startSession={startSession}
            updateState={updateState}
            syncConnected={syncConnected}
            syncTarget={syncTarget}
            syncStatus={syncStatus}
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
            syncStatus={syncStatus}
            formatSeconds={formatSeconds}
            DEFAULT_REST_SECONDS={DEFAULT_REST_SECONDS}
            onExerciseImageError={handleExerciseImageError}
            isAlternateExercise={isAlternateExercise}
            updateState={updateState}
            startSession={startSession}
            beginProgramAfterWarmup={beginProgramAfterWarmup}
            toggleRepGuide={toggleRepGuide}
            restartRepGuide={restartRepGuide}
            toggleSetTimer={toggleSetTimer}
            resetSetTimer={resetSetTimer}
            completeSet={completeSet}
            skipRest={skipRest}
            resetSession={resetSession}
            finishSession={finishSession}
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

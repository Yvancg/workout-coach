import React, { useEffect, useMemo, useRef, useState } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import {
  Activity,
  ArrowUpRight,
  Play,
  RotateCcw,
  CheckCircle2,
  TimerReset,
  Plus,
  Minus,
  Save,
  Dumbbell,
  Download,
  ChevronRight,
  Volume2,
  VolumeX,
  CalendarDays,
  Clock3,
  ListChecks,
  House,
  History,
} from "lucide-react";
import "./App.css";

const STORAGE_KEY = "yvan-workout-coach-v2";
const SHEET_HEADERS = [
  "timestamp",
  "date",
  "program",
  "dayType",
  "exercise",
  "setNumber",
  "target",
  "completed",
  "isTime",
  "weightGuide",
  "tempo",
  "rest",
  "sessionId",
  "durationMinutes",
];

const PROGRAMS = {
  "General 1-6kg": {
    description: "Balanced full-body plan using your available dumbbells.",
    A: [
      { name: "Chair Squat", sets: 3, reps: 12, weight: "8-12 kg total", tempo: "3-1-2", rest: 60, cues: ["Chest up", "Sit back", "Drive through feet"] },
      { name: "DB Chest Press", sets: 3, reps: 12, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Shoulders down", "Lower with control", "Exhale on press"] },
      { name: "DB Row", sets: 3, reps: 12, weight: "6-12 kg total", tempo: "2-1-2", rest: 60, cues: ["Flat back", "Pull elbow to hip", "Pause at top"] },
      { name: "Plank", sets: 3, reps: 30, weight: "Bodyweight", tempo: "Hold", rest: 45, isTime: true, cues: ["Ribs down", "Squeeze glutes", "Breathe slowly"] },
    ],
    B: [
      { name: "Split Squat", sets: 3, reps: 10, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Stay tall", "Front heel down", "Shorten range if needed"] },
      { name: "Shoulder Press", sets: 3, reps: 10, weight: "4-8 kg total", tempo: "2-1-2", rest: 60, cues: ["Brace core", "No leaning back", "Smooth lockout"] },
      { name: "Biceps Curl", sets: 3, reps: 12, weight: "4-8 kg total", tempo: "3-1-2", rest: 45, cues: ["Elbows still", "No swinging", "Slow lowering"] },
      { name: "Triceps Extension", sets: 3, reps: 12, weight: "4-8 kg total", tempo: "3-1-2", rest: 45, cues: ["Upper arms stable", "Full stretch", "Controlled finish"] },
      { name: "Calf Raise", sets: 3, reps: 15, weight: "Bodyweight or 4-8 kg total", tempo: "2-1-2", rest: 30, cues: ["Pause high", "Slow down", "Use wall if needed"] },
    ],
    C: [
      { name: "Goblet Squat", sets: 3, reps: 12, weight: "8-12 kg total", tempo: "3-1-2", rest: 60, cues: ["Hold dumbbell close", "Knees track toes", "Stand tall"] },
      { name: "Floor Press", sets: 3, reps: 12, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Press evenly", "Touch elbows lightly", "Exhale up"] },
      { name: "DB Row", sets: 3, reps: 12, weight: "6-12 kg total", tempo: "2-1-2", rest: 60, cues: ["Neck neutral", "Pull to hip", "Control lowering"] },
      { name: "Lateral Raise", sets: 2, reps: 15, weight: "2-4 kg total", tempo: "2-1-3", rest: 45, cues: ["Soft elbows", "Raise to shoulder height", "Do not shrug"] },
      { name: "Bicycle Crunch", sets: 3, reps: 15, weight: "Bodyweight", tempo: "Controlled", rest: 30, cues: ["Slow twist", "Exhale as you rotate", "Do not pull neck"] },
    ],
  },
  "Hypertrophy 1-6kg": {
    description: "Higher reps and slower tempo to get more out of light weights.",
    A: [
      { name: "Goblet Squat", sets: 4, reps: 20, weight: "8-12 kg total", tempo: "4-1-2", rest: 60, cues: ["Slow lowering", "Own the pause", "Stand hard"] },
      { name: "DB Chest Press", sets: 4, reps: 20, weight: "6-10 kg total", tempo: "4-1-2", rest: 60, cues: ["Constant tension", "No bouncing", "Press strong"] },
      { name: "DB Row", sets: 4, reps: 20, weight: "6-12 kg total", tempo: "3-1-2", rest: 60, cues: ["Pause and squeeze", "Keep hips square", "Slow return"] },
      { name: "Biceps Curl", sets: 3, reps: 20, weight: "4-8 kg total", tempo: "3-1-3", rest: 45, cues: ["Lift smoothly", "Slow negative", "Stay strict"] },
      { name: "Plank", sets: 3, reps: 45, weight: "Bodyweight", tempo: "Hold", rest: 45, isTime: true, cues: ["Brace abs", "Long neck", "Quiet breathing"] },
    ],
    B: [
      { name: "Reverse Lunge", sets: 4, reps: 15, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Step back softly", "Tall torso", "Drive forward"] },
      { name: "Shoulder Press", sets: 4, reps: 15, weight: "4-8 kg total", tempo: "3-1-2", rest: 60, cues: ["Core tight", "Smooth path", "No shrugging"] },
      { name: "Lateral Raise", sets: 4, reps: 20, weight: "2-4 kg total", tempo: "2-1-3", rest: 45, cues: ["Lead with elbows", "Stop at shoulder level", "Slow down"] },
      { name: "Overhead Triceps Extension", sets: 3, reps: 20, weight: "2-6 kg total", tempo: "3-1-3", rest: 45, cues: ["Full stretch", "Keep elbows tucked", "Smooth finish"] },
      { name: "Calf Raise", sets: 4, reps: 20, weight: "Bodyweight or 4-8 kg total", tempo: "3-1-2", rest: 30, cues: ["Pause top", "Slow bottom", "Stay balanced"] },
    ],
    C: [
      { name: "Split Squat", sets: 4, reps: 15, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Use support if needed", "Descend slowly", "Drive evenly"] },
      { name: "Floor Press", sets: 3, reps: 20, weight: "6-10 kg total", tempo: "3-1-2", rest: 60, cues: ["Controlled press", "Light elbow touch", "Keep wrists straight"] },
      { name: "DB Row", sets: 3, reps: 20, weight: "6-12 kg total", tempo: "3-1-2", rest: 60, cues: ["Brace trunk", "Pull clean", "Return slowly"] },
      { name: "Hammer Curl", sets: 3, reps: 20, weight: "4-8 kg total", tempo: "3-1-3", rest: 45, cues: ["Neutral grip", "No body swing", "Long lowering"] },
      { name: "Bicycle Crunch", sets: 3, reps: 20, weight: "Bodyweight", tempo: "Controlled", rest: 30, cues: ["Move slowly", "Twist through trunk", "Breathe out"] },
    ],
  },
  "Sandow 5lb": {
    description: "A lighter classical routine inspired by early physical culture.",
    A: [
      { name: "Biceps Curl", sets: 2, reps: 50, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Full control", "No momentum", "Rhythmic breathing"] },
      { name: "Reverse Curl", sets: 2, reps: 25, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Palms down", "Elbows quiet", "Smooth rhythm"] },
      { name: "Lateral Raise", sets: 2, reps: 20, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Lift clean", "No shrug", "Control down"] },
      { name: "Chair Squat", sets: 2, reps: 20, weight: "Bodyweight", tempo: "Smooth", rest: 30, cues: ["Stand tall", "Easy rhythm", "Do not rush"] },
      { name: "Calf Raise", sets: 2, reps: 30, weight: "Bodyweight", tempo: "Smooth", rest: 30, cues: ["Rise fully", "Pause top", "Smooth lower"] },
    ],
    B: [
      { name: "Shoulder Press", sets: 2, reps: 25, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Smooth arc", "Core tight", "Steady breathing"] },
      { name: "Front Raise", sets: 2, reps: 15, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Shoulder height only", "No swing", "Lower slow"] },
      { name: "DB Row", sets: 2, reps: 20, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Pull clean", "Pause top", "Stay long through spine"] },
      { name: "Side Bend", sets: 2, reps: 20, weight: "2.3 kg in one hand", tempo: "Controlled", rest: 30, cues: ["Small range", "Do not collapse", "Move gently"] },
      { name: "Push-Up", sets: 2, reps: 10, weight: "Bodyweight", tempo: "Controlled", rest: 30, cues: ["Elevate hands if needed", "Body straight", "Smooth press"] },
    ],
    C: [
      { name: "Biceps Curl", sets: 1, reps: 50, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Long set", "Stay calm", "Smooth rhythm"] },
      { name: "Lateral Raise", sets: 1, reps: 20, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Strict motion", "No shrugging", "Lower softly"] },
      { name: "Shoulder Press", sets: 1, reps: 25, weight: "2.3 kg each hand", tempo: "Smooth", rest: 30, cues: ["Steady pace", "Brace lightly", "Exhale up"] },
      { name: "Pullover", sets: 1, reps: 20, weight: "2.3 kg total", tempo: "Smooth", rest: 30, cues: ["Gentle arc", "No shoulder pain", "Keep ribs quiet"] },
      { name: "Chair Squat", sets: 1, reps: 25, weight: "Bodyweight", tempo: "Smooth", rest: 30, cues: ["Comfortable range", "Rhythmic pace", "Stand tall"] },
    ],
  },
  "Testosterone 50+": {
    description: "A strength-focused plan built around larger muscle groups and recovery habits after 50.",
    A: [
      { name: "Goblet Squat", sets: 3, reps: 10, weight: "10-12 kg total", tempo: "2-1-2", rest: 90, cues: ["Use your heaviest safe load", "Stand hard", "Control depth"] },
      { name: "DB Row", sets: 3, reps: 10, weight: "8-12 kg total", tempo: "2-1-2", rest: 90, cues: ["Strong pull", "Pause top", "Own the lowering"] },
      { name: "DB Chest Press", sets: 3, reps: 10, weight: "8-12 kg total", tempo: "2-1-2", rest: 90, cues: ["Big exhale up", "Keep shoulders packed", "Move cleanly"] },
      { name: "Farmer Carry", sets: 3, reps: 40, weight: "10-12 kg total", tempo: "Walk", rest: 60, isTime: true, cues: ["Walk tall", "Tight grip", "Slow breathing"] },
      { name: "Plank", sets: 3, reps: 30, weight: "Bodyweight", tempo: "Hold", rest: 45, isTime: true, cues: ["Brace firm", "Long spine", "Do not sag"] },
    ],
    B: [
      { name: "Step-Up", sets: 3, reps: 10, weight: "6-10 kg total", tempo: "2-1-2", rest: 90, cues: ["Stable foot", "Drive through heel", "Control down"] },
      { name: "Shoulder Press", sets: 3, reps: 10, weight: "6-10 kg total", tempo: "2-1-2", rest: 90, cues: ["Core tight", "No lean", "Press smoothly"] },
      { name: "Biceps Curl", sets: 2, reps: 12, weight: "4-8 kg total", tempo: "2-1-2", rest: 60, cues: ["No swinging", "Elbows stable", "Slow down"] },
      { name: "Triceps Extension", sets: 2, reps: 12, weight: "4-8 kg total", tempo: "2-1-2", rest: 60, cues: ["Upper arms stay fixed", "Smooth stretch", "Controlled finish"] },
      { name: "Walk / March", sets: 1, reps: 1200, weight: "Bodyweight", tempo: "Zone 2", rest: 0, isTime: true, cues: ["Nasal breathing if possible", "Keep moving", "Easy steady pace"] },
    ],
    C: [
      { name: "Split Squat", sets: 3, reps: 10, weight: "6-10 kg total", tempo: "2-1-2", rest: 90, cues: ["Stay tall", "Use support if needed", "Controlled pace"] },
      { name: "Floor Press", sets: 3, reps: 10, weight: "8-12 kg total", tempo: "2-1-2", rest: 90, cues: ["Even press", "Wrist straight", "Own the lowering"] },
      { name: "DB Row", sets: 3, reps: 10, weight: "8-12 kg total", tempo: "2-1-2", rest: 90, cues: ["Pull to hip", "No twisting", "Stay strict"] },
      { name: "Calf Raise", sets: 3, reps: 15, weight: "Bodyweight or 4-8 kg total", tempo: "2-1-2", rest: 45, cues: ["Full range", "Pause top", "Slow descent"] },
      { name: "Plank", sets: 3, reps: 40, weight: "Bodyweight", tempo: "Hold", rest: 45, isTime: true, cues: ["Firm brace", "Quiet breathing", "Long body line"] },
    ],
  },
};

const DEFAULT_STATE = {
  activeProgram: "General 1-6kg",
  dayType: "A",
  exerciseIndex: 0,
  currentSet: 1,
  currentRep: 0,
  setDurationRemaining: 0,
  setTimerRunning: false,
  restRemaining: 0,
  restTimerRunning: false,
  warmupDone: false,
  sessionStartedAt: null,
  sessionId: null,
  logs: [],
  sheetWebhookUrl: "",
  soundEnabled: true,
  installReady: false,
  history: [],
  todayNote: "",
  activeTab: "today",
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function formatSeconds(total) {
  const safe = Math.max(0, Number(total) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function todayDateLabel() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getNextDayType(current) {
  if (current === "A") return "B";
  if (current === "B") return "C";
  return "A";
}

function speak(text, enabled) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function csvEscape(value) {
  const v = String(value ?? "");
  return `"${v.replaceAll('"', '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

function Card({ className = "", children, ...props }) {
  return <div className={`surface ${className}`.trim()} {...props}>{children}</div>;
}

function CardHeader({ className = "", children, ...props }) {
  return <div className={`section-header ${className}`.trim()} {...props}>{children}</div>;
}

function CardTitle({ className = "", children, ...props }) {
  return <h2 className={`section-title ${className}`.trim()} {...props}>{children}</h2>;
}

function CardContent({ className = "", children, ...props }) {
  return <div className={`section-content ${className}`.trim()} {...props}>{children}</div>;
}

function Button({ className = "", children, ...props }) {
  return (
    <button className={`ui-button ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

function Input({ className = "", ...props }) {
  return <input className={`ui-input ${className}`.trim()} {...props} />;
}

function Progress({ value = 0, className = "", ...props }) {
  return (
    <div className={`progress-track ${className}`.trim()} {...props}>
      <div
        className="progress-fill"
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
        }}
      />
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [sheetStatus, setSheetStatus] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const setTimerRef = useRef(null);
  const restTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setState((prev) => ({ ...prev, installReady: true }));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (state.setTimerRunning && state.setDurationRemaining > 0) {
      setTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.setDurationRemaining <= 1) {
            speak("Time", prev.soundEnabled);
            return { ...prev, setDurationRemaining: 0, setTimerRunning: false };
          }
          return { ...prev, setDurationRemaining: prev.setDurationRemaining - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(setTimerRef.current);
  }, [state.setTimerRunning, state.setDurationRemaining, state.soundEnabled]);

  useEffect(() => {
    if (state.restTimerRunning && state.restRemaining > 0) {
      restTimerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.restRemaining <= 1) {
            speak("Rest over. Next set.", prev.soundEnabled);
            return { ...prev, restRemaining: 0, restTimerRunning: false };
          }
          return { ...prev, restRemaining: prev.restRemaining - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restTimerRef.current);
  }, [state.restTimerRunning, state.restRemaining, state.soundEnabled]);

  const exercises = useMemo(() => PROGRAMS[state.activeProgram][state.dayType] || [], [state.activeProgram, state.dayType]);
  const currentProgramMeta = useMemo(() => PROGRAMS[state.activeProgram], [state.activeProgram]);
  const currentExercise = exercises[state.exerciseIndex] || null;
  const sessionProgress = exercises.length
    ? ((state.exerciseIndex + (state.currentSet - 1) / (currentExercise?.sets || 1)) / exercises.length) * 100
    : 0;
  const completedTodaySets = useMemo(
    () => state.logs.filter((log) => log.date === todayDateLabel()).length,
    [state.logs],
  );
  const nextWorkout = `${state.activeProgram} - Day ${state.dayType}`;
  const latestSession = state.history[0] || null;
  const tabs = [
    { id: "today", label: "Today", icon: House },
    { id: "session", label: "Session", icon: Activity },
    { id: "history", label: "History", icon: History },
  ];

  const updateState = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const startSession = () => {
    const sessionId = `${Date.now()}`;
    updateState({
      sessionStartedAt: new Date().toISOString(),
      sessionId,
      activeTab: "session",
      exerciseIndex: 0,
      currentSet: 1,
      currentRep: 0,
      setDurationRemaining: PROGRAMS[state.activeProgram][state.dayType]?.[0]?.isTime
        ? PROGRAMS[state.activeProgram][state.dayType][0].reps
        : 0,
      setTimerRunning: false,
      restRemaining: 0,
      restTimerRunning: false,
    });
    runHaptic("medium");
    speak(`Session started. ${state.activeProgram}, day ${state.dayType}.`, state.soundEnabled);
  };

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    updateState({ installReady: false });
  };

  const saveSetLocally = async (entry) => {
    const nextLogs = [...state.logs, entry];
    updateState({ logs: nextLogs });

    if (!state.sheetWebhookUrl) return;
    try {
      setSheetStatus("Saving to Google Sheets...");
      const response = await fetch(state.sheetWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error("sync failed");
      setSheetStatus("Saved to Google Sheets");
    } catch {
      setSheetStatus("Local save only. Google Sheets sync failed");
    }
  };

  const currentSessionDurationMinutes = () => {
    if (!state.sessionStartedAt) return "";
    return Math.max(1, Math.round((Date.now() - new Date(state.sessionStartedAt).getTime()) / 60000));
  };

  const moveToNextStage = (restSeconds) => {
    if (!currentExercise) return;

    if (state.currentSet < currentExercise.sets) {
      updateState({
        currentSet: state.currentSet + 1,
        currentRep: 0,
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
        setDurationRemaining: nextExercise?.isTime ? nextExercise.reps : 0,
        setTimerRunning: false,
        restRemaining: restSeconds,
        restTimerRunning: restSeconds > 0,
      });
      speak(`Next exercise. ${nextExercise?.name || "Continue"}.`, state.soundEnabled);
      return;
    }

    const sessionRecord = {
      sessionId: state.sessionId,
      date: todayDateLabel(),
      program: state.activeProgram,
      dayType: state.dayType,
      durationMinutes: currentSessionDurationMinutes(),
      setsCompleted: state.logs.filter((x) => x.sessionId === state.sessionId).length + 1,
    };
    updateState({
      history: [sessionRecord, ...state.history].slice(0, 50),
      activeTab: "history",
      restRemaining: 0,
      restTimerRunning: false,
      setDurationRemaining: 0,
      setTimerRunning: false,
      dayType: getNextDayType(state.dayType),
    });
    runHaptic("success");
    speak("Session complete. Good work.", state.soundEnabled);
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
      weightGuide: currentExercise.weight,
      tempo: currentExercise.tempo,
      rest: currentExercise.rest,
      sessionId: state.sessionId,
      durationMinutes: currentSessionDurationMinutes(),
    };

    await saveSetLocally(entry);
    moveToNextStage(currentExercise.rest);
  };

  const resetSession = () => {
    runHaptic("light");
    updateState({
      exerciseIndex: 0,
      currentSet: 1,
      currentRep: 0,
      setDurationRemaining: currentExercise?.isTime ? currentExercise.reps : 0,
      setTimerRunning: false,
      restRemaining: 0,
      restTimerRunning: false,
      warmupDone: false,
      sessionStartedAt: null,
      sessionId: null,
    });
  };

  const nextRep = () => {
    runHaptic("light");
    updateState({ currentRep: state.currentRep + 1 });
    if ((state.currentRep + 1) % 5 === 0) speak(String(state.currentRep + 1), state.soundEnabled);
  };

  const prevRep = () => {
    runHaptic("light");
    updateState({ currentRep: Math.max(0, state.currentRep - 1) });
  };

  const exportLogs = () => {
    const rows = [SHEET_HEADERS, ...state.logs.map((log) => SHEET_HEADERS.map((h) => log[h] ?? ""))];
    downloadCsv(`workout-log-${todayDateLabel()}.csv`, rows);
  };

  const clearAllData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
    setSheetStatus("");
  };

  const toggleSetTimer = () => {
    if (!currentExercise?.isTime) return;
    if (state.setDurationRemaining === 0) {
      updateState({ setDurationRemaining: currentExercise.reps, setTimerRunning: true });
      return;
    }
    updateState({ setTimerRunning: !state.setTimerRunning });
  };

  return (
    <div className="app-shell min-h-screen bg-white text-black p-3 sm:p-6">
      <div className="app-stack max-w-md mx-auto space-y-4 pb-24">
        <div className="hero-card border-4 border-black rounded-3xl p-4">
          <div className="eyebrow">Workout Coach</div>
          <h1 className="text-3xl font-black tracking-tight">Minimal training flow, tuned for Android.</h1>
          <p className="hero-copy text-base font-semibold mt-2">A calmer app shell with faster access to today&apos;s plan, active session controls, and history.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {todayDateLabel()}</div>
            <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black flex items-center gap-2"><ListChecks className="h-4 w-4" /> {state.activeProgram}</div>
            <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black">Day {state.dayType}</div>
          </div>
        </div>

        <div className="tab-bar-mobile surface rounded-3xl p-3">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = state.activeTab === tab.id;

            return (
              <Button
                key={tab.id}
                className={`tab-button ${isActive ? "tab-button-active bg-black text-white" : "bg-white text-black"}`}
                onClick={() => updateState({ activeTab: tab.id })}
              >
                <span className="tab-icon-wrap"><Icon className="h-5 w-5" /></span>
                <span>{tab.label}</span>
              </Button>
            );
          })}
        </div>

        {state.activeTab === "today" && (
          <>
            <Card className="border-4 border-black rounded-3xl shadow-none">
              <CardContent className="p-4 space-y-3">
                <div className="split-header">
                  <div>
                    <div className="eyebrow">Today</div>
                    <div className="text-2xl font-black">Ready for {nextWorkout}</div>
                  </div>
                  <div className="status-pill bg-black text-white">{completedTodaySets} sets logged</div>
                </div>
                <div className="stats-grid compact-grid">
                  <div className="border-4 border-black rounded-2xl p-3 bg-white text-black">
                    <div className="text-sm font-black">Current focus</div>
                    <div className="text-lg font-black mt-1">{state.activeProgram}</div>
                    <div className="text-sm font-semibold">{currentProgramMeta.description}</div>
                  </div>
                  <div className="border-4 border-black rounded-2xl p-3 bg-white text-black">
                    <div className="text-sm font-black">Last session</div>
                    <div className="text-lg font-black mt-1">{latestSession ? `${latestSession.durationMinutes} min` : "No history yet"}</div>
                    <div className="text-sm font-semibold">{latestSession ? `${latestSession.program} - Day ${latestSession.dayType}` : "Complete a workout to see trends."}</div>
                  </div>
                </div>
                <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl bg-black text-white" onClick={startSession}>
                  <Play className="mr-2 h-5 w-5" /> Start today&apos;s session
                </Button>
              </CardContent>
            </Card>

            {state.installReady && (
              <Card className="border-4 border-black rounded-3xl shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="split-header">
                    <div>
                      <div className="eyebrow">Install</div>
                      <div className="text-xl font-black">Add to Android home screen</div>
                    </div>
                    <div className="status-pill">PWA ready</div>
                  </div>
                  <div className="text-sm font-bold">Use the install button below. This works when the app is deployed as a PWA.</div>
                  <Button className="w-full h-14 text-xl font-black border-4 border-black rounded-2xl bg-black text-white" onClick={installApp}>
                    <Download className="mr-2 h-5 w-5" /> Install App
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-4 border-black rounded-3xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl font-black">Session Setup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="block text-sm font-black mb-1">Program</label>
                  <select
                    className="w-full border-4 border-black rounded-2xl p-3 text-lg font-bold"
                    value={state.activeProgram}
                    onChange={(e) => updateState({ activeProgram: e.target.value, exerciseIndex: 0, currentSet: 1, currentRep: 0 })}
                  >
                    {Object.keys(PROGRAMS).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-sm font-bold">{currentProgramMeta.description}</p>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1">Day</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["A", "B", "C"].map((day) => (
                      <Button
                        key={day}
                        className={`h-14 text-2xl font-black border-4 border-black rounded-2xl ${state.dayType === day ? "bg-black text-white" : "bg-white text-black"}`}
                        onClick={() => updateState({ dayType: day, exerciseIndex: 0, currentSet: 1, currentRep: 0 })}
                      >
                        {day}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1">Optional Google Sheets webhook URL</label>
                  <Input
                    className="border-4 border-black rounded-2xl p-3 text-sm font-semibold"
                    placeholder="Paste your Apps Script web app URL"
                    value={state.sheetWebhookUrl}
                    onChange={(e) => updateState({ sheetWebhookUrl: e.target.value })}
                  />
                  <p className="mt-1 text-xs font-semibold">If you leave this blank, the app still works and saves locally on the phone.</p>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1">Session note</label>
                  <Input
                    className="border-4 border-black rounded-2xl p-3 text-sm font-semibold"
                    placeholder="Optional note for today"
                    value={state.todayNote}
                    onChange={(e) => updateState({ todayNote: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className={`h-14 text-lg font-black border-4 border-black rounded-2xl ${state.soundEnabled ? "bg-black text-white" : "bg-white text-black"}`}
                    onClick={() => updateState({ soundEnabled: !state.soundEnabled })}
                  >
                    {state.soundEnabled ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />} {state.soundEnabled ? "Voice On" : "Voice Off"}
                  </Button>
                  <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={() => updateState({ activeTab: "session" })}>
                    <ArrowUpRight className="mr-2 h-5 w-5" /> Open Session
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-4 border-black rounded-3xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl font-black">Warm Up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="aspect-video rounded-2xl overflow-hidden border-4 border-black">
                  <iframe
                    className="w-full h-full"
                    src="https://www.youtube.com/embed/7PsInjpX_LM"
                    title="Warm up video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <Button
                  className={`w-full h-14 text-xl font-black border-4 border-black rounded-2xl ${state.warmupDone ? "bg-black text-white" : "bg-white text-black"}`}
                  onClick={() => updateState({ warmupDone: !state.warmupDone })}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" /> {state.warmupDone ? "Warm Up Done" : "Mark Warm Up Done"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {state.activeTab === "session" && (
          <>
            <Card className="border-4 border-black rounded-3xl shadow-none">
              <CardHeader>
                <CardTitle className="text-2xl font-black">Program of the Day</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="split-header">
                  <div>
                    <div className="eyebrow">Live session</div>
                    <div className="text-lg font-black">{currentExercise ? currentExercise.name : "Choose a workout to begin"}</div>
                  </div>
                  <div className="status-pill">{Math.round(sessionProgress)}% done</div>
                </div>
                <Progress value={sessionProgress} className="h-4 border-2 border-black" />
                <div className="space-y-2 compact-list">
                  {exercises.map((exercise, idx) => (
                    <div
                      key={`${exercise.name}-${idx}`}
                      className={`border-4 rounded-2xl p-3 ${idx === state.exerciseIndex ? "border-black bg-black text-white" : "border-black bg-white text-black"}`}
                    >
                      <div className="text-lg font-black">{exercise.name}</div>
                      <div className="text-sm font-bold">{exercise.sets} sets • {exercise.reps} {exercise.isTime ? "sec" : "reps"} • {exercise.weight}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {currentExercise && (
              <Card className="border-4 border-black rounded-3xl shadow-none">
                <CardHeader>
                  <CardTitle className="text-2xl font-black">Current Exercise</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-4 border-black rounded-3xl p-4 bg-black text-white">
                    <div className="text-3xl font-black leading-tight">{currentExercise.name}</div>
                    <div className="mt-2 text-lg font-bold">Set {state.currentSet} / {currentExercise.sets}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-4 border-black rounded-2xl p-3">
                      <div className="text-sm font-black">Weight to use</div>
                      <div className="text-2xl font-black mt-1 flex items-center gap-2"><Dumbbell className="h-6 w-6" /> {currentExercise.weight}</div>
                    </div>
                    <div className="border-4 border-black rounded-2xl p-3">
                      <div className="text-sm font-black">Tempo / Rest</div>
                      <div className="text-2xl font-black mt-1">{currentExercise.tempo}</div>
                      <div className="text-lg font-bold">{currentExercise.rest}s rest</div>
                    </div>
                  </div>

                  <div className="border-4 border-black rounded-2xl p-3">
                    <div className="text-sm font-black mb-2">Coaching cues</div>
                    <ul className="space-y-1">
                      {currentExercise.cues?.map((cue) => (
                        <li key={cue} className="text-base font-bold flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-1" /> {cue}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-4 border-black rounded-3xl p-4 text-center">
                    <div className="text-sm font-black">{currentExercise.isTime ? "Target time" : "Target reps"}</div>
                    <div className="text-5xl font-black mt-2">{currentExercise.isTime ? formatSeconds(currentExercise.reps) : currentExercise.reps}</div>
                  </div>

                  {!currentExercise.isTime ? (
                    <div className="border-4 border-black rounded-3xl p-4 text-center space-y-3">
                      <div className="text-sm font-black">Rep counter</div>
                      <div className="text-6xl font-black">{state.currentRep}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button className="h-16 text-2xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={prevRep}>
                          <Minus className="mr-2 h-5 w-5" /> Rep
                        </Button>
                        <Button className="h-16 text-2xl font-black border-4 border-black rounded-2xl bg-black text-white" onClick={nextRep}>
                          <Plus className="mr-2 h-5 w-5" /> Rep
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-4 border-black rounded-3xl p-4 text-center space-y-3">
                      <div className="text-sm font-black">Set timer</div>
                      <div className="text-6xl font-black">{formatSeconds(state.setDurationRemaining || currentExercise.reps)}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-black text-white" onClick={toggleSetTimer}>
                          <Clock3 className="mr-2 h-5 w-5" /> {state.setTimerRunning ? "Pause" : "Start"}
                        </Button>
                        <Button
                          className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                          onClick={() => updateState({ setDurationRemaining: currentExercise.reps, setTimerRunning: false })}
                        >
                          <RotateCcw className="mr-2 h-5 w-5" /> Reset
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button className="w-full h-16 text-2xl font-black border-4 border-black rounded-2xl bg-black text-white" onClick={completeSet}>
                    <Save className="mr-2 h-5 w-5" /> Complete Set and Save
                  </Button>

                  <div className="border-4 border-black rounded-3xl p-4 text-center space-y-2">
                    <div className="text-sm font-black">Rest timer</div>
                    <div className="text-6xl font-black">{formatSeconds(state.restRemaining)}</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                        onClick={() => updateState({ restTimerRunning: !state.restTimerRunning || state.restRemaining === 0, restRemaining: state.restRemaining || currentExercise.rest })}
                      >
                        <TimerReset className="mr-2 h-5 w-5" /> {state.restTimerRunning ? "Pause" : "Start"}
                      </Button>
                      <Button
                        className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                        onClick={() => updateState({ restRemaining: currentExercise.rest, restTimerRunning: false })}
                      >
                        <RotateCcw className="mr-2 h-5 w-5" /> Reset
                      </Button>
                    </div>
                  </div>

                  {sheetStatus && <div className="text-sm font-black">{sheetStatus}</div>}
                </CardContent>
              </Card>
            )}

            <Card className="border-4 border-black rounded-3xl shadow-none">
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSession}>
                    <RotateCcw className="mr-2 h-5 w-5" /> Reset Session
                  </Button>
                  <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={() => updateState({ activeTab: "today" })}>
                    <House className="mr-2 h-5 w-5" /> Back to Today
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {state.activeTab === "history" && (
          <Card className="border-4 border-black rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl font-black">Session Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {state.logs.length === 0 ? (
                <div className="border-4 border-black rounded-2xl p-4 text-lg font-bold">No sets saved yet.</div>
              ) : (
                state.logs.slice().reverse().slice(0, 12).map((log, idx) => (
                  <div key={`${log.timestamp}-${idx}`} className="border-4 border-black rounded-2xl p-3">
                    <div className="text-lg font-black">{log.exercise} • Set {log.setNumber}</div>
                    <div className="text-sm font-bold">{log.completed} / {log.target} {log.isTime ? "sec" : "reps"} • {log.weightGuide}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {state.activeTab === "history" && (
          <Card className="border-4 border-black rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl font-black">History and Export</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-black text-white" onClick={exportLogs}>
                  <Download className="mr-2 h-5 w-5" /> Export CSV
                </Button>
                <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSession}>
                  <RotateCcw className="mr-2 h-5 w-5" /> Reset Session
                </Button>
              </div>
              <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={clearAllData}>
                Clear All Local Data
              </Button>
              <div className="space-y-2">
                {state.history.length === 0 ? (
                  <div className="border-4 border-black rounded-2xl p-4 text-base font-bold">No completed sessions yet.</div>
                ) : (
                  state.history.slice(0, 8).map((item, idx) => (
                    <div key={`${item.sessionId}-${idx}`} className="border-4 border-black rounded-2xl p-3">
                      <div className="text-lg font-black">{item.date} • {item.program}</div>
                      <div className="text-sm font-bold">Day {item.dayType} • {item.durationMinutes} min • {item.setsCompleted} sets</div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {state.activeTab === "history" && (
          <Card className="border-4 border-black rounded-3xl shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl font-black">Android Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm font-bold">
              <div className="border-4 border-black rounded-2xl p-3">Frontend: React app deployed on Cloudflare Pages free plan.</div>
              <div className="border-4 border-black rounded-2xl p-3">PWA: manifest + service worker for installable Android support and offline shell.</div>
              <div className="border-4 border-black rounded-2xl p-3">Capacitor: Android wrapper can package the same UI as a native app shell.</div>
              <div className="border-4 border-black rounded-2xl p-3">Data sync: Google Apps Script or local storage with CSV export.</div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

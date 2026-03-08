import React, { useEffect, useMemo, useRef, useState } from "react";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import {
  Activity,
  ArrowUpRight,
  Play,
  RotateCcw,
  CheckCircle2,
  TimerReset,
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
const DEFAULT_REST_SECONDS = 30;
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
  syncApiUrl: import.meta.env.VITE_SYNC_API_URL || "",
  soundEnabled: true,
  installReady: false,
  history: [],
  todayNote: "",
  activeTab: "today",
  availableWeights: "1, 2, 3, 4, 5, 6",
  sessionStage: "idle",
  stretchDone: false,
  repGuideRunning: false,
  repGuidePhaseIndex: 0,
  repGuidePhaseRemaining: 0,
  repGuideSide: "left",
};

const REP_PHASES = ["Up", "2", "Hold", "Hold", "Lower", "2", "3", "Wait"];

const EXERCISE_REFERENCES = {
  "Chair Squat": "https://athlemove.com/exercises/squat/",
  "Goblet Squat": "https://athlemove.com/exercises/goblet-squat/",
  "Split Squat": "https://athlemove.com/exercises/bulgarian-split-squat/",
  "Reverse Lunge": "https://athlemove.com/exercises/reverse-lunge/",
  "Step-Up": "https://athlemove.com/exercises/step-up/",
  "DB Chest Press": "https://athlemove.com/exercises/dumbbell-bench-press/",
  "Floor Press": "https://athlemove.com/exercises/dumbbell-floor-press/",
  "DB Row": "https://athlemove.com/exercises/one-arm-dumbbell-row/",
  "Shoulder Press": "https://athlemove.com/exercises/dumbbell-shoulder-press/",
  "Lateral Raise": "https://athlemove.com/exercises/lateral-raise/",
  "Front Raise": "https://athlemove.com/exercises/front-raise/",
  "Biceps Curl": "https://athlemove.com/exercises/dumbbell-biceps-curl/",
  "Hammer Curl": "https://athlemove.com/exercises/hammer-curl/",
  "Reverse Curl": "https://athlemove.com/exercises/reverse-curl/",
  "Triceps Extension": "https://athlemove.com/exercises/overhead-triceps-extension/",
  "Overhead Triceps Extension": "https://athlemove.com/exercises/overhead-triceps-extension/",
  "Calf Raise": "https://athlemove.com/exercises/calf-raise/",
  Plank: "https://athlemove.com/exercises/plank/",
  "Bicycle Crunch": "https://athlemove.com/exercises/bicycle-crunch/",
  Pullover: "https://athlemove.com/exercises/dumbbell-pullover/",
  "Side Bend": "https://athlemove.com/exercises/side-bend/",
  "Farmer Carry": "https://athlemove.com/exercises/farmers-carry/",
  "Walk / March": "https://athlemove.com/exercises/march/",
  "Push-Up": "https://athlemove.com/exercises/push-up/",
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

function isAlternateExercise(name = "") {
  return /(split squat|reverse lunge|step-up|side bend|bicycle crunch)/i.test(name);
}

function parseAvailableWeights(input = "") {
  return input
    .split(",")
    .map((value) => Number.parseFloat(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
}

function chooseClosest(values, target) {
  return values.reduce((best, current) => (
    Math.abs(current - target) < Math.abs(best - target) ? current : best
  ), values[0]);
}

function resolveWeightGuide(guide, availableWeightsInput) {
  const availableWeights = parseAvailableWeights(availableWeightsInput);
  const hasBodyweight = /bodyweight/i.test(guide);

  if (!availableWeights.length) return guide;

  const totalRangeMatch = guide.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*kg total/i);
  if (totalRangeMatch) {
    const min = Number.parseFloat(totalRangeMatch[1]);
    const max = Number.parseFloat(totalRangeMatch[2]);
    const pairOptions = availableWeights.map((weight) => ({ single: weight, total: weight * 2 }));
    const inRange = pairOptions.filter((option) => option.total >= min && option.total <= max);
    const pick = inRange.at(-1) || pairOptions.reduce((best, option) => (
      Math.abs(option.total - (min + max) / 2) < Math.abs(best.total - (min + max) / 2) ? option : best
    ), pairOptions[0]);

    const resolved = `${pick.single} kg each hand (${pick.total} kg total)`;
    return hasBodyweight ? `Bodyweight or ${resolved}` : resolved;
  }

  const eachHandMatch = guide.match(/(\d+(?:\.\d+)?)\s*kg each hand/i);
  if (eachHandMatch) {
    const target = Number.parseFloat(eachHandMatch[1]);
    const pick = chooseClosest(availableWeights, target);
    return `${pick} kg each hand`;
  }

  const oneHandMatch = guide.match(/(\d+(?:\.\d+)?)\s*kg in one hand/i);
  if (oneHandMatch) {
    const target = Number.parseFloat(oneHandMatch[1]);
    const pick = chooseClosest(availableWeights, target);
    return `${pick} kg in one hand`;
  }

  if (hasBodyweight) return "Bodyweight";

  return guide;
}

function getExerciseReferenceUrl(name = "") {
  return EXERCISE_REFERENCES[name] || `https://www.google.com/search?q=${encodeURIComponent(`site:athlemove.com/exercises ${name}`)}`;
}

function getExerciseReferenceImage(name = "") {
  const slug = name
    .toLowerCase()
    .replaceAll("/", "-")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `/exercise-reference/${slug}.svg`;
}

function summarizeSessionLogs(logs, sessions) {
  const grouped = sessions.map((session) => {
    const sessionLogs = logs.filter((log) => log.sessionId === session.sessionId);
    const byExercise = sessionLogs.reduce((acc, log) => {
      const key = log.exercise;
      if (!acc[key]) {
        acc[key] = {
          exercise: log.exercise,
          sets: 0,
          completed: 0,
          target: log.target,
          isTime: log.isTime,
        };
      }
      acc[key].sets += 1;
      acc[key].completed += Number(log.completed) || 0;
      return acc;
    }, {});

    return {
      ...session,
      exercises: Object.values(byExercise),
    };
  });

  if (grouped.length) return grouped;

  const fallbackGrouped = Object.values(logs.reduce((acc, log) => {
    const sessionId = log.sessionId || `${log.date}-${log.program}-${log.dayType}`;
    if (!acc[sessionId]) {
      acc[sessionId] = {
        sessionId,
        date: log.date,
        program: log.program,
        dayType: log.dayType,
        durationMinutes: log.durationMinutes,
        setsCompleted: 0,
        exercises: [],
      };
    }
    acc[sessionId].setsCompleted += 1;
    const existing = acc[sessionId].exercises.find((item) => item.exercise === log.exercise);
    if (existing) {
      existing.sets += 1;
      existing.completed += Number(log.completed) || 0;
    } else {
      acc[sessionId].exercises.push({
        exercise: log.exercise,
        sets: 1,
        completed: Number(log.completed) || 0,
        target: log.target,
        isTime: log.isTime,
      });
    }
    return acc;
  }, {}));

  return fallbackGrouped.slice().reverse();
}

function confirmAction(message, callback) {
  if (typeof window === "undefined" || window.confirm(message)) {
    callback();
  }
}

function normalizeApiBase(url = "") {
  return url.trim().replace(/\/$/, "");
}

function getSyncApiBase(url = "") {
  const normalized = normalizeApiBase(url);
  if (normalized) return normalized;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "";
  }

  return null;
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
  const [syncStatus, setSyncStatus] = useState("");
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const setTimerRef = useRef(null);
  const restTimerRef = useRef(null);
  const repGuideRef = useRef(null);

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
    const apiBase = getSyncApiBase(state.syncApiUrl);
    if (apiBase === null) return;

    let cancelled = false;

    async function loadRemoteSnapshot() {
      try {
        setSyncStatus("Loading Cloudflare sync...");
        const response = await fetch(`${apiBase}/api/snapshot`);
        if (!response.ok) throw new Error("snapshot failed");

        const payload = await response.json();
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          logs: Array.isArray(payload.logs) ? payload.logs : prev.logs,
          history: Array.isArray(payload.history) ? payload.history : prev.history,
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
  }, [state.syncApiUrl]);

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
          speak(REP_PHASES[nextPhaseIndex], prev.soundEnabled);
          return {
            ...prev,
            repGuidePhaseIndex: nextPhaseIndex,
            repGuidePhaseRemaining: 1,
          };
        }

        if (isAlternateExercise(exercise.name)) {
          if (prev.repGuideSide === "left") {
            speak("Right. Up", prev.soundEnabled);
            return {
              ...prev,
              repGuideSide: "right",
              repGuidePhaseIndex: 0,
              repGuidePhaseRemaining: 1,
            };
          }

          const nextRep = prev.currentRep + 1;
          const done = nextRep >= exercise.reps;
          speak(done ? `Rep ${nextRep} complete. Set complete.` : `Rep ${nextRep} complete. Left. Up`, prev.soundEnabled);

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
        speak(done ? `Rep ${nextRep} complete. Set complete.` : `Rep ${nextRep} complete. Up`, prev.soundEnabled);

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
  }, [state.repGuideRunning, state.repGuidePhaseRemaining, state.repGuidePhaseIndex, state.sessionStage, state.activeProgram, state.dayType, state.exerciseIndex]);

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
  const currentExerciseReference = currentExercise ? getExerciseReferenceUrl(currentExercise.name) : "";
  const currentExerciseImage = currentExercise ? getExerciseReferenceImage(currentExercise.name) : "";
  const sessionSummaries = useMemo(() => summarizeSessionLogs(state.logs, state.history).slice(0, 8), [state.logs, state.history]);
  const repGuideLabel = currentExercise?.isTime
    ? ""
    : isAlternateExercise(currentExercise?.name || "")
      ? `${state.repGuideSide === "left" ? "Left" : "Right"} side • ${REP_PHASES[state.repGuidePhaseIndex] || "Up"}`
      : REP_PHASES[state.repGuidePhaseIndex] || "Up";
  const syncUrlLooksLikeSpreadsheet = /docs\.google\.com\/spreadsheets/i.test(state.syncApiUrl);
  const tabs = [
    { id: "today", label: "Setup", icon: House },
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
    speak(`Warm up first. ${state.activeProgram}, day ${state.dayType}.`, state.soundEnabled);
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
    speak(`First exercise. ${firstExercise?.name || "Begin"}.`, state.soundEnabled);
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
    speak("Session complete. Good work.", state.soundEnabled);
  };

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    updateState({ installReady: false });
  };

  const syncSessionToCloudflare = async (sessionRecord) => {
    const apiBase = getSyncApiBase(state.syncApiUrl);
    if (apiBase === null) return;

    try {
      setSyncStatus("Saving session to Cloudflare...");
      const response = await fetch(`${apiBase}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionRecord),
      });
      if (!response.ok) throw new Error("session sync failed");
      setSyncStatus("Synced with Cloudflare");
    } catch {
      setSyncStatus("Cloudflare sync failed. Local save only.");
    }
  };

  const saveSetLocally = async (entry) => {
    const nextLogs = [...state.logs, entry];
    updateState({ logs: nextLogs });

    const apiBase = getSyncApiBase(state.syncApiUrl);
    if (apiBase === null) return;
    try {
      setSyncStatus("Saving set to Cloudflare...");
      const response = await fetch(`${apiBase}/api/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error("sync failed");
      setSyncStatus("Synced with Cloudflare");
    } catch {
      setSyncStatus("Cloudflare sync failed. Local save only.");
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
      speak(`Next exercise. ${nextExercise?.name || "Continue"}.`, state.soundEnabled);
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
    speak("Workout complete. Finish with stretches.", state.soundEnabled);
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
    const rows = [SHEET_HEADERS, ...state.logs.map((log) => SHEET_HEADERS.map((h) => log[h] ?? ""))];
    downloadCsv(`workout-log-${todayDateLabel()}.csv`, rows);
  };

  const clearAllData = () => {
    confirmAction("Clear all local workout data from this device?", () => {
      localStorage.removeItem(STORAGE_KEY);
      setState(DEFAULT_STATE);
      setSyncStatus("");
    });
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
    speak(isAlternateExercise(currentExercise.name) ? `${nextSide === "left" ? "Left" : "Right"}. Up` : "Up", state.soundEnabled);
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
                className={`tab-button ${isActive ? `tab-button-active ${tab.id}-accent` : "bg-white text-black"}`}
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
            <Card className="border-4 border-black rounded-3xl shadow-none today-panel">
              <CardHeader className="card-block-header">
                <CardTitle className="text-2xl font-black">Session Setup</CardTitle>
              </CardHeader>
              <CardContent className="card-block-body space-y-3">
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
                  <label className="block text-sm font-black mb-1">Next day in sequence</label>
                  <div className="border-4 border-black rounded-2xl p-3 bg-white text-black today-subpanel">
                    <div className="text-lg font-black">Day {state.dayType}</div>
                    <div className="text-sm font-semibold">This advances automatically after you finish the current session.</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1">Available dumbbells today</label>
                  <Input
                    className="border-4 border-black rounded-2xl p-3 text-sm font-semibold"
                    placeholder="Example: 1, 2, 3, 4, 5, 6"
                    value={state.availableWeights}
                    onChange={(e) => updateState({ availableWeights: e.target.value })}
                  />
                  <p className="mt-1 text-xs font-semibold">Enter each dumbbell weight in kg. Exercise suggestions will use this list.</p>
                </div>

                <div>
                  <label className="block text-sm font-black mb-1">Cloudflare sync API URL</label>
                  <Input
                    className="border-4 border-black rounded-2xl p-3 text-sm font-semibold"
                    placeholder="https://workout-coach-api.your-name.workers.dev"
                    value={state.syncApiUrl}
                    onChange={(e) => updateState({ syncApiUrl: e.target.value })}
                  />
                  <p className="mt-1 text-xs font-semibold">Paste your Cloudflare Worker base URL here for production sync. In local dev, leaving this blank uses the proxied `/api` Worker automatically.</p>
                  {syncUrlLooksLikeSpreadsheet && <p className="mt-1 text-xs font-bold">That still looks like a spreadsheet link. This field should point to your Worker URL.</p>}
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
                    className={`h-14 text-lg font-black border-4 border-black rounded-2xl ${state.soundEnabled ? "today-accent" : "bg-white text-black"}`}
                    onClick={() => updateState({ soundEnabled: !state.soundEnabled })}
                  >
                    {state.soundEnabled ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />} {state.soundEnabled ? "Voice On" : "Voice Off"}
                  </Button>
                  <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={startSession}>
                    <Play className="mr-2 h-5 w-5" /> Start Session
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-4 border-black rounded-3xl shadow-none today-panel">
              <CardContent className="p-4 space-y-3">
                <div className="split-header">
                  <div>
                    <div className="eyebrow">Today Ready</div>
                    <div className="text-2xl font-black">{nextWorkout}</div>
                  </div>
                  <div className="status-pill today-accent">{completedTodaySets} sets today</div>
                </div>
                <div className="stats-grid compact-grid">
                  <div className="border-4 border-black rounded-2xl p-3 bg-white text-black today-subpanel">
                    <div className="text-sm font-black">Weights selected</div>
                    <div className="text-lg font-black mt-1">{state.availableWeights}</div>
                    <div className="text-sm font-semibold">Applied to each exercise suggestion.</div>
                  </div>
                  <div className="border-4 border-black rounded-2xl p-3 bg-white text-black today-subpanel">
                    <div className="text-sm font-black">Last session</div>
                    <div className="text-lg font-black mt-1">{latestSession ? `${latestSession.durationMinutes} min` : "No history yet"}</div>
                    <div className="text-sm font-semibold">{latestSession ? `${latestSession.program} - Day ${latestSession.dayType}` : "Complete a session to build your log."}</div>
                  </div>
                </div>
                <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl today-accent" onClick={() => updateState({ activeTab: "session" })}>
                  <ArrowUpRight className="mr-2 h-5 w-5" /> Open session flow
                </Button>
              </CardContent>
            </Card>

            {state.installReady && <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl today-accent" onClick={installApp}><Download className="mr-2 h-5 w-5" /> Install App</Button>}
          </>
        )}

        {state.activeTab === "session" && (
          <>
            <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
              <CardHeader className="card-block-header">
                <div className="eyebrow">Session</div>
                <CardTitle className="text-2xl font-black">Program of the Day</CardTitle>
              </CardHeader>
              <CardContent className="card-block-body space-y-3">
                <div className="split-header">
                  <div>
                    <div className="eyebrow">Live session</div>
                    <div className="text-lg font-black">
                      {state.sessionStage === "warmup" && "Warm Up"}
                      {state.sessionStage === "exercise" && (currentExercise ? currentExercise.name : "Workout")}
                      {state.sessionStage === "stretch" && "Finish with stretches"}
                      {state.sessionStage === "idle" && "Session not started yet"}
                    </div>
                  </div>
                  <div className="status-pill session-accent text-white">{Math.round(sessionProgress)}% done</div>
                </div>
                <Progress value={sessionProgress} className="h-4 border-2 border-black" />
                <div className="space-y-2 compact-list">
                  <div className={`border-4 rounded-2xl p-3 ${state.sessionStage === "warmup" || state.sessionStage === "idle" ? "border-black session-accent text-white" : "border-black bg-white text-black session-subpanel"}`}>
                    <div className="text-lg font-black">Warm Up</div>
                    <div className="text-sm font-bold">Guided video before your first exercise</div>
                  </div>
                  {exercises.map((exercise, idx) => (
                    <div
                      key={`${exercise.name}-${idx}`}
                      className={`border-4 rounded-2xl p-3 ${state.sessionStage === "exercise" && idx === state.exerciseIndex ? "border-black session-accent text-white" : "border-black bg-white text-black session-subpanel"}`}
                    >
                      <div className="text-lg font-black">{exercise.name}</div>
                      <div className="text-sm font-bold">{exercise.sets} sets • {exercise.reps} {exercise.isTime ? "sec" : "reps"} • {exercise.weight}</div>
                    </div>
                  ))}
                  <div className={`border-4 rounded-2xl p-3 ${state.sessionStage === "stretch" ? "border-black session-accent text-white" : "border-black bg-white text-black session-subpanel"}`}>
                    <div className="text-lg font-black">Stretches</div>
                    <div className="text-sm font-bold">Cooldown video to finish the session</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {state.sessionStage === "idle" && (
              <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
                <CardContent className="p-4 space-y-3">
                  <div className="text-xl font-black">Your session begins with warm up.</div>
                  <div className="text-sm font-bold">Start the session to move into warm up, then continue through the workout and cooldown stretches.</div>
                  <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl session-accent text-white" onClick={startSession}>
                    <Play className="mr-2 h-5 w-5" /> Start Session Flow
                  </Button>
                </CardContent>
              </Card>
            )}

            {state.sessionStage === "warmup" && (
              <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
                <CardHeader className="card-block-header">
                  <div className="eyebrow">Session</div>
                  <CardTitle className="text-2xl font-black">Warm Up First</CardTitle>
                </CardHeader>
                <CardContent className="card-block-body space-y-3">
                  <div className="aspect-video rounded-2xl overflow-hidden border-4 border-black">
                    <iframe
                      className="w-full h-full"
                      src="https://www.youtube.com/embed/7PsInjpX_LM"
                      title="Warm up video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <Button className="w-full h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={beginProgramAfterWarmup}>
                    <CheckCircle2 className="mr-2 h-5 w-5" /> Warm Up Done, Start Program
                  </Button>
                </CardContent>
              </Card>
            )}

            {currentExercise && (
              <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
                <CardHeader className="card-block-header">
                  <div className="eyebrow">Session</div>
                  <CardTitle className="text-2xl font-black">Current Exercise</CardTitle>
                </CardHeader>
                <CardContent className="card-block-body space-y-4">
                  <div className="border-4 border-black rounded-3xl p-4 session-accent text-white">
                    <div className="text-3xl font-black leading-tight">{currentExercise.name}</div>
                    <div className="mt-2 text-lg font-bold">Set {state.currentSet} / {currentExercise.sets}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-4 border-black rounded-2xl p-3">
                      <div className="text-sm font-black">Weight to use</div>
                      <div className="text-2xl font-black mt-1 flex items-center gap-2"><Dumbbell className="h-6 w-6" /> {resolvedCurrentWeight}</div>
                    </div>
                    <div className="border-4 border-black rounded-2xl p-3">
                      <div className="text-sm font-black">Tempo / Rest</div>
                      <div className="text-2xl font-black mt-1">{currentExercise.isTime ? currentExercise.tempo : "2-2-3 + 1s"}</div>
                      <div className="text-lg font-bold">{DEFAULT_REST_SECONDS}s rest</div>
                    </div>
                  </div>

                  <div className="border-4 border-black rounded-2xl p-3">
                    <div className="text-sm font-black mb-2">Coaching cues</div>
                    <div className="exercise-reference-media rounded-2xl overflow-hidden border-4 border-black mb-1">
                      <img className="exercise-reference-image" src={currentExerciseImage} alt={`${currentExercise.name} visual reference`} />
                    </div>
                    <ul className="space-y-1">
                      {currentExercise.cues?.map((cue) => (
                        <li key={cue} className="text-base font-bold flex items-start gap-2"><ChevronRight className="h-4 w-4 mt-1" /> {cue}</li>
                      ))}
                    </ul>
                    <a className="reference-link" href={currentExerciseReference} target="_blank" rel="noreferrer">Open visual reference</a>
                  </div>

                  <div className="border-4 border-black rounded-3xl p-4 text-center">
                    <div className="text-sm font-black">{currentExercise.isTime ? "Target time" : "Target reps"}</div>
                    <div className="text-5xl font-black mt-2">{currentExercise.isTime ? formatSeconds(currentExercise.reps) : currentExercise.reps}</div>
                  </div>

                  {!currentExercise.isTime ? (
                    <div className="border-4 border-black rounded-3xl p-4 text-center space-y-3">
                      <div className="text-sm font-black">Voice-guided rep count</div>
                      <div className="text-6xl font-black">{state.currentRep}</div>
                      <div className="text-sm font-bold">{repGuideLabel} • 2-2-3 tempo with 1s reset {isAlternateExercise(currentExercise.name) ? "per side" : ""}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button className="h-16 text-2xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={restartRepGuide}>
                          <RotateCcw className="mr-2 h-5 w-5" /> Restart
                        </Button>
                        <Button className="h-16 text-2xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={toggleRepGuide}>
                          <Play className="mr-2 h-5 w-5" /> {state.repGuideRunning ? "Pause" : "Start"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-4 border-black rounded-3xl p-4 text-center space-y-3">
                      <div className="text-sm font-black">Set timer</div>
                      <div className="text-6xl font-black">{formatSeconds(state.setDurationRemaining || currentExercise.reps)}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={toggleSetTimer}>
                          <Clock3 className="mr-2 h-5 w-5" /> {state.setTimerRunning ? "Pause" : "Start"}
                        </Button>
                        <Button
                          className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                          onClick={resetSetTimer}
                        >
                          <RotateCcw className="mr-2 h-5 w-5" /> Reset
                        </Button>
                      </div>
                    </div>
                  )}

                  <Button className="w-full h-16 text-2xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={completeSet}>
                    <Save className="mr-2 h-5 w-5" /> Complete Set and Save
                  </Button>

                  <div className="border-4 border-black rounded-3xl p-4 text-center space-y-2">
                    <div className="text-sm font-black">Rest timer</div>
                    <div className="text-6xl font-black">{formatSeconds(state.restRemaining)}</div>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                          className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                          onClick={() => updateState({ restTimerRunning: !state.restTimerRunning || state.restRemaining === 0, restRemaining: state.restRemaining || DEFAULT_REST_SECONDS })}
                        >
                        <TimerReset className="mr-2 h-5 w-5" /> {state.restTimerRunning ? "Pause" : "Start"}
                      </Button>
                      <Button
                        className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black"
                        onClick={skipRest}
                      >
                        <ChevronRight className="mr-2 h-5 w-5" /> Skip
                      </Button>
                    </div>
                  </div>

                  {syncStatus && <div className="text-sm font-black">{syncStatus}</div>}
                </CardContent>
              </Card>
            )}

            {state.sessionStage === "stretch" && (
              <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
                <CardHeader className="card-block-header">
                  <div className="eyebrow">Session</div>
                  <CardTitle className="text-2xl font-black">Finish with Stretches</CardTitle>
                </CardHeader>
                <CardContent className="card-block-body space-y-3">
                  <div className="aspect-video rounded-2xl overflow-hidden border-4 border-black">
                    <iframe
                      className="w-full h-full"
                      src="https://www.youtube.com/embed/5oj9-4ZQes4?start=187"
                      title="Cooldown stretch video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <Button className="w-full h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={finishSession}>
                    <CheckCircle2 className="mr-2 h-5 w-5" /> Stretch Done, Finish Session
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
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
          <Card className="border-4 border-black rounded-3xl shadow-none history-panel">
            <CardHeader className="card-block-header">
              <div className="eyebrow">History</div>
              <CardTitle className="text-2xl font-black">Session Log</CardTitle>
            </CardHeader>
            <CardContent className="card-block-body space-y-2">
              {sessionSummaries.length === 0 ? (
                <div className="border-4 border-black rounded-2xl p-4 text-lg font-bold">No sets saved yet.</div>
              ) : (
                sessionSummaries.map((session) => (
                  <div key={session.sessionId} className="history-session-group">
                    <div className="history-session-head">
                      <div className="text-lg font-black">{session.date} • {session.program}</div>
                      <div className="text-sm font-bold">Day {session.dayType} • {session.durationMinutes || "-"} min • {session.setsCompleted} sets</div>
                      <div className="text-sm font-bold">Warm up {session.warmupCompleted ? "done" : "not marked"} • Stretch {session.stretchCompleted ? "done" : "not marked"}</div>
                      {session.availableWeights && <div className="text-sm font-bold">Weights: {session.availableWeights}</div>}
                      {session.note && <div className="text-sm font-bold">Note: {session.note}</div>}
                    </div>
                    <div className="history-exercise-list">
                      {session.exercises.map((exercise) => (
                        <div key={`${session.sessionId}-${exercise.exercise}`} className="history-exercise-row">
                          <div className="text-base font-black">{exercise.exercise}</div>
                          <div className="text-sm font-bold">{exercise.sets} sets • {exercise.completed} total {exercise.isTime ? "sec" : "reps"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {state.activeTab === "history" && (
          <Card className="border-4 border-black rounded-3xl shadow-none history-panel">
            <CardHeader className="card-block-header">
              <div className="eyebrow">History</div>
              <CardTitle className="text-2xl font-black">History and Export</CardTitle>
            </CardHeader>
            <CardContent className="card-block-body space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl history-accent text-white" onClick={exportLogs}>
                  <Download className="mr-2 h-5 w-5" /> Export CSV
                </Button>
                <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSession}>
                  <RotateCcw className="mr-2 h-5 w-5" /> Reset Session
                </Button>
              </div>
              <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={clearAllData}>
                Clear All Local Data
              </Button>
              <div className="text-sm font-bold">Export gives you the full raw set log as CSV. The on-screen history stays grouped by session and exercise.</div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

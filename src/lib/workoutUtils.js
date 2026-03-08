import { DEFAULT_STATE, IMPORTED_IMAGE_EXTENSIONS, PLAYFUL_LINES, REP_PHASES, STORAGE_KEY } from "./workoutData";

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

export function formatSeconds(total) {
  const safe = Math.max(0, Number(total) || 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function todayDateLabel() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function getNextDayType(current) {
  if (current === "A") return "B";
  if (current === "B") return "C";
  return "A";
}

export function isAlternateExercise(name = "") {
  return /(split squat|reverse lunge|step-up|side bend|bicycle crunch)/i.test(name);
}

export function parseAvailableWeights(input = "") {
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

export function resolveWeightGuide(guide, availableWeightsInput) {
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

export function slugifyExerciseName(name = "") {
  return name
    .toLowerCase()
    .replaceAll("/", "-")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function getExerciseReferenceImage(name = "") {
  const slug = slugifyExerciseName(name);
  return `/exercise-reference/${slug}.svg`;
}

export function getExerciseReferenceImageCandidates(name = "") {
  const slug = slugifyExerciseName(name);
  const imported = IMPORTED_IMAGE_EXTENSIONS.map((ext) => `/exercise-reference/imported/${slug}.${ext}`);
  return [...imported, getExerciseReferenceImage(name)];
}

export function getWeightTotalKg(weightGuide = "") {
  const totalMatch = weightGuide.match(/\((\d+(?:\.\d+)?)\s*kg total\)/i) || weightGuide.match(/(\d+(?:\.\d+)?)\s*kg total/i);
  if (totalMatch) return Number.parseFloat(totalMatch[1]) || 0;

  const eachHandMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg each hand/i);
  if (eachHandMatch) return (Number.parseFloat(eachHandMatch[1]) || 0) * 2;

  const oneHandMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg in one hand/i);
  if (oneHandMatch) return Number.parseFloat(oneHandMatch[1]) || 0;

  const singleKgMatch = weightGuide.match(/(\d+(?:\.\d+)?)\s*kg/i);
  if (singleKgMatch && !/bodyweight/i.test(weightGuide)) return Number.parseFloat(singleKgMatch[1]) || 0;

  return 0;
}

export function summarizeSessionLogs(logs, sessions) {
  const logsBySession = logs.reduce((acc, log) => {
    const sessionId = log.sessionId || `${log.date}-${log.program}-${log.dayType}`;
    if (!acc[sessionId]) acc[sessionId] = [];
    acc[sessionId].push(log);
    return acc;
  }, {});

  const grouped = sessions.map((session) => {
    if (Array.isArray(session.exercises) && session.exercises.length) {
      return {
        ...session,
        totalKg: session.totalKg ?? session.exercises.reduce((sum, exercise) => sum + (exercise.totalKg || 0), 0),
        totalCompleted: session.totalCompleted ?? session.exercises.reduce((sum, exercise) => sum + (exercise.completed || 0), 0),
      };
    }

    const sessionLogs = logsBySession[session.sessionId] || [];
    const byExercise = sessionLogs.reduce((acc, log) => {
      const key = log.exercise;
      if (!acc[key]) {
        acc[key] = {
          exercise: log.exercise,
          sets: 0,
          completed: 0,
          target: log.target,
          isTime: log.isTime,
          totalKg: 0,
        };
      }
      acc[key].sets += 1;
      acc[key].completed += Number(log.completed) || 0;
      acc[key].totalKg += (Number(log.completed) || 0) * getWeightTotalKg(log.weightGuide);
      return acc;
    }, {});

    const exercises = Object.values(byExercise);
    return {
      ...session,
      exercises,
      totalKg: exercises.reduce((sum, exercise) => sum + exercise.totalKg, 0),
      totalCompleted: exercises.reduce((sum, exercise) => sum + exercise.completed, 0),
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
        totalKg: 0,
        totalCompleted: 0,
      };
    }
    acc[sessionId].setsCompleted += 1;
    const existing = acc[sessionId].exercises.find((item) => item.exercise === log.exercise);
    if (existing) {
      existing.sets += 1;
      existing.completed += Number(log.completed) || 0;
      existing.totalKg += (Number(log.completed) || 0) * getWeightTotalKg(log.weightGuide);
    } else {
      acc[sessionId].exercises.push({
        exercise: log.exercise,
        sets: 1,
        completed: Number(log.completed) || 0,
        target: log.target,
        isTime: log.isTime,
        totalKg: (Number(log.completed) || 0) * getWeightTotalKg(log.weightGuide),
      });
    }
    acc[sessionId].totalKg += (Number(log.completed) || 0) * getWeightTotalKg(log.weightGuide);
    acc[sessionId].totalCompleted += Number(log.completed) || 0;
    return acc;
  }, {}));

  return fallbackGrouped.slice().reverse();
}

export function confirmAction(message, callback) {
  if (typeof window === "undefined" || window.confirm(message)) {
    callback();
  }
}

export function normalizeApiBase(url = "") {
  return url.trim().replace(/\/$/, "");
}

export function getSyncApiBase(url = "") {
  const normalized = normalizeApiBase(url);
  if (normalized) return normalized;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return "";
  }

  return null;
}

export function getSyncHeaders(includeJson = false) {
  const headers = {};
  const token = import.meta.env.VITE_SYNC_API_TOKEN;
  if (includeJson) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function pickLine(lines, seed = 0) {
  if (!lines?.length) return "";
  return lines[seed % lines.length];
}

export function getPhaseCue(phase, seed = 0) {
  if (phase === "Up") return pickLine(PLAYFUL_LINES.phaseUp, seed);
  if (phase === "2") return pickLine(PLAYFUL_LINES.phaseTwo, seed);
  if (phase === "Hold") return pickLine(PLAYFUL_LINES.phaseHold, seed);
  if (phase === "Lower") return pickLine(PLAYFUL_LINES.phaseLower, seed);
  if (phase === "3") return pickLine(PLAYFUL_LINES.phaseThree, seed);
  if (phase === "Wait") return pickLine(PLAYFUL_LINES.phaseWait, seed);
  return phase;
}

function csvEscape(value) {
  const v = String(value ?? "");
  return `"${v.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { PLAYFUL_LINES, REP_PHASES, STORAGE_KEY };

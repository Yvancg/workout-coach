import { getWeightTotalKg, parseAvailableWeights, resolveWeightGuide } from "./workoutUtils.js";

function roundLoad(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.round(numeric * 10) / 10;
}

export function getExerciseLoadOptionsKg(exercise, availableWeightsInput) {
  const weights = parseAvailableWeights(availableWeightsInput);
  const guide = exercise?.weight || "";
  if (!weights.length || !/kg/i.test(guide)) return [];

  const mode = exercise?.loadMode || "pair";
  const options = mode === "single"
    ? weights
    : weights.map((weight) => weight * 2);

  return [...new Set(options.map(roundLoad))].filter((value) => value > 0).sort((a, b) => a - b);
}

export function getBaseRecommendedLoadKg(exercise, availableWeightsInput) {
  if (!exercise) return 0;
  if (/bodyweight\s+or/i.test(exercise.weight || "")) return 0;
  const resolved = resolveWeightGuide(exercise.weight || "", availableWeightsInput, exercise.loadMode || "pair");
  return roundLoad(getWeightTotalKg(resolved));
}

function nearestIndex(options, value) {
  if (!options.length) return -1;
  return options.reduce((bestIndex, option, index) => (
    Math.abs(option - value) < Math.abs(options[bestIndex] - value) ? index : bestIndex
  ), 0);
}

function stepLoad(options, currentLoad, direction) {
  if (!options.length) return 0;
  if (!(currentLoad > 0)) return direction > 0 ? options[0] : 0;
  const currentIndex = nearestIndex(options, currentLoad);
  const nextIndex = Math.max(0, Math.min(options.length - 1, currentIndex + direction));
  return options[nextIndex];
}

function summarizeSetLogs(logs) {
  if (!logs.length) return null;

  const completed = logs.reduce((sum, log) => sum + (Number(log.completed) || 0), 0);
  const target = logs.reduce((sum, log) => sum + (Number(log.target) || 0), 0);
  const rated = logs.map((log) => Number(log.effortRpe)).filter((value) => value > 0);
  const loadEntries = logs
    .map((log) => ({ timestamp: Date.parse(log.timestamp || "") || 0, load: Number(log.actualLoadKg) || 0 }))
    .filter((entry) => entry.load > 0)
    .sort((a, b) => b.timestamp - a.timestamp);

  return {
    completionRate: target > 0 ? completed / target : 1,
    avgRpe: rated.length ? rated.reduce((sum, value) => sum + value, 0) / rated.length : 0,
    lastLoadKg: loadEntries[0]?.load || 0,
    ratedSets: rated.length,
    sets: logs.length,
  };
}

function latestLocalPerformance({ logs, program, dayType, exerciseName, currentSessionId }) {
  const matching = logs
    .filter((log) => (
      log.exercise === exerciseName
      && log.program === program
      && log.dayType === dayType
      && log.sessionId !== currentSessionId
    ))
    .sort((a, b) => (Date.parse(b.timestamp || "") || 0) - (Date.parse(a.timestamp || "") || 0));

  if (!matching.length) return null;
  const latestSessionId = matching[0].sessionId;
  return summarizeSetLogs(matching.filter((log) => log.sessionId === latestSessionId));
}

function latestRemotePerformance({ history, program, dayType, exerciseName, currentSessionId }) {
  const sessions = history
    .filter((session) => (
      session.sessionId !== currentSessionId
      && session.program === program
      && session.dayType === dayType
      && Array.isArray(session.exercises)
    ));

  for (const session of sessions) {
    const exercise = session.exercises.find((item) => item.exercise === exerciseName);
    if (!exercise) continue;

    return {
      completionRate: Number(exercise.completionRate) || (
        Number(exercise.target) > 0 && Number(exercise.sets) > 0
          ? (Number(exercise.completed) || 0) / (Number(exercise.target) * Number(exercise.sets))
          : 1
      ),
      avgRpe: Number(exercise.avgRpe) || 0,
      lastLoadKg: Number(exercise.lastLoadKg) || 0,
      ratedSets: Number(exercise.ratedSets) || 0,
      sets: Number(exercise.sets) || 0,
    };
  }

  return null;
}

function bodyweightRecommendation({ exercise, performance, readiness }) {
  if (readiness <= 2) {
    return {
      recommendedLoadKg: 0,
      action: "easy",
      message: "Low readiness today: keep the movement comfortable, shorten the set if needed, and finish with several reps or seconds in reserve.",
    };
  }

  if (!performance) {
    return {
      recommendedLoadKg: 0,
      action: "start",
      message: "First tracked session for this exercise: use the planned target and rate the set effort so the next recommendation has a baseline.",
    };
  }

  if (performance.completionRate < 0.9 || performance.avgRpe >= 9) {
    return {
      recommendedLoadKg: 0,
      action: "reduce",
      message: "Last time was very hard or below target. Keep the bodyweight variation, reduce reps/time slightly, and prioritize clean form.",
    };
  }

  if (performance.completionRate >= 1 && performance.avgRpe > 0 && performance.avgRpe <= 6.5) {
    return {
      recommendedLoadKg: 0,
      action: "progress",
      message: exercise?.isTime
        ? "Last time was comfortable. If form stays clean, add about 5 seconds to the final set or use a slightly harder variation."
        : "Last time was comfortable. If form stays clean, add 1–2 reps per set or use a slightly harder variation.",
    };
  }

  return {
    recommendedLoadKg: 0,
    action: "hold",
    message: "Keep the current bodyweight target. Aim for controlled technique and roughly RPE 7–8.",
  };
}

export function getCoachingRecommendation({
  exercise,
  logs = [],
  history = [],
  program,
  dayType,
  availableWeightsInput,
  readiness = 3,
  currentSessionId = "",
}) {
  if (!exercise) {
    return { recommendedLoadKg: 0, action: "none", message: "" };
  }

  const local = latestLocalPerformance({
    logs,
    program,
    dayType,
    exerciseName: exercise.name,
    currentSessionId,
  });
  const performance = local || latestRemotePerformance({
    history,
    program,
    dayType,
    exerciseName: exercise.name,
    currentSessionId,
  });

  const options = getExerciseLoadOptionsKg(exercise, availableWeightsInput);
  if (!options.length) {
    return bodyweightRecommendation({ exercise, performance, readiness: Number(readiness) || 3 });
  }

  const baseLoad = getBaseRecommendedLoadKg(exercise, availableWeightsInput) || options[0];
  const previousLoad = performance?.lastLoadKg || baseLoad;
  const normalizedReadiness = Number(readiness) || 3;

  if (normalizedReadiness <= 2) {
    const load = stepLoad(options, previousLoad, -1);
    return {
      recommendedLoadKg: load,
      action: "easy",
      message: `Low readiness today: use about ${load} kg total, keep the set controlled, and stop around RPE 6–7.`,
    };
  }

  if (!performance) {
    const optionalBodyweight = /bodyweight\s+or/i.test(exercise.weight || "");
    return {
      recommendedLoadKg: baseLoad,
      action: "start",
      message: optionalBodyweight
        ? "Start with bodyweight and rate the set effort. Add external load only after the planned work feels comfortably controlled."
        : `Start around ${baseLoad} kg total and aim to finish the set near RPE 7–8. Log the actual load and effort for the next recommendation.`,
    };
  }

  if (performance.completionRate < 0.9 || performance.avgRpe >= 9) {
    const load = stepLoad(options, previousLoad, -1);
    return {
      recommendedLoadKg: load,
      action: "reduce",
      message: `Last time was very hard or below target. Try ${load} kg total and rebuild clean reps before increasing load.`,
    };
  }

  if (performance.completionRate >= 1 && performance.avgRpe > 0 && performance.avgRpe <= 6.5) {
    const load = stepLoad(options, previousLoad, 1);
    if (load > previousLoad) {
      return {
        recommendedLoadKg: load,
        action: "progress",
        message: `Last time was comfortable and on target. Progress one step to ${load} kg total if technique remains clean.`,
      };
    }

    return {
      recommendedLoadKg: previousLoad,
      action: "progress",
      message: exercise.isTime
        ? `You are already at your heaviest available load. Keep ${previousLoad} kg total and add about 5 seconds only if the set still feels controlled.`
        : `You are already at your heaviest available load. Keep ${previousLoad} kg total and add 1–2 reps or slow the lowering phase instead.`,
    };
  }

  if (performance.completionRate >= 1 && (!performance.avgRpe || performance.avgRpe <= 8.5)) {
    return {
      recommendedLoadKg: previousLoad,
      action: "hold",
      message: performance.avgRpe
        ? `Hold at ${previousLoad} kg total. Your last effort was in a productive range; repeat it cleanly before progressing.`
        : `Hold at ${previousLoad} kg total and rate each set so the coach can decide when to progress.`,
    };
  }

  const load = stepLoad(options, previousLoad, -1);
  return {
    recommendedLoadKg: load,
    action: "reduce",
    message: `Use ${load} kg total today and prioritize clean completion before adding load.`,
  };
}

export function clampRpe(value, fallback = 7) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(10, parsed));
}

export function normalizeActualLoadKg(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 10) / 10;
}

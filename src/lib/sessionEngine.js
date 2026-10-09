function stoppedTimers() {
  return {
    setTimerRunning: false,
    setTimerDeadline: null,
    restTimerRunning: false,
    restTimerDeadline: null,
  };
}

function resetRepGuide() {
  return {
    currentRep: 0,
    repGuideRunning: false,
    repGuidePhaseIndex: 0,
    repGuidePhaseRemaining: 0,
    repGuideSide: "left",
  };
}

export function getSessionStartPatch({ sessionId, startedAt }) {
  return {
    sessionStartedAt: startedAt,
    sessionId,
    activeTab: "session",
    sessionStage: "warmup",
    exerciseIndex: 0,
    currentSet: 1,
    ...resetRepGuide(),
    setDurationRemaining: 0,
    restRemaining: 0,
    ...stoppedTimers(),
    warmupDone: false,
    stretchDone: false,
  };
}

export function getProgramStartPatch(firstExercise) {
  return {
    warmupDone: true,
    sessionStage: "exercise",
    exerciseIndex: 0,
    currentSet: 1,
    ...resetRepGuide(),
    setDurationRemaining: firstExercise?.isTime ? firstExercise.reps : 0,
    restRemaining: 0,
    ...stoppedTimers(),
  };
}

function getRestPatch(restSeconds, nowMs) {
  const safeRest = Math.max(0, Number(restSeconds) || 0);
  return {
    restRemaining: safeRest,
    restTimerRunning: safeRest > 0,
    restTimerDeadline: safeRest > 0 ? nowMs + safeRest * 1000 : null,
  };
}

function getExerciseResetPatch(exercise) {
  return {
    ...resetRepGuide(),
    setDurationRemaining: exercise?.isTime ? exercise.reps : 0,
    setTimerRunning: false,
    setTimerDeadline: null,
  };
}

export function getNextStageTransition({
  state,
  currentExercise,
  exercises,
  restSeconds,
  nowMs,
}) {
  if (!currentExercise) return null;

  if (state.currentSet < currentExercise.sets) {
    return {
      patch: {
        currentSet: state.currentSet + 1,
        ...getExerciseResetPatch(currentExercise),
        ...getRestPatch(restSeconds, nowMs),
      },
      announcement: "",
    };
  }

  if (state.exerciseIndex < exercises.length - 1) {
    const nextExercise = exercises[state.exerciseIndex + 1];
    return {
      patch: {
        exerciseIndex: state.exerciseIndex + 1,
        currentSet: 1,
        ...getExerciseResetPatch(nextExercise),
        ...getRestPatch(restSeconds, nowMs),
      },
      announcement: nextExercise?.name || "continue",
    };
  }

  return {
    patch: {
      sessionStage: "stretch",
      restRemaining: 0,
      setDurationRemaining: 0,
      ...stoppedTimers(),
      repGuideRunning: false,
      repGuidePhaseIndex: 0,
      repGuidePhaseRemaining: 0,
      repGuideSide: "left",
    },
    announcement: "stretch",
  };
}

export function getSessionFinishPatch(nextDayType) {
  return {
    activeTab: "history",
    sessionStage: "idle",
    restRemaining: 0,
    setDurationRemaining: 0,
    ...stoppedTimers(),
    ...resetRepGuide(),
    currentSet: 1,
    exerciseIndex: 0,
    stretchDone: true,
    sessionStartedAt: null,
    sessionId: null,
    warmupDone: false,
    currentLoadKg: "",
    currentRpe: 7,
    completedOverride: "",
    dayType: nextDayType,
  };
}

export function getSessionResetPatch() {
  return {
    exerciseIndex: 0,
    currentSet: 1,
    ...resetRepGuide(),
    setDurationRemaining: 0,
    restRemaining: 0,
    ...stoppedTimers(),
    warmupDone: false,
    stretchDone: false,
    sessionStage: "idle",
    sessionStartedAt: null,
    sessionId: null,
    currentLoadKg: "",
    currentRpe: 7,
    completedOverride: "",
  };
}

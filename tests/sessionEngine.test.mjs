import assert from "node:assert/strict";
import test from "node:test";

import {
  getNextStageTransition,
  getProgramStartPatch,
  getSessionFinishPatch,
  getSessionResetPatch,
  getSessionStartPatch,
} from "../src/lib/sessionEngine.js";

test("session start always begins at warmup with clean timers and reps", () => {
  const patch = getSessionStartPatch({ sessionId: "s1", startedAt: "2026-10-09T00:00:00.000Z" });
  assert.equal(patch.sessionStage, "warmup");
  assert.equal(patch.exerciseIndex, 0);
  assert.equal(patch.currentSet, 1);
  assert.equal(patch.currentRep, 0);
  assert.equal(patch.setTimerDeadline, null);
  assert.equal(patch.restTimerDeadline, null);
  assert.equal(patch.sessionId, "s1");
});

test("program start initializes timed exercises to their target duration", () => {
  const timed = getProgramStartPatch({ name: "Plank", reps: 45, isTime: true });
  const reps = getProgramStartPatch({ name: "Squat", reps: 12 });
  assert.equal(timed.setDurationRemaining, 45);
  assert.equal(reps.setDurationRemaining, 0);
  assert.equal(timed.sessionStage, "exercise");
});

test("next set preserves exercise and starts an absolute rest deadline", () => {
  const transition = getNextStageTransition({
    state: { currentSet: 1, exerciseIndex: 0 },
    currentExercise: { name: "Plank", sets: 3, reps: 30, isTime: true },
    exercises: [{ name: "Plank", sets: 3, reps: 30, isTime: true }],
    restSeconds: 45,
    nowMs: 1_000,
  });
  assert.equal(transition.patch.currentSet, 2);
  assert.equal(transition.patch.setDurationRemaining, 30);
  assert.equal(transition.patch.restRemaining, 45);
  assert.equal(transition.patch.restTimerDeadline, 46_000);
  assert.equal(transition.announcement, "");
});

test("next exercise resets set count and announces the new exercise", () => {
  const exercises = [
    { name: "Squat", sets: 1, reps: 12 },
    { name: "Plank", sets: 2, reps: 30, isTime: true },
  ];
  const transition = getNextStageTransition({
    state: { currentSet: 1, exerciseIndex: 0 },
    currentExercise: exercises[0],
    exercises,
    restSeconds: 60,
    nowMs: 10_000,
  });
  assert.equal(transition.patch.exerciseIndex, 1);
  assert.equal(transition.patch.currentSet, 1);
  assert.equal(transition.patch.setDurationRemaining, 30);
  assert.equal(transition.patch.restTimerDeadline, 70_000);
  assert.equal(transition.announcement, "Plank");
});

test("zero-rest exercises do not start a rest timer", () => {
  const exercise = { name: "Walk", sets: 2, reps: 60, isTime: true };
  const transition = getNextStageTransition({
    state: { currentSet: 1, exerciseIndex: 0 },
    currentExercise: exercise,
    exercises: [exercise],
    restSeconds: 0,
    nowMs: 5_000,
  });
  assert.equal(transition.patch.restRemaining, 0);
  assert.equal(transition.patch.restTimerRunning, false);
  assert.equal(transition.patch.restTimerDeadline, null);
});

test("last set of last exercise moves to stretch stage", () => {
  const exercise = { name: "Row", sets: 1, reps: 12 };
  const transition = getNextStageTransition({
    state: { currentSet: 1, exerciseIndex: 0 },
    currentExercise: exercise,
    exercises: [exercise],
    restSeconds: 60,
    nowMs: 0,
  });
  assert.equal(transition.patch.sessionStage, "stretch");
  assert.equal(transition.patch.restTimerRunning, false);
  assert.equal(transition.announcement, "stretch");
});

test("finish and reset patches clear active session state", () => {
  const finish = getSessionFinishPatch("B");
  const reset = getSessionResetPatch();
  assert.equal(finish.dayType, "B");
  assert.equal(finish.activeTab, "history");
  assert.equal(finish.sessionId, null);
  assert.equal(reset.sessionStage, "idle");
  assert.equal(reset.sessionId, null);
  assert.equal(reset.stretchDone, false);
});

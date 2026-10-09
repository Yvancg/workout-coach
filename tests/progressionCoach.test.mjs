import assert from "node:assert/strict";
import test from "node:test";

import {
  clampRpe,
  getBaseRecommendedLoadKg,
  getCoachingRecommendation,
  getExerciseLoadOptionsKg,
  normalizeActualLoadKg,
} from "../src/lib/progressionCoach.js";

const pairExercise = { name: "DB Row", weight: "6-12 kg total", reps: 12 };
const singleExercise = { name: "Goblet Squat", weight: "8-12 kg total", reps: 12, loadMode: "single" };
const bodyweightExercise = { name: "Plank", weight: "Bodyweight", reps: 30, isTime: true };
const weights = "1, 2, 3, 4, 5, 6";

test("load options respect pair versus single-dumbbell exercises", () => {
  assert.deepEqual(getExerciseLoadOptionsKg(pairExercise, weights), [2, 4, 6, 8, 10, 12]);
  assert.deepEqual(getExerciseLoadOptionsKg(singleExercise, weights), [1, 2, 3, 4, 5, 6]);
  assert.equal(getBaseRecommendedLoadKg(singleExercise, weights), 6);
});

test("first tracked session starts from the resolved equipment-aware load", () => {
  const recommendation = getCoachingRecommendation({
    exercise: pairExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 3,
  });
  assert.equal(recommendation.action, "start");
  assert.equal(recommendation.recommendedLoadKg, 12);
});

test("easy completed session progresses only one available load step", () => {
  const recommendation = getCoachingRecommendation({
    exercise: pairExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 4,
    logs: [
      { timestamp: "2026-10-01T10:00:00Z", sessionId: "old", program: "General 1-6kg", dayType: "A", exercise: "DB Row", target: 12, completed: 12, effortRpe: 6, actualLoadKg: 8 },
      { timestamp: "2026-10-01T10:02:00Z", sessionId: "old", program: "General 1-6kg", dayType: "A", exercise: "DB Row", target: 12, completed: 12, effortRpe: 6, actualLoadKg: 8 },
    ],
  });
  assert.equal(recommendation.action, "progress");
  assert.equal(recommendation.recommendedLoadKg, 10);
});

test("very hard or incomplete session steps load down", () => {
  const recommendation = getCoachingRecommendation({
    exercise: pairExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 3,
    logs: [
      { timestamp: "2026-10-01T10:00:00Z", sessionId: "old", program: "General 1-6kg", dayType: "A", exercise: "DB Row", target: 12, completed: 8, effortRpe: 9, actualLoadKg: 10 },
    ],
  });
  assert.equal(recommendation.action, "reduce");
  assert.equal(recommendation.recommendedLoadKg, 8);
});

test("low readiness takes priority over progression", () => {
  const recommendation = getCoachingRecommendation({
    exercise: pairExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 2,
    logs: [
      { timestamp: "2026-10-01T10:00:00Z", sessionId: "old", program: "General 1-6kg", dayType: "A", exercise: "DB Row", target: 12, completed: 12, effortRpe: 5, actualLoadKg: 10 },
    ],
  });
  assert.equal(recommendation.action, "easy");
  assert.equal(recommendation.recommendedLoadKg, 8);
});

test("bodyweight progression never invents an external load", () => {
  const recommendation = getCoachingRecommendation({
    exercise: bodyweightExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 4,
    logs: [
      { timestamp: "2026-10-01T10:00:00Z", sessionId: "old", program: "General 1-6kg", dayType: "A", exercise: "Plank", target: 30, completed: 30, effortRpe: 6, actualLoadKg: 0 },
    ],
  });
  assert.equal(recommendation.recommendedLoadKg, 0);
  assert.equal(recommendation.action, "progress");
});

test("remote history summaries can drive recommendations on a new device", () => {
  const recommendation = getCoachingRecommendation({
    exercise: pairExercise,
    program: "General 1-6kg",
    dayType: "A",
    availableWeightsInput: weights,
    readiness: 3,
    history: [{
      sessionId: "remote-old",
      program: "General 1-6kg",
      dayType: "A",
      exercises: [{
        exercise: "DB Row",
        completionRate: 1,
        avgRpe: 6,
        lastLoadKg: 8,
        ratedSets: 3,
        sets: 3,
      }],
    }],
  });
  assert.equal(recommendation.recommendedLoadKg, 10);
});

test("RPE and actual load normalization are bounded", () => {
  assert.equal(clampRpe(12), 10);
  assert.equal(clampRpe(-2), 1);
  assert.equal(normalizeActualLoadKg("5.26"), 5.3);
  assert.equal(normalizeActualLoadKg(-1), 0);
});

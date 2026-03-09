export const STORAGE_KEY = "yvan-workout-coach-v2";

export const DEFAULT_REST_SECONDS = 30;

export const PLAYFUL_LINES = {
  sessionStart: ["Warm up first. Let us get you moving.", "Warm up first. Nice and easy to start."],
  warmup: ["Easy now. Loosen everything up.", "Nice and smooth. Wake the body up.", "Good. Take your time here."],
  firstExercise: ["First exercise. Let us go.", "First exercise. Stay smooth and strong."],
  nextExercise: ["Next exercise. Keep that momentum.", "Next exercise. You are doing great.", "Alright, next one. Stay with me."],
  sessionComplete: ["Session complete. Nice work.", "Session complete. You crushed that."],
  stretch: ["Workout complete. Finish with stretches.", "Nice work. Finish strong with stretches."],
  stretchCue: ["Slow it down now.", "Nice and easy here.", "Breathe and let go of the tension."],
  restDone: ["Rest over. Back to it.", "Rest over. Let us go again."],
  repPraise: ["Nice.", "Good.", "Strong.", "That is it."],
  repPush: ["Stay with it.", "Keep it smooth.", "One more clean one.", "You have got this."],
  phaseUp: ["Up.", "Lift.", "Drive up."],
  phaseTwo: ["Two.", "And two."],
  phaseHold: ["Hold.", "Stay there."],
  phaseLower: ["Lower.", "Ease down."],
  phaseThree: ["Three.", "Nice and slow."],
  phaseWait: ["Reset.", "Breathe.", "Stay with it."],
};

export const SHEET_HEADERS = [
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

export const PROGRAMS = {
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

export const DEFAULT_STATE = {
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
  selectedVoiceName: "",
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

export const REP_PHASES = ["Up", "2", "Hold", "2", "Down", "2", "3", "Hold"];

export const REP_PHASE_DURATIONS = [1, 1, 1, 1, 1, 1, 1, 1];

export const IMPORTED_IMAGE_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "gif", "svg", "avif"];

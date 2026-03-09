import { CheckCircle2, ChevronRight, Clock3, Dumbbell, House, Pause, Play, RotateCcw, Save, TimerReset, Volume2, VolumeX } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from "./ui";

export function SessionTab({
  state,
  exercises,
  currentExercise,
  sessionProgress,
  resolvedCurrentWeight,
  currentExerciseImage,
  repGuideLabel,
  repGuideCountdown,
  syncConnected,
  syncStatus,
  formatSeconds,
  DEFAULT_REST_SECONDS,
  onExerciseImageError,
  isAlternateExercise,
  toggleSound,
  startSession,
  beginProgramAfterWarmup,
  toggleRepGuide,
  restartRepGuide,
  toggleSetTimer,
  resetSetTimer,
  toggleRestTimer,
  completeSet,
  skipRest,
  resetSession,
  finishSession,
  navigateToToday,
}) {
  const restSeconds = currentExercise?.rest || DEFAULT_REST_SECONDS;

  return (
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
              <div key={`${exercise.name}-${idx}`} className={`border-4 rounded-2xl p-3 ${state.sessionStage === "exercise" && idx === state.exerciseIndex ? "border-black session-accent text-white" : "border-black bg-white text-black session-subpanel"}`}>
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
              <iframe className="w-full h-full" src="https://www.youtube.com/embed/7PsInjpX_LM" title="Warm up video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
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
                <div className="text-2xl font-black mt-1">{currentExercise.tempo}</div>
                <div className="text-lg font-bold">{restSeconds}s rest</div>
              </div>
            </div>

            <div className="border-4 border-black rounded-2xl p-3">
              <div className="text-sm font-black mb-2">Coaching cues</div>
              <div className="exercise-reference-media rounded-2xl overflow-hidden border-4 border-black mb-1">
                <img className="exercise-reference-image" src={currentExerciseImage} alt={`${currentExercise.name} visual reference`} onError={onExerciseImageError} />
              </div>
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
                <div className="text-sm font-black">Voice-guided rep count</div>
                <div className="text-6xl font-black">{state.currentRep}</div>
                <div className="text-sm font-bold">{repGuideCountdown > 0 ? `Starting in ${repGuideCountdown}` : `${repGuideLabel}${isAlternateExercise(currentExercise.name) ? " - per side" : ""}`}</div>
                <div className="rep-guide-actions">
                  <Button className="h-16 w-16 p-0 border-4 border-black rounded-2xl bg-white text-black rep-guide-action rep-guide-action-icon" onClick={toggleSound} aria-label={state.soundEnabled ? "Mute voice counting" : "Unmute voice counting"}>{state.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</Button>
                  <Button className="h-16 text-lg font-black border-4 border-black rounded-2xl bg-white text-black rep-guide-action" onClick={restartRepGuide}><RotateCcw className="h-5 w-5" /> Reset</Button>
                  <Button className="h-16 text-lg font-black border-4 border-black rounded-2xl session-accent text-white rep-guide-action" onClick={toggleRepGuide}>{state.repGuideRunning || repGuideCountdown > 0 ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} {state.repGuideRunning || repGuideCountdown > 0 ? "Pause" : "Start"}</Button>
                </div>
              </div>
            ) : (
              <div className="border-4 border-black rounded-3xl p-4 text-center space-y-3">
                <div className="text-sm font-black">Set timer</div>
                <div className="text-6xl font-black">{formatSeconds(state.setDurationRemaining || currentExercise.reps)}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={toggleSetTimer}>{state.setTimerRunning ? <Pause className="mr-2 h-5 w-5" /> : <Clock3 className="mr-2 h-5 w-5" />} {state.setTimerRunning ? "Pause" : "Start"}</Button>
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSetTimer}><RotateCcw className="mr-2 h-5 w-5" /> Reset</Button>
                </div>
              </div>
            )}

            <Button className="w-full h-16 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={completeSet}><Save className="mr-2 h-5 w-5" /> Complete Set and Save</Button>

             <div className="border-4 border-black rounded-3xl p-4 text-center space-y-2">
                 <div className="text-sm font-black">Rest timer</div>
                 <div className="text-6xl font-black">{formatSeconds(state.restRemaining)}</div>
                 <div className="grid grid-cols-2 gap-3">
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={toggleRestTimer}>{state.restTimerRunning ? <Pause className="mr-2 h-5 w-5" /> : <TimerReset className="mr-2 h-5 w-5" />} {state.restTimerRunning ? "Pause" : "Start"}</Button>
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={skipRest}><ChevronRight className="mr-2 h-5 w-5" /> Skip</Button>
                 </div>
               </div>

            {syncStatus && (
              <div className="sync-indicator-row session-sync-row">
                <div className={`sync-indicator-dot ${syncConnected ? "sync-indicator-live" : "sync-indicator-warning"}`} />
                <div className="text-sm font-black">{syncStatus}</div>
              </div>
            )}
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
              <iframe className="w-full h-full" src="https://www.youtube.com/embed/5oj9-4ZQes4?start=187" title="Cooldown stretch video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <Button className="w-full h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={finishSession}><CheckCircle2 className="mr-2 h-5 w-5" /> Stretch Done, Finish Session</Button>
          </CardContent>
        </Card>
      )}

      <Card className="border-4 border-black rounded-3xl shadow-none session-panel">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button className="session-footer-button h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSession}><RotateCcw className="h-5 w-5" /> Reset</Button>
            <Button className="session-footer-button h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={navigateToToday}><House className="h-5 w-5" /> Today</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

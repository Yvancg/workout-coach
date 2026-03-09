import { CheckCircle2, ChevronRight, Clock3, Dumbbell, House, Pause, Play, RotateCcw, Save, TimerReset, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Progress } from "./ui";

function pointOnArc(cx, cy, radius, startAngle, endAngle, progress) {
  const angle = startAngle + (endAngle - startAngle) * progress;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function buildPerimeterModel(width, height) {
  const radius = Math.min(24, width * 0.12, height * 0.16);
  const arcLength = (Math.PI * radius) / 2;
  const verticalLength = Math.max(0, height - 2 * radius);
  const horizontalLength = Math.max(0, width - 2 * radius);

  return {
    radius,
    arcLength,
    verticalLength,
    horizontalLength,
    leftLength: arcLength + verticalLength + arcLength,
    topLength: horizontalLength,
    rightLength: arcLength + verticalLength + arcLength,
    bottomLength: horizontalLength,
  };
}

function appendLineTo(parts, x, y) {
  parts.push(`L ${x} ${y}`);
}

function appendArcTo(parts, radius, x, y) {
  parts.push(`A ${radius} ${radius} 0 0 1 ${x} ${y}`);
}

function buildLeftSegment(parts, width, height, model, progress) {
  const { radius, arcLength, verticalLength, leftLength } = model;
  let point = { x: radius, y: height };
  const travel = leftLength * progress;
  if (travel <= arcLength) {
    point = pointOnArc(radius, height - radius, radius, Math.PI / 2, Math.PI, travel / arcLength);
    appendArcTo(parts, radius, point.x, point.y);
    return point;
  }
  appendArcTo(parts, radius, 0, height - radius);
  if (travel <= arcLength + verticalLength) {
    point = { x: 0, y: height - radius - (travel - arcLength) };
    appendLineTo(parts, point.x, point.y);
    return point;
  }
  appendLineTo(parts, 0, radius);
  point = pointOnArc(radius, radius, radius, Math.PI, (3 * Math.PI) / 2, (travel - arcLength - verticalLength) / arcLength);
  appendArcTo(parts, radius, point.x, point.y);
  return point;
}

function buildTopSegment(parts, width, height, model, progress) {
  const { radius, horizontalLength } = model;
  const point = { x: radius + horizontalLength * progress, y: 0 };
  appendLineTo(parts, point.x, point.y);
  return point;
}

function buildRightSegment(parts, width, height, model, progress) {
  const { radius, arcLength, verticalLength, rightLength } = model;
  let point = { x: width - radius, y: 0 };
  const travel = rightLength * progress;
  if (travel <= arcLength) {
    point = pointOnArc(width - radius, radius, radius, (3 * Math.PI) / 2, Math.PI * 2, travel / arcLength);
    appendArcTo(parts, radius, point.x, point.y);
    return point;
  }
  appendArcTo(parts, radius, width, radius);
  if (travel <= arcLength + verticalLength) {
    point = { x: width, y: radius + (travel - arcLength) };
    appendLineTo(parts, point.x, point.y);
    return point;
  }
  appendLineTo(parts, width, height - radius);
  point = pointOnArc(width - radius, height - radius, radius, 0, Math.PI / 2, (travel - arcLength - verticalLength) / arcLength);
  appendArcTo(parts, radius, point.x, point.y);
  return point;
}

function buildBottomSegment(parts, width, height, model, progress) {
  const { radius, horizontalLength } = model;
  const point = { x: width - radius - horizontalLength * progress, y: height };
  appendLineTo(parts, point.x, point.y);
  return point;
}

function buildTrace(borderProgress, width, height) {
  const model = buildPerimeterModel(width, height);
  const segmentProgress = borderProgress.segmentProgress || (() => {
    const totalLength = model.leftLength + model.topLength + model.rightLength + model.bottomLength;
    let remaining = totalLength * (borderProgress.progress || 0);
    const lengths = [model.leftLength, model.topLength, model.rightLength, model.bottomLength];
    return lengths.map((length) => {
      const fill = Math.max(0, Math.min(1, remaining / length));
      remaining -= length;
      return fill;
    });
  })();

  const parts = [`M ${model.radius} ${height}`];
  let point = { x: model.radius, y: height };

  if (segmentProgress[0] > 0) {
    point = buildLeftSegment(parts, width, height, model, Math.min(1, segmentProgress[0]));
    if (segmentProgress[0] < 1) return { path: parts.join(' '), point };
  } else {
    return { path: '', point: null };
  }

  if (segmentProgress[1] > 0) {
    point = buildTopSegment(parts, width, height, model, Math.min(1, segmentProgress[1]));
    if (segmentProgress[1] < 1) return { path: parts.join(' '), point };
  } else {
    return { path: parts.join(' '), point };
  }

  if (segmentProgress[2] > 0) {
    point = buildRightSegment(parts, width, height, model, Math.min(1, segmentProgress[2]));
    if (segmentProgress[2] < 1) return { path: parts.join(' '), point };
  } else {
    return { path: parts.join(' '), point };
  }

  if (segmentProgress[3] > 0) {
    point = buildBottomSegment(parts, width, height, model, Math.min(1, segmentProgress[3]));
  }

  return { path: parts.join(' '), point };
}

function PerimeterProgressFrame({ borderProgress, className, children }) {
  const frameRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!frameRef.current || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  const overlay = useMemo(() => {
    const width = size.width;
    const height = size.height;
    if (!width || !height || !borderProgress?.active) return null;

    const trace = buildTrace(borderProgress, width, height);
    if (!trace.path || !trace.point) return null;

    return (
      <svg className="perimeter-progress-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="perimeter-dot-glow" x="-200%" y="-200%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path d={trace.path} className="perimeter-progress-stroke" />
        <g filter="url(#perimeter-dot-glow)">
          <circle cx={trace.point.x} cy={trace.point.y} r="6.5" className="perimeter-progress-dot-glow" />
          <circle cx={trace.point.x} cy={trace.point.y} r="4.5" className="perimeter-progress-dot" />
        </g>
      </svg>
    );
  }, [borderProgress, size.height, size.width]);

  return (
    <div ref={frameRef} className={`perimeter-progress-frame ${className}`}>
      {overlay}
      <div className="perimeter-progress-content">{children}</div>
    </div>
  );
}

export function SessionTab({
  state,
  exercises,
  currentExercise,
  sessionProgress,
  resolvedCurrentWeight,
  currentExerciseImage,
  repGuideLabel,
  repGuideCountdown,
  repGuideBorderProgress,
  setTimerBorderProgress,
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

            <div className="grid grid-cols-2 gap-3">
              <div className="border-4 border-black rounded-3xl p-4 text-center">
                <div className="text-sm font-black">Set number</div>
                <div className="text-5xl font-black mt-2">{state.currentSet}<span className="text-3xl">/{currentExercise.sets}</span></div>
              </div>
              <div className="border-4 border-black rounded-3xl p-4 text-center">
                <div className="text-sm font-black">{currentExercise.isTime ? "Target time" : "Target reps"}</div>
                <div className="text-5xl font-black mt-2">{currentExercise.isTime ? formatSeconds(currentExercise.reps) : currentExercise.reps}</div>
              </div>
            </div>

            {!currentExercise.isTime ? (
              <PerimeterProgressFrame borderProgress={repGuideBorderProgress} className="border-4 border-black rounded-3xl p-4 text-center perimeter-progress-card rep-guide-progress-card">
                <div className="text-sm font-black rep-guide-title">Voice-guided rep count</div>
                <div className="text-6xl font-black rep-guide-value">{state.currentRep}</div>
                <div className="text-sm font-bold rep-guide-status-line">{repGuideCountdown > 0 ? `Starting in ${repGuideCountdown}` : state.repGuideRunning ? `${repGuideLabel}${isAlternateExercise(currentExercise.name) ? " - per side" : ""}` : "Ready"}</div>
                <div className="rep-guide-actions">
                  <Button className="h-16 w-16 p-0 border-4 border-black rounded-2xl bg-white text-black rep-guide-action rep-guide-action-icon" onClick={toggleSound} aria-label={state.soundEnabled ? "Mute voice counting" : "Unmute voice counting"}>{state.soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</Button>
                  <Button className="h-16 text-lg font-black border-4 border-black rounded-2xl bg-white text-black rep-guide-action" onClick={restartRepGuide}><RotateCcw className="h-5 w-5" /> Reset</Button>
                  <Button className="h-16 text-lg font-black border-4 border-black rounded-2xl session-accent text-white rep-guide-action" onClick={toggleRepGuide}>{state.repGuideRunning || repGuideCountdown > 0 ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />} {state.repGuideRunning || repGuideCountdown > 0 ? "Pause" : "Start"}</Button>
                </div>
              </PerimeterProgressFrame>
            ) : (
              <PerimeterProgressFrame borderProgress={setTimerBorderProgress} className="border-4 border-black rounded-3xl p-4 text-center perimeter-progress-card rep-guide-progress-card">
                <div className="text-sm font-black rep-guide-title">Set timer</div>
                <div className="text-6xl font-black rep-guide-value">{formatSeconds(state.setDurationRemaining || currentExercise.reps)}</div>
                <div className="rep-guide-status-line" />
                <div className="grid grid-cols-2 gap-3 rep-guide-actions rep-guide-actions-timer">
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl session-accent text-white" onClick={toggleSetTimer}>{state.setTimerRunning ? <Pause className="mr-2 h-5 w-5" /> : <Clock3 className="mr-2 h-5 w-5" />} {state.setTimerRunning ? "Pause" : "Start"}</Button>
                  <Button className="h-14 text-xl font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSetTimer}><RotateCcw className="mr-2 h-5 w-5" /> Reset</Button>
                </div>
              </PerimeterProgressFrame>
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

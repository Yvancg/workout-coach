import { ArrowUpRight, Download, Play, Volume2, VolumeX } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "./ui";

export function TodayTab({
  state,
  programs,
  currentProgramMeta,
  nextWorkout,
  completedTodaySets,
  latestSession,
  installApp,
  startSession,
  updateState,
  syncConnected,
  syncTarget,
  syncStatus,
  syncUrlLooksLikeSpreadsheet,
}) {
  return (
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
              {Object.keys(programs).map((program) => (
                <option key={program} value={program}>{program}</option>
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
            <Input className="border-4 border-black rounded-2xl p-3 text-sm font-semibold" placeholder="Example: 1, 2, 3, 4, 5, 6" value={state.availableWeights} onChange={(e) => updateState({ availableWeights: e.target.value })} />
            <p className="mt-1 text-xs font-semibold">Enter each dumbbell weight in kg. Exercise suggestions will use this list.</p>
          </div>

          <div>
            <label className="block text-sm font-black mb-1">Cloudflare sync API URL</label>
            <Input className="border-4 border-black rounded-2xl p-3 text-sm font-semibold" placeholder="https://workout-coach-api.your-name.workers.dev" value={state.syncApiUrl} onChange={(e) => updateState({ syncApiUrl: e.target.value })} />
            <p className="mt-1 text-xs font-semibold">Paste your Cloudflare Worker base URL here for production sync. In local dev, leaving this blank uses the proxied `/api` Worker automatically.</p>
            {syncUrlLooksLikeSpreadsheet && <p className="mt-1 text-xs font-bold">That still looks like a spreadsheet link. This field should point to your Worker URL.</p>}
          </div>

          <div>
            <label className="block text-sm font-black mb-1">Session note</label>
            <Input className="border-4 border-black rounded-2xl p-3 text-sm font-semibold" placeholder="Optional note for today" value={state.todayNote} onChange={(e) => updateState({ todayNote: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button className={`h-14 text-lg font-black border-4 border-black rounded-2xl ${state.soundEnabled ? "today-accent" : "bg-white text-black"}`} onClick={() => updateState({ soundEnabled: !state.soundEnabled })}>
              {state.soundEnabled ? <Volume2 className="mr-2 h-5 w-5" /> : <VolumeX className="mr-2 h-5 w-5" />} {state.soundEnabled ? "Voice On" : "Voice Off"}
            </Button>
            <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={startSession}>
              <Play className="mr-2 h-5 w-5" /> Start Session
            </Button>
          </div>

          <div className="sync-indicator-row">
            <div className={`sync-indicator-dot ${syncConnected ? "sync-indicator-live" : "sync-indicator-idle"}`} />
            <div className="text-sm font-bold">{syncConnected ? "Connected to Cloudflare sync" : syncTarget === null ? "Local-only mode" : "Cloudflare sync not connected"}</div>
          </div>
          {syncStatus && <div className="text-xs font-semibold">{syncStatus}</div>}
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
  );
}

import { Download, Ellipsis, RotateCcw } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "./ui";

export function HistoryTab({ sessionSummaries, openHistoryMenuId, setOpenHistoryMenuId, editSession, deleteSession, exportLogs, resetSession, clearAllData }) {
  return (
    <>
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
                  <div className="history-session-topline">
                    <div>
                      <div className="text-lg font-black">{session.date} • {session.program}</div>
                      <div className="text-sm font-bold">Day {session.dayType} • {session.durationMinutes || "-"} min • {session.setsCompleted} sets • {Math.round(session.totalCompleted || 0)} reps/sec • {Math.round(session.totalKg || 0)} kg total</div>
                      <div className="text-sm font-bold">Warm up {session.warmupCompleted ? "done" : "not marked"} • Stretch {session.stretchCompleted ? "done" : "not marked"}</div>
                      {session.availableWeights && <div className="text-sm font-bold">Weights: {session.availableWeights}</div>}
                      {session.note && <div className="text-sm font-bold">Note: {session.note}</div>}
                    </div>
                    <div className="history-menu-wrap">
                      <button className="history-menu-trigger" onClick={() => setOpenHistoryMenuId((prev) => prev === session.sessionId ? null : session.sessionId)} aria-label="Open session actions">
                        <Ellipsis className="h-5 w-5" />
                      </button>
                      {openHistoryMenuId === session.sessionId && (
                        <div className="history-menu">
                          <button className="history-menu-item" onClick={() => editSession(session)}>Edit session</button>
                          <button className="history-menu-item history-menu-danger" onClick={() => { setOpenHistoryMenuId(null); deleteSession(session.sessionId); }}>Delete session</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="history-exercise-list">
                  {session.exercises.map((exercise) => (
                    <div key={`${session.sessionId}-${exercise.exercise}`} className="history-exercise-row">
                      <div className="text-base font-black">{exercise.exercise}</div>
                      <div className="text-sm font-bold">{exercise.sets} x {exercise.target} {exercise.isTime ? "sec" : "reps"} • {Math.round(exercise.totalKg || 0)} kg</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-4 border-black rounded-3xl shadow-none history-panel">
        <CardHeader className="card-block-header">
          <div className="eyebrow">History</div>
          <CardTitle className="text-2xl font-black">History and Export</CardTitle>
        </CardHeader>
        <CardContent className="card-block-body space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl history-accent text-white" onClick={exportLogs}><Download className="mr-2 h-5 w-5" /> Export CSV</Button>
            <Button className="h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={resetSession}><RotateCcw className="mr-2 h-5 w-5" /> Reset</Button>
          </div>
          <Button className="w-full h-14 text-lg font-black border-4 border-black rounded-2xl bg-white text-black" onClick={clearAllData}>Clear All Local Data</Button>
          <div className="text-sm font-bold">Export downloads the raw set log saved on this device. On-screen history can also include grouped synced session summaries after login.</div>
        </CardContent>
      </Card>
    </>
  );
}

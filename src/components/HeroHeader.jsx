import { CalendarDays, ListChecks } from "lucide-react";

export function HeroHeader({ todayLabel, activeProgram, dayType }) {
  return (
    <div className="hero-card border-4 border-black rounded-3xl p-4">
      <div className="eyebrow">Workout Coach</div>
      <h1 className="text-3xl font-black tracking-tight">Workout Coach: Your Simple Strength Companion</h1>
      <p className="hero-copy text-base font-semibold mt-2">We guide you through effective dumbbell workouts with a clear flow. Follow the program of the day, complete each set, track reps and rest, and log every exercise without losing focus.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {todayLabel}</div>
        <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black flex items-center gap-2"><ListChecks className="h-4 w-4" /> {activeProgram}</div>
        <div className="border-4 border-black rounded-2xl px-3 py-2 text-sm font-black">Day {dayType}</div>
      </div>
    </div>
  );
}

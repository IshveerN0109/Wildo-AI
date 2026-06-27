import { useState } from "react";
import { useStudent } from "@/contexts/StudentContext";
import { type Level, O_LEVEL_SUBJECTS, A_LEVEL_SUBJECTS } from "@/lib/constants";
import { GraduationCap, BookOpen, ChevronRight } from "lucide-react";

const levels: { value: Level; label: string; badge: string; description: string; count: number; examples: string[] }[] = [
  {
    value: "O Level",
    label: "O Level",
    badge: "CAIE O Level",
    description: "Equivalent to IGCSE. Typically taken at age 15–17 before A Levels.",
    count: O_LEVEL_SUBJECTS.length,
    examples: ["Mathematics", "Physics", "Business Studies", "Additional Mathematics"],
  },
  {
    value: "A Level",
    label: "A Level",
    badge: "CAIE A Level",
    description: "Advanced Level. Typically taken at age 17–19, often for university entry.",
    count: A_LEVEL_SUBJECTS.length,
    examples: ["Mathematics", "Economics", "Further Mathematics", "Law"],
  },
];

export default function Onboarding() {
  const { setLevel } = useStudent();
  const [selected, setSelected] = useState<Level | null>(null);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">

        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold font-serif text-foreground tracking-tight">
            Welcome to Cambridge AI Tutor
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Your personal study companion for Cambridge International Examinations.
            Let's start by setting up your profile.
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Which level are you studying?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {levels.map((lvl) => (
              <button
                key={lvl.value}
                onClick={() => setSelected(lvl.value)}
                className={`group relative text-left rounded-2xl border-2 p-6 transition-all duration-200 focus:outline-none
                  ${selected === lvl.value
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
                  }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wide
                      ${selected === lvl.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {lvl.badge}
                    </span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                      ${selected === lvl.value ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                      {selected === lvl.value && (
                        <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold font-serif text-foreground">{lvl.label}</h2>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{lvl.description}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {lvl.count} subjects including
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {lvl.examples.map(ex => (
                        <span key={ex} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground">
                          <BookOpen className="w-3 h-3" />
                          {ex}
                        </span>
                      ))}
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-xs text-muted-foreground">
                        +{lvl.count - lvl.examples.length} more
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => selected && setLevel(selected)}
            disabled={!selected}
            className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-base transition-all duration-200
              ${selected
                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
          >
            Start Studying
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          You can change your level anytime from the sidebar.
        </p>
      </div>
    </div>
  );
}

import {
  Brain,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Library,
  Mic,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WILDO_LOGO } from "@/lib/branding";

const features: {
  title: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    title: "AI Tutor",
    description: "Ask Cambridge-focused questions and get help with your subjects.",
    icon: Brain,
  },
  {
    title: "Dashboard",
    description: "Keep track of your study activity and progress.",
    icon: LayoutDashboard,
  },
  {
    title: "Timed quizzes",
    description: "Practise syllabus topics under timed conditions.",
    icon: Zap,
  },
  {
    title: "Notes",
    description: "Create and review subject notes.",
    icon: BookOpen,
  },
  {
    title: "Flashcards",
    description: "Review key facts and concepts with flashcard sets.",
    icon: Library,
  },
  {
    title: "Oral English practice",
    description: "Practise speaking and receive feedback.",
    icon: Mic,
  },
];

export default function GuestExplore({ onSignIn }: { onSignIn: () => void }) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center gap-3">
          <img
            src={WILDO_LOGO}
            alt="Wildo"
            className="h-12 w-12 rounded-xl border bg-white object-contain p-1"
          />
          <div>
            <p className="font-serif text-xl font-bold text-foreground">Wildo</p>
            <p className="text-xs text-muted-foreground">Cambridge AI Tutor</p>
          </div>
          <span className="ml-auto rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Guest preview
          </span>
        </header>

        <section className="mt-12 rounded-3xl border bg-card p-7 shadow-sm sm:mt-16 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <GraduationCap className="h-6 w-6" />
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Explore Wildo
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Take a look at the study tools. Guest visits are temporary and are not saved. Sign in when you’re ready to use the AI Tutor or your study tools.
            </p>
            <Button type="button" onClick={onSignIn} className="mt-6">
              Sign in to study
            </Button>
          </div>

          <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-2xl border bg-background p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-semibold text-foreground">{title}</h2>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <p className="mt-4 text-xs font-medium text-muted-foreground">Sign in required to use</p>
              </article>
            ))}
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-muted-foreground">
          No account activity, level choice, or study work is stored in guest mode.
        </p>
      </div>
    </main>
  );
}
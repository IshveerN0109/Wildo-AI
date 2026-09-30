import { Link } from "wouter";
import { CalendarDays, CreditCard, Flame, Gift, LogIn, MessageCircle, ShieldCheck, Star, User } from "lucide-react";
import { useGetStreak, useGetSubscriptionUsage } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

function percent(value: number, target: number) {
  return Math.min(100, Math.round((value / Math.max(target, 1)) * 100));
}

const FEATURE_LABELS: Record<string, string> = {
  tutorMessage: "AI Tutor questions",
  noteGeneration: "AI note generations",
  quizGeneration: "AI quiz generations",
  flashcardGeneration: "AI flashcard generations",
  oralPractice: "Oral practice evaluations",
};

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated, login } = useAuth();
  const { data: streak, isLoading: streakLoading } = useGetStreak();
  const { data: subscription, isLoading: subscriptionLoading } = useGetSubscriptionUsage();

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Student"
    : "Student";
  const rewardWeeks = streak?.rewardWeeks ?? 26;
  const currentStreak = streak?.currentStreak ?? 0;
  const currentWeekDays = streak?.currentWeekDays ?? 0;
  const todayQuestions = streak?.todayQuestions ?? 0;
  const weeklyTarget = streak?.weeklyDayTarget ?? 6;
  const dailyTarget = streak?.dailyQuestionTarget ?? 50;
  const currentWeek = streak?.weekHistory?.[0];

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <div className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <h1 className="mt-5 font-serif text-3xl font-bold">Your profile</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in to see your name, study streak, weekly progress, and Wildo reward status.
          </p>
          <Button type="button" onClick={login} className="mt-6">
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" data-testid="page-profile">
      <header className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-sm md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/65">
              <User className="h-4 w-4" /> Student profile
            </div>
            <h1 className="mt-3 font-serif text-3xl font-bold md:text-4xl">{displayName}</h1>
            <p className="mt-2 text-sm text-primary-foreground/75">
              {user?.email ?? "Your Wildo learning profile"}
            </p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/10">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={displayName} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <User className="h-8 w-8 text-primary-foreground/75" />
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-7" data-testid="card-study-streak">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Study streak</p>
              <h2 className="mt-2 font-serif text-2xl font-bold">
                {currentStreak} qualifying week{currentStreak === 1 ? "" : "s"} 🔥
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                One flame for every completed week, up to your six-month reward.
              </p>
            </div>
            <div className="rounded-xl bg-orange-500/10 p-3 text-orange-500">
              <Flame className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-orange-500/15 bg-orange-500/5 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">This week</span>
              <span className="font-semibold text-orange-600 dark:text-orange-300">
                {currentWeekDays}/{weeklyTarget} qualifying days
              </span>
            </div>
            <Progress value={percent(currentWeekDays, weeklyTarget)} className="mt-3 h-2 bg-orange-500/10 [&>div]:bg-orange-500" />
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A day qualifies after at least {dailyTarget} questions. A week qualifies at {weeklyTarget} of 7 days.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <span>Today: <strong className="text-foreground">{todayQuestions}/{dailyTarget}</strong> Tutor questions</span>
            </div>
            <Progress value={percent(todayQuestions, dailyTarget)} className="mt-2 h-1.5 bg-secondary [&>div]:bg-primary" />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Six-month flame track</p>
              <span className="text-xs text-muted-foreground">{Math.min(currentStreak, rewardWeeks)}/{rewardWeeks} weeks</span>
            </div>
            {streakLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-muted" />
            ) : (
              <div className="grid grid-cols-7 gap-2 sm:grid-cols-13" data-testid="flame-track">
                {Array.from({ length: rewardWeeks }, (_, index) => {
                  const earned = index < currentStreak;
                  const next = !earned && index === currentStreak && currentWeekDays > 0;
                  return (
                    <div key={index} className={`flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 ${earned ? "border-orange-500/25 bg-orange-500/10" : next ? "border-primary/25 bg-primary/5" : "border-border bg-background"}`}>
                      {earned ? <Flame className="h-4 w-4 fill-orange-500 text-orange-500" /> : next ? <Flame className="h-4 w-4 text-primary/50" /> : <span className="h-4 text-sm text-muted-foreground/40">·</span>}
                      <span className="text-[10px] text-muted-foreground">{index + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-start gap-3 border-t pt-5">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {streak?.rewardStatus === "reset"
                ? "Your previous week had five or fewer qualifying days, so the weekly streak has reset. Start building it again this week."
                : currentWeek
                  ? `Current week started ${currentWeek.weekStart}. Keep reaching ${dailyTarget} questions on at least ${weeklyTarget} days to earn the next flame.`
                  : "Start asking the Tutor questions to begin your first qualifying week."}
            </p>
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6" data-testid="card-subscription">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h2 className="font-bold">{subscription?.planName ?? "Plan"} usage</h2>
              </div>
              {subscription && (
                <span className="text-xs text-muted-foreground">
                  Resets {format(new Date(subscription.currentPeriodEnd), "MMM d")}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Included with your account. Limits reset every month.
            </p>
            <div className="mt-4 space-y-3.5">
              {subscriptionLoading ? (
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
              ) : (
                subscription?.usage.map((u) => (
                  <div key={u.feature}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-foreground">{FEATURE_LABELS[u.feature] ?? u.feature}</span>
                      <span className="text-muted-foreground">{u.used}/{u.limit}</span>
                    </div>
                    <Progress
                      value={percent(u.used, u.limit)}
                      className={`mt-1.5 h-1.5 ${u.remaining === 0 ? "[&>div]:bg-destructive" : ""}`}
                    />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={`rounded-2xl border p-5 shadow-sm md:p-6 ${streak?.nextMonthFreeEligible ? "border-emerald-500/25 bg-emerald-500/5" : "border-primary/15 bg-accent/35"}`} data-testid="card-reward">
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${streak?.nextMonthFreeEligible ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"}`}>
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Wildo reward</p>
                <h2 className="mt-2 text-xl font-bold">
                  {streak?.nextMonthFreeEligible ? "Next month free unlocked" : `${streak?.weeksUntilReward ?? rewardWeeks} weeks to go`}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {streak?.nextMonthFreeEligible
                    ? "You completed six months of qualifying study. Your account is eligible for the next-month-free reward."
                    : "Reach six qualifying days every week for six months. Each qualifying day needs at least 50 Tutor questions."}
                </p>
              </div>
            </div>
            {streak?.nextMonthFreeEligible && (
              <div className="mt-5 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Six-month study requirement complete
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm md:p-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
              <h2 className="font-bold">Keep your streak fair</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Wildo counts questions sent to the AI Tutor. A week with five or fewer qualifying days resets the streak, so the flames represent consistent study rather than one busy day.
            </p>
            <Link href="/tutor">
              <Button className="mt-5 w-full" variant="outline">
                <MessageCircle className="h-4 w-4" /> Ask the AI Tutor
              </Button>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
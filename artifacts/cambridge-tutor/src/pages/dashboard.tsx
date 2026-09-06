import { useGetStudySummary, useGetRecentActivity, useGetStreak } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, Library, Flame, Trophy, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetStudySummary();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();
  const { data: streak } = useGetStreak();

  if (loadingSummary || loadingActivity) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-2">Here is a summary of your Cambridge studies.</p>
      </div>

      {/* Streak banner */}
      {currentStreak > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-2xl border bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border-orange-200 dark:border-orange-800">
          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-orange-700 dark:text-orange-300">
              {currentStreak} week streak — keep it up! 🔥
            </p>
            <p className="text-xs text-orange-500 mt-0.5">
              Longest streak: {longestStreak} week{longestStreak !== 1 ? "s" : ""} · Reach 6 qualifying days each week to grow it
            </p>
          </div>
          {currentStreak >= longestStreak && longestStreak > 1 && (
            <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded-full">
              <Trophy className="w-3 h-3" /> Personal best!
            </div>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <Brain className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalConversations || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Chat sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Notes</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalNotes || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Saved notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Flashcard Sets</CardTitle>
            <Library className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalFlashcardSets || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Active decks</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Continue your revision</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/tutor">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Brain className="mr-2 h-5 w-5" />
                Ask AI Tutor a question
              </Button>
            </Link>
            <Link href="/quiz">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Zap className="mr-2 h-5 w-5 text-amber-500" />
                Take a timed quiz
              </Button>
            </Link>
            <Link href="/notes">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Create a study note
              </Button>
            </Link>
            <Link href="/flashcards">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Library className="mr-2 h-5 w-5" />
                Review flashcards
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest study items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activity?.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="bg-primary/10 p-2 rounded-full shrink-0">
                    {item.type === "note"        ? <BookOpen className="h-4 w-4 text-primary" /> :
                     item.type === "flashcard"   ? <Library  className="h-4 w-4 text-primary" /> :
                                                   <Brain    className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subject} · {item.level}</p>
                  </div>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useGetStudySummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, Library } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetStudySummary();
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity();

  if (loadingSummary || loadingActivity) {
    return <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-32 bg-muted rounded"></div>
      </div>
    </div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold font-serif text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-2">Here is a summary of your Cambridge studies.</p>
      </div>

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
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
            <CardDescription>Continue your revision</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/tutor">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <Brain className="mr-2 h-5 w-5" />
                Ask AI Tutor a question
              </Button>
            </Link>
            <Link href="/notes">
              <Button className="w-full justify-start" variant="outline" size="lg">
                <BookOpen className="mr-2 h-5 w-5" />
                Create a new study note
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

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest study items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activity?.map((item) => (
                <div key={`${item.type}-${item.id}`} className="flex items-start gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                  <div className="bg-primary/10 p-2 rounded-full">
                    {item.type === 'note' ? <BookOpen className="h-4 w-4 text-primary" /> :
                     item.type === 'flashcard' ? <Library className="h-4 w-4 text-primary" /> :
                     <Brain className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.subject} • {item.level}</p>
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

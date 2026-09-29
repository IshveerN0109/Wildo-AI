import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { StudentProvider, useStudent } from "@/contexts/StudentContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogIn } from "lucide-react";

import Dashboard from "@/pages/dashboard";
import Tutor from "@/pages/tutor";
import Notes from "@/pages/notes";
import NoteDetail from "@/pages/note-detail";
import Flashcards from "@/pages/flashcards";
import FlashcardDetail from "@/pages/flashcard-detail";
import Revision from "@/pages/revision";
import Onboarding from "@/pages/onboarding";
import Terms from "@/pages/terms";
import Quiz from "@/pages/quiz";
import OralPractice from "@/pages/oral-practice";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function SignInRequired() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-3xl font-bold text-foreground">Sign in to study with Wildo</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your student profile, notes, conversations, flashcards, quizzes, and study progress are saved securely to your account so you can access them anywhere.
        </p>
        <Button type="button" onClick={login} className="mt-6">
          <LogIn className="h-4 w-4" />
          Sign in to continue
        </Button>
      </div>
    </div>
  );
}

function Router() {
  const { level, isLoading } = useStudent();
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  if (authLoading) {
    return <div className="min-h-screen bg-background" aria-label="Loading student profile" />;
  }
  if (!isAuthenticated) return <SignInRequired />;
  if (isLoading) {
    return <div className="min-h-screen bg-background" aria-label="Loading student profile" />;
  }
  if (!level) {
    return <Onboarding />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Tutor} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/tutor" component={Tutor} />
        <Route path="/notes" component={Notes} />
        <Route path="/notes/:id" component={NoteDetail} />
        <Route path="/flashcards" component={Flashcards} />
        <Route path="/flashcards/:id" component={FlashcardDetail} />
        <Route path="/revision" component={Revision} />
        <Route path="/quiz" component={Quiz} />
        <Route path="/oral-practice" component={OralPractice} />
        <Route path="/profile" component={Profile} />
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <StudentProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </StudentProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

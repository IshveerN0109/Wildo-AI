import { useState } from "react";
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
import GuestExplore from "@/pages/guest-explore";
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
import Plans from "@/pages/plans";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function SignInRequired({ onExploreAsGuest }: { onExploreAsGuest: () => void }) {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="font-serif text-3xl font-bold text-foreground">Study with Wildo</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to use the AI Tutor and save your level and study progress to your account.
        </p>
        <div className="mt-6 grid gap-3">
          <Button type="button" onClick={login}>
            <LogIn className="h-4 w-4" />
            Sign in to continue
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onExploreAsGuest}
          >
            Explore as a guest
          </Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Guests can look around, but AI and study tools require an account. Guest activity is not saved.
        </p>
      </div>
    </div>
  );
}

function Router({
  isGuest,
  onContinueAsGuest,
}: {
  isGuest: boolean;
  onContinueAsGuest: () => void;
}) {
  const { level, isLoading, profileLoadError, retryProfileLoad } = useStudent();
  const { isLoading: authLoading, isAuthenticated, login } = useAuth();

  if (authLoading) {
    return <div className="min-h-screen bg-background" aria-label="Loading student profile" />;
  }
  if (!isAuthenticated) {
    return isGuest ? <GuestExplore onSignIn={login} /> : <SignInRequired onExploreAsGuest={onContinueAsGuest} />;
  }
  if (isLoading) {
    return <div className="min-h-screen bg-background" aria-label="Loading student profile" />;
  }
  if (profileLoadError && !level) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="font-serif text-2xl font-bold text-foreground">Couldn’t load your student profile</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your saved study level is still on your account. Try again to continue.
          </p>
          <Button type="button" onClick={retryProfileLoad} className="mt-6">
            Try again
          </Button>
        </div>
      </div>
    );
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
        <Route path="/plans" component={Plans} />
        <Route path="/terms" component={Terms} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  const [isGuest, setIsGuest] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <StudentProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router
                isGuest={isGuest}
                onContinueAsGuest={() => setIsGuest(true)}
              />
            </WouterRouter>
          </StudentProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

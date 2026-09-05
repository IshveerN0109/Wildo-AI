import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/AppShell";
import { StudentProvider, useStudent } from "@/contexts/StudentContext";
import { AuthProvider } from "@/contexts/AuthContext";

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
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  const { level } = useStudent();

  if (!level) {
    return <Onboarding />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/tutor" component={Tutor} />
        <Route path="/notes" component={Notes} />
        <Route path="/notes/:id" component={NoteDetail} />
        <Route path="/flashcards" component={Flashcards} />
        <Route path="/flashcards/:id" component={FlashcardDetail} />
        <Route path="/revision" component={Revision} />
        <Route path="/quiz" component={Quiz} />
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

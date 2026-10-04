import { Link, useLocation } from "wouter";
import { BookOpen, Brain, LayoutDashboard, Library, Settings, ChevronDown, GraduationCap, LogIn, LogOut, User, Zap, Flame, Mic, Menu, X, Star, Coins } from "lucide-react";
import { useGetStreak, useGetSubscriptionUsage, getGetSubscriptionUsageQueryKey, type SubscriptionFeature } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useStudent } from "@/contexts/StudentContext";
import { useAuth } from "@/contexts/AuthContext";
import { WILDO_LOGO } from "@/lib/branding";
import { SUBSCRIPTION_FEATURE_LABELS } from "@/lib/constants";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";

// Mutations that consume a quota unit server-side (see requireQuota() call
// sites in api-server/src/routes). Tutor chat sends go through a raw fetch
// for SSE streaming, not a react-query mutation, so it's invalidated
// manually in tutor.tsx instead of being caught here.
const QUOTA_MUTATION_KEYS = new Set(["generateNote", "generateFlashcardSet", "generateQuiz", "evaluateOralPractice"]);

const FEATURE_BY_PATH: Record<string, SubscriptionFeature> = {
  "/tutor": "tutorMessage",
  "/notes": "noteGeneration",
  "/quiz": "quizGeneration",
  "/flashcards": "flashcardGeneration",
  "/oral-practice": "oralPractice",
};

function percent(used: number, limit: number) {
  return Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
}

function CreditsIndicator({ location, isAuthenticated }: { location: string; isAuthenticated: boolean }) {
  const { data: subscription } = useGetSubscriptionUsage({
    query: { enabled: isAuthenticated, queryKey: getGetSubscriptionUsageQueryKey() },
  });
  if (!isAuthenticated || !subscription || subscription.usage.length === 0) return null;

  const pathFeature = Object.entries(FEATURE_BY_PATH).find(([path]) => location.startsWith(path))?.[1];
  const current = pathFeature ? subscription.usage.find((u) => u.feature === pathFeature) : null;

  const label = current ? SUBSCRIPTION_FEATURE_LABELS[current.feature] ?? current.feature : "Credits this month";
  const used = current ? current.used : subscription.usage.reduce((sum, u) => sum + u.used, 0);
  const limit = current ? current.limit : subscription.usage.reduce((sum, u) => sum + u.limit, 0);
  const remaining = current ? current.remaining : Math.max(0, limit - used);

  return (
    <Link href="/plans">
      <div className="rounded-lg px-3 py-2.5 bg-sidebar-accent/40 hover:bg-sidebar-accent/60 transition-colors cursor-pointer">
        <div className="flex items-center gap-1.5 text-xs">
          <Coins className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate text-sidebar-foreground/80">{label}</span>
          <span className={`ml-auto font-medium shrink-0 ${remaining === 0 ? "text-destructive" : "text-sidebar-foreground"}`}>
            {remaining} left
          </span>
        </div>
        <Progress value={percent(used, limit)} className={`mt-1.5 h-1.5 ${remaining === 0 ? "[&>div]:bg-destructive" : ""}`} />
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { level, setLevel } = useStudent();
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.mutation.state.status !== "success") return;
      const key = event.mutation.options.mutationKey?.[0];
      if (typeof key === "string" && QUOTA_MUTATION_KEYS.has(key)) {
        queryClient.invalidateQueries({ queryKey: getGetSubscriptionUsageQueryKey() });
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const navItems = [
    { href: "/tutor", label: "AI Tutor", icon: Brain, featured: true },
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/quiz", label: "Timed Quiz", icon: Zap },
    { href: "/notes", label: "Notes", icon: BookOpen },
    { href: "/flashcards", label: "Flashcards", icon: Library },
    { href: "/revision", label: "Revision Mode", icon: GraduationCap },
    { href: "/oral-practice", label: "Oral English practice", icon: Mic },
    { href: "/profile", label: "My profile", icon: User },
  ];

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Student"
    : null;

  const { data: streak } = useGetStreak();

  useEffect(() => {
    setShowMobileMenu(false);
  }, [location]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowMobileMenu(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showMobileMenu]);

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {showMobileMenu && (
        <button
          type="button"
          aria-label="Close navigation menu"
          data-testid="button-mobile-menu-backdrop"
          onClick={() => setShowMobileMenu(false)}
          className="fixed inset-0 z-40 bg-slate-950/45 md:hidden"
        />
      )}
      <aside
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,calc(100vw-3rem))] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ease-out md:relative md:inset-auto md:z-auto md:w-64 md:translate-x-0 md:shadow-none ${showMobileMenu ? "pointer-events-auto translate-x-0" : "pointer-events-none -translate-x-full md:pointer-events-auto"}`}
      >
        <div className="p-5 border-b border-sidebar-border/50">
          <div className="flex items-center gap-3">
            <img
              src={WILDO_LOGO}
              alt="Wildo logo"
              className="w-10 h-10 rounded-full object-contain bg-white ring-2 ring-primary/30 flex-shrink-0"
            />
            <div>
              <h1 className="text-lg font-bold text-sidebar-primary tracking-tight font-serif leading-tight">Wildo</h1>
              <p className="text-[11px] text-sidebar-foreground/50 leading-tight">Cambridge AI Tutor</p>
            </div>
          </div>
          {level && (
            <div className="mt-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary/20 text-primary">
                {level}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div onClick={() => setShowMobileMenu(false)} className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : item.featured ? "bg-sidebar-primary/10 text-sidebar-primary hover:bg-sidebar-primary/20" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.featured && <Star className="ml-auto h-3.5 w-3.5 fill-current text-amber-300" aria-label="Main study space" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50 space-y-2">
          {!authLoading && (
            <div className="relative">
              {isAuthenticated && user ? (
                <>
                  <button
                    onClick={() => setShowUserMenu(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 transition-colors"
                  >
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={displayName ?? ""} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
                      {user.email && <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-sidebar-foreground/50 flex-shrink-0 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 bg-card border rounded-lg shadow-lg overflow-hidden z-50">
                      <p className="px-3 py-2 text-xs text-muted-foreground font-medium border-b">Account</p>
                      <button
                        onClick={logout}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-destructive font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={login}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to save progress
                </button>
              )}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowLevelMenu(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors text-sm"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span>Change Level</span>
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${showLevelMenu ? "rotate-180" : ""}`} />
            </button>
            {showLevelMenu && (
              <div className="absolute bottom-full mb-1 left-0 right-0 bg-card border rounded-lg shadow-lg overflow-hidden z-50">
                <p className="px-3 py-2 text-xs text-muted-foreground font-medium border-b">Switch your level</p>
                {(["O Level", "A Level"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={level === option}
                    onClick={() => {
                      setLevel(option);
                      setShowLevelMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
                      level === option ? "font-semibold text-primary" : "text-foreground"
                    }`}
                  >
                    {option}{level === option ? " · Current" : ""}
                  </button>
                ))}
              </div>
            )}
          </div>

          <CreditsIndicator location={location} isAuthenticated={isAuthenticated} />

          {/* Streak */}
          {streak && streak.currentStreak > 0 && (
            <Link href="/quiz">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors cursor-pointer">
                <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 leading-tight">
                    {streak.currentStreak} week streak 🔥
                  </p>
                   <p className="text-[10px] text-orange-500/70 leading-tight">Best: {streak.longestStreak} weeks</p>
                </div>
              </div>
            </Link>
          )}

          {/* Creator credit */}
          <div className="pt-2 border-t border-sidebar-border/30 mt-1">
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <img
                src={WILDO_LOGO}
                alt="Wildo"
                className="w-5 h-5 rounded-full object-contain bg-white opacity-70"
              />
              <span className="text-[11px] text-sidebar-foreground/40 font-medium">Wildo · Created by I.Nairoo</span>
            </div>
            <Link href="/terms">
              <span className="text-[10px] text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors cursor-pointer px-1">
                Terms & Conditions · Privacy Policy
              </span>
            </Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <header className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background px-4 py-3 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={WILDO_LOGO}
              alt="Wildo logo"
              className="h-9 w-9 shrink-0 rounded-full object-contain bg-white ring-2 ring-primary/20"
            />
            <div className="min-w-0">
              <p className="truncate font-serif text-base font-bold leading-tight text-primary">Wildo</p>
              <p className="truncate text-[10px] leading-tight text-muted-foreground">Cambridge AI Tutor</p>
            </div>
          </div>
          <button
            type="button"
            aria-label={showMobileMenu ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={showMobileMenu}
            data-testid="button-mobile-menu"
            onClick={() => setShowMobileMenu((open) => !open)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showMobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </div>
        <div className="shrink-0 border-t border-border/40 px-6 py-2 bg-background flex items-center justify-center">
          <p className="text-[11px] text-muted-foreground/50 text-center">
            Wildo is an AI and can make mistakes — always verify important answers with your teacher or official Cambridge resources.
          </p>
        </div>
      </main>
    </div>
  );
}

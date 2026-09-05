import { Link, useLocation } from "wouter";
import { BookOpen, Brain, LayoutDashboard, Library, Settings, ChevronDown, GraduationCap, LogIn, LogOut, User, Zap, Flame, Mic } from "lucide-react";
import { useGetStreak } from "@workspace/api-client-react";
import { useStudent } from "@/contexts/StudentContext";
import { useAuth } from "@/contexts/AuthContext";
import { WILDO_LOGO } from "@/lib/branding";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { level, clearLevel } = useStudent();
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tutor", label: "AI Tutor", icon: Brain },
    { href: "/quiz", label: "Timed Quiz", icon: Zap },
    { href: "/notes", label: "Notes", icon: BookOpen },
    { href: "/flashcards", label: "Flashcards", icon: Library },
    { href: "/revision", label: "Revision Mode", icon: GraduationCap },
    { href: "/oral-practice", label: "Oral English practice", icon: Mic },
  ];

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Student"
    : null;

  const { data: streak } = useGetStreak();

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col hidden md:flex">
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
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
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
                <button
                  onClick={() => { clearLevel(); setShowLevelMenu(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors text-destructive font-medium"
                >
                  Reset & Choose Again
                </button>
              </div>
            )}
          </div>

          {/* Streak */}
          {streak && streak.currentStreak > 0 && (
            <Link href="/quiz">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 transition-colors cursor-pointer">
                <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 leading-tight">
                    {streak.currentStreak} day streak 🔥
                  </p>
                  <p className="text-[10px] text-orange-500/70 leading-tight">Best: {streak.longestStreak} days</p>
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

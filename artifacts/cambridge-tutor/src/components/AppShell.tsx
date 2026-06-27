import { Link, useLocation } from "wouter";
import { BookOpen, Brain, LayoutDashboard, Library, Settings, ChevronDown } from "lucide-react";
import { useStudent } from "@/contexts/StudentContext";
import { useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { level, clearLevel } = useStudent();
  const [showLevelMenu, setShowLevelMenu] = useState(false);

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tutor", label: "AI Tutor", icon: Brain },
    { href: "/notes", label: "Notes", icon: BookOpen },
    { href: "/flashcards", label: "Flashcards", icon: Library },
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-shrink-0 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-sidebar-border/50">
          <h1 className="text-xl font-bold text-sidebar-primary tracking-tight font-serif">Cambridge AI Tutor</h1>
          {level && (
            <div className="mt-2">
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

        <div className="p-4 border-t border-sidebar-border/50">
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
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

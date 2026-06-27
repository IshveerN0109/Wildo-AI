import { Link, useLocation } from "wouter";
import { BookOpen, Brain, LayoutDashboard, Library } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

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
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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

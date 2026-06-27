import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { type Level, getSubjectsForLevel } from "@/lib/constants";

interface StudentProfile {
  level: Level | null;
  setLevel: (level: Level) => void;
  clearLevel: () => void;
  subjects: readonly string[];
}

const StudentContext = createContext<StudentProfile>({
  level: null,
  setLevel: () => {},
  clearLevel: () => {},
  subjects: [],
});

const STORAGE_KEY = "cam_ai_student_level";

export function StudentProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<Level | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as Level) ?? null;
  });

  const setLevel = (l: Level) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLevelState(l);
  };

  const clearLevel = () => {
    localStorage.removeItem(STORAGE_KEY);
    setLevelState(null);
  };

  const subjects = level ? getSubjectsForLevel(level) : [];

  return (
    <StudentContext.Provider value={{ level, setLevel, clearLevel, subjects }}>
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  return useContext(StudentContext);
}

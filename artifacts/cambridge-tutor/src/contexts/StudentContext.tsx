import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  getGetStudentProfileQueryKey,
  useGetStudentProfile,
  useUpdateStudentProfile,
} from "@workspace/api-client-react";
import { type Level, getSubjectsForLevel } from "@/lib/constants";
import { useAuth } from "@/contexts/AuthContext";

interface StudentProfile {
  level: Level | null;
  setLevel: (level: Level) => void;
  clearLevel: () => void;
  subjects: readonly string[];
  isLoading: boolean;
}

const StudentContext = createContext<StudentProfile>({
  level: null,
  setLevel: () => {},
  clearLevel: () => {},
  subjects: [],
  isLoading: true,
});

const LEGACY_STORAGE_KEY = "cam_ai_student_level";
const GUEST_STORAGE_KEY = "cam_ai_student_level:guest";

function storageKey(userId: string | null) {
  return userId ? `cam_ai_student_level:${userId}` : GUEST_STORAGE_KEY;
}

function readStoredLevel(userId: string | null): Level | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem(storageKey(userId)) ?? (
    userId === null ? localStorage.getItem(LEGACY_STORAGE_KEY) : null
  );
  return saved === "O Level" || saved === "A Level" ? saved : null;
}

function writeStoredLevel(userId: string | null, level: Level | null) {
  if (typeof window === "undefined") return;
  const key = storageKey(userId);
  if (level) {
    localStorage.setItem(key, level);
  } else {
    localStorage.removeItem(key);
  }
  if (userId === null) localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export function StudentProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [level, setLevelState] = useState<Level | null>(() => readStoredLevel(null));
  const profileQuery = useGetStudentProfile({
    query: {
      enabled: isAuthenticated && Boolean(user),
      queryKey: getGetStudentProfileQueryKey(),
    },
  });
  const updateProfile = useUpdateStudentProfile();

  useEffect(() => {
    if (authLoading || profileQuery.isLoading) return;

    if (isAuthenticated && user) {
      const cloudLevel = profileQuery.data?.level;
      if (cloudLevel === "O Level" || cloudLevel === "A Level") {
        writeStoredLevel(user.id, cloudLevel);
        setLevelState(cloudLevel);
        return;
      }

      setLevelState(null);
      return;
    }

    setLevelState(readStoredLevel(null));
  }, [
    authLoading,
    isAuthenticated,
    profileQuery.data?.level,
    profileQuery.isLoading,
    user?.id,
  ]);

  const setLevel = (l: Level) => {
    writeStoredLevel(user?.id ?? null, l);
    setLevelState(l);
    if (isAuthenticated && user) {
      updateProfile.mutate({ data: { level: l } });
    }
  };

  const clearLevel = () => {
    writeStoredLevel(user?.id ?? null, null);
    setLevelState(null);
    if (isAuthenticated && user) {
      updateProfile.mutate({ data: { level: null } });
    }
  };

  const subjects = level ? getSubjectsForLevel(level) : [];

  return (
    <StudentContext.Provider
      value={{
        level,
        setLevel,
        clearLevel,
        subjects,
        isLoading: authLoading || (isAuthenticated && profileQuery.isLoading),
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  return useContext(StudentContext);
}

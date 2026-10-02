import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  profileLoadError: boolean;
  retryProfileLoad: () => void;
}

const StudentContext = createContext<StudentProfile>({
  level: null,
  setLevel: () => {},
  clearLevel: () => {},
  subjects: [],
  isLoading: true,
  profileLoadError: false,
  retryProfileLoad: () => {},
});

function storageKey(userId: string) {
  return `cam_ai_student_level:${userId}`;
}

function readStoredLevel(userId: string | null): Level | null {
  if (typeof window === "undefined" || !userId) return null;
  const saved = localStorage.getItem(storageKey(userId));
  return saved === "O Level" || saved === "A Level" ? saved : null;
}

function writeStoredLevel(userId: string | null, level: Level | null) {
  if (typeof window === "undefined" || !userId) return;
  const key = storageKey(userId);
  if (level) {
    localStorage.setItem(key, level);
  } else {
    localStorage.removeItem(key);
  }
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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (authLoading || profileQuery.isLoading) return;

    if (isAuthenticated && user) {
      const cloudLevel = profileQuery.data?.level;
      if (cloudLevel === "O Level" || cloudLevel === "A Level") {
        writeStoredLevel(user.id, cloudLevel);
        setLevelState(cloudLevel);
        return;
      }

      const cachedLevel = readStoredLevel(user.id);
      if (cachedLevel) {
        setLevelState(cachedLevel);
        if (profileQuery.isSuccess) {
          updateProfile.mutate(
            { data: { level: cachedLevel } },
            {
              onSuccess: (profile) => {
                queryClient.setQueryData(getGetStudentProfileQueryKey(), profile);
              },
            },
          );
        }
        return;
      }

      setLevelState(null);
      return;
    }

    setLevelState(null);
  }, [
    authLoading,
    isAuthenticated,
    profileQuery.data?.level,
    profileQuery.isSuccess,
    profileQuery.isLoading,
    user?.id,
  ]);

  const setLevel = (l: Level) => {
    writeStoredLevel(user?.id ?? null, l);
    setLevelState(l);
    if (isAuthenticated && user) {
      updateProfile.mutate(
        { data: { level: l } },
        {
          onSuccess: (profile) => {
            queryClient.setQueryData(getGetStudentProfileQueryKey(), profile);
          },
        },
      );
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
        profileLoadError: isAuthenticated && profileQuery.isError && !profileQuery.data,
        retryProfileLoad: () => {
          void profileQuery.refetch();
        },
      }}
    >
      {children}
    </StudentContext.Provider>
  );
}

export function useStudent() {
  return useContext(StudentContext);
}

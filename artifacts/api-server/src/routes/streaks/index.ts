import { Router, type IRouter } from "express";
import { db, studyActivityDays } from "@workspace/db";
import { and, asc, eq, gte, sql } from "drizzle-orm";

const router: IRouter = Router();

const DAILY_QUESTION_TARGET = 50;
const WEEKLY_DAY_TARGET = 6;
const REWARD_WEEKS = 26;

type WeekSummary = {
  weekStart: string;
  activeDays: number;
  questions: number;
  qualified: boolean;
  isCurrentWeek: boolean;
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function weekStartFor(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return dateKey(date);
}

function emptyStreak() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    lastStudiedDate: null,
    currentWeekDays: 0,
    currentWeekQuestions: 0,
    todayQuestions: 0,
    dailyQuestionTarget: DAILY_QUESTION_TARGET,
    weeklyDayTarget: WEEKLY_DAY_TARGET,
    rewardWeeks: REWARD_WEEKS,
    nextMonthFreeEligible: false,
    weeksUntilReward: REWARD_WEEKS,
    rewardStatus: "in_progress" as const,
    weekHistory: [] as WeekSummary[],
  };
}

export async function recordQuestionForUser(userId: string, activityDate = dateKey(new Date())): Promise<void> {
  await db
    .insert(studyActivityDays)
    .values({ userId, activityDate, questionCount: 1 })
    .onConflictDoUpdate({
      target: [studyActivityDays.userId, studyActivityDays.activityDate],
      set: {
        questionCount: sql`${studyActivityDays.questionCount} + 1`,
        updatedAt: new Date(),
      },
    });
}

export async function getStudyStreakSummary(userId: string) {
  const today = dateKey(new Date());
  const currentWeekStart = weekStartFor(today);
  const rangeStart = addDays(currentWeekStart, -7 * (REWARD_WEEKS * 2 + 4));
  const rows = await db
    .select()
    .from(studyActivityDays)
    .where(and(eq(studyActivityDays.userId, userId), gte(studyActivityDays.activityDate, rangeStart)))
    .orderBy(asc(studyActivityDays.activityDate));

  if (!rows.length) return emptyStreak();

  const byWeek = new Map<string, { activeDays: number; questions: number }>();
  for (const row of rows) {
    const weekStart = weekStartFor(row.activityDate);
    const week = byWeek.get(weekStart) ?? { activeDays: 0, questions: 0 };
    week.questions += row.questionCount;
    if (row.questionCount >= DAILY_QUESTION_TARGET) week.activeDays += 1;
    byWeek.set(weekStart, week);
  }

  const weekHistory: WeekSummary[] = Array.from({ length: REWARD_WEEKS + 1 }, (_, index) => {
    const weekStart = addDays(currentWeekStart, -7 * index);
    const week = byWeek.get(weekStart) ?? { activeDays: 0, questions: 0 };
    return {
      weekStart,
      activeDays: week.activeDays,
      questions: week.questions,
      qualified: week.activeDays >= WEEKLY_DAY_TARGET,
      isCurrentWeek: index === 0,
    };
  });

  const completedWeeks = weekHistory.filter((week) => !week.isCurrentWeek);
  let currentStreak = 0;
  for (const week of completedWeeks) {
    if (!week.qualified) break;
    currentStreak += 1;
  }

  let longestStreak = 0;
  let run = 0;
  for (const week of [...completedWeeks].reverse()) {
    run = week.qualified ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  const currentWeek = weekHistory[0];
  const previousWeek = weekHistory[1];
  const todayQuestions = rows.find((row) => row.activityDate === today)?.questionCount ?? 0;
  const nextMonthFreeEligible = currentStreak >= REWARD_WEEKS;
  return {
    currentStreak,
    longestStreak,
    lastStudiedDate: rows[rows.length - 1]?.activityDate ?? null,
    currentWeekDays: currentWeek.activeDays,
    currentWeekQuestions: currentWeek.questions,
    todayQuestions,
    dailyQuestionTarget: DAILY_QUESTION_TARGET,
    weeklyDayTarget: WEEKLY_DAY_TARGET,
    rewardWeeks: REWARD_WEEKS,
    nextMonthFreeEligible,
    weeksUntilReward: Math.max(0, REWARD_WEEKS - currentStreak),
    rewardStatus: nextMonthFreeEligible
      ? ("eligible" as const)
      : currentStreak === 0 && previousWeek && !previousWeek.qualified
        ? ("reset" as const)
        : ("in_progress" as const),
    weekHistory,
  };
}

router.get("/streak", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json(emptyStreak());
    return;
  }
  res.json(await getStudyStreakSummary(req.user.id));
});

router.post("/streak/record", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.json(emptyStreak());
    return;
  }
  await recordQuestionForUser(req.user.id);
  res.json(await getStudyStreakSummary(req.user.id));
});

export default router;

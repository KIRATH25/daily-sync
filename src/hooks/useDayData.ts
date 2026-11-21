import { listOccurrencesOn } from '@/db/repositories/entriesRepo';
import { listHabits, listLogs } from '@/db/repositories/habitsRepo';
import { getReview } from '@/db/repositories/reviewsRepo';
import { listTasksForDate, listOpenTasksDueBy } from '@/db/repositories/tasksRepo';
import { attendanceForDate, listSlotsForWeekday } from '@/db/repositories/timetableRepo';
import { weekdayOf, type DateKey } from '@/lib/dates';
import { isHabitDueOn } from '@/lib/habits';
import type { AttendanceStatus, DayReview, EntryOccurrence, Habit, HabitLog, Task, TimetableSlotWithSubject } from '@/types/models';

import { useLiveQuery } from './useLiveQuery';

export interface DayData {
  date: DateKey;
  occurrences: EntryOccurrence[];
  tasks: Task[];
  overdue: Task[];
  habits: Habit[];
  dueHabits: Habit[];
  logs: Record<string, HabitLog>;
  review: DayReview | null;
  classes: TimetableSlotWithSubject[];
  attendance: Record<string, AttendanceStatus>;
  /** Completion counts derived from real records */
  tasksPlanned: number;
  tasksDone: number;
  habitsPlanned: number;
  habitsDone: number;
}

export async function loadDayData(date: DateKey, today: DateKey): Promise<DayData> {
  const [occurrences, tasks, habits, logs, review, classes, attendance, openDue] = await Promise.all([
    listOccurrencesOn(date),
    listTasksForDate(date),
    listHabits(),
    listLogs(date, date),
    getReview(date),
    listSlotsForWeekday(weekdayOf(date)),
    attendanceForDate(date),
    date === today ? listOpenTasksDueBy(date) : Promise.resolve([] as Task[]),
  ]);
  const logMap = Object.fromEntries(logs.map((log) => [log.habitId, log]));
  const dueHabits = habits.filter((habit) => habit.startDate <= date && isHabitDueOn(habit.scheduleDays, date, habit.paused));
  const dueTasks = tasks.filter((task) => task.dueDate === date);
  return {
    date,
    occurrences,
    tasks,
    overdue: openDue.filter((task) => task.dueDate != null && task.dueDate < date),
    habits,
    dueHabits,
    logs: logMap,
    review,
    classes,
    attendance,
    tasksPlanned: dueTasks.length,
    tasksDone: dueTasks.filter((task) => task.completedAt != null).length,
    habitsPlanned: dueHabits.length,
    habitsDone: dueHabits.filter((habit) => logMap[habit.id]?.completed).length,
  };
}

export function useDayData(date: DateKey, today: DateKey) {
  return useLiveQuery(
    () => loadDayData(date, today),
    [
      'calendar_entries',
      'entry_completions',
      'tasks',
      'task_subtasks',
      'habits',
      'habit_logs',
      'day_reviews',
      'timetable_slots',
      'subjects',
      'attendance_records',
    ],
    [date, today],
  );
}

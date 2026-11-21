import type { DateKey } from '@/lib/dates';
import type { RecurrenceRule } from '@/lib/recurrence';

export type Priority = 'critical' | 'high' | 'medium' | 'low';
export const PRIORITIES: Priority[] = ['critical', 'high', 'medium', 'low'];

export type Category = 'academics' | 'work' | 'personal' | 'fitness' | 'mindful' | 'social' | 'health' | 'finance';
export const CATEGORIES: Category[] = ['academics', 'work', 'personal', 'fitness', 'mindful', 'social', 'health', 'finance'];

export type EntryKind = 'event' | 'reminder' | 'note' | 'goal' | 'workout';

export interface CalendarEntry {
  id: string;
  kind: EntryKind;
  title: string;
  description: string | null;
  category: Category;
  color: string | null;
  priority: Priority | null;
  location: string | null;
  allDay: boolean;
  startDate: DateKey;
  startMinute: number | null;
  endMinute: number | null;
  recurrence: RecurrenceRule | null;
  exceptionDates: DateKey[];
  reminderOffsets: number[];
  popupMessage: string | null;
  workoutPlanId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** One concrete appearance of an entry on a date (recurring entries expand). */
export interface EntryOccurrence {
  entry: CalendarEntry;
  date: DateKey;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  priority: Priority;
  category: Category;
  dueDate: DateKey | null;
  dueMinute: number | null;
  recurrence: RecurrenceRule | null;
  reminderOffsets: number[];
  popupMessage: string | null;
  seriesId: string | null;
  completedAt: number | null;
  completedDate: DateKey | null;
  createdAt: number;
  updatedAt: number;
  subtaskTotal: number;
  subtaskDone: number;
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  done: boolean;
  position: number;
}

export interface Habit {
  id: string;
  title: string;
  icon: HabitIcon;
  color: string | null;
  targetValue: number;
  unit: string | null;
  increment: number | null;
  scheduleDays: number[];
  weeklyTarget: number | null;
  reminderMinute: number | null;
  notes: string | null;
  paused: boolean;
  archived: boolean;
  position: number;
  startDate: DateKey;
  createdAt: number;
  updatedAt: number;
}

export type HabitIcon =
  | 'droplet'
  | 'book'
  | 'dumbbell'
  | 'footprints'
  | 'brain'
  | 'moon'
  | 'sun'
  | 'leaf'
  | 'heart'
  | 'pen'
  | 'music'
  | 'sparkles';

export interface HabitLog {
  habitId: string;
  date: DateKey;
  value: number;
  completed: boolean;
  note: string | null;
}

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface DayReview {
  date: DateKey;
  mood: MoodLevel;
  tags: string[];
  remark: string | null;
  gratitude: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JournalEntry {
  id: string;
  date: DateKey;
  title: string | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  name: string;
  code: string | null;
  professor: string | null;
  color: string | null;
  attendanceTarget: number;
}

export type SlotType = 'lecture' | 'lab' | 'tutorial' | 'seminar';

export interface TimetableSlot {
  id: string;
  subjectId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  room: string | null;
  slotType: SlotType;
  reminderOffset: number | null;
}

export interface TimetableSlotWithSubject extends TimetableSlot {
  subject: Subject;
}

export type AssignmentKind = 'assignment' | 'exam' | 'quiz' | 'project';

export interface Assignment {
  id: string;
  subjectId: string | null;
  subjectName: string | null;
  kind: AssignmentKind;
  title: string;
  notes: string | null;
  dueDate: DateKey;
  dueMinute: number | null;
  reminderOffsets: number[];
  completedAt: number | null;
}

export type AttendanceStatus = 'present' | 'absent' | 'cancelled';

export type CountdownStyle = 'minimal' | 'digital' | 'cinematic' | 'editorial' | 'aurora' | 'custom';
export const COUNTDOWN_STYLES: CountdownStyle[] = ['minimal', 'digital', 'cinematic', 'editorial', 'aurora', 'custom'];

export interface Countdown {
  id: string;
  title: string;
  subtitle: string | null;
  targetDate: DateKey;
  targetMinute: number;
  style: CountdownStyle;
  accent: string | null;
  backgroundUri: string | null;
  message: string | null;
  pinned: boolean;
  showSeconds: boolean;
  reminderOffsets: number[];
  createdAt: number;
  updatedAt: number;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  isCustom: boolean;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  notes: string | null;
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutPlanExercise {
  id: string;
  planId: string;
  exercise: Exercise;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeight: number | null;
  restSeconds: number;
}

export interface WorkoutSession {
  id: string;
  planId: string | null;
  name: string;
  date: DateKey;
  startedAt: number;
  endedAt: number | null;
  notes: string | null;
}

export interface ExerciseSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  weight: number;
  completedAt: number | null;
}

export interface BodyMetric {
  id: string;
  date: DateKey;
  weight: number | null;
  waist: number | null;
  chest: number | null;
  arms: number | null;
  bodyFat: number | null;
}

export type FocusMode = 'focus' | 'short_break' | 'long_break' | 'stopwatch';

export interface FocusSession {
  id: string;
  mode: FocusMode;
  taskId: string | null;
  label: string | null;
  plannedSeconds: number | null;
  actualSeconds: number;
  startedAt: number;
  endedAt: number;
  completed: boolean;
  date: DateKey;
}

export interface CustomTheme {
  id: string;
  name: string;
  basePreset: string;
  accent: string | null;
  background: string | null;
  surface: string | null;
  highlight: string | null;
}

export type InboxCategory =
  | 'task'
  | 'event'
  | 'reminder'
  | 'habit'
  | 'class'
  | 'exam'
  | 'workout'
  | 'countdown'
  | 'mood'
  | 'achievement'
  | 'system';

export interface InboxItem {
  id: string;
  category: InboxCategory;
  title: string;
  body: string | null;
  route: string | null;
  occurredAt: number;
  readAt: number | null;
}

export interface AchievementRecord {
  id: string;
  achievementId: string;
  earnedDate: DateKey;
  milestoneValue: number;
  earnedAt: number;
  seen: boolean;
}

/**
 * College planner: subjects, weekly timetable slots, assignments/exams and
 * optional attendance. Slots recur weekly by `weekday`; attendance is stored
 * per (slot, date) so history survives timetable edits.
 */
import type { DateKey } from '@/lib/dates';
import { createId } from '@/lib/id';
import type {
  Assignment,
  AssignmentKind,
  AttendanceStatus,
  SlotType,
  Subject,
  TimetableSlot,
  TimetableSlotWithSubject,
} from '@/types/models';

import { notifyChange } from '../changes';
import { db } from '../driver';
import { isNumber, parseJsonArray, toJson } from '../json';

interface SubjectRow {
  id: string;
  name: string;
  code: string | null;
  professor: string | null;
  color: string | null;
  attendance_target: number;
}

interface SlotRow {
  id: string;
  subject_id: string;
  weekday: number;
  start_minute: number;
  end_minute: number;
  room: string | null;
  slot_type: SlotType;
  reminder_offset: number | null;
}

interface SlotJoinRow extends SlotRow {
  s_name: string;
  s_code: string | null;
  s_professor: string | null;
  s_color: string | null;
  s_attendance_target: number;
}

interface AssignmentRow {
  id: string;
  subject_id: string | null;
  subject_name: string | null;
  kind: AssignmentKind;
  title: string;
  notes: string | null;
  due_date: string;
  due_minute: number | null;
  reminder_offsets: string;
  completed_at: number | null;
}

const mapSubject = (row: SubjectRow): Subject => ({
  id: row.id,
  name: row.name,
  code: row.code,
  professor: row.professor,
  color: row.color,
  attendanceTarget: row.attendance_target,
});

const mapSlot = (row: SlotRow): TimetableSlot => ({
  id: row.id,
  subjectId: row.subject_id,
  weekday: row.weekday,
  startMinute: row.start_minute,
  endMinute: row.end_minute,
  room: row.room,
  slotType: row.slot_type,
  reminderOffset: row.reminder_offset,
});

const mapSlotJoin = (row: SlotJoinRow): TimetableSlotWithSubject => ({
  ...mapSlot(row),
  subject: {
    id: row.subject_id,
    name: row.s_name,
    code: row.s_code,
    professor: row.s_professor,
    color: row.s_color,
    attendanceTarget: row.s_attendance_target,
  },
});

const mapAssignment = (row: AssignmentRow): Assignment => ({
  id: row.id,
  subjectId: row.subject_id,
  subjectName: row.subject_name,
  kind: row.kind,
  title: row.title,
  notes: row.notes,
  dueDate: row.due_date,
  dueMinute: row.due_minute,
  reminderOffsets: parseJsonArray(row.reminder_offsets, isNumber),
  completedAt: row.completed_at,
});

// ── Subjects ────────────────────────────────────────────────────────────────

export type SubjectInput = Omit<Subject, 'id'>;

export async function listSubjects(): Promise<Subject[]> {
  const rows = await db().all<SubjectRow>('SELECT * FROM subjects ORDER BY name COLLATE NOCASE');
  return rows.map(mapSubject);
}

export async function createSubject(input: SubjectInput): Promise<Subject> {
  const id = createId('sub');
  const now = Date.now();
  await db().run(
    `INSERT INTO subjects (id, name, code, professor, color, attendance_target, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.name, input.code, input.professor, input.color, input.attendanceTarget, now, now],
  );
  notifyChange('subjects');
  return { id, ...input };
}

export async function updateSubject(id: string, input: SubjectInput): Promise<void> {
  await db().run(
    'UPDATE subjects SET name = ?, code = ?, professor = ?, color = ?, attendance_target = ?, updated_at = ? WHERE id = ?',
    [input.name, input.code, input.professor, input.color, input.attendanceTarget, Date.now(), id],
  );
  notifyChange('subjects');
}

export async function deleteSubject(id: string): Promise<void> {
  await db().run('DELETE FROM subjects WHERE id = ?', [id]);
  notifyChange('subjects', 'timetable_slots', 'assignments', 'attendance_records');
}

// ── Slots ───────────────────────────────────────────────────────────────────

export type SlotInput = Omit<TimetableSlot, 'id'>;

const SLOT_JOIN = `
  SELECT t.*, s.name AS s_name, s.code AS s_code, s.professor AS s_professor, s.color AS s_color,
         s.attendance_target AS s_attendance_target
  FROM timetable_slots t JOIN subjects s ON s.id = t.subject_id`;

export async function listSlots(): Promise<TimetableSlotWithSubject[]> {
  const rows = await db().all<SlotJoinRow>(`${SLOT_JOIN} ORDER BY t.weekday, t.start_minute`);
  return rows.map(mapSlotJoin);
}

export async function listSlotsForWeekday(weekday: number): Promise<TimetableSlotWithSubject[]> {
  const rows = await db().all<SlotJoinRow>(`${SLOT_JOIN} WHERE t.weekday = ? ORDER BY t.start_minute`, [weekday]);
  return rows.map(mapSlotJoin);
}

export async function getSlot(id: string): Promise<TimetableSlotWithSubject | null> {
  const row = await db().first<SlotJoinRow>(`${SLOT_JOIN} WHERE t.id = ?`, [id]);
  return row ? mapSlotJoin(row) : null;
}

export async function createSlots(input: Omit<SlotInput, 'weekday'>, weekdays: number[]): Promise<void> {
  const now = Date.now();
  await db().transaction(async () => {
    for (const weekday of [...new Set(weekdays)]) {
      await db().run(
        `INSERT INTO timetable_slots (id, subject_id, weekday, start_minute, end_minute, room, slot_type, reminder_offset,
           created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId('slt'),
          input.subjectId,
          weekday,
          input.startMinute,
          input.endMinute,
          input.room,
          input.slotType,
          input.reminderOffset,
          now,
          now,
        ],
      );
    }
  });
  notifyChange('timetable_slots');
}

export async function updateSlot(id: string, input: SlotInput): Promise<void> {
  await db().run(
    `UPDATE timetable_slots SET subject_id = ?, weekday = ?, start_minute = ?, end_minute = ?, room = ?, slot_type = ?,
       reminder_offset = ?, updated_at = ? WHERE id = ?`,
    [
      input.subjectId,
      input.weekday,
      input.startMinute,
      input.endMinute,
      input.room,
      input.slotType,
      input.reminderOffset,
      Date.now(),
      id,
    ],
  );
  notifyChange('timetable_slots');
}

export async function deleteSlot(id: string): Promise<void> {
  await db().run('DELETE FROM timetable_slots WHERE id = ?', [id]);
  notifyChange('timetable_slots', 'attendance_records');
}

// ── Assignments & exams ─────────────────────────────────────────────────────

export type AssignmentInput = Omit<Assignment, 'id' | 'subjectName' | 'completedAt'>;

const ASSIGNMENT_SELECT = `
  SELECT a.*, s.name AS subject_name FROM assignments a LEFT JOIN subjects s ON s.id = a.subject_id`;

export async function listAssignments(includeCompleted = false): Promise<Assignment[]> {
  const rows = await db().all<AssignmentRow>(
    `${ASSIGNMENT_SELECT} ${includeCompleted ? '' : 'WHERE a.completed_at IS NULL'}
     ORDER BY a.due_date, a.due_minute IS NULL, a.due_minute`,
  );
  return rows.map(mapAssignment);
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const row = await db().first<AssignmentRow>(`${ASSIGNMENT_SELECT} WHERE a.id = ?`, [id]);
  return row ? mapAssignment(row) : null;
}

export async function createAssignment(input: AssignmentInput): Promise<string> {
  const id = createId('asg');
  const now = Date.now();
  await db().run(
    `INSERT INTO assignments (id, subject_id, kind, title, notes, due_date, due_minute, reminder_offsets, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.subjectId, input.kind, input.title, input.notes, input.dueDate, input.dueMinute, toJson(input.reminderOffsets), now, now],
  );
  notifyChange('assignments');
  return id;
}

export async function updateAssignment(id: string, input: AssignmentInput): Promise<void> {
  await db().run(
    `UPDATE assignments SET subject_id = ?, kind = ?, title = ?, notes = ?, due_date = ?, due_minute = ?,
       reminder_offsets = ?, updated_at = ? WHERE id = ?`,
    [input.subjectId, input.kind, input.title, input.notes, input.dueDate, input.dueMinute, toJson(input.reminderOffsets), Date.now(), id],
  );
  notifyChange('assignments');
}

export async function setAssignmentCompleted(id: string, completed: boolean, today: DateKey): Promise<void> {
  await db().run('UPDATE assignments SET completed_at = ?, completed_date = ?, updated_at = ? WHERE id = ?', [
    completed ? Date.now() : null,
    completed ? today : null,
    Date.now(),
    id,
  ]);
  notifyChange('assignments');
}

export async function deleteAssignment(id: string): Promise<void> {
  await db().run('DELETE FROM assignments WHERE id = ?', [id]);
  notifyChange('assignments');
}

// ── Attendance ──────────────────────────────────────────────────────────────

export async function setAttendance(slotId: string, date: DateKey, status: AttendanceStatus | null): Promise<void> {
  if (status === null) {
    await db().run('DELETE FROM attendance_records WHERE slot_id = ? AND class_date = ?', [slotId, date]);
  } else {
    const now = Date.now();
    await db().run(
      `INSERT INTO attendance_records (slot_id, class_date, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(slot_id, class_date) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`,
      [slotId, date, status, now, now],
    );
  }
  notifyChange('attendance_records');
}

export async function attendanceForDate(date: DateKey): Promise<Record<string, AttendanceStatus>> {
  const rows = await db().all<{ slot_id: string; status: AttendanceStatus }>(
    'SELECT slot_id, status FROM attendance_records WHERE class_date = ?',
    [date],
  );
  return Object.fromEntries(rows.map((row) => [row.slot_id, row.status]));
}

export interface SubjectAttendance {
  subjectId: string;
  name: string;
  target: number;
  present: number;
  absent: number;
  /** null when nothing has been recorded yet */
  ratio: number | null;
}

export async function attendanceSummary(): Promise<SubjectAttendance[]> {
  const rows = await db().all<{ id: string; name: string; target: number; present: number; absent: number }>(
    `SELECT s.id, s.name, s.attendance_target AS target,
       COALESCE(SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END), 0) AS present,
       COALESCE(SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END), 0) AS absent
     FROM subjects s
     LEFT JOIN timetable_slots t ON t.subject_id = s.id
     LEFT JOIN attendance_records a ON a.slot_id = t.id
     GROUP BY s.id ORDER BY s.name COLLATE NOCASE`,
  );
  return rows.map((row) => ({
    subjectId: row.id,
    name: row.name,
    target: row.target,
    present: row.present,
    absent: row.absent,
    ratio: row.present + row.absent > 0 ? row.present / (row.present + row.absent) : null,
  }));
}

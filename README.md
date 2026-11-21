# Daily Sync — *Your life, in sync.*

Daily Sync is an offline-first Android app (built with Expo / React Native) that brings your
calendar, tasks, habits, college timetable, fitness, focus timer, mood check-ins, journal,
countdowns and a collectible achievement system together in one calm, premium interface.

Everything is stored on the device. There are no accounts, no servers, no analytics and no ads.

---

## Contents

1. [Features](#features)
2. [Quick start (beginner friendly)](#quick-start)
3. [Expo Go vs. installed app (APK)](#expo-go-vs-installed-app)
4. [Building an installable APK](#building-an-installable-apk)
5. [Quality checks](#quality-checks)
6. [Project structure](#project-structure)
7. [How it works (architecture)](#how-it-works)
8. [Achievement rules](#achievement-rules)
9. [Privacy & security](#privacy--security)
10. [Known limitations](#known-limitations)

---

## Features

| Area | What you can do |
| --- | --- |
| **Home** | Greeting, day-at-a-glance ring (real completion), next event/class, priority tasks, pinned countdown, weekly habit row, mood check-in, fitness & water, journey stats, daily quote. Cards can be hidden. |
| **Calendar** | Month / Week / Day / Agenda views, category dots, mood emoji per day, filters, day timeline with a live "now" line. |
| **Create** | One form for Event, Task, Reminder, Habit, College class, Workout, Note and Goal, with only the relevant fields. Repeats (daily, weekdays, weekly on chosen days, monthly, yearly, with end date), up to 5 reminders, custom reminder message, colour, category, priority, optional countdown. |
| **Quick create** | Natural-language box (“Physics lab due 11pm”, “Gym 6pm tomorrow”) with a preview before saving, plus presets (water, 25-min focus, reading). |
| **Tasks** | Today / Upcoming / Overdue / Completed, priorities, subtasks, search, sort, recurring tasks, one-tap “move overdue to today”, undo. |
| **Habits** | Check-off or counted habits (e.g. 3000 ml), specific weekdays, reminders, pause/archive, per-day logs, streaks, 30-day consistency, 12-week heatmap. |
| **College** | Weekly timetable, next class, attendance (present/absent/cancelled) with per-subject %, assignments, exams and quizzes with reminders, semester week. |
| **Fitness** | Workout plans, exercise library + custom exercises, live resumable workout with rest timer, history, personal records, body metrics with trend, water tracking. |
| **Focus** | Pomodoro (with long breaks), custom timers, stopwatch, link to a task, daily goal, history. Accurate after closing the app. |
| **Mood** | Evening check-in (default 10:00 PM, Asia/Kolkata), 5 moods, factor tags, note, gratitude, edit any day, weekly rhythm. In-app prompt with Snooze / Skip / Turn off. |
| **Journal** | Private entries, search, optional fingerprint/face/PIN lock. |
| **Countdown Studio** | Live countdowns in 6 styles (Minimal, Digital, Cinematic, Editorial, Aurora, Orbital), background photo, accent, private note, reminders, pin to Home. |
| **Theme Studio** | Interactive radial selector (drag or tap), 6 themes, light/dark/automatic, custom HEX accent/background/surface/highlight with readability protection, save custom themes, motion & card style. |
| **My Journey & Sync Collection** | Active days, current and longest streak, 16-week heatmap, 13 collectible cards in 6 series, locked cards with progress, card detail with 3-D tilt. |
| **Share Studio** | Export a designed milestone card as a PNG at exactly 1080×1350 (4:5), 1080×1920 (9:16) or 1080×1080 (1:1), share or save to photos. Name/photo/streak are opt-in. |
| **Insights** | Weekly & monthly reports from real records: completion, focus, workouts, habits, mood distribution, best day, most productive hour, change vs. previous period. |
| **Notifications** | Task, event, class, exam, habit, workout, countdown and mood reminders; in-app notification centre; permission & precise-alarm status; test notification. |
| **Languages** | English and हिन्दी across every screen (Noto Sans Devanagari). Your own text is never translated. |
| **Backup** | Export everything to a JSON file, restore (validated, all-or-nothing), erase all data. |

---

## Open the published app (iPhone & Android, no computer needed)

The latest version is published with EAS Update and opens inside **Expo Go**:

1. Install **Expo Go** (App Store / Play Store).
2. Scan this QR code with the phone camera (iPhone) or with Expo Go (Android), or open the link on the phone:

   `exp://u.expo.dev/59759913-e332-4629-928c-5d6b00e5315b?runtime-version=exposdk%3A58.0.0&channel-name=preview`

   <img src="docs/expo-go-qr.svg" width="220" alt="QR code to open Daily Sync in Expo Go" />

To publish a new version after changing code:

```bash
npx eas-cli@latest update --channel preview --environment preview --platform ios --message "What changed"
npx eas-cli@latest update --channel preview --environment preview --platform android --message "What changed"
```

## Quick start

> You need a computer with **Node.js 20 or newer** and an **Android phone**.

1. **Install the Expo Go app** on your phone from the Play Store (it must support **SDK 58**).
2. Open a terminal in this folder and install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npx expo start
   ```

4. **Open the app:** scan the QR code shown in the terminal with Expo Go.
   Phone and computer must be on the same Wi-Fi. If that is not possible, use
   `npx expo start --tunnel`.

5. To check that installed packages match the Expo SDK:

   ```bash
   npx expo-doctor
   npx expo install --check
   ```

---

## Expo Go vs. installed app

Most of Daily Sync works inside Expo Go. A few things only behave fully in an installed build
(APK or development build), because in Expo Go the permissions and app identity belong to
Expo Go itself.

| Capability | Expo Go | Installed APK / dev build |
| --- | --- | --- |
| All screens, database, themes, Hindi, charts, card export | ✅ | ✅ |
| Local reminders & mood notification | ✅ (local notifications are supported in Expo Go on Android) | ✅ |
| Precise (“Alarms & reminders”) timing | ⚠️ Permission belongs to Expo Go; may not be grantable | ✅ Requestable in *Settings → Notifications* |
| Notification channel names, app icon in notifications | Expo Go’s | Daily Sync’s |
| Saving a card to the photo gallery | ⚠️ May be restricted by Expo Go’s permissions | ✅ |
| Fingerprint / face / PIN lock | ✅ | ✅ |
| App icon, splash screen, app name | Expo Go’s | Daily Sync’s |

No custom native code is used, so a development build is only needed if you want to test the
items marked ⚠️ while developing (see below).

---

## Building an installable APK

The easiest way is **EAS Build** (Expo’s cloud build service, free tier available). You do not
need Android Studio.

```bash
# 1. Log in (create a free account at expo.dev if needed)
npx eas-cli@latest login

# 2. Link the project to your account (first time only)
npx eas-cli@latest init

# 3. Build an installable APK (profile "preview" in eas.json)
npm run build:apk
#   = npx eas-cli@latest build --platform android --profile preview
```

When the build finishes, EAS prints a link and a QR code. Open it on your phone, download the
`.apk`, and install it (Android will ask you to allow installing apps from this source).

**Development build (optional).** To test native-only behaviour with live reload:

```bash
npx expo install expo-dev-client   # one-time
npm run build:dev                  # builds the "development" profile
npx expo start --dev-client
```

**Play Store bundle:** `npx eas-cli@latest build --platform android --profile production`
produces an `.aab`.

**Local builds** (`npx expo run:android --variant release`) are also possible but require the
Android SDK and JDK 17 installed and configured; EAS is recommended.

Android package id: `app.dailysync.mobile` (change it in `app.json` before publishing).

---

## Quality checks

```bash
npm run typecheck   # TypeScript, strict mode
npm run lint        # ESLint incl. React Compiler / hooks rules
npm test            # 100 unit + repository tests
npm run check       # all three
npx expo-doctor     # dependency & config compatibility
npx expo export --platform android   # production JS bundle
```

What the tests cover:

- **Dates & time zones** — date keys, month grids, week start, IST midnight boundaries, DST zones, next daily occurrence.
- **Recurrence** — daily/weekly/bi-weekly/monthly (31st)/yearly (Feb 29), until/count, exceptions.
- **Journey** — active days, current streak (today-or-yesterday rule), longest streak.
- **Achievements** — every unlock rule and its exact earned date, no duplicates, progress.
- **Repositories (real SQLite)** — CRUD, constraints, per-occurrence completion, recurring-task spawning without duplicates, one mood per day, backup round-trip and all-or-nothing restore.
- **Reminders** — correct fire instants in IST, rolling window, disabled types, cap, idempotent diff (no duplicate scheduling).
- **Theme** — Obsidian Gold spec, WCAG contrast in all 6 presets × light/dark, custom colour rejection.
- **Focus timer, habits, analytics, HEX/validation, quick-create parser, i18n** (identical EN/HI keys, matching placeholders, every dynamic key present).

---

## Project structure

```
src/
  app/                 Expo Router screens (file = route)
    (tabs)/            Home, Calendar, Insights, Profile (+ custom tab bar)
    create.tsx         Universal create/edit form
    quick-add.tsx      Quick create sheet
    day/ entry/ tasks/ habits/ mood/ journal/ timetable/ fitness/
    countdowns/ themes.tsx journey.tsx collection/ share/
    notifications.tsx search.tsx focus.tsx settings/
  components/
    ui/                Design system: Text, PressableScale, PremiumButton, IconButton,
                       DSCard, DSInput, DSChip, Segmented, DSSwitch, ProgressRing/Bar,
                       AnimatedCheckbox, DSBottomSheet, Pickers, Feedback (toasts/dialogs),
                       States (empty/loading/error), Screen, icons
    calendar/ collection/ countdown/ dashboard/ fitness/ forms/ habits/
    insights/ onboarding/ shell/ tasks/ themes/
  db/
    driver.ts          DbDriver interface (parameterised SQL only)
    expoDriver.ts      expo-sqlite adapter
    migrations.ts      Versioned schema (PRAGMA user_version)
    changes.ts         Table change notifications
    repositories/      One module per domain
  hooks/               useLiveQuery, useClock, useTicker, useDayData, …
  i18n/                en.ts (source of truth), hi.ts, formatters
  lib/                 Pure logic: dates, timezone, recurrence, journey, achievements,
                       habits, analytics, countdown, focus timer, colour, validation
  services/            notifications, achievements, backup, sharing, media, security,
                       quotes, insights, bootstrap
  store/preferences.tsx
  theme/               palette engine, tokens, ThemeProvider
  types/models.ts
```

---

## How it works

**Offline-first data.** SQLite with versioned migrations, foreign keys, CHECK constraints and
indexes. Screens never write SQL; they call repositories, which notify a tiny change bus, and
`useLiveQuery` re-reads only what changed. Every query uses bound parameters.

**Dates & time.** Calendar days are stored as `YYYY-MM-DD` keys and times as minutes after
midnight in your chosen time zone (default **Asia/Kolkata**). Absolute timestamps are computed
only when needed (reminders, countdowns), so all-day items never shift to another day.

**Reminders.** Each reminder is a one-time notification at an exact moment. For repeating items
the next 14 days are kept scheduled. On every launch, return to the app and data change, the
engine builds the *desired* schedule and compares it with what is recorded as scheduled
(deterministic keys), cancelling or adding only the difference — so it never double-books. At
most 60 notifications are pending at once.

**Streaks & cards.** See [Achievement rules](#achievement-rules). Cards are computed from your
real activity history and stored once earned.

**Theme engine.** Every theme is derived from a few seed colours. Text colours are chosen to
meet WCAG contrast (≥ 7:1 for primary text), and custom colours that would make text
unreadable are rejected with an explanation.

**Timers.** Countdowns, focus sessions, workouts and rest timers are computed from stored
timestamps and the real clock — never from a running interval — and only tick while visible.

---

## Achievement rules

An **active day** is a local calendar date on which you did at least one of: complete a task or
calendar item, complete a habit, log your mood, write a journal entry, finish a workout, focus
for 5+ minutes, complete an assignment, or mark yourself present in a class. Opening the app
does not count.

- **Current streak:** consecutive active days ending today — or yesterday, until today is over.
- **Longest streak:** the longest run of consecutive active days ever.

| # | Card | Series | Unlocks when |
| --- | --- | --- | --- |
| 1 | The First Step | Signature | 1 active day |
| 2 | Warming Up | Moment | 3-day streak |
| 3 | Seven & Strong | Obsidian | 7-day streak |
| 4 | Two Weeks Forward | Platinum | 14-day streak |
| 5 | The Consistent One | Obsidian | 30 active days in total |
| 6 | Unstoppable | Aurora | 30-day streak |
| 7 | Half Century | Aurora | 50 active days |
| 8 | Century Club | Legacy | 100 active days |
| 9 | The Dedicated | Platinum | 200 active days |
| 10 | Year of Growth | Legacy | 365 active days |
| 11 | Comeback Story | Moment | 3 active days in a row after a break of 7+ inactive days |
| 12 | Perfect Month | Signature | Every day of a completed calendar month active |
| 13 | New Personal Best | Moment | A streak beats a previous best of 3+ days |

The earned date is the exact day the condition was first met. Earned cards are never revoked.

---

## Privacy & security

- All data stays in the app’s private storage on the device. Nothing is sent anywhere.
- The SQLite database is protected by Android’s app sandbox. **It is not separately
  encrypted.** App lock and journal lock (fingerprint / face / device PIN) protect access
  through the app; their on/off state is kept in the hardware-backed SecureStore.
- Journal text is never logged and never placed in notifications. Search skips the journal
  while it is locked.
- Permissions are requested only when needed: notifications (onboarding or settings),
  write-only photo access (only when saving a card), photo picker (no storage permission on
  Android 13+). Camera, microphone and location are explicitly blocked in `app.json`.
- Backups are created only on request and contain everything — store them privately.
  Restores validate the file, whitelist tables and columns, and run in one transaction.
- `npm audit` reports a moderate advisory in `minimatch`, used only by Expo’s build-time
  fingerprinting tooling; it is not shipped in the app.

---

## Known limitations

Stated honestly so nothing is a surprise:

- **Device testing.** This codebase has passed TypeScript, ESLint, 100 automated tests,
  `expo-doctor` and a production Android bundle. It has **not yet been run on a physical
  phone or emulator** as part of this work, so on-device visual polish, gesture feel and
  notification delivery still need a manual test pass. No APK has been built yet.
- **Reminder timing** depends on Android. Without the precise-alarm permission (denied by
  default on Android 14+) or with aggressive battery savers, reminders can arrive late.
  Repeating reminders are scheduled 14 days ahead and refreshed whenever the app is opened;
  if the app isn’t opened for more than two weeks, repeating reminders pause until it is.
- **Snooze from the notification shade** relies on the app process being available; the
  in-app check-in prompt’s Snooze/Skip/Turn-off always works.
- **Repeating events:** edits apply to the whole series. A single date can be deleted, but not
  edited on its own. Events are single-day (timed or all-day); multi-day spans aren’t supported.
- **Quick create** understands English keywords (today, tomorrow, weekday names, “due”, times).
- The built-in **exercise library** uses English exercise names.
- **No cloud sync** in this version (by design). The repository layer is structured so sync can
  be added later.
- **Mood tracking** is a personal reflection tool, not a health assessment.

---

## License

Copyright © 2026 Kirath Kumar Sharma. **All rights reserved.** This is proprietary software:
no permission is granted to use, copy, modify or distribute it. See [LICENSE](LICENSE).

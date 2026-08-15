# Tour Diary — V1

A field-work diary app for Forest Van Mitras, Forest Guards, and other field staff, built with Expo (managed workflow) + React Native.

## Running it

```bash
npm install
npx expo start
```

Then scan the QR code with **Expo Go** (Android/iOS), or press `a` / `i` in the terminal for an emulator/simulator. No native linking step is required.

Requires Node.js and the Expo Go app on your phone (or an Android/iOS emulator).

## What's included (V1 scope)

- Current-month diary, auto-created on first open
- Create a diary for any historical month/year (leap-year aware)
- Daily entries: From / To / Remarks, 3 entries per page with Previous/Next
- Edit any existing entry (updates in place — never duplicates a row)
- Future dates locked in the *current* month only; historical months are fully editable
- Missed days stay empty until filled — never auto-filled or deleted
- Progress tracking and a "My Diaries" list with completion %
- Word (.docx) export via the native share sheet, blocked until the diary is 100% complete
- All data stored locally in SQLite (`expo-sqlite`) — no backend, no network calls

The storage layer is isolated as `UI → diaryService → repositories → SQLite`, so a future Node/Express/MongoDB backend (see the project brief's V2 roadmap) can replace the repository layer without touching the UI.

## Architecture

```
src/
  database/       database.js (SQLite connection), migrations.js (schema)
  repositories/    diaryRepository.js, diaryEntryRepository.js  — raw SQL only
  services/        diaryService.js (business rules), exportService.js (docx)
  screens/         Home, CurrentDiary, CreateDiary, MyDiaries, DiaryDetails
  components/      DiaryEntryCard, MonthSelector, ProgressBar, NavigationControls
  navigation/      AppNavigator.js
  utils/           dateUtils.js (local-date-only helpers), validation.js
  constants/       colors.js, dimensions.js, locations.js (empty by default)
```

Screens only ever call `diaryService` — never SQLite directly.

### Date handling

All diary dates are stored and compared as local `YYYY-MM-DD` strings built from `getFullYear()/getMonth()/getDate()`. `Date.toISOString()` is never used for the diary `date` field, since that converts to UTC and can shift a date near midnight in timezones ahead of UTC (e.g. IST). See `src/utils/dateUtils.js` for details. (Audit-only `created_at`/`updated_at` timestamps do use ISO strings — that's just bookkeeping metadata, not the date-locking logic.)

## What was verified, and how

I don't have a phone/emulator in the environment I built this in, so I verified as much as I could without one, and I'm flagging exactly what's programmatic vs. what still needs a real device:

**Verified programmatically (30/30 + rollback + docx checks passed):**
- All 23 source files parse correctly (Babel/JSX syntax check)
- Date logic executed directly: leap years (2024 ✓29, 1900 ✗28 despite ÷4, 2000 ✓29 despite ÷100), local-date construction, future/past comparisons, display formatting — 21 assertions
- Full `diaryService` business logic run against a real SQLite database (Node's built-in `sqlite` module standing in for `expo-sqlite`'s identical async API): month creation with correct day counts, duplicate-diary blocking, current-month date locking vs. historical-month full editability, edit-updates-same-row (no duplicate rows), missed days stay fillable, completion percentage/state — 30 assertions
- Transaction rollback: forced a failure partway through a 30-day month creation and confirmed no partial diary or orphaned entry rows were left behind
- Word export: ran the exact `docx` API calls used in `exportService.js`, packed a real `.docx`, unzipped it, and confirmed the table content (dates, From/To, remarks) is correctly present in the document XML

**Still needs a real run-through on your end (can't be done without a device/emulator):**
- Items 2, 3, 7, 9, 12 from the spec's end-to-end checklist — actually tapping through the UI, closing/reopening the app, force-closing mid-use, and confirming the native Android/iOS share sheet opens correctly for the Word file
- General on-screen look and feel (the design follows the spec's professional/field-appropriate guidelines, but hasn't been visually confirmed on a real screen)

Recommend running through the 12-point checklist in the original brief once on your device before treating this as final — items 1, 4, 5, 6, 8, 10, 11 are effectively covered by the automated tests above, but seeing them work on-screen is worth the few minutes.

## Excluded from V1 (by design)

GPS, maps, photos/camera, server sync, authentication, notifications, AI-generated remarks, attendance, and analytics — all deliberately out of scope per the brief. The architecture (service/repository separation, empty `LOCATIONS` config, swappable export layer) is set up so these can be added later without a rewrite.

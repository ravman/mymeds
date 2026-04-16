# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Metro bundler
npm run android    # Build and run on Android
npm run ios        # Build and run on iOS
npm test           # Run Jest tests
npm run lint       # Run ESLint
```

To run a single test file:
```bash
npx jest __tests__/SomeFile.test.ts
```

Node version: 20 (use `.nvmrc`). Package.json requires `>= 22.11.0`.

## Architecture

**MyMedicationsRN** is a senior-focused medication reminder app. Key design decisions: large fonts (1.15× scale), emoji tab icons, voice I/O, and high-contrast colors.

### Navigation

`App.tsx` → `AppNavigator` (NativeStackNavigator) contains:
- `MainTabs` (BottomTabNavigator): Today, Medications, History, Settings
- `AddMedication` (modal)
- `MedicationDetail` (stack)

### State & Persistence

No global state library. Each screen loads data from AsyncStorage on mount/focus via `useFocusEffect`. Three storage keys in `src/storage.ts`:
- `@mymeds:medications` — `Medication[]`
- `@mymeds:logs` — `DoseLog[]` (pruned to 90 days)
- `@mymeds:settings` — `AppSettings`

### Key Modules

| File | Purpose |
|------|---------|
| `src/types.ts` | All TypeScript types — start here to understand data shapes |
| `src/theme.ts` | Design tokens (colors, typography, spacing, shadows) |
| `src/storage.ts` | AsyncStorage CRUD helpers for medications, logs, settings |
| `src/notifications.ts` | Schedules 30 days of push notifications per medication; uses `react-native-push-notification` |
| `src/voice.ts` | Three-part system: TTS (slow rate for seniors), speech-to-text input, and recorded voice note playback |
| `src/components/index.tsx` | Shared UI: `Button`, `Card`, `Row`, `StatusBadge`, `PillDot`, `EmptyState`, etc. |
| `src/navigation.tsx` | Navigation stack + tab configuration |

### Notification Scheduling

`scheduleMedicationNotifications()` in `notifications.ts` pre-schedules up to 30 days of reminders based on frequency type (`once_daily`, `twice_daily`, `three_times_daily`, `every_x_hours`, `weekly`, `as_needed`). Call this whenever a medication is saved or its active status toggled. Cancel with `cancelMedicationNotifications(notificationIds)`.

### Voice System

`voice.ts` exports:
- `initTts()` / `speak(text)` — TTS at slow rate (0.48) for seniors
- `startListening(onResult)` / `stopListening()` — speech-to-text via `react-native-voice`
- `playVoiceNote(uri)` — plays user-recorded audio (preferred over TTS for medication names)

### Path Alias

`@/*` maps to `src/*` — use `import { ... } from '@/storage'` etc.

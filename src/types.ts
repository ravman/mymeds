// src/types.ts

export type FrequencyType =
  | 'once_daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'every_x_hours'
  | 'weekly'
  | 'as_needed';

export type DosageUnit = 'pill' | 'tablet' | 'capsule' | 'ml' | 'mg' | 'drop' | 'puff';

export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface Medication {
  id: string;
  name: string;                 // Typed or transcribed display name
  voiceNoteUri?: string;        // Path to .wav/.m4a recorded by user
  spokenName?: string;          // Phonetic / as-heard fallback for TTS

  dosage: number;
  dosageUnit: DosageUnit;
  instructions?: string;        // e.g. "Take with food"

  frequency: FrequencyType;
  intervalHours?: number;       // Only for every_x_hours
  reminderTimes: ReminderTime[];
  activeDays?: number[];        // 0=Sun … 6=Sat (weekly only)

  startDate: string;            // ISO date
  endDate?: string;

  pillColor: string;            // Hex — visual ID at a glance
  notificationIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoseLog {
  id: string;
  medicationId: string;
  medicationName: string;
  voiceNoteUri?: string;
  scheduledTime: string;        // ISO
  takenAt?: string;             // ISO — undefined means pending/missed
  skipped: boolean;
}

export interface AppSettings {
  voiceEnabled: boolean;
  ttsEnabled: boolean;          // Read reminder aloud via TTS
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  snoozeMinutes: number;
  fontSize: 'normal' | 'large' | 'xlarge';
}

export const DEFAULT_SETTINGS: AppSettings = {
  voiceEnabled: true,
  ttsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  snoozeMinutes: 10,
  fontSize: 'large',
};

export type RootStackParamList = {
  MainTabs: undefined;
  AddMedication: { medicationId?: string };
  MedicationDetail: { medicationId: string };
  ReminderAlert: { logId: string };
};

export type TabParamList = {
  Today: undefined;
  Medications: undefined;
  History: undefined;
  Settings: undefined;
};

// src/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Medication, DoseLog, AppSettings, DEFAULT_SETTINGS } from './types';

const KEYS = {
  MEDICATIONS: '@mymeds:medications',
  LOGS: '@mymeds:logs',
  SETTINGS: '@mymeds:settings',
};

// ── Medications ──────────────────────────────────────────────────────────────

export async function getMedications(): Promise<Medication[]> {
  const raw = await AsyncStorage.getItem(KEYS.MEDICATIONS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMedications(meds: Medication[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.MEDICATIONS, JSON.stringify(meds));
}

export async function getMedication(id: string): Promise<Medication | null> {
  const meds = await getMedications();
  return meds.find(m => m.id === id) ?? null;
}

export async function upsertMedication(med: Medication): Promise<void> {
  const meds = await getMedications();
  const idx = meds.findIndex(m => m.id === med.id);
  if (idx >= 0) {
    meds[idx] = med;
  } else {
    meds.push(med);
  }
  await saveMedications(meds);
}

export async function deleteMedication(id: string): Promise<void> {
  const meds = await getMedications();
  await saveMedications(meds.filter(m => m.id !== id));
}

// ── Dose Logs ────────────────────────────────────────────────────────────────

export async function getLogs(): Promise<DoseLog[]> {
  const raw = await AsyncStorage.getItem(KEYS.LOGS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveLogs(logs: DoseLog[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
}

export async function upsertLog(log: DoseLog): Promise<void> {
  const logs = await getLogs();
  const idx = logs.findIndex(l => l.id === log.id);
  if (idx >= 0) {
    logs[idx] = log;
  } else {
    logs.push(log);
  }
  await saveLogs(logs);
}

export async function getLogsForDate(dateStr: string): Promise<DoseLog[]> {
  const logs = await getLogs();
  return logs.filter(l => l.scheduledTime.startsWith(dateStr));
}

// Keep only last 90 days of logs
export async function pruneOldLogs(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const logs = await getLogs();
  await saveLogs(logs.filter(l => new Date(l.scheduledTime) > cutoff));
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
  return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
}

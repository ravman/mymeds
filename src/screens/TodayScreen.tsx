// src/screens/TodayScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { getMedications, getLogs, upsertLog } from '../storage';
import { speak, playVoiceNote } from '../voice';
import { Medication, DoseLog, AppSettings } from '../types';
import { getSettings } from '../storage';
import { colors, spacing, radius } from '../theme';
import { useFontSizes } from '../fontScale';
import { Card, Row, PillDot, EmptyState, StatusBadge, Button } from '../components';
import { v4 as uuid } from 'uuid';

interface ScheduledDose {
  logId: string;
  medication: Medication;
  scheduledISO: string;
  hour: number;
  minute: number;
  log?: DoseLog;
}

function buildTodaySchedule(meds: Medication[], logs: DoseLog[]): ScheduledDose[] {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const dow = today.getDay();
  const doses: ScheduledDose[] = [];

  for (const med of meds) {
    if (!med.active) continue;
    if (med.startDate > todayStr) continue;
    if (med.endDate && med.endDate < todayStr) continue;
    if (med.frequency === 'as_needed') continue;
    if (med.frequency === 'weekly' && !med.activeDays?.includes(dow)) continue;

    for (const t of med.reminderTimes) {
      const iso = `${todayStr}T${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}:00`;
      const logId = `${med.id}__${todayStr}__${t.hour}:${String(t.minute).padStart(2, '0')}`;
      const log = logs.find(l => l.id === logId);
      doses.push({ logId, medication: med, scheduledISO: iso, hour: t.hour, minute: t.minute, log });
    }
  }

  doses.sort((a, b) => a.scheduledISO.localeCompare(b.scheduledISO));
  return doses;
}

function doseStatus(dose: ScheduledDose): 'taken' | 'skipped' | 'missed' | 'pending' {
  if (dose.log?.takenAt) return 'taken';
  if (dose.log?.skipped) return 'skipped';
  const scheduled = new Date(dose.scheduledISO);
  if (scheduled < new Date()) return 'missed';
  return 'pending';
}

export const TodayScreen: React.FC = () => {
  const fs = useFontSizes();
  const [doses, setDoses] = useState<ScheduledDose[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useMemo(() => makeStyles(fs), [fs]);

  const load = useCallback(async () => {
    const [meds, logs, s] = await Promise.all([getMedications(), getLogs(), getSettings()]);
    setDoses(buildTodaySchedule(meds, logs));
    setSettings(s);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markTaken = useCallback(async (dose: ScheduledDose) => {
    const log: DoseLog = {
      id: dose.logId,
      medicationId: dose.medication.id,
      medicationName: dose.medication.name,
      voiceNoteUri: dose.medication.voiceNoteUri,
      scheduledTime: dose.scheduledISO,
      takenAt: new Date().toISOString(),
      skipped: false,
    };
    await upsertLog(log);
    await load();

    if (settings?.ttsEnabled) {
      if (dose.medication.voiceNoteUri) {
        await playVoiceNote(dose.medication.voiceNoteUri).catch(() => {});
        await speak('taken. Great job!');
      } else {
        await speak(`${dose.medication.name} marked as taken. Great job!`);
      }
    }
  }, [settings, load]);

  const markSkipped = useCallback(async (dose: ScheduledDose) => {
    Alert.alert('Skip dose?', `Skip ${dose.medication.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Skip', style: 'destructive', onPress: async () => {
          const log: DoseLog = {
            id: dose.logId,
            medicationId: dose.medication.id,
            medicationName: dose.medication.name,
            scheduledTime: dose.scheduledISO,
            skipped: true,
          };
          await upsertLog(log);
          await load();
        },
      },
    ]);
  }, [load]);

  const playName = useCallback(async (dose: ScheduledDose) => {
    if (dose.medication.voiceNoteUri) {
      await playVoiceNote(dose.medication.voiceNoteUri).catch(() => {});
    } else if (settings?.ttsEnabled) {
      await speak(dose.medication.name);
    }
  }, [settings]);

  const { taken, total, pct } = useMemo(() => {
    const t = doses.filter(d => doseStatus(d) === 'taken').length;
    const n = doses.length;
    return { taken: t, total: n, pct: n > 0 ? Math.round((t / n) * 100) : 0 };
  }, [doses]);

  const dateText = useMemo(() => format(new Date(), 'EEEE, MMMM d'), []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderDose = useCallback(({ item }: { item: ScheduledDose }) => {
    const status = doseStatus(item);
    const timeLabel = format(new Date(item.scheduledISO), 'h:mm a');
    const isDone = status === 'taken' || status === 'skipped';

    return (
      <Card style={[styles.doseCard, isDone && styles.doseCardDone]}>
        <Row style={{ marginBottom: spacing.sm }}>
          <PillDot color={item.medication.pillColor} size={18} />
          <Text style={styles.medName} numberOfLines={1}>{item.medication.name}</Text>
          <TouchableOpacity onPress={() => playName(item)} style={styles.speakBtn}>
            <Text style={styles.speakIcon}>🔊</Text>
          </TouchableOpacity>
        </Row>

        <Row style={{ marginBottom: spacing.md }}>
          <Text style={styles.timeLabel}>⏰ {timeLabel}</Text>
          <Text style={styles.dosageLabel}>
            {item.medication.dosage} {item.medication.dosageUnit}
          </Text>
          {item.medication.instructions
            ? <Text style={styles.instructions}> · {item.medication.instructions}</Text>
            : null}
        </Row>

        <Row style={{ justifyContent: 'space-between' }}>
          <StatusBadge status={status} />
          {!isDone && (
            <Row>
              <TouchableOpacity onPress={() => markSkipped(item)} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
              <Button
                label="Take Now"
                onPress={() => markTaken(item)}
                size="sm"
                icon="✓"
                style={{ marginLeft: spacing.sm }}
              />
            </Row>
          )}
        </Row>
      </Card>
    );
  }, [styles, markTaken, markSkipped, playName]);

  return (
    <View style={styles.container}>
      {/* Header summary */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{dateText}</Text>
        <Text style={styles.summaryText}>
          {total === 0
            ? 'No medications scheduled'
            : `${taken} of ${total} doses taken — ${pct}%`}
        </Text>
        {total > 0 && (
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
          </View>
        )}
      </View>

      <FlatList
        data={doses}
        keyExtractor={d => d.logId}
        renderItem={renderDose}
        contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="💊"
            title="All clear!"
            subtitle="No medications scheduled for today. Add one using the Medications tab."
          />
        }
      />
    </View>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      backgroundColor: colors.primary,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    dateText: { fontSize: fs.xxl, fontWeight: '800', color: '#fff', marginBottom: 4 },
    summaryText: { fontSize: fs.md, color: 'rgba(255,255,255,0.82)', marginBottom: spacing.sm },
    progressBar: {
      height: 6, backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: radius.full, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: radius.full },

    doseCard: { opacity: 1 },
    doseCardDone: { opacity: 0.65 },

    medName: {
      flex: 1, fontSize: fs.lg, fontWeight: '700',
      color: colors.text, marginLeft: spacing.sm,
    },
    speakBtn: { padding: 6 },
    speakIcon: { fontSize: 20 },

    timeLabel: { fontSize: fs.md, color: colors.textSecondary, marginRight: spacing.sm },
    dosageLabel: { fontSize: fs.md, fontWeight: '600', color: colors.primary },
    instructions: { fontSize: fs.sm, color: colors.textMuted, flex: 1 },

    skipBtn: {
      paddingVertical: 8, paddingHorizontal: 14,
      borderRadius: radius.md, borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    skipBtnText: { fontSize: fs.sm, fontWeight: '600', color: colors.textSecondary },
  });
}

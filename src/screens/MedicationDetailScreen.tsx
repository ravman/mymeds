// src/screens/MedicationDetailScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, subDays } from 'date-fns';
import { getMedication, getLogs, deleteMedication } from '../storage';
import { cancelMedicationNotifications } from '../notifications';
import { playVoiceNote, speak } from '../voice';
import { Medication, DoseLog, RootStackParamList } from '../types';
import { colors, spacing, radius } from '../theme';
import { useFontSizes } from '../fontScale';
import { Card, Row, PillDot, SectionLabel, StatusBadge, Button, Divider } from '../components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MedicationDetail'>;

const FREQ_LABELS: Record<string, string> = {
  once_daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: '3× daily',
  every_x_hours: 'Every X hours',
  weekly: 'Weekly',
  as_needed: 'As needed',
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const MedicationDetailScreen: React.FC = () => {
  const fs = useFontSizes();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { medicationId } = route.params;

  const [med, setMed] = useState<Medication | null>(null);
  const [recentLogs, setRecentLogs] = useState<DoseLog[]>([]);

  useFocusEffect(useCallback(() => {
    (async () => {
      const m = await getMedication(medicationId);
      setMed(m);
      if (m) {
        const allLogs = await getLogs();
        const cutoff = subDays(new Date(), 14).toISOString();
        const filtered = allLogs
          .filter(l => l.medicationId === medicationId && l.scheduledTime >= cutoff)
          .sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime))
          .slice(0, 14);
        setRecentLogs(filtered);
      }
    })();
  }, [medicationId]));

  const adherence = useMemo(() => {
    if (recentLogs.length === 0) return null;
    const taken = recentLogs.filter(l => l.takenAt).length;
    return Math.round((taken / recentLogs.length) * 100);
  }, [recentLogs]);

  const playName = useCallback(async () => {
    if (!med) return;
    if (med.voiceNoteUri) {
      await playVoiceNote(med.voiceNoteUri).catch(() => speak(med.name));
    } else {
      await speak(med.name);
    }
  }, [med]);

  const confirmDelete = useCallback(() => {
    if (!med) return;
    Alert.alert(
      'Delete Medication',
      `Remove "${med.name}" permanently? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await cancelMedicationNotifications(med.notificationIds);
            await deleteMedication(med.id);
            nav.goBack();
          },
        },
      ],
    );
  }, [med, nav]);

  if (!med) return null;

  const logStatus = (log: DoseLog): 'taken' | 'skipped' | 'missed' => {
    if (log.takenAt) return 'taken';
    if (log.skipped) return 'skipped';
    return 'missed';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: med.pillColor }]}>
        <PillDot color="rgba(255,255,255,0.35)" size={80} />
        <View style={styles.heroText}>
          <Text style={styles.heroName}>{med.name}</Text>
          {med.voiceNoteUri && (
            <TouchableOpacity onPress={playName} style={styles.playBtn}>
              <Text style={styles.playBtnText}>🔊 Play pronunciation</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.heroDosage}>
            {med.dosage} {med.dosageUnit} · {FREQ_LABELS[med.frequency]}
          </Text>
        </View>
      </View>

      {/* Adherence */}
      {adherence !== null && (
        <>
          <SectionLabel title="14-Day Adherence" />
          <Card>
            <Row style={{ marginBottom: spacing.sm }}>
              <Text style={styles.adherencePct}>{adherence}%</Text>
              <Text style={styles.adherenceLabel}> doses taken on time</Text>
            </Row>
            <View style={styles.adherenceBar}>
              <View style={[
                styles.adherenceFill,
                {
                  width: `${adherence}%` as any,
                  backgroundColor: adherence >= 80 ? colors.success : adherence >= 50 ? colors.warning : colors.danger,
                },
              ]} />
            </View>
          </Card>
        </>
      )}

      {/* Details */}
      <SectionLabel title="Details" />
      <Card>
        <Row style={styles.detailRow}>
          <Text style={styles.detailIcon}>💊</Text>
          <Text style={styles.detailKey}>Dosage</Text>
          <Text style={styles.detailVal}>{med.dosage} {med.dosageUnit}</Text>
        </Row>
        <Divider />
        <Row style={styles.detailRow}>
          <Text style={styles.detailIcon}>🔄</Text>
          <Text style={styles.detailKey}>Frequency</Text>
          <Text style={styles.detailVal}>{FREQ_LABELS[med.frequency]}</Text>
        </Row>
        {med.frequency === 'every_x_hours' && (
          <>
            <Divider />
            <Row style={styles.detailRow}>
              <Text style={styles.detailIcon}>⏱</Text>
              <Text style={styles.detailKey}>Interval</Text>
              <Text style={styles.detailVal}>Every {med.intervalHours} hours</Text>
            </Row>
          </>
        )}
        {med.frequency === 'weekly' && med.activeDays && (
          <>
            <Divider />
            <Row style={styles.detailRow}>
              <Text style={styles.detailIcon}>📅</Text>
              <Text style={styles.detailKey}>Days</Text>
              <Text style={styles.detailVal}>{med.activeDays.map(d => DAYS[d]).join(', ')}</Text>
            </Row>
          </>
        )}
        {med.reminderTimes.length > 0 && (
          <>
            <Divider />
            <Row style={[styles.detailRow, { alignItems: 'flex-start' }]}>
              <Text style={styles.detailIcon}>⏰</Text>
              <Text style={styles.detailKey}>Reminders</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                {med.reminderTimes.map((t, i) => {
                  const d = new Date(); d.setHours(t.hour, t.minute);
                  return (
                    <Text key={i} style={styles.detailVal}>
                      {d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  );
                })}
              </View>
            </Row>
          </>
        )}
        {med.instructions && (
          <>
            <Divider />
            <Row style={styles.detailRow}>
              <Text style={styles.detailIcon}>📝</Text>
              <Text style={styles.detailKey}>Instructions</Text>
              <Text style={[styles.detailVal, { flex: 1, textAlign: 'right' }]}>{med.instructions}</Text>
            </Row>
          </>
        )}
        <Divider />
        <Row style={styles.detailRow}>
          <Text style={styles.detailIcon}>📆</Text>
          <Text style={styles.detailKey}>Start date</Text>
          <Text style={styles.detailVal}>{format(new Date(med.startDate), 'MMM d, yyyy')}</Text>
        </Row>
        {med.endDate && (
          <>
            <Divider />
            <Row style={styles.detailRow}>
              <Text style={styles.detailIcon}>🏁</Text>
              <Text style={styles.detailKey}>End date</Text>
              <Text style={styles.detailVal}>{format(new Date(med.endDate), 'MMM d, yyyy')}</Text>
            </Row>
          </>
        )}
        <Divider />
        <Row style={styles.detailRow}>
          <Text style={styles.detailIcon}>🔔</Text>
          <Text style={styles.detailKey}>Reminders</Text>
          <Text style={styles.detailVal}>{med.notificationIds.length} scheduled</Text>
        </Row>
      </Card>

      {/* Recent history */}
      {recentLogs.length > 0 && (
        <>
          <SectionLabel title="Recent Doses" />
          <Card>
            {recentLogs.slice(0, 7).map((log, i) => (
              <View key={log.id}>
                {i > 0 && <Divider />}
                <Row style={styles.logRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logDate}>
                      {format(new Date(log.scheduledTime), 'EEE, MMM d · h:mm a')}
                    </Text>
                    {log.takenAt && (
                      <Text style={styles.logTaken}>
                        Taken at {format(new Date(log.takenAt), 'h:mm a')}
                      </Text>
                    )}
                  </View>
                  <StatusBadge status={logStatus(log)} />
                </Row>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label="Edit Medication"
          onPress={() => nav.navigate('AddMedication', { medicationId: med.id })}
          variant="secondary"
          size="lg"
          icon="✏️"
          fullWidth
          style={{ marginBottom: spacing.md }}
        />
        <Button
          label="Delete Medication"
          onPress={confirmDelete}
          variant="danger"
          size="lg"
          icon="🗑"
          fullWidth
        />
      </View>
    </ScrollView>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxl },

    hero: {
      flexDirection: 'row', alignItems: 'center',
      padding: spacing.xl, paddingTop: spacing.xxl,
    },
    heroText: { flex: 1, marginLeft: spacing.md },
    heroName: { fontSize: fs.xxl, fontWeight: '800', color: '#fff', marginBottom: 6 },
    playBtn: {
      backgroundColor: 'rgba(255,255,255,0.25)',
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, alignSelf: 'flex-start', marginBottom: 6,
    },
    playBtnText: { fontSize: fs.sm, color: '#fff', fontWeight: '600' },
    heroDosage: { fontSize: fs.md, color: 'rgba(255,255,255,0.85)' },

    adherencePct: { fontSize: fs.xxxl, fontWeight: '800', color: colors.text },
    adherenceLabel: { fontSize: fs.md, color: colors.textSecondary },
    adherenceBar: { height: 10, backgroundColor: colors.border, borderRadius: radius.full, overflow: 'hidden' },
    adherenceFill: { height: '100%', borderRadius: radius.full },

    detailRow: { paddingVertical: spacing.sm },
    detailIcon: { fontSize: 18, width: 28 },
    detailKey: { fontSize: fs.md, color: colors.textSecondary, flex: 1 },
    detailVal: { fontSize: fs.md, fontWeight: '600', color: colors.text },

    logRow: { paddingVertical: spacing.sm },
    logDate: { fontSize: fs.md, color: colors.text, fontWeight: '500' },
    logTaken: { fontSize: fs.sm, color: colors.textMuted, marginTop: 2 },

    actions: { padding: spacing.lg, marginTop: spacing.sm },
  });
}

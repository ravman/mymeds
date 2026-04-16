// src/screens/MedicationsScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { getMedications, upsertMedication, deleteMedication } from '../storage';
import { cancelMedicationNotifications, scheduleMedicationNotifications } from '../notifications';
import { Medication, RootStackParamList } from '../types';
import { colors, spacing, radius, shadow } from '../theme';
import { useFontSizes } from '../fontScale';
import { Row, PillDot, EmptyState, SectionLabel } from '../components';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const FREQ_LABELS: Record<string, string> = {
  once_daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: '3× daily',
  every_x_hours: 'Every X hours',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

export const MedicationsScreen: React.FC = () => {
  const fs = useFontSizes();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const nav = useNavigation<Nav>();

  const load = useCallback(async () => {
    const all = await getMedications();
    setMeds(all.sort((a, b) => a.name.localeCompare(b.name)));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleActive = useCallback(async (med: Medication) => {
    const updated = { ...med, active: !med.active, updatedAt: new Date().toISOString() };
    if (!updated.active) {
      await cancelMedicationNotifications(med.notificationIds);
      updated.notificationIds = [];
    } else {
      const ids = await scheduleMedicationNotifications(updated);
      updated.notificationIds = ids;
    }
    await upsertMedication(updated);
    await load();
  }, [load]);

  const confirmDelete = useCallback((med: Medication) => {
    Alert.alert(
      'Delete Medication',
      `Remove "${med.name}" and all its reminders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            await cancelMedicationNotifications(med.notificationIds);
            await deleteMedication(med.id);
            await load();
          },
        },
      ],
    );
  }, [load]);

  const { active, inactive } = useMemo(() => ({
    active: meds.filter(m => m.active),
    inactive: meds.filter(m => !m.active),
  }), [meds]);

  const renderMed = useCallback(({ item }: { item: Medication }) => {
    const nextTime = item.reminderTimes.length > 0
      ? (() => {
          const t = item.reminderTimes[0];
          const d = new Date();
          d.setHours(t.hour, t.minute, 0, 0);
          return format(d, 'h:mm a');
        })()
      : null;

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => nav.navigate('MedicationDetail', { medicationId: item.id })}
        onLongPress={() => confirmDelete(item)}
        style={styles.medCard}>

        <View style={[styles.colorBar, { backgroundColor: item.pillColor }]} />

        <View style={styles.medBody}>
          <Row style={{ marginBottom: 4, alignItems: 'center' }}>
            <PillDot color={item.pillColor} size={14} />
            <Text style={styles.medName} numberOfLines={1}>{item.name}</Text>
            {item.voiceNoteUri
              ? <Text style={styles.voiceTag}>🎙</Text>
              : null}
          </Row>

          <Text style={styles.medSub}>
            {item.dosage} {item.dosageUnit} · {FREQ_LABELS[item.frequency]}
          </Text>

          {nextTime && item.active && (
            <Text style={styles.nextTime}>Next: {nextTime}</Text>
          )}

          {item.instructions
            ? <Text style={styles.medInstructions} numberOfLines={1}>{item.instructions}</Text>
            : null}
        </View>

        <View style={styles.medActions}>
          <Switch
            value={item.active}
            onValueChange={() => toggleActive(item)}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor="#fff"
          />
          <TouchableOpacity
            onPress={() => nav.navigate('AddMedication', { medicationId: item.id })}
            style={styles.editBtn}>
            <Text style={styles.editIcon}>✏️</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [styles, nav, toggleActive, confirmDelete]);

  return (
    <View style={styles.container}>
      <FlatList
        data={[...active, ...inactive]}
        keyExtractor={m => m.id}
        renderItem={renderMed}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            {active.length > 0 && <SectionLabel title={`Active (${active.length})`} />}
          </>
        }
        ListFooterComponent={
          inactive.length > 0
            ? <SectionLabel title={`Inactive (${inactive.length})`} style={{ marginTop: spacing.xl }} />
            : null
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListEmptyComponent={
          <EmptyState
            icon="💊"
            title="No medications yet"
            subtitle="Tap the + button to add your first medication"
          />
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.85}
        onPress={() => nav.navigate('AddMedication', {})}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    medCard: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      marginHorizontal: spacing.md,
      borderRadius: radius.lg,
      overflow: 'hidden',
      ...shadow.md,
    },
    colorBar: { width: 6 },
    medBody: { flex: 1, padding: spacing.md },
    medName: { fontSize: fs.lg, fontWeight: '700', color: colors.text, flex: 1, marginLeft: spacing.sm },
    voiceTag: { fontSize: 14, marginLeft: 4 },
    medSub: { fontSize: fs.sm, color: colors.textSecondary, marginBottom: 2 },
    nextTime: { fontSize: fs.sm, color: colors.primary, fontWeight: '600', marginTop: 2 },
    medInstructions: { fontSize: fs.xs, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },

    medActions: {
      alignItems: 'center', justifyContent: 'space-around',
      paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    },
    editBtn: { marginTop: spacing.xs, padding: 4 },
    editIcon: { fontSize: 18 },

    fab: {
      position: 'absolute', bottom: 28, right: 24,
      width: 62, height: 62, borderRadius: 31,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
      ...shadow.lg,
    },
    fabIcon: { fontSize: 32, color: '#fff', lineHeight: 36, marginTop: -2 },
  });
}

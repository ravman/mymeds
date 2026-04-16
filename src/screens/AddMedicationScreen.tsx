// src/screens/AddMedicationScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet,
  Alert, Platform, Modal, Switch,
  TouchableOpacity as RNTouchableOpacity,
} from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuid } from 'uuid';
import { getMedication, upsertMedication } from '../storage';
import { scheduleMedicationNotifications, cancelMedicationNotifications } from '../notifications';
import {
  startListening, stopListening, requestMicPermission,
  speak,
  startRecordingVoiceNote, stopRecordingVoiceNote,
} from '../voice';
import { Medication, FrequencyType, DosageUnit, ReminderTime, RootStackParamList } from '../types';
import { colors, spacing, radius, shadow } from '../theme';
import { useFontSizes } from '../fontScale';
import { Button, Row, SectionLabel } from '../components';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AddMedication'>;

const FREQ_OPTIONS: { value: FrequencyType; label: string; times: ReminderTime[] }[] = [
  { value: 'once_daily',        label: 'Once daily',    times: [{ hour: 8, minute: 0 }] },
  { value: 'twice_daily',       label: 'Twice daily',   times: [{ hour: 8, minute: 0 }, { hour: 20, minute: 0 }] },
  { value: 'three_times_daily', label: '3× daily',      times: [{ hour: 8, minute: 0 }, { hour: 14, minute: 0 }, { hour: 20, minute: 0 }] },
  { value: 'every_x_hours',     label: 'Every X hours', times: [{ hour: 8, minute: 0 }] },
  { value: 'weekly',            label: 'Weekly',        times: [{ hour: 8, minute: 0 }] },
  { value: 'as_needed',         label: 'As needed',     times: [] },
];

const UNITS: DosageUnit[] = ['tablet', 'capsule', 'ml', 'drop'];
const MEAL_OPTIONS = ['Before food', 'With food', 'After food'] as const;
type MealInstruction = typeof MEAL_OPTIONS[number] | '';

const PILL_COLORS = [
  '#E74C3C', '#E67E22', '#F1C40F', '#2ECC71',
  '#1ABC9C', '#3498DB', '#9B59B6', '#E91E8C',
  '#795548', '#607D8B',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Pure — defined outside to avoid recreation on every render
function fmt12(t: ReminderTime): string {
  const d = new Date();
  d.setHours(t.hour, t.minute);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function makeTimeDate(t: ReminderTime): Date {
  const d = new Date();
  d.setHours(t.hour, t.minute, 0, 0);
  return d;
}

const HELP_KEY = '@mymeds:add_med_help_shown';

const HELP_SECTIONS = [
  { title: '💊 Medication Name', body: 'Type the name, or tap the mic 🎙 to say it. When you speak, your voice is also recorded — that recording will play when your reminder fires.' },
  { title: '📏 Dosage', body: 'Enter how much you take (e.g. 1, 2, 0.5) and choose the unit — tablet, capsule, ml, or drop. Tap a meal time if you need to take it with food.' },
  { title: '🔄 How Often', body: 'Choose how frequently you take this medication — once daily, twice daily, every X hours, weekly, or as needed.' },
  { title: '⏰ Reminder Times', body: 'Set the exact times each day you\'d like to be reminded. Tap a time to change it. You can add multiple times.' },
  { title: '🎨 Pill Color', body: 'Pick a color to match your physical pill. This helps you quickly identify the right medication at a glance.' },
  { title: '📅 Duration', body: 'Set when you start taking this medication. If you have a fixed course (e.g. antibiotics), toggle "Has end date" to set a stop date.' },
];

// Memoized sub-components — child owns the stable callback so parent .map() stays clean
const ColorSwatch = memo(({ color, selected, onSelect }: {
  color: string; selected: boolean; onSelect: (c: string) => void;
}) => {
  const handlePress = useCallback(() => onSelect(color), [onSelect, color]);
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', ...shadow.sm, backgroundColor: color },
              selected && { borderWidth: 3, borderColor: '#222' }]}>
      {selected && <Text style={{ fontSize: 18, color: '#fff', fontWeight: '700' }}>✓</Text>}
    </TouchableOpacity>
  );
});

const FreqRow = memo(({ opt, selected, onSelect }: {
  opt: typeof FREQ_OPTIONS[number]; selected: boolean; onSelect: (f: FrequencyType) => void;
}) => {
  const handlePress = useCallback(() => onSelect(opt.value), [onSelect, opt.value]);
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, borderRadius: radius.sm, paddingHorizontal: spacing.xs },
              selected && { backgroundColor: colors.primaryLight }]}>
      <View style={[{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
                    selected && { borderColor: colors.primary }]}>
        {selected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />}
      </View>
      <Text style={[{ fontSize: 16, color: colors.textSecondary }, selected && { color: colors.primary, fontWeight: '600' }]}>
        {opt.label}
      </Text>
    </TouchableOpacity>
  );
});

export const AddMedicationScreen: React.FC = () => {
  const fs = useFontSizes();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editId = route.params?.medicationId;
  const isEdit = !!editId;

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('1');
  const [unit, setUnit] = useState<DosageUnit>('tablet');
  const [mealInstruction, setMealInstruction] = useState<MealInstruction>('');
  const [frequency, setFrequency] = useState<FrequencyType>('once_daily');
  const [reminderTimes, setReminderTimes] = useState<ReminderTime[]>([{ hour: 8, minute: 0 }]);
  const [intervalHours, setIntervalHours] = useState('6');
  const [activeDays, setActiveDays] = useState<number[]>([new Date().getDay()]);
  const [pillColor, setPillColor] = useState(PILL_COLORS[5]);
  const [startDate, setStartDate] = useState(new Date());
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | undefined>();

  // Time picker
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerKey, setTimePickerKey] = useState(0);
  const [editingTimeIdx, setEditingTimeIdx] = useState(0);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Voice
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'done'>('idle');
  const [partialText, setPartialText] = useState('');
  const [recordState, setRecordState] = useState<'idle' | 'recording' | 'done'>('idle');

  // Help overlay
  const [showHelp, setShowHelp] = useState(false);

  const [saving, setSaving] = useState(false);

  // Set help icon in nav header
  useEffect(() => {
    nav.setOptions({
      title: isEdit ? 'Edit Medication' : 'Add Medication',
      headerRight: () => (
        <TouchableOpacity onPress={() => setShowHelp(true)} style={{ padding: 8, marginRight: 4 }}>
          <Text style={{ fontSize: 22, color: colors.primary }}>?</Text>
        </TouchableOpacity>
      ),
    });
  }, [isEdit]);

  // Auto-show help on first visit
  useEffect(() => {
    AsyncStorage.getItem(HELP_KEY).then(v => {
      if (!v) {
        setShowHelp(true);
        AsyncStorage.setItem(HELP_KEY, 'shown');
      }
    });
  }, []);

  // Load for edit
  useEffect(() => {
    if (editId) {
      getMedication(editId).then(med => {
        if (!med) return;
        setName(med.name);
        setDosage(String(med.dosage));
        setUnit(UNITS.includes(med.dosageUnit as any) ? med.dosageUnit : 'tablet');
        setFrequency(med.frequency);
        setReminderTimes(med.reminderTimes);
        setIntervalHours(String(med.intervalHours ?? 6));
        setActiveDays(med.activeDays ?? []);
        setPillColor(med.pillColor);
        setStartDate(new Date(med.startDate));
        if (med.endDate) { setHasEndDate(true); setEndDate(new Date(med.endDate)); }
        setVoiceNoteUri(med.voiceNoteUri);
        if (med.voiceNoteUri) setRecordState('done');
        // Restore meal instruction from saved instructions string
        const saved = med.instructions ?? '';
        if ((MEAL_OPTIONS as readonly string[]).includes(saved)) {
          setMealInstruction(saved as MealInstruction);
        }
      });
    }
  }, [editId]);

  const handleFreqChange = useCallback((f: FrequencyType) => {
    setFrequency(f);
    setReminderTimes(FREQ_OPTIONS.find(o => o.value === f)!.times);
  }, []);

  // Auto-stop timer for recording phase
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishRecording = useCallback(async () => {
    if (recordTimerRef.current) { clearTimeout(recordTimerRef.current); recordTimerRef.current = null; }
    try {
      const uri = await stopRecordingVoiceNote();
      setVoiceNoteUri(uri);
      setRecordState('done');
      setVoiceState('idle');
    } catch {
      setRecordState('idle');
      setVoiceState('idle');
    }
  }, []);

  // Phase 2: start recording immediately after STT releases the mic
  const beginReminderRecording = useCallback(async (heardName: string) => {
    try {
      setRecordState('recording');
      await speak(`Say ${heardName} for your reminder`);
      await startRecordingVoiceNote();
      // Auto-stop after 5 seconds if user doesn't tap ⏹
      recordTimerRef.current = setTimeout(finishRecording, 5000);
    } catch {
      setRecordState('idle');
      setVoiceState('idle');
    }
  }, [finishRecording]);

  // Mic button: Phase 1 = STT for name, then auto-flows into Phase 2 = recording
  const startVoice = useCallback(async () => {
    try {
      const ok = await requestMicPermission();
      if (!ok) { Alert.alert('Permission needed', 'Microphone access is required.'); return; }
      setVoiceState('listening');
      setPartialText('');
      await speak('Say the medication name');
      await startListening({
        onPartial: t => setPartialText(t),
        onResult: t => {
          setPartialText('');
          setName(t);
          // STT done — mic is now free, auto-start recording phase
          beginReminderRecording(t);
        },
        onError: () => {
          setVoiceState('idle');
          Alert.alert('Voice error', 'Could not recognise speech. Please type the name.');
        },
      });
    } catch {
      setVoiceState('idle');
      Alert.alert('Voice error', 'Could not start voice input. Please type the name.');
    }
  }, [beginReminderRecording]);

  const stopVoice = useCallback(async () => {
    if (recordState === 'recording') {
      // User tapped ⏹ during recording phase — stop early
      await finishRecording();
    } else {
      await stopListening();
      setVoiceState('idle');
    }
  }, [recordState, finishRecording]);

  const openTimePicker = useCallback((idx: number) => {
    setEditingTimeIdx(idx);
    setShowTimePicker(false);
    setTimePickerKey(k => k + 1);
    // Small delay ensures the picker unmounts before remounting with new key
    requestAnimationFrame(() => setShowTimePicker(true));
  }, []);

  const onTimeChange = useCallback((_: any, date?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (!date) return;
    setReminderTimes(prev => {
      const updated = [...prev];
      updated[editingTimeIdx] = { hour: date.getHours(), minute: date.getMinutes() };
      return updated;
    });
  }, [editingTimeIdx]);

  const addTime = useCallback(() => setReminderTimes(t => [...t, { hour: 12, minute: 0 }]), []);
  const removeTime = useCallback((idx: number) => setReminderTimes(t => t.filter((_, i) => i !== idx)), []);

  const toggleDay = useCallback((d: number) => {
    setActiveDays(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort(),
    );
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter a medication name.'); return; }
    if (isNaN(parseFloat(dosage)) || parseFloat(dosage) <= 0) {
      Alert.alert('Invalid dosage', 'Please enter a valid dosage amount.'); return;
    }
    if (frequency !== 'as_needed' && reminderTimes.length === 0) {
      Alert.alert('No reminder times', 'Please add at least one reminder time.'); return;
    }
    if (frequency === 'weekly' && activeDays.length === 0) {
      Alert.alert('No days selected', 'Please select at least one day of the week.'); return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = isEdit ? await getMedication(editId!) : null;
      if (existing) await cancelMedicationNotifications(existing.notificationIds);

      const med: Medication = {
        id: editId ?? uuid(),
        name: name.trim(),
        voiceNoteUri,
        dosage: parseFloat(dosage),
        dosageUnit: unit,
        instructions: mealInstruction || undefined,
        frequency,
        intervalHours: frequency === 'every_x_hours' ? parseInt(intervalHours) : undefined,
        reminderTimes,
        activeDays: frequency === 'weekly' ? activeDays : undefined,
        startDate: startDate.toISOString().split('T')[0],
        endDate: hasEndDate ? endDate.toISOString().split('T')[0] : undefined,
        pillColor,
        notificationIds: [],
        active: true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const notifIds = await scheduleMedicationNotifications(med).catch(() => [] as string[]);
      med.notificationIds = notifIds;
      await upsertMedication(med);
      nav.goBack();
    } catch (e) {
      Alert.alert('Error', `Could not save medication: ${String(e)}`);
    } finally {
      setSaving(false);
    }
  }, [name, dosage, frequency, reminderTimes, intervalHours, activeDays, mealInstruction,
      pillColor, startDate, hasEndDate, endDate, voiceNoteUri, isEdit, editId]);

  const selectedTime = useMemo(
    () => reminderTimes[editingTimeIdx] ? makeTimeDate(reminderTimes[editingTimeIdx]) : new Date(),
    [reminderTimes, editingTimeIdx],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

      {/* ── Medication Name ── */}
      <SectionLabel title="Medication Name" />
      <View style={styles.card}>
        <View style={styles.nameRow}>
          <TextInput
            style={styles.nameInput}
            value={voiceState === 'listening' ? (partialText || '…') : name}
            onChangeText={setName}
            placeholder="e.g. Metformin"
            placeholderTextColor={colors.textMuted}
            editable={voiceState !== 'listening'}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.micBtn, (voiceState === 'listening' || recordState === 'recording') && styles.micBtnActive]}
            onPress={(voiceState === 'listening' || recordState === 'recording') ? stopVoice : startVoice}>
            <Text style={styles.micIcon}>{(voiceState === 'listening' || recordState === 'recording') ? '⏹' : '🎙'}</Text>
          </TouchableOpacity>
        </View>
        {voiceState === 'listening' && (
          <Text style={styles.listeningHint}>Listening… speak the medication name</Text>
        )}
        {recordState === 'recording' && (
          <Text style={styles.listeningHint}>Recording reminder… tap ⏹ when done (auto-stops in 5s)</Text>
        )}
        {recordState === 'done' && (
          <Text style={styles.voiceDoneHint}>✓ Reminder voice recorded</Text>
        )}
        <Text style={styles.fieldHint}>
          {recordState === 'done'
            ? 'Tap 🎙 again to re-record'
            : 'Tap 🎙 to speak the name — it will also be recorded for your reminder'}
        </Text>
      </View>

      {/* ── Dosage ── */}
      <SectionLabel title="Dosage" />
      <View style={styles.card}>
        <TextInput
          style={[styles.input, { marginBottom: spacing.md }]}
          value={dosage}
          onChangeText={setDosage}
          keyboardType="decimal-pad"
          placeholder="Amount (e.g. 1, 2, 0.5)"
          placeholderTextColor={colors.textMuted}
        />
        {/* Single row of 4 equal-width unit buttons */}
        <View style={styles.unitGrid}>
          {UNITS.map(u => (
            <RNTouchableOpacity
              key={u}
              style={[styles.unitChip, u === unit && styles.unitChipActive]}
              onPress={() => setUnit(u)}>
              <Text style={[styles.unitChipText, u === unit && styles.unitChipTextActive]}>{u}</Text>
            </RNTouchableOpacity>
          ))}
        </View>
        {/* Meal radio buttons */}
        <View style={styles.mealDivider} />
        {MEAL_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt}
            style={styles.mealRadioRow}
            onPress={() => setMealInstruction(prev => prev === opt ? '' : opt)}>
            <View style={[styles.radio, mealInstruction === opt && styles.radioActive]}>
              {mealInstruction === opt && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.mealRadioLabel, mealInstruction === opt && styles.mealRadioLabelActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Frequency ── */}
      <SectionLabel title="How Often" />
      <View style={styles.card}>
        {FREQ_OPTIONS.map(opt => (
          <FreqRow key={opt.value} opt={opt} selected={opt.value === frequency} onSelect={handleFreqChange} />
        ))}

        {frequency === 'every_x_hours' && (
          <Row style={{ marginTop: spacing.sm }}>
            <Text style={styles.fieldLabel}>Every </Text>
            <TextInput
              style={[styles.input, { width: 60, marginHorizontal: spacing.sm }]}
              value={intervalHours}
              onChangeText={setIntervalHours}
              keyboardType="number-pad"
            />
            <Text style={styles.fieldLabel}> hours</Text>
          </Row>
        )}

        {frequency === 'weekly' && (
          <Row style={{ flexWrap: 'wrap', marginTop: spacing.sm }}>
            {DAYS.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dayChip, activeDays.includes(i) && styles.dayChipActive]}
                onPress={() => toggleDay(i)}>
                <Text style={[styles.dayChipText, activeDays.includes(i) && styles.dayChipTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </Row>
        )}
      </View>

      {/* ── Reminder Times ── */}
      {frequency !== 'as_needed' && (
        <>
          <SectionLabel title="Reminder Times" />
          <View style={styles.card}>
            {reminderTimes.map((t, idx) => (
              <Row key={idx} style={[styles.timeRow, idx < reminderTimes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                <Text style={styles.timeIcon}>⏰</Text>
                <TouchableOpacity onPress={() => openTimePicker(idx)} style={{ flex: 1 }}>
                  <Text style={styles.timeText}>{fmt12(t)}</Text>
                </TouchableOpacity>
                {reminderTimes.length > 1 && (
                  <TouchableOpacity onPress={() => removeTime(idx)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </Row>
            ))}
            <TouchableOpacity style={styles.addTimeBtn} onPress={addTime}>
              <Text style={styles.addTimeBtnText}>+ Add another time</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {showTimePicker && (
        <DateTimePicker
          key={timePickerKey}
          mode="time"
          value={selectedTime}
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
          onChange={onTimeChange}
        />
      )}

      {/* ── Pill Color ── */}
      <SectionLabel title="Pill Color" />
      <View style={[styles.card, { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }]}>
        {PILL_COLORS.map(c => (
          <ColorSwatch key={c} color={c} selected={c === pillColor} onSelect={setPillColor} />
        ))}
      </View>

      {/* ── Duration ── */}
      <SectionLabel title="Duration" />
      <View style={styles.card}>
        <Row style={{ marginBottom: spacing.md }}>
          <Text style={[styles.fieldLabel, { flex: 1 }]}>Start date</Text>
          <TouchableOpacity onPress={() => setShowStartPicker(true)} style={styles.datePill}>
            <Text style={styles.datePillText}>{startDate.toLocaleDateString()}</Text>
          </TouchableOpacity>
        </Row>
        <Row style={{ marginBottom: hasEndDate ? spacing.md : 0 }}>
          <Text style={[styles.fieldLabel, { flex: 1 }]}>Has end date?</Text>
          <Switch
            value={hasEndDate}
            onValueChange={setHasEndDate}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
            thumbColor="#fff"
          />
        </Row>
        {hasEndDate && (
          <Row>
            <Text style={[styles.fieldLabel, { flex: 1 }]}>End date</Text>
            <TouchableOpacity onPress={() => setShowEndPicker(true)} style={styles.datePill}>
              <Text style={styles.datePillText}>{endDate.toLocaleDateString()}</Text>
            </TouchableOpacity>
          </Row>
        )}
      </View>

      {showStartPicker && (
        <DateTimePicker mode="date" value={startDate}
          onChange={(_, d) => { setShowStartPicker(Platform.OS === 'ios'); if (d) setStartDate(d); }} />
      )}
      {showEndPicker && (
        <DateTimePicker mode="date" value={endDate} minimumDate={startDate}
          onChange={(_, d) => { setShowEndPicker(Platform.OS === 'ios'); if (d) setEndDate(d); }} />
      )}

      {/* ── Save ── */}
      <View style={{ padding: spacing.lg, marginTop: spacing.md }}>
        <Button
          label={isEdit ? 'Save Changes' : 'Add Medication'}
          onPress={save}
          loading={saving}
          fullWidth
          size="lg"
          icon="💊"
        />
      </View>

      {/* ── Help Overlay ── */}
      <Modal visible={showHelp} transparent animationType="none" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.helpBackdrop}>
          <View style={styles.helpModal}>
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>How to Add a Medication</Text>
            </View>
            <ScrollView style={styles.helpScroll} showsVerticalScrollIndicator={false}>
              {HELP_SECTIONS.map((s, i) => (
                <View key={i} style={styles.helpSection}>
                  <Text style={styles.helpSectionTitle}>{s.title}</Text>
                  <Text style={styles.helpSectionBody}>{s.body}</Text>
                </View>
              ))}
            </ScrollView>
            <RNTouchableOpacity style={styles.helpDoneBtn} onPress={() => setShowHelp(false)}>
              <Text style={styles.helpDoneBtnText}>Got it</Text>
            </RNTouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxl },

    card: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.md,
      borderRadius: radius.lg,
      padding: spacing.md,
      ...shadow.sm,
    },

    nameRow: { flexDirection: 'row', alignItems: 'center' },
    nameInput: {
      flex: 1, fontSize: fs.xl, fontWeight: '600',
      color: colors.text, paddingVertical: spacing.sm,
      borderBottomWidth: 2, borderBottomColor: colors.primaryLight,
      marginRight: spacing.sm,
    },
    micBtn: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: colors.primaryLight,
      alignItems: 'center', justifyContent: 'center',
    },
    micBtnActive: { backgroundColor: colors.danger + '22', borderWidth: 2, borderColor: colors.danger },
    micIcon: { fontSize: 22 },
    listeningHint: { fontSize: fs.sm, color: colors.danger, marginTop: spacing.sm, fontStyle: 'italic' },
    voiceDoneHint: { fontSize: fs.sm, color: colors.success, marginTop: spacing.sm },
    fieldHint: { fontSize: fs.xs, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },

    recordRemindBtn: {
      marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger + '88',
      backgroundColor: colors.danger + '11', alignSelf: 'flex-start',
    },
    recordRemindBtnDone: { borderColor: colors.success + '88', backgroundColor: colors.success + '11' },
    recordRemindBtnActive: {
      marginTop: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
      borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.danger,
      backgroundColor: colors.danger + '22', alignSelf: 'flex-start',
    },
    recordRemindBtnText: { fontSize: fs.sm, color: colors.danger, fontWeight: '600' },

    input: {
      fontSize: fs.md, color: colors.text,
      borderWidth: 1.5, borderColor: colors.border,
      borderRadius: radius.sm, paddingHorizontal: spacing.sm,
      paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
      backgroundColor: colors.background,
    },

    unitGrid: {
      flexDirection: 'row',
      gap: spacing.xs,
      alignSelf: 'stretch',
    },
    unitChip: {
      flex: 1,
      paddingVertical: spacing.sm,
      borderRadius: radius.md, borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
    },
    unitChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    unitChipText: { fontSize: fs.md, color: colors.textSecondary, fontWeight: '600' },
    unitChipTextActive: { color: '#fff' },

    mealDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
    mealRadioRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.xs + 1, paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
    },
    mealRadioLabel: { fontSize: fs.md, color: colors.textSecondary },
    mealRadioLabelActive: { color: colors.primary, fontWeight: '600' },

    chip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      borderRadius: radius.full, borderWidth: 1.5,
      borderColor: colors.border, marginRight: spacing.sm,
      backgroundColor: colors.background,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: fs.sm, color: colors.textSecondary, fontWeight: '500' },
    chipTextActive: { color: '#fff', fontWeight: '700' },

    freqRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: spacing.sm + 2, borderRadius: radius.sm,
      paddingHorizontal: spacing.xs,
    },
    freqRowActive: { backgroundColor: colors.primaryLight },
    radio: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 2, borderColor: colors.borderStrong,
      alignItems: 'center', justifyContent: 'center',
      marginRight: spacing.sm,
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    freqLabel: { fontSize: fs.md, color: colors.textSecondary },
    freqLabelActive: { color: colors.primary, fontWeight: '600' },

    fieldLabel: { fontSize: fs.md, color: colors.textSecondary },

    dayChip: {
      width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: colors.border,
      marginRight: spacing.sm, marginBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    dayChipText: { fontSize: fs.sm, fontWeight: '600', color: colors.textSecondary },
    dayChipTextActive: { color: '#fff' },

    timeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
    timeIcon: { fontSize: 18, marginRight: spacing.sm },
    timeText: { fontSize: fs.lg, fontWeight: '600', color: colors.primary },
    removeBtn: { padding: 6 },
    removeBtnText: { fontSize: 16, color: colors.danger },
    addTimeBtn: { marginTop: spacing.sm, paddingVertical: spacing.sm },
    addTimeBtnText: { fontSize: fs.md, color: colors.primary, fontWeight: '600' },

    colorSwatch: {
      width: 38, height: 38, borderRadius: 19,
      alignItems: 'center', justifyContent: 'center',
      ...shadow.sm,
    },
    colorSwatchActive: { borderWidth: 3, borderColor: colors.text },
    checkMark: { fontSize: 18, color: '#fff', fontWeight: '700' },

    datePill: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full,
    },
    datePillText: { fontSize: fs.md, color: colors.primary, fontWeight: '600' },

    // Help overlay
    helpBackdrop: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
    },
    helpModal: {
      backgroundColor: colors.surface, borderRadius: radius.xl,
      width: '100%', maxHeight: '85%',
      padding: spacing.lg, ...shadow.lg,
    },
    helpHeader: {
      flexDirection: 'row', alignItems: 'center',
      marginBottom: spacing.md,
    },
    helpTitle: { flex: 1, fontSize: fs.lg, fontWeight: '700', color: colors.text },
    helpClose: { padding: 4 },
    helpCloseText: { fontSize: 20, color: colors.textMuted },
    helpScroll: { marginBottom: spacing.md },
    helpSection: { marginBottom: spacing.md },
    helpSectionTitle: { fontSize: fs.md, fontWeight: '700', color: colors.primary, marginBottom: 4 },
    helpSectionBody: { fontSize: fs.sm, color: colors.textSecondary, lineHeight: 22 },
    helpDoneBtn: {
      backgroundColor: colors.primary, borderRadius: radius.md,
      paddingVertical: spacing.md, alignItems: 'center',
    },
    helpDoneBtnText: { fontSize: fs.md, color: '#fff', fontWeight: '700' },
  });
}

// src/screens/SettingsScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, Linking, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSettings, saveSettings, pruneOldLogs } from '../storage';
import { cancelAllNotifications } from '../notifications';
import { initTts, speak } from '../voice';
import { AppSettings } from '../types';
import { colors, spacing, radius } from '../theme';
import { useFontSizes, useFontSizePref } from '../fontScale';
import { SectionLabel, SettingRow, Button } from '../components';

const SNOOZE_OPTIONS = [5, 10, 15, 20, 30];
const FONT_OPTIONS: AppSettings['fontSize'][] = ['normal', 'large', 'xlarge'];

export const SettingsScreen: React.FC = () => {
  const fs = useFontSizes();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  const [, setFontSizePref] = useFontSizePref();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useFocusEffect(useCallback(() => {
    getSettings().then(setSettings);
  }, []));

  const update = useCallback(async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await saveSettings(updated);
    if (patch.fontSize) {
      setFontSizePref(patch.fontSize);
    }
  }, [settings, setFontSizePref]);

  const testVoice = useCallback(async () => {
    try {
      await speak('This is how your medication reminder will sound. Time to take your Metformin — 1 tablet. Take with food.');
    } catch (e) {
      Alert.alert('Voice Error', String(e));
    }
  }, []);

  const clearAllData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL medications and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything', style: 'destructive', onPress: async () => {
            const { AsyncStorage } = await import('@react-native-async-storage/async-storage');
            await AsyncStorage.clear();
            await cancelAllNotifications();
            Alert.alert('Done', 'All data has been cleared.');
          },
        },
      ],
    );
  }, []);

  const pruneHistory = useCallback(async () => {
    await pruneOldLogs();
    Alert.alert('Done', 'History older than 90 days has been removed.');
  }, []);

  if (!settings) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Voice & Sound */}
      <SectionLabel title="Voice & Sound" />
      <View style={styles.group}>
        <SettingRow
          icon="🎙"
          label="Voice Entry"
          detail="Use microphone to record medication names"
          value={settings.voiceEnabled}
          onToggle={v => update({ voiceEnabled: v })}
        />
        <SettingRow
          icon="🔊"
          label="Read Reminders Aloud"
          detail="Speak medication name when reminder fires"
          value={settings.ttsEnabled}
          onToggle={v => update({ ttsEnabled: v })}
        />
        <SettingRow
          icon="🔔"
          label="Sound"
          value={settings.soundEnabled}
          onToggle={v => update({ soundEnabled: v })}
        />
        <SettingRow
          icon="📳"
          label="Vibration"
          value={settings.vibrationEnabled}
          onToggle={v => update({ vibrationEnabled: v })}
          last
        />
      </View>

      <Button
        label="Test Voice Reminder"
        onPress={testVoice}
        variant="secondary"
        size="md"
        icon="▶"
        style={styles.testBtn}
      />

      {/* Snooze */}
      <SectionLabel title="Snooze Duration" />
      <View style={styles.group}>
        <View style={styles.snoozeRow}>
          {SNOOZE_OPTIONS.map(mins => (
            <TouchableOpacity
              key={mins}
              activeOpacity={0.7}
              style={[
                styles.snoozeChip,
                settings.snoozeMinutes === mins && styles.snoozeChipActive,
              ]}
              onPress={() => update({ snoozeMinutes: mins })}>
              <Text
                style={[
                  styles.snoozeText,
                  settings.snoozeMinutes === mins && styles.snoozeTextActive,
                ]}>
                {mins}m
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Font Size */}
      <SectionLabel title="Text Size" />
      <View style={styles.group}>
        <View style={styles.snoozeRow}>
          {FONT_OPTIONS.map(f => (
            <TouchableOpacity
              key={f}
              activeOpacity={0.7}
              style={[
                styles.snoozeChip,
                { flex: 1 },
                settings.fontSize === f && styles.snoozeChipActive,
              ]}
              onPress={() => update({ fontSize: f })}>
              <Text
                style={[
                  styles.snoozeText,
                  { fontSize: f === 'normal' ? 14 : f === 'large' ? 17 : 21 },
                  settings.fontSize === f && styles.snoozeTextActive,
                ]}>
                {f === 'normal' ? 'A' : f === 'large' ? 'A' : 'A'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>
          {settings.fontSize === 'normal' ? 'Standard text size'
            : settings.fontSize === 'large' ? 'Larger text (recommended)'
            : 'Extra large text'}
        </Text>
      </View>

      {/* Data */}
      <SectionLabel title="Data & Privacy" />
      <View style={styles.group}>
        <SettingRow
          icon="🗑"
          label="Clear Old History"
          detail="Remove dose logs older than 90 days"
          onPress={pruneHistory}
        />
        <SettingRow
          icon="⚠️"
          label="Clear All Data"
          detail="Delete all medications and history"
          onPress={clearAllData}
          last
        />
      </View>

      {/* About */}
      <SectionLabel title="About" />
      <View style={styles.group}>
        <SettingRow icon="💊" label="MedHelper" detail="Version 1.0.0" last />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          All data is stored locally on your device.{'\n'}Nothing is shared or sent anywhere.
        </Text>
      </View>
    </ScrollView>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxl },

    group: {
      marginHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: 'hidden',
    },

    testBtn: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
    },

    snoozeRow: {
      flexDirection: 'row',
      padding: spacing.md,
      gap: spacing.sm,
    },
    snoozeChip: {
      flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
      borderRadius: radius.md, borderWidth: 1.5,
      borderColor: colors.border, backgroundColor: colors.background,
    },
    snoozeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    snoozeText: { fontSize: fs.md, fontWeight: '600', color: colors.textSecondary },
    snoozeTextActive: { color: '#fff' },

    hint: {
      fontSize: fs.sm, color: colors.textMuted,
      textAlign: 'center', paddingBottom: spacing.sm,
    },

    footer: {
      margin: spacing.xl,
      padding: spacing.lg,
      backgroundColor: colors.primaryLight,
      borderRadius: radius.lg,
      alignItems: 'center',
    },
    footerText: {
      fontSize: fs.sm, color: colors.primary,
      textAlign: 'center', lineHeight: 22,
    },
  });
}

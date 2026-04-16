// src/screens/HistoryScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, SectionList, StyleSheet, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { getLogs, getMedications } from '../storage';
import { DoseLog, Medication } from '../types';
import { colors, spacing, radius } from '../theme';
import { useFontSizes } from '../fontScale';
import { Row, PillDot, EmptyState, StatusBadge } from '../components';

interface DaySection {
  title: string;
  dateStr: string;
  data: DoseLog[];
}

type Filter = 'all' | 'taken' | 'missed' | 'skipped';

function logStatus(log: DoseLog, now: Date): 'taken' | 'skipped' | 'missed' | 'pending' {
  if (log.takenAt) return 'taken';
  if (log.skipped) return 'skipped';
  if (new Date(log.scheduledTime) < now) return 'missed';
  return 'pending';
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'taken',   label: '✓ Taken' },
  { value: 'missed',  label: '✗ Missed' },
  { value: 'skipped', label: '⟳ Skipped' },
];

export const HistoryScreen: React.FC = () => {
  const fs = useFontSizes();
  const styles = useMemo(() => makeStyles(fs), [fs]);
  const [sections, setSections] = useState<DaySection[]>([]);
  const [medMap, setMedMap] = useState<Record<string, Medication>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [stats, setStats] = useState({ taken: 0, missed: 0, skipped: 0, total: 0 });

  useFocusEffect(useCallback(() => {
    (async () => {
      const [allLogs, meds] = await Promise.all([getLogs(), getMedications()]);
      const map: Record<string, Medication> = {};
      meds.forEach(m => { map[m.id] = m; });
      setMedMap(map);

      const now = new Date();
      const cutoff = subDays(startOfDay(now), 30).toISOString();
      const relevant = allLogs
        .filter(l => l.scheduledTime >= cutoff && new Date(l.scheduledTime) <= now)
        .sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime));

      // Stats (last 30 days)
      const taken = relevant.filter(l => l.takenAt).length;
      const skipped = relevant.filter(l => l.skipped).length;
      const missed = relevant.filter(l => !l.takenAt && !l.skipped).length;
      setStats({ taken, missed, skipped, total: relevant.length });

      // Group by date
      const byDate: Record<string, DoseLog[]> = {};
      for (const log of relevant) {
        const d = log.scheduledTime.split('T')[0];
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(log);
      }

      const s: DaySection[] = Object.keys(byDate)
        .sort((a, b) => b.localeCompare(a))
        .map(dateStr => ({
          title: (() => {
            const today = format(now, 'yyyy-MM-dd');
            const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
            if (dateStr === today) return 'Today';
            if (dateStr === yesterday) return 'Yesterday';
            return format(parseISO(dateStr), 'EEEE, MMMM d');
          })(),
          dateStr,
          data: byDate[dateStr],
        }));

      setSections(s);
    })();
  }, []));

  const filtered = useMemo(() => {
    const now = new Date();
    return sections.map(s => ({
      ...s,
      data: s.data.filter(log => {
        if (filter === 'all') return true;
        const status = logStatus(log, now);
        return status === filter;
      }),
    })).filter(s => s.data.length > 0);
  }, [sections, filter]);

  const pct = useMemo(
    () => stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0,
    [stats],
  );

  const renderLog = useCallback(({ item }: { item: DoseLog }) => {
    const med = medMap[item.medicationId];
    const status = logStatus(item, new Date());
    const timeStr = format(new Date(item.scheduledTime), 'h:mm a');

    return (
      <Row style={styles.logRow}>
        <PillDot color={med?.pillColor ?? colors.textMuted} size={14} />
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.logName}>{item.medicationName}</Text>
          <Text style={styles.logTime}>
            {timeStr}
            {item.takenAt ? ` → taken at ${format(new Date(item.takenAt), 'h:mm a')}` : ''}
          </Text>
        </View>
        <StatusBadge status={status} />
      </Row>
    );
  }, [styles, medMap]);

  return (
    <View style={styles.container}>
      {/* Stats banner */}
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>30-Day Overview</Text>
        <Row style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.success }]}>{stats.taken}</Text>
            <Text style={styles.statLabel}>Taken</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.danger }]}>{stats.missed}</Text>
            <Text style={styles.statLabel}>Missed</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: colors.warning }]}>{stats.skipped}</Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxHighlight]}>
            <Text style={[styles.statNum, { color: colors.primary }]}>{pct}%</Text>
            <Text style={styles.statLabel}>Adherence</Text>
          </View>
        </Row>
        <View style={styles.adherenceBar}>
          <View style={[
            styles.adherenceFill,
            {
              width: `${pct}%` as any,
              backgroundColor: pct >= 80 ? colors.success : pct >= 50 ? colors.warning : colors.danger,
            },
          ]} />
        </View>
      </View>

      {/* Filters */}
      <Row style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, f.value === filter && styles.filterChipActive]}
            onPress={() => setFilter(f.value)}>
            <Text style={[styles.filterText, f.value === filter && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Row>

      <SectionList
        sections={filtered}
        keyExtractor={log => log.id}
        renderItem={renderLog}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No history yet"
            subtitle="Dose history will appear here as you log medications"
          />
        }
        stickySectionHeadersEnabled
      />
    </View>
  );
};

type FS = ReturnType<typeof useFontSizes>;

function makeStyles(fs: FS) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    banner: {
      backgroundColor: colors.primary,
      padding: spacing.lg,
      paddingTop: spacing.xl,
    },
    bannerTitle: { fontSize: fs.lg, fontWeight: '700', color: '#fff', marginBottom: spacing.md },
    statsRow: { marginBottom: spacing.md },
    statBox: { flex: 1, alignItems: 'center' },
    statBoxHighlight: {
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: radius.md, paddingVertical: spacing.xs,
    },
    statNum: { fontSize: fs.xxl, fontWeight: '800', color: '#fff' },
    statLabel: { fontSize: fs.xs, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
    adherenceBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.full, overflow: 'hidden' },
    adherenceFill: { height: '100%', borderRadius: radius.full },

    filterRow: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    filterChip: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.full, marginRight: spacing.sm,
      backgroundColor: colors.background,
      borderWidth: 1, borderColor: colors.border,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterText: { fontSize: fs.sm, color: colors.textSecondary, fontWeight: '500' },
    filterTextActive: { color: '#fff', fontWeight: '700' },

    sectionHeader: {
      fontSize: fs.sm, fontWeight: '700', color: colors.textMuted,
      letterSpacing: 0.8, paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm, backgroundColor: colors.background,
      textTransform: 'uppercase',
    },

    logRow: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    logName: { fontSize: fs.md, fontWeight: '600', color: colors.text },
    logTime: { fontSize: fs.sm, color: colors.textSecondary, marginTop: 2 },
  });
}

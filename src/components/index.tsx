// src/components/index.tsx
import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Switch,
} from 'react-native';
import { colors, fontSize as baseFontSize, spacing, radius, shadow } from '../theme';
import { useFontSizes } from '../fontScale';

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', size = 'md',
  loading, disabled, icon, style, fullWidth,
}) => {
  const fs = useFontSizes();
  const bg: Record<string, string> = {
    primary: colors.primary,
    secondary: colors.surface,
    danger: colors.danger,
    ghost: 'transparent',
  };
  const fg: Record<string, string> = {
    primary: colors.textOnPrimary,
    secondary: colors.primary,
    danger: colors.textOnPrimary,
    ghost: colors.primary,
  };
  const padV = { sm: 10, md: 14, lg: 18 }[size]!;
  const padH = { sm: 14, md: 20, lg: 28 }[size]!;
  const textSize = { sm: fs.sm, md: fs.md, lg: fs.lg }[size]!;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        staticStyles.btn,
        { backgroundColor: bg[variant], paddingVertical: padV, paddingHorizontal: padH },
        variant === 'secondary' && { borderWidth: 2, borderColor: colors.primary },
        fullWidth && { width: '100%' },
        (disabled || loading) && { opacity: 0.45 },
        (variant === 'primary' || variant === 'danger') && shadow.sm,
        style,
      ]}>
      {loading
        ? <ActivityIndicator color={fg[variant]} size="small" />
        : (
          <View style={staticStyles.btnRow}>
            {icon ? <Text style={{ fontSize: textSize, marginRight: 6 }}>{icon}</Text> : null}
            <Text style={[staticStyles.btnLabel, { color: fg[variant], fontSize: textSize }]}>{label}</Text>
          </View>
        )}
    </TouchableOpacity>
  );
};

// ── PillDot ───────────────────────────────────────────────────────────────────

export const PillDot: React.FC<{ color: string; size?: number }> = ({ color, size = 16 }) => (
  <View style={{
    width: size, height: size, borderRadius: size / 2,
    backgroundColor: color,
  }} />
);

// ── Card ──────────────────────────────────────────────────────────────────────

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; onPress?: () => void }> = ({
  children, style, onPress,
}) => {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={[staticStyles.card, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[staticStyles.card, style]}>{children}</View>;
};

// ── SectionLabel ──────────────────────────────────────────────────────────────

export const SectionLabel: React.FC<{ title: string; style?: TextStyle }> = ({ title, style }) => {
  const fs = useFontSizes();
  return (
    <Text style={[staticStyles.sectionLabel, { fontSize: fs.xs }, style]}>
      {title.toUpperCase()}
    </Text>
  );
};

// ── EmptyState ────────────────────────────────────────────────────────────────

export const EmptyState: React.FC<{ icon: string; title: string; subtitle?: string }> = ({
  icon, title, subtitle,
}) => {
  const fs = useFontSizes();
  return (
    <View style={staticStyles.empty}>
      <Text style={staticStyles.emptyIcon}>{icon}</Text>
      <Text style={[staticStyles.emptyTitle, { fontSize: fs.xl }]}>{title}</Text>
      {subtitle ? <Text style={[staticStyles.emptySubtitle, { fontSize: fs.md }]}>{subtitle}</Text> : null}
    </View>
  );
};

// ── Divider ───────────────────────────────────────────────────────────────────

export const Divider: React.FC<{ style?: ViewStyle }> = ({ style }) => (
  <View style={[staticStyles.divider, style]} />
);

// ── Row ───────────────────────────────────────────────────────────────────────

export const Row: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}> = ({ children, style, onPress }) => {
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.75} onPress={onPress}
        style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
};

// ── SettingRow ────────────────────────────────────────────────────────────────

export const SettingRow: React.FC<{
  icon: string;
  label: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  detail?: string;
  last?: boolean;
}> = ({ icon, label, value, onToggle, onPress, detail, last }) => {
  const fs = useFontSizes();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[staticStyles.settingRow, !last && staticStyles.settingRowBorder]}>
      <Text style={staticStyles.settingIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[staticStyles.settingLabel, { fontSize: fs.md }]}>{label}</Text>
        {detail ? <Text style={[staticStyles.settingDetail, { fontSize: fs.sm }]}>{detail}</Text> : null}
      </View>
      {onToggle !== undefined
        ? <Switch value={value} onValueChange={onToggle} trackColor={{ true: colors.primary }} />
        : onPress
          ? <Text style={staticStyles.chevron}>›</Text>
          : null}
    </TouchableOpacity>
  );
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

export const StatusBadge: React.FC<{ status: 'taken' | 'skipped' | 'pending' | 'missed' }> = ({ status }) => {
  const fs = useFontSizes();
  const cfg = {
    taken: { bg: colors.successLight, fg: colors.success, label: '✓ Taken' },
    skipped: { bg: colors.warningLight, fg: colors.warning, label: '⟳ Skipped' },
    pending: { bg: colors.primaryLight, fg: colors.primary, label: '◌ Pending' },
    missed: { bg: colors.dangerLight, fg: colors.danger, label: '✗ Missed' },
  }[status];
  return (
    <View style={[staticStyles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[staticStyles.badgeText, { color: cfg.fg, fontSize: fs.sm }]}>{cfg.label}</Text>
    </View>
  );
};

// ── Static styles (layout/color only — no font sizes) ────────────────────────

const staticStyles = StyleSheet.create({
  btn: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  btnLabel: { fontWeight: '700', letterSpacing: 0.2 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    ...shadow.md,
  },

  sectionLabel: {
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyIcon: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: {
    fontWeight: '700', color: colors.text,
    textAlign: 'center', marginBottom: spacing.sm,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    textAlign: 'center', lineHeight: 24,
  },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingIcon: { fontSize: 22, marginRight: spacing.md, width: 32, textAlign: 'center' },
  settingLabel: { fontWeight: '500', color: colors.text },
  settingDetail: { color: colors.textSecondary, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: spacing.sm },

  badge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.full,
  },
  badgeText: { fontWeight: '600' },
});

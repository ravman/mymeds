// src/navigation.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { TodayScreen } from './screens/TodayScreen';
import { MedicationsScreen } from './screens/MedicationsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AddMedicationScreen } from './screens/AddMedicationScreen';
import { MedicationDetailScreen } from './screens/MedicationDetailScreen';

import { RootStackParamList, TabParamList } from './types';
import { colors, fontSize } from './theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ── Custom tab icons drawn with View primitives ───────────────────────────────

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={[icon.wrap]}>
      {/* roof triangle */}
      <View style={[icon.roofLeft,  { borderRightColor: color }]} />
      <View style={[icon.roofRight, { borderLeftColor: color }]} />
      {/* walls */}
      <View style={[icon.houseBody, { borderColor: color }]}>
        {/* door */}
        <View style={[icon.door, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function PillIcon({ color }: { color: string }) {
  return (
    <View style={icon.wrap}>
      <View style={[icon.pillOuter, { borderColor: color, transform: [{ rotate: '-35deg' }] }]}>
        <View style={[icon.pillDivider, { backgroundColor: color }]} />
        <View style={[icon.pillHalfRight, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function HistoryIcon({ color }: { color: string }) {
  return (
    <View style={icon.wrap}>
      {/* clock circle */}
      <View style={[icon.clockFace, { borderColor: color }]}>
        {/* hour hand */}
        <View style={[icon.clockHourHand, { backgroundColor: color }]} />
        {/* minute hand */}
        <View style={[icon.clockMinuteHand, { backgroundColor: color }]} />
      </View>
      {/* counter-clockwise arrow hint */}
      <View style={[icon.arrowTail, { borderColor: color }]} />
    </View>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <View style={icon.wrap}>
      {/* 8 solid teeth, rotated around canvas centre */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
        <View
          key={deg}
          style={[icon.gearTooth, { backgroundColor: color, transform: [{ rotate: `${deg}deg` }] }]}
        />
      ))}
      {/* solid filled body on top of teeth */}
      <View style={[icon.gearBody, { backgroundColor: color }]} />
      {/* punch-through centre hole */}
      <View style={icon.gearHole} />
    </View>
  );
}

const S = 28; // icon canvas size

const icon = StyleSheet.create({
  wrap: {
    width: S,
    height: S,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Home
  roofLeft: {
    position: 'absolute',
    top: 1,
    left: S / 2 - 10,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderRightWidth: 10,
    borderBottomWidth: 9,
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  roofRight: {
    position: 'absolute',
    top: 1,
    left: S / 2,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  houseBody: {
    position: 'absolute',
    bottom: 2,
    width: 14,
    height: 11,
    borderWidth: 2,
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  door: {
    width: 5,
    height: 6,
    borderRadius: 1,
    marginBottom: -2,
  },
  // Pill
  pillOuter: {
    width: 22,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  pillDivider: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
  },
  pillHalfRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    opacity: 0.25,
  },
  // Clock / History
  clockFace: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHourHand: {
    position: 'absolute',
    width: 2,
    height: 5,
    borderRadius: 1,
    bottom: '50%',
    left: '50%',
    marginLeft: -1,
    transformOrigin: 'bottom',
    transform: [{ rotate: '-40deg' }],
  },
  clockMinuteHand: {
    position: 'absolute',
    width: 2,
    height: 7,
    borderRadius: 1,
    bottom: '50%',
    left: '50%',
    marginLeft: -1,
    transformOrigin: 'bottom',
    transform: [{ rotate: '80deg' }],
  },
  arrowTail: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 2,
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  // Settings / Gear (solid silhouette)
  gearBody: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    top: (S - 16) / 2,
    left: (S - 16) / 2,
  },
  gearHole: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: (S - 8) / 2,
    left: (S - 8) / 2,
    backgroundColor: colors.surface, // matches tab bar background
  },
  gearTooth: {
    position: 'absolute',
    width: 6,
    height: 9,
    borderRadius: 2,
    top: S / 2 - 13,   // extends to outer edge (r≈13 from centre)
    left: S / 2 - 3,   // centred horizontally
    transformOrigin: `3px 13px`, // pivot at canvas centre
  },
});

// ── Tab label styles (static — never change) ─────────────────────────────────
const tabLabelStyles = StyleSheet.create({
  active:   { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary,   marginBottom: 6 },
  inactive: { fontSize: fontSize.xs, fontWeight: '400', color: colors.textMuted, marginBottom: 6 },
});

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TAB_CONFIG: Record<string, { label: string; title: string; Icon: React.FC<{ color: string }> }> = {
  Today:       { label: 'Today',       title: "Today's Doses",  Icon: HomeIcon },
  Medications: { label: 'Medications', title: 'Medications',    Icon: PillIcon },
  History:     { label: 'History',     title: 'Dose History',   Icon: HistoryIcon },
  Settings:    { label: 'Settings',    title: 'Settings',       Icon: SettingsIcon },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const { Icon, label } = TAB_CONFIG[route.name];
        return {
          tabBarIcon: ({ focused }) => (
            <Icon color={focused ? colors.primary : colors.textMuted} />
          ),
          tabBarLabel: ({ focused }) => (
            <Text style={focused ? tabLabelStyles.active : tabLabelStyles.inactive}>
              {label}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 8,
            height: 76,
          },
          tabBarItemStyle: { paddingBottom: 2 },
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: {
            fontSize: fontSize.xl,
            fontWeight: '700',
            color: colors.text,
          },
          headerShadowVisible: false,
        };
      }}>
      <Tab.Screen name="Today"       component={TodayScreen}       options={{ title: TAB_CONFIG.Today.title }} />
      <Tab.Screen name="Medications" component={MedicationsScreen} options={{ title: TAB_CONFIG.Medications.title }} />
      <Tab.Screen name="History"     component={HistoryScreen}     options={{ title: TAB_CONFIG.History.title }} />
      <Tab.Screen name="Settings"    component={SettingsScreen}    options={{ title: TAB_CONFIG.Settings.title }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="MainTabs"          component={MainTabs}              options={{ headerShown: false }} />
        <Stack.Screen name="AddMedication"     component={AddMedicationScreen}   options={{ title: 'Add Medication', presentation: 'modal' }} />
        <Stack.Screen name="MedicationDetail"  component={MedicationDetailScreen} options={{ title: 'Medication Details' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

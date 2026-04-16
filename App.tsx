// App.tsx
import React, { useEffect } from 'react';
import { StatusBar, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { initNotifications } from './src/notifications';
import { initTts, speak, playVoiceNote } from './src/voice';
import { colors } from './src/theme';
import { FontScaleProvider } from './src/fontScale';
import notifee, { EventType } from '@notifee/react-native';
import { getMedications } from './src/storage';

LogBox.ignoreLogs([
  'ViewPropTypes',
  'Non-serializable values were found in the navigation state',
]);

export default function App() {
  useEffect(() => {
    initNotifications();
    initTts();

    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        const medicationId = detail.notification?.data?.medicationId as string | undefined;
        if (!medicationId) return;
        try {
          const meds = await getMedications();
          const med = meds.find(m => m.id === medicationId);
          if (!med) return;
          if (med.voiceNoteUri) {
            await speak('Time to take your medication.');
            await playVoiceNote(med.voiceNoteUri).catch(() => {});
          } else {
            await speak(`Time to take ${med.name}`);
          }
        } catch {
          // audio failure is non-critical
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <FontScaleProvider>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.surface}
            translucent={false}
          />
          <AppNavigator />
        </FontScaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

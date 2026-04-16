/**
 * @format
 */

import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import notifee from '@notifee/react-native';
import { getMedications } from './src/storage';
import { speak, playVoiceNote, initTts } from './src/voice';

// Handles notification events when app is in background or quit state
notifee.onBackgroundEvent(async ({ detail }) => {
  const medicationId = detail.notification?.data?.medicationId;
  if (!medicationId) return;
  try {
    initTts();
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
});

AppRegistry.registerComponent(appName, () => App);

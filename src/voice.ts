// src/voice.ts
/**
 * Voice service:
 *  - Speech-to-text via react-native-voice (for entry)
 *  - Audio recording via react-native-audio-recorder-player
 *  - Audio playback via react-native-sound
 *  - TTS via react-native-tts (reads reminder back)
 *
 * The KEY design: we record the user *saying* the medication name as audio.
 * On reminder, we PLAY BACK their own voice saying it (most reliable for
 * unusual drug names), with TTS as fallback if no recording exists.
 */

import Voice from 'react-native-voice';
import Tts from 'react-native-tts';
import Sound from 'react-native-sound';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { Platform, PermissionsAndroid } from 'react-native';

const audioRecorderPlayer = new AudioRecorderPlayer();

// ── TTS ──────────────────────────────────────────────────────────────────────

export function initTts() {
  Tts.getInitStatus()
    .then(() => {
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(0.48); // Slower for seniors
      Tts.setDefaultPitch(1.0);
    })
    .catch((err: any) => {
      if (err?.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
    });
}

export function speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Tts.stop();
    const finishSub = Tts.addEventListener('tts-finish', () => {
      finishSub.remove();
      errorSub.remove();
      resolve();
    });
    const errorSub = Tts.addEventListener('tts-error', (err) => {
      finishSub.remove();
      errorSub.remove();
      reject(err);
    });
    Tts.speak(text);
  });
}

export function stopSpeaking() {
  Tts.stop();
}

// ── Speech Recognition ───────────────────────────────────────────────────────

export type RecognitionCallback = {
  onPartial: (text: string) => void;
  onResult: (text: string) => void;
  onError: (err: string) => void;
};

let _recognitionCallback: RecognitionCallback | null = null;

Voice.onSpeechPartialResults = e => {
  const text = e.value?.[0] ?? '';
  _recognitionCallback?.onPartial(text);
};

Voice.onSpeechResults = e => {
  const text = e.value?.[0] ?? '';
  _recognitionCallback?.onResult(text);
};

Voice.onSpeechError = e => {
  _recognitionCallback?.onError(e.error?.message ?? 'Unknown error');
};

export async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone Permission',
        message: 'My Medications needs the microphone to record medication names by voice.',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true; // iOS permissions handled at app level via Info.plist
}

export async function startListening(cb: RecognitionCallback): Promise<void> {
  _recognitionCallback = cb;
  await Voice.start('en-US');
}

export async function stopListening(): Promise<void> {
  await Voice.stop();
  _recognitionCallback = null;
}

export function destroyVoice() {
  Voice.destroy().then(Voice.removeAllListeners);
}

// ── Audio Recording (user's voice note of medication name) ───────────────────

export async function startRecordingVoiceNote(): Promise<void> {
  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE as any,
    ).catch(() => {}); // not required on Android 10+
  }
  await audioRecorderPlayer.startRecorder();
}

export async function stopRecordingVoiceNote(): Promise<string> {
  const uri = await audioRecorderPlayer.stopRecorder();
  return uri;
}

// ── Audio Playback (user's recorded voice note) ───────────────────────────────

export function playVoiceNote(uri: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Sound.setCategory('Playback');
    const sound = new Sound(uri, '', err => {
      if (err) {
        reject(err);
        return;
      }
      sound.play(success => {
        sound.release();
        if (success) resolve();
        else reject(new Error('Playback failed'));
      });
    });
  });
}

// Thin wrapper over Capacitor Preferences with localStorage fallback for the web preview build.
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';

const useNative = Capacitor.isNativePlatform();

export async function getItem(key) {
  if (useNative) {
    const { value } = await Preferences.get({ key });
    return value;
  }
  return localStorage.getItem(key);
}

export async function setItem(key, value) {
  if (useNative) return Preferences.set({ key, value });
  localStorage.setItem(key, value);
}

export async function removeItem(key) {
  if (useNative) return Preferences.remove({ key });
  localStorage.removeItem(key);
}

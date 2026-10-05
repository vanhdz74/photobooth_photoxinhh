// Safe Storage Helper to prevent QuotaExceededError in WebKit/Capacitor/iOS

declare global {
  interface Window {
    __PX_STRIPS_CACHE__?: Record<string, string>;
  }
}

export const safeStoreStrip = (key: string, dataUrl: string): void => {
  if (typeof window !== 'undefined') {
    window.__PX_STRIPS_CACHE__ = window.__PX_STRIPS_CACHE__ || {};
    window.__PX_STRIPS_CACHE__[key] = dataUrl;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      // Only store in localStorage if smaller than 400KB to guarantee quota safety
      if (dataUrl.length < 400000) {
        localStorage.setItem(key, dataUrl);
      }
    }
  } catch {
    // Quota exceeded on iOS - safely ignored because we have in-memory cache
  }
};

export const safeGetStrip = (key: string): string | null => {
  if (typeof window !== 'undefined' && window.__PX_STRIPS_CACHE__?.[key]) {
    return window.__PX_STRIPS_CACHE__[key];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
};

export const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (err) {
    console.warn(`SafeStorage: could not persist key "${key}" to localStorage`, err);
  }
};

export const safeGetItem = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    return null;
  }
  return null;
};

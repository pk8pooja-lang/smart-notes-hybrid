import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from 'firebase/ai';
import { firebaseConfig, appCheck } from './firebase-config.js';

export function isConfigured() {
  return Boolean(firebaseConfig.apiKey) && !String(firebaseConfig.apiKey).startsWith('YOUR_');
}

/**
 * Builds the two hybrid models with Firebase AI Logic.
 *  - device: PREFER_ON_DEVICE  (Gemini Nano in Chrome when available, else cloud)
 *  - cloud:  ONLY_IN_CLOUD     (always the cloud model)
 * Returns null when Firebase is not configured (the app then runs in demo mode).
 */
export function createModels() {
  if (!isConfigured()) return null;

  const app = initializeApp(firebaseConfig);

  if (appCheck.debugToken) {
    // Must be set before initializeAppCheck. The same token has to be registered
    // in the Firebase console (App Check > Manage debug tokens).
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = appCheck.debugToken;
  }
  if (appCheck.debugToken || (appCheck.siteKey && !String(appCheck.siteKey).startsWith('YOUR_'))) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheck.siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const ai = getAI(app, { backend: new GoogleAIBackend() });
  const device = getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE });
  const cloud = getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD });

  let started = false;
  // Must run after a user interaction (it is called from a button click).
  // Not awaited: while the model downloads, PREFER_ON_DEVICE falls back to the cloud.
  function prepareDevice(onProgress) {
    if (started) return;
    started = true;
    try {
      const p = device.initializeDeviceModel((value) => onProgress && onProgress(value));
      if (p && typeof p.then === 'function') {
        p.then(() => onProgress && onProgress(1)).catch(() => {});
      }
    } catch (e) {
      /* on-device AI not supported here, the cloud model is used instead */
    }
  }

  return { device, cloud, prepareDevice };
}

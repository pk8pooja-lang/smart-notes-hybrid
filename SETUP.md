# Setup: connect Firebase AI Logic

The app runs without any of this (demo mode, local fallback only). These steps turn on the real hybrid AI.

## 1. Create a Firebase project
1. Open https://console.firebase.google.com and click **Add project**. Name it, for example, `smart-notes-hybrid`.
2. In **Project settings > Your apps**, click the web icon `</>`, register an app, and copy the `firebaseConfig` values.
3. Paste them into `src/firebase-config.js` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). These are public identifiers, not secrets.

## 2. Turn on Firebase AI Logic
1. In the console, open **Build > AI Logic** and click **Get started**.
2. Choose the **Gemini Developer API** and enable it. It has a free tier and does not need billing.

## 3. App Check
The hackathon requires App Check, and debug tokens are accepted.
1. Create a reCAPTCHA v3 site key at https://www.google.com/recaptcha/admin (add `localhost` and your `YOUR_PROJECT.web.app` domain).
2. In the console, open **App Check > Apps**, register your web app with **reCAPTCHA** and paste the secret key.
3. Generate a debug token (for example `node -e "console.log(crypto.randomUUID())"`), open **Manage debug tokens** for the app and add it.
4. In `src/firebase-config.js` set `appCheck.debugToken` to the same value and `appCheck.siteKey` to your site key.

Console labels change over time. If something does not match, follow the current Firebase App Check docs for web.

## 4. Run
```
npm install
npm run dev
```
The banner at the top should say **Firebase AI Logic is connected**. Add a note and click **Summarize**. The badge shows whether the answer came from the device, the cloud, or the local fallback.

## 5. Deploy (Firebase Hosting)
```
npm install -g firebase-tools
firebase login
npm run build
firebase deploy --only hosting --project YOUR_PROJECT_ID
```
The site is served at `https://YOUR_PROJECT_ID.web.app`. Add that domain to your reCAPTCHA key settings and App Check if you use reCAPTCHA. If the deploy asks for a hosting site, open **Build > Hosting > Get started** in the console first.

## Checking Gemini Nano
In Chrome DevTools console run `await LanguageModel.availability()`. It returns `available`, `downloading`, `downloadable` or `unavailable`. If it is `unavailable`, the app uses the cloud model.

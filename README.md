# Smart Notes (Hybrid AI)

A notes app that writes summaries and action items for your notes using **Firebase AI Logic hybrid inference**: short notes run **on-device** with Gemini Nano in Chrome, long notes (or devices without Gemini Nano) run in the **cloud**. Every result shows where it was computed.

Platform: **Web (Chrome)**. Built for the #BuildHybridAI 2026 hackathon.

Live demo: *https://smart-notes-hybrid.web.app*

## Why hybrid

On-device models are fast, private and free to run, but they are not on every device. Smart Notes uses both:

* Notes are personal, so short notes stay on the device when Chrome has Gemini Nano (nothing is sent anywhere).
* Long notes go to the cloud model, which handles big inputs better.
* If Gemini Nano is missing, still downloading, or the call fails, the app falls back automatically, so the user always gets an answer.

## How it uses Firebase AI Logic

All AI calls go through the Firebase AI Logic SDK (`firebase/ai`, JS SDK 12.5+). See `src/firebase.js` and `src/ai.js`.

* `getAI(app, { backend: new GoogleAIBackend() })` creates the AI instance (Gemini Developer API).
* Two models are created with `getGenerativeModel`:

  * `InferenceMode.PREFER\_ON\_DEVICE` for short notes. Uses Gemini Nano when available, otherwise the SDK falls back to the cloud.
  * `InferenceMode.ONLY\_IN\_CLOUD` for long notes.
* `model.initializeDeviceModel(onProgress)` is called from the first button click (Chrome requires a user interaction). It is not awaited: while the model downloads, the SDK answers from the cloud, and the UI shows the download progress.
* `result.response.inferenceSource` (`on\_device` or `in\_cloud`) is read after every call and shown as a badge: **On-device · Gemini Nano**, **Cloud · Gemini** or **Local fallback**.
* An "AI mode" selector lets you force on-device preference or cloud, which is handy for demos.
* **App Check** is initialized with `firebase/app-check` (debug token or reCAPTCHA v3).
* If both models fail, a small local algorithm answers instead, and the UI says so.

## Features

* Add, search and delete notes (stored in the browser)
* **Summarize** a note (1 to 3 sentences)
* **Action items** extracted from a note
* Source badge on every AI result, download progress for the on-device model
* Works without Firebase config in demo mode (local fallback only)

## Run it

```
npm install
npm run dev
```

Open the URL Vite prints. Without Firebase config the app runs in demo mode. To enable Firebase AI Logic, follow `SETUP.md`.

```
npm test        # unit tests for routing, fallback and source detection
npm run build   # production build into dist/
```

### Gemini Nano in Chrome

On-device inference needs a recent desktop Chrome (Gemini Nano is built in, no flag needed on current versions) and a device that meets Chrome's hardware requirements. The model downloads on first use. On devices that cannot run it (for example, a low performance class laptop), the app automatically uses the cloud model, which is the point of hybrid. This was tested on such a device, so the demo video shows the cloud path.

## Project layout

```
src/ai.js              routing, prompts, source detection, fallback logic
src/firebase.js        Firebase AI Logic + App Check setup (the two hybrid models)
src/local.js           offline fallback (extractive summary, action items)
src/firebase-config.js your Firebase config (public identifiers)
src/main.js            UI
test/ai.test.js        unit tests
```

## What was built for this hackathon

This is a new repository. Its starting point was a small local-only notes app (add, search, delete, and an offline extractive summary). Everything that uses Firebase AI Logic is new: the hybrid on-device and cloud routing, `inferenceSource` badges, on-device model download handling, App Check, action items, AI mode selector, fallback handling and tests.
The Firebase web config in src/firebase-config.js is public by design.

## License

MIT, see `LICENSE`.


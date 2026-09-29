# Vercel deploy fix

This copy intentionally deploys the current Grove app as a static Vite/PWA app.

Why: the original project used TanStack Start + Nitro SSR even though the current Grove UI stores its data in browser localStorage. On Vercel, the Nitro v3 server bundle was crashing at runtime while loading a generated Radix UI chunk that imported `tslib`. A static build removes that unnecessary server runtime from the current app.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Production build

```bash
npm run build
npm run preview
```

## Deploy

Push these files to the same GitHub repository. Vercel will detect `framework: vite` and deploy the `dist` output as static files.

No database is needed for the current version. Habits/checks remain in localStorage on the device.

## iPhone

Open the Vercel URL in Safari -> Share -> Add to Home Screen. The manifest is configured with `display: standalone`.

## AI later

Add AI as a separate server endpoint (for example a Vercel Function under `/api/ai`) instead of putting the whole UI behind SSR. That lets the static phone app call the AI securely while keeping the AI API key server-side.

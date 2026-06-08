# Property Tracker

Mobile-optimised property investment research and tracking app.
Built with Next.js · Deployed on Vercel · Data stored in Google Drive · Maps via Leaflet + Stadia Maps

---

## Quick start

### 1. Clone and install
```bash
git clone https://github.com/YOUR_USERNAME/property-tracker.git
cd property-tracker
npm install
```

### 2. Set up Google OAuth
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **Enable the Google Drive API**
3. APIs & Services → Credentials → **Create OAuth 2.0 Client ID**
   - Type: **Web application**
   - Authorised redirect URIs:
     - `http://localhost:3000/api/auth/callback` (development)
     - `https://your-app.vercel.app/api/auth/callback` (production — add after deploy)
4. Copy the Client ID and Client Secret

### 3. Set up Stadia Maps
1. Sign up free at [client.stadiamaps.com](https://client.stadiamaps.com) — no credit card
2. Create a **Property** → copy your API key
3. Under **Allowed Domains** add:
   - `localhost` (development — works without this, but good practice)
   - `your-app.vercel.app` (production)

The tile style used is **Alidade Smooth Light** — clean, minimal, matches the cream UI.  
UK postcodes are geocoded via [postcodes.io](https://postcodes.io) — free, no account, no key needed.

### 4. Configure environment
```bash
cp .env.local.example .env.local
# Fill in:
#   GOOGLE_CLIENT_ID
#   GOOGLE_CLIENT_SECRET
#   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
#   NEXT_PUBLIC_STADIA_API_KEY
```

### 5. Run locally
```bash
npm run dev
# Open http://localhost:3000
# Click "Connect Google Drive" on first run
```

### 6. Deploy to Vercel
```bash
npx vercel
# Follow the prompts
```
Then in the Vercel dashboard → Project Settings → Environment Variables, add all four values from `.env.local`.  
Finally, go back to Google Cloud Console and add your `https://your-app.vercel.app/api/auth/callback` as an additional authorised redirect URI.

---

## Architecture

```
app/
  api/
    auth/               → GET: redirect to Google OAuth consent screen
    auth/callback/      → GET: exchange code for tokens, set httpOnly cookie
    drive/
      load/             → GET: read property-tracker.json from Drive
      save/             → POST: write property-tracker.json to Drive
      status/           → GET: is the user authenticated?
  page.tsx              → Root → <App />
  layout.tsx            → <DriveProvider> wraps everything

components/
  App.tsx               → Navigation shell + screen routing
  layout/
    DriveProvider.tsx   → Auth check + data hydration on mount
    SaveIndicator.tsx   → Saving… / ✓ Saved / ⚠ Not saved
  map/
    ComparablesMap.tsx        → Leaflet map with Stadia tiles + postcodes.io geocoding
    ComparablesMapDynamic.tsx → Next.js dynamic wrapper (ssr: false)

lib/
  drive.ts          → Google Drive read/write (server-side only)
  store.ts          → Zustand store + debounced auto-save (800ms)
  autosave.ts       → useAutoSave hook
  calculations.ts   → SDLT banding, yield, financing, sensitivity
  geocode.ts        → postcodes.io geocoder with in-memory cache

types/
  index.ts          → All TypeScript types, defaults, newProperty() factory
```

---

## How maps work

1. When the Comparables tab opens, `ComparablesMapDynamic` is rendered
2. The subject property's postcode is geocoded via postcodes.io → lat/lng
3. Each comparable's postcode is geocoded in parallel
4. Pins are plotted on Leaflet with Stadia Alidade Smooth Light tiles
5. Map auto-fits to show all pins with padding
6. Geocode results are cached in memory for the session

**Pin colours:**
- 🟤 Brown — subject property
- 🔵 Blue — for sale comparables
- 🟢 Green — sold comparables (ticked in market summary)
- ⬤ Grey — sold comparables (not ticked)
- 🟡 Amber — auction comparables (ticked)
- ⬤ Light grey — auction comparables (not ticked)

---

## How data is stored

All app data lives in a single `property-tracker.json` in the user's Google Drive.  
The app uses the `drive.file` OAuth scope — it can only see files it created, not the rest of your Drive.

Auto-save fires 800ms after the last state change. The indicator in the top bar shows current status.

---

## Adding a new screen / component

1. Add your types to `types/index.ts` if needed
2. Add your store actions to `lib/store.ts`
3. Create your component in `components/`
4. Import and wire into `components/App.tsx`

All financial calculations should go through `lib/calculations.ts` — pure functions, easy to test.

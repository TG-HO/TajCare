# PHASE 5: Future Native React Native (Expo) Transition Plan

## Objective
Provide the architecture and implementation setup for porting the web/PWA application into a native mobile app using **React Native (Expo)** with shared backend infrastructure.

---

## 1. Shared Infrastructure Strategy
- **Backend API & Database:** Retain the exact same Supabase database, RLS policies, and Auth backend.
- **Shared Code:** Re-use TypeScript interfaces, validation schemas (Zod), and Supabase JS query hooks between Next.js web and Expo mobile apps.

---

## 2. Native Mobile Tech Stack
- **Framework:** Expo (React Native App Router / Expo Router)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Push Notifications:** Expo Notifications (integrated with APNs for iOS and FCM for Android)
- **Secure Storage:** `expo-secure-store` for JWT auth token persistence

---

## 3. Key Native Features to Add
1. **Native Push Notifications:** Replaces web push notifications for instant alerts to site handlers on mobile screens.
2. **Camera Integration:** Allow complainants and site handlers to attach photo evidence of hardware/dispenser issues directly from device camera.
3. **Offline Ticket Drafts:** Cache ticket forms locally using `AsyncStorage` when site internet is temporarily offline.

---

## 4. Acceptance Criteria & Hand-off Checklist
- [ ] Shared Supabase library is extracted and tested with Expo.
- [ ] Native mobile build runs smoothly on iOS Simulator and Android Emulator.
- [ ] Camera attachment feature integrated into ticket logging flow.
- [ ] Expo Push Notifications tested and working on device.
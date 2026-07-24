# Taj Care - React Native (Expo) Native Mobile Architecture Blueprint

This directory contains the architecture and porting blueprint for launching **Taj Care** as a native iOS & Android application using **Expo (React Native)**.

---

## 1. Shared Architecture Strategy

The native mobile app connects directly to the existing Taj Care backend infrastructure without requiring duplicate backend code:

```
                  ┌─────────────────────────────────────┐
                  │    Shared Supabase PostgreSQL DB    │
                  │   RLS Policies & Triggers Active    │
                  └──────────────────┬──────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
     ┌───────────▼───────────┐               ┌───────────▼───────────┐
     │ Next.js 14 Web / PWA  │               │ React Native Expo App │
     │  (Desktop / Browser)  │               │   (iOS & Android)     │
     └────────────────────────┘               └───────────────────────┘
```

- **Shared Database & RLS:** Retains `locations`, `profiles`, `responder_locations`, `predefined_issues`, `tickets`, and `ticket_logs`.
- **Shared Types:** Re-uses `src/types/database.ts` directly in mobile.
- **Shared Auth:** Supabase Auth JWT token persisted using `expo-secure-store`.

---

## 2. Recommended Native Mobile Stack

- **Framework:** Expo SDK 51+ (Expo Router v3)
- **Styling:** NativeWind v4 (Tailwind CSS for React Native)
- **Secure Token Storage:** `expo-secure-store`
- **Camera & Photos:** `expo-camera` & `expo-image-picker`
- **Offline Cache:** `@react-native-async-storage/async-storage`
- **Push Notifications:** `expo-notifications` (FCM for Android, APNs for iOS)

---

## 3. How to Bootstrap Mobile App

```bash
# Navigate to mobile directory
cd mobile

# Initialize Expo Router app
npx create-expo-app@latest ./ --template default

# Install dependencies
npx expo install @supabase/supabase-js expo-secure-store expo-camera expo-image-picker expo-notifications nativewind react-native-reanimated
```

---

## 4. Mobile Supabase Client with SecureStore

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabaseMobile = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

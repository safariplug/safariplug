# SafariPlug Android (Expo)

Native React Native catalog client. Not a WebView. Not safariplug.com in a wrapper.

Consumes production public API:
- GET https://safariplug.com/api/v1/events
- GET https://safariplug.com/api/v1/events/{id}
- GET https://safariplug.com/api/v1/search?q=
- GET https://safariplug.com/api/v1/destinations
- GET https://safariplug.com/api/v1/experiences

No service-role, OpenAI, Resend, or Aurelian secrets.

```
cd mobile
npm install
npx expo start
```

Optional: `EXPO_PUBLIC_API_BASE_URL` (defaults to https://safariplug.com).

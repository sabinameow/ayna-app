# Ayna Frontend

Expo / React Native frontend scaffold for the Ayna backend.

## What is included

- Role-aware auth flow using backend JWT login
- Patient tabs:
  - Home
  - Cycle
  - Appointments
  - Chat
  - Profile
- Doctor tabs:
  - Dashboard
  - Patients
  - Appointments
  - Schedule
  - Profile
- Manager tabs:
  - Dashboard
  - Chats
  - Appointments
  - Schedules
  - Profile
- Shared API client wired to `/api/v1`

## Backend additions

Two backend helper endpoints were added to support the frontend:

- `GET /api/v1/doctors`
- `GET /api/v1/doctor/profile`
- `GET /api/v1/doctor/patients/{patient_id}/recommendations`

## Run

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start Expo:

```bash
npm run start
```

3. Point the app at your API:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npm run start
```

If you test on a physical device, replace `127.0.0.1` with your computer's LAN IP.

## Notes

- Patient chat requires an active subscription in the backend, so the app shows a locked state until the patient subscribes.
- The UI follows the soft mobile direction from your patient designs while keeping doctor and manager screens more operational.
- This is a strong first scaffold, not the final polished version yet.

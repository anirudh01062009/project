# Smart Attendance System — Polished Web Build 2026

Professional web conversion of the Smart Attendance System, designed to keep the Python workflow while adding a reliable browser UI.

## Final UI / Welcome
- 10-second full-screen cinematic welcome animation.
- Deep black/blue space background.
- Blue + gold particle streams flow from both sides and connect at the center.
- Particles form a glowing flower/bloom, continuously swirl, then settle smoothly.
- Subtle camera-style zoom/depth effect.
- Final reveal: **WELCOME** / **SMART ATTENDENCE SYSTEM**.
- Color system is carried through the app: navy/black surfaces, electric blue/cyan actions, gold for highlights, green for success/present, orange for late, red for destructive actions, purple for admin panels.

## Roles and permissions
- **Admin:** full access; student registration/update/delete, timetable editing, holiday add/delete, audit/admin tools, attendance, reports, notifications, own password change.
- **Teacher:** attendance, temporary OUT/IN, reports, notifications, timetable/holiday viewing; no admin-only changes.
- **Viewer:** automatically available without a password; view-only; no admin/teacher actions.
- Privileged permissions are enforced server-side, not only by hiding UI controls.

## Attendance rules
- First 5 minutes: **Present**.
- After the first 5 minutes until the final 5 minutes: **Late**.
- Last 5 minutes: **Final OUT window**.
- Automatic final OUT is applied when a lecture finishes.
- Duplicate Student + Date + Lecture attendance is blocked.
- Attendance and movement are blocked on Sundays, official holidays, and college custom holidays.

## Holiday rules
- Automatic 2026 holiday list is displayed.
- College custom holidays can be added/removed by Admin only.
- Duplicate holiday dates are rejected instead of silently replacing an existing holiday.
- Holiday blocking is enforced in the API as well as the UI.

## Reliability improvements
- Browser `alert()` / `confirm()` / `prompt()` popups have been removed from normal workflows.
- Professional success/error/warning toasts are used instead.
- Destructive and data-entry actions use an in-app dialog.
- Action buttons receive a busy/disabled state to reduce double-click duplicate requests.
- API errors are surfaced as readable messages.

## Vercel structure

```text
index.html
style.css
script.js
package.json
vercel.json
.env.example
README.md
api/index.js
db/schema.sql
```

## Environment variables
Set these in Vercel for production:
- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_PASSWORD`
- `TEACHER_PASSWORD`

Never publish secret values in GitHub or chat.

## Demo accounts for a fresh database
- Admin: `admin` / `admin123`
- Teacher: `teacher` / `teacher123`
- Viewer: `viewer` / no password

Change production credentials through Vercel environment variables before real use.

## Browser face recognition note
The desktop Python version uses OpenCV Haar Cascade + LBPH. A normal browser cannot execute that desktop OpenCV/LBPH pipeline directly, so the web build uses browser-compatible face descriptors while preserving the registration/recognition attendance workflow.

Vercel deployment update

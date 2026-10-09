# GoG OMS — Academic Workflow Enhancement: Implementation Report

Scope: password reset (Module 1), sprint plan lifecycle (2–5), class record and verification pipeline (6–20), weekly calendar (21–23), college isolation (24), notifications (25), status model and audit trail (26–27), permissions (29), scheduled deadlines (31).

---

## A. Existing functionality found

| Area | What already existed |
|---|---|
| Login | `/api/auth/login` compared the typed password with the stored value as **plain text** (default `26082001`). `/api/employees/change-password` also stored plain text and had no session check. |
| Employee / college | `Employee.location` = `Location.id` (older records hold the location name / short name). HOI link = `Employee.reportsTo`. No separate college model. |
| Roles | `PROFESSOR`/`FACULTY`, `OM`, `HOI`, `AD`, `CURRICULUM_LEAD` (CL), `CURRICULUM_HEAD` (CH), `HR`, `FOUNDER` … CL and CH are separate roles but the existing pages give them the same checks, so they are treated as **one CL/CH level**. |
| Sprint plan | `SprintPlan` (faculty, week, entries, `isLocked`, `changeRequests`). Professor page `/faculty/sprint-plan` saved the week; HOI "Finalize & Lock" in Academic Monitoring; CL page `/curriculum/sprint-plans`. A change request could be raised but **no page ever processed it**. The CL page sent action names the API did not understand, so its lock/unlock buttons never worked. No status, no history, no auth on any sprint-plan API. |
| Class record | `LectureReport` (attendance, notes, assignment, OM in/out time, CL verification flag, HOI `auditStatus`). Professor page `/faculty/lectures`, OM page `/manager/daily-lectures`, CL page `/curriculum/lectures`, HOI audit buttons in Academic Monitoring. Each stage worked independently (CL could verify before OM, HOI audit had no order); no auth or college check on these APIs; the CL "Needs Revision" value was not allowed by the schema (save error). |
| Email | `sendMailInternal` (nodemailer, SMTP from `.env`), templates in `src/lib/mail-templates.ts`. |
| In-app notifications | Only in browser memory (lost on refresh), no page. |
| Scheduler | None. |
| Weekly calendar | A campus timetable grid (`SprintPlanTimetableGrid`) inside the sprint plan pages, with hard-coded campus names. |

## B. Functionality enhanced

- **Login / change password**: accept the new hashed format and old plain-text passwords; a correct plain-text password is replaced by its hash immediately (every account moves to hashed storage on its next login). Change Password now requires the session and only changes your own password.
- **Sprint plan**: real lifecycle (Draft → Submitted → Locked → Unlock Requested → Unlocked for Revision → Re-submitted → Locked Again), new lecture fields, server-side role + college checks, full history, kept revisions. The old change-request API now *is* "Request Unlock"; the old lock API and the CL page use the same lifecycle (and the CL page buttons now work).
- **Class record**: the existing lecture report became the class record — attendance validated (0 ≤ present ≤ total, default strength 60 or the strength already stored for that class), notes upload/link or a mandatory "Unable to Submit Notes" reason, optional assignment and snapshots, class must have ended, linked to the exact sprint plan entry.
- **OM Daily Lecture Timings**: server-scoped to the OM's college, entry/exit time stores who/when, the "notes shared" tick is the same as "Submitted to Groups"; campus list comes from the database.
- **CL Lecture Quality Hub** and **HOI audit buttons**: now the CL/CH and HOI stages of the one pipeline (CL/CH only after OM, HOI only after CL/CH).
- **Timetable grid**: receives the real college so it shows the classes.
- **Security fixes found on the way** (a separate review pass checked the new code for scope bypasses):
  - `/api/employees` PUT let any logged-in user change any employee — including role, college and password. Now HR / Founder can edit anyone (never the password); everyone else only their own profile (not role, college, reporting line, status, email, salary); managers can still save ratings of others. The response no longer contains the password hash.
  - `/api/employees` POST (add employee) is HR / Founder only and always hashes the password.
  - Login matched the typed email as a pattern (`.*` logged into the first account); it is now an exact case-insensitive match.
  - The new academic APIs read the role from the database, so a role changed by HR takes effect at once (the user has to log in again).

## C. New functionality

- HR **Reset Password** (generate temporary password / set manually), hashed, shown once.
- **Request Unlock** with reason + comment → email + in-app to HOI + CL + CH + AD; **Unlock / Reject request / Lock / Lock again** for HOI, CL, CH, AD.
- **Class Verification** page (`/academic/verification`): OM queue, CL/CH queue, HOI final queue, "All Classes" (with classes that have no record yet), full record details, audit trail, actions.
- OM: verify / revert missing-notes reason, verify / revert class record, Submitted to Groups, entry/exit time.
- CL/CH: verify, revert to Professor or to OM. HOI: final verify (Completed) or send back to CL/CH.
- HOI / CL / CH: **notes-pending comments** (on a record or on a class with no record yet), resolved automatically when notes arrive, or manually; history kept.
- Professor: **Add Assignment later** and **Add Notes later** on the exact class; correct & re-submit a reverted record.
- **Weekly Calendar** (`/academic/weekly-calendar`): Mon–Sat timetable (time axis, overlapping classes side by side) or list; My Schedule / College Weekly Schedule for professors; filters Professor, Day, Subject, Class, Section, Branch, Year, Semester (+ College for cross-college roles); class details popup; "Complete Class" and "Add Assignment" from the popup.
- **Notifications** page (`/notifications`) + unread badge in the sidebar; stored in the database.
- **Saturday 10:00 AM checks** (missing sprint plan, missing assignments) — in-process scheduler + protected cron URL + `vercel.json` cron.

## D. Database

No new college mapping. All changes are additive (old documents keep working; their status is derived).

| Model | Fields added |
|---|---|
| `Employee` | `passwordChangedAt`, `passwordResetAt`, `passwordResetBy`, `passwordResetByName` (password itself now stored as `scrypt$salt$hash`) |
| `SprintPlan` | `status`, `statusBeforeUnlockRequest`, `createdById`, `submittedAt`, `resubmittedAt`, `lockedById`, `lockedByName`, `lockedByRole`, `unlockRequestedAt`, `unlockedAt/By/ByName/ByRole`, `version`, `history[]` {action, fromStatus, toStatus, by, byName, role, at, note}, `revisions[]` {version, status, entries, savedAt, savedBy, savedByName}; entries: `lectureType`, `unitNumber`, `content`, `className` (Branch = existing `stream`); changeRequests: `requestedBy/ByName`, `requestedAtISO`, `comment`, `processedBy/ByName/ByRole/At`, `decisionNote` |
| `LectureReport` | `sprintEntryId`, `timeStart`, `timeStop`, `section`, `className`, `lectureType`, `unitNumber`, `subjectCode`, `snapshotUrls[]`, `submittedAt`, `submissionCount`, `notesMissing`, `notesMissingReason`, `notesReasonStatus` (+ reviewedBy/ByName/At/Comment), `pipelineStatus`, `omVerification` / `clChVerification` (+`revertTo`) / `hoiVerification` {status, by, byName, role, at, comment}, `submittedToGroup/By/ByName/At`, `omTimesUpdatedBy/ByName/At`, `delayFlags[]` {flagId, comment, by, byName, role, at, status, resolvedBy/ByName/At, resolutionNote}, `pipelineHistory[]`; assignment: `addedAt`, `addedBy`, `addedByName`, `addedLater`; "Needs Revision" added to the notes/assignment status lists |
| `Notification` (new) | one row per recipient: title, message, type, link, entity, college, actor, read/readAt, emailStatus/emailError |
| `ReminderLog` (new) | unique `key` per professor + reminder type + week → each reminder email is sent once |
| `JobRun` (new) | unique `key` per deadline → the Saturday job runs once even with several servers |

Relationships used: `Employee.location → Location (id / name / shortName)` for college; `SprintPlan.facultyId → Employee.id`; `LectureReport.sprintEntryId → SprintPlan.entries._id`.
Indexes: `SprintPlan {facultyId, weekStartDate}`, `{college, weekStartDate}`; `LectureReport {facultyId, date, lectureNumber}`, `{college, pipelineStatus}`; `Notification {recipientId, read, createdAt}`; unique `ReminderLog.key`, `JobRun.key`, `Notification.id`.

## E. Backend

New services (`src/lib`)

| File | Purpose |
|---|---|
| `password.ts` | scrypt hash / verify (plain-text fallback for old accounts), strong temporary password, manual password rules |
| `academic-status.ts` | all statuses, labels, role groups (shared by API and pages) |
| `academic.ts` | college scope, recipients per college, notifications (in-app + email), institution time zone helpers |
| `sprint-plan-workflow.ts` | submit / lock / request_unlock / unlock / reject_unlock / save draft (atomic status changes, history, revisions) |
| `class-record-workflow.ts` | class record submission + every OM / CL-CH / HOI / flag / assignment action, class list builder |
| `weekly-deadlines.ts` | Saturday 10:00 checks with duplicate protection |
| `scheduler.ts` + `src/instrumentation.ts` | starts the every-minute check when the server starts |

Routes added: `POST /api/hr/reset-password`, `POST /api/sprint-plan/action`, `GET|POST /api/academic/class-records`, `GET /api/academic/weekly-calendar`, `GET|PATCH /api/notifications`, `GET|POST /api/cron/weekly-deadlines`.
Routes modified (auth + college scope + lifecycle): `/api/auth/login`, `/api/employees/change-password`, `/api/employees`, `/api/faculty/sprint-plan` (+ `/lock`, `/change-request`), `/api/curriculum/sprint-plan`, `/api/faculty/lectures`, `/api/om/lectures`, `/api/curriculum/lectures`, `/api/manager/lectures/audit`.
Middleware: none changed — every new/changed route checks the session itself with `getSessionUser` (`src/lib/session-user.ts`, which now also refuses a session whose role no longer matches the database).
Scheduled job: "weekly-deadlines" every Saturday 10:00 `ACADEMIC_TIMEZONE` (default Asia/Kolkata).

## F. Frontend

New: `academic/verification/page.tsx`, `academic/weekly-calendar/page.tsx`, `notifications/page.tsx`, `components/ResetPasswordDialog.tsx`, `components/academic/SprintPlanWorkflowPanel.tsx`, `components/academic/ClassRecordDetails.tsx`.
Modified: `employees/page.tsx` (Reset Password button), `faculty/sprint-plan/page.tsx` (status, Submit, Request Unlock, new fields, history), `faculty/lectures/page.tsx` (class record form, pipeline status, revert comment, details popup, deep link), `components/academic/FacultySprintPlanView.tsx` (lock/unlock panel), `components/academic/FacultyLecturesView.tsx` (HOI final verify), `curriculum/sprint-plans/page.tsx` (real colleges, per-plan lifecycle, deep link), `manager/daily-lectures/page.tsx` (real colleges), `components/Sidebar.tsx` (Weekly Calendar, Class Verification, Sprint Plan Approvals, Notifications + badge), three curriculum pages (one-line type fix so `next build` passes).

## G. Email (existing SMTP mailer; every email also creates an in-app notification)

| Trigger | Recipient | Template / subject | Condition |
|---|---|---|---|
| Professor requests unlock | HOI + CL of the college, CL without a college, all CH, all AD | "Sprint Plan Unlock Request — <professor>" (professor, college, week, plan, request time, reason, details, link) | plan Locked / Locked Again |
| Plan unlocked | Professor | "Sprint Plan Unlocked for Revision" | by HOI/CL/CH/AD in scope |
| Unlock request rejected | Professor | "Sprint Plan Unlock Request Rejected" | reason required |
| Sprint plan missing (Sat 10:00) | Professor | "Sprint Plan Not Submitted — Week …" (exact message from the spec) | no plan or Draft for next week; once per week |
| Missing-notes reason submitted | OM(s) of the college | "Missing Notes Reason — <professor>" | notes not provided |
| OM reverts | Professor | "Class Record Reverted by OM" (comment) | comment ≥ 5 chars |
| OM verifies | CL/CH of the college | "Class Record Ready for CL/CH Verification" | after reason verified (if any) |
| CL/CH reverts | Professor **or** OM (chosen), the other side in-app | "Class Record Reverted by CL/CH" | comment required |
| CL/CH verifies | HOI(s) of the college | "Class Record Ready for Final Verification" | — |
| HOI sends back | CL/CH | "Class Record Sent Back by HOI" | comment required |
| Final verification | Professor | "Class Record Verified — Completed" | OM and CL/CH verified |
| Notes-pending comment | Professor + OM(s) | "Notes Pending — <subject> (<date>)" | HOI/CL/CH |
| Pending assignments (Sat 10:00) | Professor | "Assignment Submission Pending — Week …" listing day, date, time, subject, class/section; no penalty (none exists in the project) | classes Mon–Fri of that week without an assignment; once per week |

All user-typed text is HTML-escaped in emails. Addresses ending in `@gog.com` are skipped (same rule as the existing `/api/send-email`).

## H. Permissions (enforced on the server)

| Function | Professor | OM | CL | CH | HOI | AD | HR |
|---|---|---|---|---|---|---|---|
| Create / edit own plan (Draft, Submitted, Unlocked) | ✅ own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit locked plan | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Request unlock | ✅ own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Lock / Unlock / Reject request | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Submit class record | ✅ own | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| OM verification, Submitted to Groups, entry/exit | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CL/CH verification | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Final verification | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Notes-pending comment | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Reset password | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Founder too; HR cannot reset the Founder or themself) |

College scope: Professor, OM, HOI → own college only. CL → own college (a CL with no college keeps the existing cross-college access). CH, AD, Founder → cross-college (head-office roles; the existing curriculum pages already showed every campus) with a College filter. HOI scope is by college, not by `reportsTo`, so an HOI cannot act on a professor of another college even if that professor reports to them. The old OM daily-lecture entry/exit screen also stays available to the HOI (it was before), with who/when recorded.

## I. Complete workflow

1. **Professor → Sprint Plan**: Faculty Suite → Sprint Plan → Day-by-Day Slot Editor → add classes (time, subject, topic, branch, section, year/semester, lecture type, unit, class, content) → Save Draft → **Submit Week for Locking** (status Submitted; a copy is kept as version 1).
2. **Lock**: HOI (Manager Suite → Sprint Plan Approvals, or Academic Monitoring) / CL / CH / AD (Curriculum Suite → Sprint Plan Grid) → **Lock** → Locked. Professor's editor becomes read-only.
3. **Unlock request**: Professor → Request Unlock (reason + details) → Unlock Requested (still locked) → email + notification to HOI + CL + CH + AD.
4. **Revision**: one of them → Unlock for Revision (or Reject Request) → professor notified → edits → **Re-submit** (version 2 kept) → Lock Again.
5. **Class**: after the class ends, professor opens it from My Lectures or Weekly Calendar → Complete Class → attendance (present out of 60 or the stored strength) → notes file/link **or** "Unable to Submit Notes" + reason → optional assignment, snapshots → Submit → **Pending OM**.
6. **OM**: Class Verification → verify or revert the missing-notes reason → record entry/exit → tick Submitted to Groups → Verify (→ **Pending CL/CH**) or Revert (→ professor corrects and re-submits).
7. **CL/CH**: verify (→ **Pending HOI**) or revert to Professor / OM.
8. **HOI**: Final Verify → **Completed** (professor notified), or send back to CL/CH.
9. **Assignments** can be added later on the same class; Saturday 10:00 lists the classes still without one. Delayed notes can be flagged by HOI/CL/CH at any point.

## J. Testing credentials (dummy data only — `npm run seed`)

All accounts use password **Test@123** (stored hashed). Pick the matching role in the login dropdown.

| Role | Campus A | Campus B | Campus C / org-wide |
|---|---|---|---|
| HR | hr1@test.gog | hr2@test.gog | |
| Professor | prof01@test.gog, prof03@test.gog, prof07@test.gog | prof02@test.gog, prof05@test.gog | prof10@test.gog (C) |
| OM | om1@test.gog | om2@test.gog | |
| CL | curriculum.lead@test.gog | curriculum.lead.b@test.gog | |
| CH | | | curriculum.head@test.gog (all colleges) |
| HOI | hoi1@test.gog | hoi2@test.gog | hoi3@test.gog (C) |
| AD | | | ad@test.gog (all colleges) |

Seeded academic data (relative to today): last week — Professor 01 class records at every stage (Completed, Pending HOI, Pending CL/CH, Pending OM with a missing-notes reason) and one Campus B record (Professor 02); this week — locked plans for Professors 01, 02, submitted plan for 03, unlock request from 07; next week — Professor 01 Draft only. No real credentials anywhere; the database URL comes only from `.env.local`.

## K. Test instructions (click by click)

1. **Password reset** — log in hr1 (HR) → Workforce → row "Test Professor 04" → Reset Password → Generate Temporary Password → copy it → Sign Out → log in prof04@test.gog / PROFESSOR with the copied password → dashboard opens; Test@123 no longer works.
2. **Weekly plan** — prof10 → Sprint Plan → (next week is shown) → Day-by-Day Slot Editor → Add Slot on MON and WED → fill all fields → Save Draft → Submit Week for Locking (badge "Submitted"). hoi3 → Sprint Plan Approvals → week arrows to that week → card Test Professor 10 → Lock. prof10 → editor is read-only.
3. **Mid-week change** — prof10 → Request Unlock → reason → Send Request. Check the email inbox of hoi3 / CL / CH / AD (or their Notifications page). curriculum.head → Sprint Plan Grid → card → Unlock for Revision → Unlock. prof10 → edit → Save Draft → Re-submit Week for Locking. ad → Sprint Plan Grid → Lock Again → History shows every step.
4. **Class completion** — prof03 → Weekly Calendar → click Monday's Python class → Complete Class / Upload Notes → present 48 (out of 60) → notes link (or file) → attach recording → Submit Report → status "Pending OM". om1 → Class Verification → the record is in the OM queue.
5. **Missing notes** — same form, tick "Unable to Submit Notes" + reason → submit → om1 gets the email → Class Verification → open record → write comment → Revert Reason → prof03 Notifications shows it, My Lectures row shows "Reverted by OM" + comment → Correct & Re-submit with a notes link → om1 → Verify Class Record.
6. **Verification** — om1 → Verify (tick Submitted to Groups, save entry/exit) → curriculum.lead → Class Verification → Verify → hoi1 → Class Verification → Final Verify (Complete) → status Completed, audit trail shows all four stages.
7. **College isolation** — om2 / hoi2 / curriculum.lead.b → Class Verification and Weekly Calendar show only Professor 02 (Campus B); om1 / hoi1 never see Professor 02. Trying a Campus B record id as om1 returns "not found in your college".
8. **Weekly calendar** — prof01 → Weekly Calendar → My Schedule (own classes) → College Weekly Schedule (Campus A professors) → Professor filter "Test Professor 03" → only his classes. om1 / hoi1 → Weekly Calendar → all Campus A professors; ad / curriculum.head → College filter.
9. **Saturday deadlines** — with `CRON_SECRET` set in `.env.local`:
   `curl -H "Authorization: Bearer <CRON_SECRET>" "http://localhost:3000/api/cron/weekly-deadlines?at=<coming Saturday>T10:05:00%2B05:30&dryRun=1"` (lists missing plans / assignments; `%2B` is the `+` of `+05:30`) → same without `dryRun` sends the emails → run again → "Already ran for this deadline", no new email. Before 10:00 (e.g. `T09:59:00`) it answers "Not yet the deadline". Without any URL call, a running server checks every minute and runs it by itself on Saturday at 10:00.

## L. Bugs / limitations / external configuration

- **SMTP** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`) must be set for real emails; if sending fails the workflow continues and the notification shows "email failed".
- **APP_URL** should be set to the portal address so email buttons open the right site.
- **Scheduler on Vercel / serverless**: a serverless deployment does not keep a process running, so use the included `vercel.json` cron (Saturday 04:30 UTC = 10:00 IST) and set `CRON_SECRET` in the project's environment variables. On a normal server (`npm start`, VPS, Render, Railway) the built-in scheduler runs on its own; both together are safe (no duplicates).
- **File uploads** still use the existing S3 / Cloudinary helper — S3 credentials (or the Cloudinary preset) are needed for notes/recording/snapshot files; links work without them. The recording upload is still required for the first submission (existing rule); later re-submissions reuse it.
- If `JWT_SECRET` is not set, the existing session code signs cookies with a fallback value — always set a long random `JWT_SECRET` in production.
- Sessions are not ended when HR resets a password (the existing session token has no password version); the old password stops working immediately for new logins.
- The Employee schema default password `26082001` (existing) is plain text for brand-new records until their first login converts it; the legacy `/api/curriculum/seed` route also writes plain text — both are converted on first login.
- HOI scope is by college: an HOI's reportee in another college (possible in old data) shows "not in your college" in Academic Monitoring.
- The CL Lecture Quality Hub still has its old hard-coded campus dropdown; "All Campuses" (default) shows the CL's own college data correctly (the server limits it).
- Old lecture reports created before this change count as "Pending OM" (they were never verified by OM).
- Unused old APIs `/api/faculty/lectures/start`, `/end` and `/api/directreports` were left as they were (no page calls them).

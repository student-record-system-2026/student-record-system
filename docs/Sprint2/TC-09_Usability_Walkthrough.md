# TC-09 Usability Walkthrough (NFR-3)

**Requirement:** NFR-3 (SRS 5.4): a first-time user in each role shall be able to complete their core task without external help, verified through a usability walkthrough in which at least three representative users each complete the relevant core task on their first attempt.

**Test case:** TC-09 steps 1 to 3 (Test Plan v1.1, Section 12.3). Steps 4 and 5 (browsers) are recorded in [`TC-09_Browser_Results.md`](TC-09_Browser_Results.md).

**Automated pre-checks:** `frontend/tests/usability.test.jsx` runs on every pull request. It checks that each core task is at most two clicks from the dashboard, that every form field is labelled, that required fields are marked, and that success and error messages are shown. Those checks do not replace this walkthrough with real users.

---

## 1. Participants

Use three people who have **never used the system**: classmates outside the team, friends or family. One person per role. Team members cannot be participants.

| ID | Role played | Name | Background (e.g. "2nd-year ECE student") | Has used the system before? |
|---|---|---|---|---|
| P1 | Administrator |  |  | No |
| P2 | Faculty |  |  | No |
| P3 | Student |  |  | No |

## 2. Setup (facilitator)

1. Reset the demo data: `npm --prefix backend run db:seed`.
2. Start the app (backend and frontend), and open `http://localhost:5173/login` in Chrome on a laptop.
3. Write the participant's login on a slip of paper (from the table below) and give them only the task card.
4. Start a stopwatch when the participant first touches the mouse.

| Role | Username | Password |
|---|---|---|
| Administrator | `admin01` | `Admin@123` |
| Faculty | `fac_krao` | `Faculty@123` |
| Student | `stu_pnair` | `Student@123` |

## 3. Task cards (read aloud, then hand over)

**P1 – Administrator:** "You are the college administrator. Log in and add a new student: name *Ananya Rao*, roll number *PES1UG24CS150*, department *CSE*, batch *2024*, email *ananya.rao@example.com*, initial password *Welcome123*. Tell me when you think you are done."

**P2 – Faculty:** "You teach Software Engineering. Log in and record today's attendance for your Software Engineering class. Mark the first student on the list absent and everyone else present. Tell me when you think you are done."

**P3 – Student:** "You are a student. Log in and find your attendance percentage and your Internal Assessment 1 marks for Software Engineering. Tell me both numbers when you have them."

## 4. Rules for the facilitator

- Do **not** help, point or hint. If asked a question, reply: "Do whatever you would do if I weren't here."
- Stop the task if the participant gives up, asks for help twice, or takes more than **5 minutes**. That counts as not completed.
- Note where the participant hesitates, clicks the wrong thing, or says something is unclear.

## 5. Success criteria

| Task | Completed on first attempt when… |
|---|---|
| P1 create student | The new student's record page opens with the confirmation message, and the details match the task card |
| P2 record attendance | "Attendance saved." appears, and the first student is Absent, all others Present |
| P3 view attendance and marks | The participant states the correct attendance percentage and IA1 mark shown on screen |

## 6. Results

| ID | Task | Completed without help? | First attempt? | Time (mm:ss) | Wrong clicks | Help requests | Observations (hesitations, comments) |
|---|---|---|---|---|---|---|---|
| P1 | Create a new student record |  |  |  |  |  |  |
| P2 | Record attendance for one session |  |  |  |  |  |  |
| P3 | View attendance and marks |  |  |  |  |  |  |

**Post-task question** (ask each participant): "On a scale of 1 (very hard) to 5 (very easy), how easy was that?"

| ID | Rating (1–5) | Comment |
|---|---|---|
| P1 |  |  |
| P2 |  |  |
| P3 |  |  |

## 7. Outcome

| Item | Value |
|---|---|
| Participants who completed their core task on the first attempt without help | __ / 3 |
| TC-09 steps 1–3 result | Pass / Fail (Pass only if 3 / 3) |
| Usability issues found | (list, or "None") |
| Follow-up actions | (fixes made or deferred, with PR numbers) |

| Facilitator | Date | Signature |
|---|---|---|
|  |  |  |

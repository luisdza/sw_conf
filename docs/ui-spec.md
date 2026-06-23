# UI Specification — Dispute Triage System (UC1)

**Purpose:** Screen-by-screen definition of the call-centre triage UI, each screen mapped
to the endpoints it calls (see [`api-spec.md`](api-spec.md)) and the `REQ-*` it satisfies.
**Owner:** UI/UX Designer
**Last updated:** 2026-06-22
**Covers:** Feature-1 (capture, result) and Feature-2 (queue, detail).

## Shared conventions

- **Stack:** React + Vite + Tailwind. **Audience:** authenticated call-centre operators.
- **Enum labels** are rendered from the exact values in
  [`decision_rules.md`](decision_rules.md); the underlying value is never altered.
- **Advisory framing (REQ-RST-002):** every result screen states the recommendation is
  advisory and offers **no auto-action control** — the operator decides and acts elsewhere.
- **Global states:** each screen specifies loading, empty, error, and validation states.
- **Accessibility:** form fields have labels; the priority/disposition badges encode
  meaning with text (not colour alone); keyboard navigable; live region announces triage
  results.
- **Responsive:** desktop-first (operator workstation). On narrow viewports the queue table
  collapses to stacked cards, multi-column forms become single-column, and the result "Why"
  panel stacks beneath the recommendation banner.
- **Navigation:** `Queue ⇄ Capture`, `Queue → Detail`, `Capture → Result → Detail`.

---

## Screen 1 — Dispute Capture Form

**Purpose:** capture an operator-submitted dispute and submit it for triage.
**Calls:** `POST /api/disputes`.
**Satisfies:** REQ-CAP-001/002/003, REQ-VAL-001/002, REQ-LKP-005/006 (free-text reason).

### Fields (operator-submitted only)

| Field | Control | Validation (client mirrors server) |
| ----- | ------- | ---------------------------------- |
| `operatorId` | text (prefilled from session) | required |
| `customerId` | text | required |
| `accountNumber` | text | required |
| `transactionDate` | date | required; not after `disputeCaptureDate` (REQ-VAL-002) |
| `transactionAmount` | number (ZAR) | required; ≥ 0 |
| `transactionStatus` | select `SUCCESS / FAILED / PENDING` | required |
| `disputeCaptureDate` | date | required; within 90 days of `transactionDate` (REQ-VAL-001) |
| `disputeReason` | **free text** | required; mapped server-side to `disputeType` |

> `customerType`, `accountType`, `transactionId`, `transactionType`, and `disputeType` are
> **not** entered — they are resolved server-side. `accountType` is display-only.

### States

- **Loading:** submit button shows a spinner and is disabled while the POST is in flight.
- **Validation (client):** inline messages mirror server wording — *"Required fields are
  missing"* (lists fields, REQ-CAP-002), *"Dispute is older than 90 days"* (REQ-VAL-001),
  *"Dispute capture date cannot be earlier than the transaction date"* (REQ-VAL-002).
- **Error (server 4xx/5xx):** banner shows `error.message`; missing fields highlighted from
  `error.missingFields`.
- **Success:** navigates to **Screen 2 (Triage Result)** with the returned decision.

---

## Screen 2 — Triage Result (with mandatory "Why" panel)

**Purpose:** present the advisory recommendation for the just-captured dispute.
**Calls:** none on load (data passed from capture); link to `GET /api/disputes/:id`.
**Satisfies:** REQ-RST-001/002, REQ-EXP-001/002/003.

### Layout

- **Recommendation banner:** `disposition`, `route`, `priority` as text badges.
- **Mandatory "Why" panel** (cannot be hidden):
  - matched **`ruleId`** (e.g. `DR-01`),
  - the **rationale** text (`decisionReason`),
  - the **input values** that produced it: `disputeType`, `transactionType`,
    `transactionStatus`, `transactionAmount`, `disputeAgeDays`, `customerType`
    (REQ-EXP-003).
- **Advisory note:** *"This is an advisory recommendation. No action has been taken
  automatically."* (REQ-RST-002) — and **no** approve/auto-resolve button.
- **Actions:** "View full detail" → Screen 4; "Capture another" → Screen 1.

### States

- **Loading:** skeleton banner + panel (only if re-fetched).
- **Error:** if a deep-link result can't be loaded, show error banner with retry.
- **Empty:** not applicable (a result always has exactly one of each axis, REQ-RST-001).

---

## Screen 3 — Dispute Queue

**Purpose:** list triaged disputes for operators to pick up.
**Calls:** `GET /api/disputes` (with optional `priority` / `route` / `disposition` /
`disputeType` filters).
**Satisfies:** REQ-RST-001, REQ-EXP-001.

### Columns

`id` · `customerId` · `disputeType` · `transactionAmount` · `disputeAgeDays` ·
`disposition` · `route` · `priority` · `ruleId`.

### States

- **Loading:** table skeleton rows.
- **Empty:** *"No disputes match the current filters."*
- **Error:** banner with retry; filters preserved.
- **Row click:** navigates to **Screen 4 (Detail)**.

---

## Screen 4 — Dispute Detail (audit / rule trace)

**Purpose:** full view of one dispute, its decision, and the audit trail.
**Calls:** `GET /api/disputes/:id`.
**Satisfies:** REQ-EXP-001/002/003, REQ-RST-001.

### Sections

- **Dispute facts:** operator-submitted + resolved fields, including display-only
  `accountType` (clearly labelled "display only").
- **Decision:** `disposition / route / priority / ruleId / decisionReason / version`.
- **Why / inputs:** the six triage inputs (REQ-EXP-003).
- **Audit / rule trace:** chronological `AuditLog` entries (`action`, `createdAt`,
  `ruleTrace`) — REQ-EXP-001/002.

### States

- **Loading:** section skeletons.
- **Not found:** `404` → *"Dispute not found."*
- **Error:** banner with retry.

---

## Screen ↔ endpoint ↔ requirement map

| Screen | Endpoints | REQs |
| ------ | --------- | ---- |
| 1 Capture Form | `POST /api/disputes` | REQ-CAP-*, REQ-VAL-*, REQ-LKP-005/006 |
| 2 Triage Result | (data from capture) | REQ-RST-001/002, REQ-EXP-001/002/003 |
| 3 Queue | `GET /api/disputes` | REQ-RST-001, REQ-EXP-001 |
| 4 Detail | `GET /api/disputes/:id` | REQ-EXP-001/002/003, REQ-RST-001 |

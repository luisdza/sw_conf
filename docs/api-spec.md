# API Specification — Dispute Triage System (UC1)

**Purpose:** The HTTP contract for every endpoint the UC1 features need, kept in lockstep
with the data model in [`architecture.md`](architecture.md) and the frozen spine
[`decision_rules.md`](decision_rules.md).
**Owner:** API Designer
**Last updated:** 2026-06-22
**Covers:** Feature-1 (capture + triage pipeline), Feature-2 (result, queue, detail, audit).

## Conventions (defined once)

- **Base path:** `/api`. **Format:** JSON (`Content-Type: application/json`).
- **Auth:** the operator is authenticated upstream (call-centre session); `operatorId` is
  carried in the request body. No per-endpoint auth scheme in the prototype.
- **Standard error body** (all non-2xx):

  ```json
  { "error": { "code": "STRING_CODE", "message": "human readable" } }
  ```

  Validation errors additionally carry `error.missingFields: string[]` when fields are
  missing (REQ-CAP-002).
- **Enum values** in every request/response use the exact spellings from
  [`decision_rules.md`](decision_rules.md) (e.g. `UNAUTHORISED`, `AUTHORIZATION_ISSUE`).
- **Advisory (REQ-RST-002):** responses are recommendations. No endpoint auto-actions a
  dispute; the only side effects are persistence (Dispute + TriageDecision + AuditLog) and
  the simulated routing publish.
- **SLA (REQ-RST-003, assumed):** a valid `POST /api/disputes` returns within **2 seconds**
  (assumption replacing the source `[TBD]`; see
  [`../CONSISTENCY-REPORT.md`](../CONSISTENCY-REPORT.md) §Reconciliation 2).
- **Ordering:** on success the server **persists first, then publishes** the routing message
  `dispute.<route>.<priority>` (publish-after-persist).
- **Pagination:** not required at prototype scale — `GET /api/disputes` returns the full
  filtered set. Add cursor pagination (`?cursor` / `?limit`) before production.
- **Versioning:** the HTTP API is unversioned (implicit `v1`); the **triage ruleset** is
  versioned via `TriageDecision.version` (e.g. `decision_rules@2026-06-22`), so a stored
  decision always records which rule revision produced it.

---

## POST /api/disputes — capture a dispute and run triage

Captures an operator-submitted dispute, validates it, resolves lookups, computes
`disputeAgeDays`, runs the frozen rules engine, persists the result, writes an audit log,
and publishes the routing message.

**Implements:** REQ-CAP-001/002/003, REQ-VAL-001/002, REQ-LKP-001..006, REQ-CALC-001..005,
REQ-TRG-001..014, REQ-EXP-001..003, REQ-RST-001/002/003.
**Entities touched:** `Dispute` (create), `TriageDecision` (create, 1↔1), `AuditLog`
(create, 1↔M).

### Request body

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `operatorId` | string | ✓ | capturing operator |
| `customerId` | string | ✓ | |
| `accountNumber` | string | ✓ | drives `customerType`/`accountType`/`transactionId` lookups |
| `transactionDate` | string (ISO date) | ✓ | source for `disputeAgeDays` |
| `transactionAmount` | number (ZAR) | ✓ | |
| `transactionStatus` | enum `SUCCESS\|FAILED\|PENDING` | ✓ | |
| `disputeCaptureDate` | string (ISO date) | ✓ | filing date |
| `disputeReason` | string (free text) | ✓ | mapped to `disputeType` (REQ-LKP-005/006) |

```json
{
  "operatorId": "op-101",
  "customerId": "cust-001",
  "accountNumber": "1000001",
  "transactionDate": "2026-06-18",
  "transactionAmount": 4200,
  "transactionStatus": "SUCCESS",
  "disputeCaptureDate": "2026-06-20",
  "disputeReason": "unauthorised transaction"
}
```

### Response `201 Created`

Returns the persisted `Dispute` (incl. resolved + computed fields and the display-only
`accountType`) plus its `TriageDecision`.

```json
{
  "id": "cuid-abc123",
  "dispute": {
    "id": "cuid-abc123",
    "operatorId": "op-101",
    "customerId": "cust-001",
    "accountNumber": "1000001",
    "transactionId": "txn-001",
    "transactionDate": "2026-06-18",
    "transactionAmount": 4200,
    "transactionType": "CARD",
    "transactionStatus": "SUCCESS",
    "disputeCaptureDate": "2026-06-20",
    "disputeReason": "unauthorised transaction",
    "disputeType": "UNAUTHORISED",
    "customerType": "PERSONAL",
    "accountType": "CURRENT",
    "disputeAgeDays": 2
  },
  "decision": {
    "disposition": "ESCALATE",
    "route": "FRAUD_TEAM",
    "priority": "HIGH",
    "ruleId": "DR-01",
    "decisionReason": "Unauthorised transactions are escalated to the fraud team first…",
    "inputs": {
      "transactionAmount": 4200,
      "transactionType": "CARD",
      "disputeType": "UNAUTHORISED",
      "transactionStatus": "SUCCESS",
      "disputeAgeDays": 2,
      "customerType": "PERSONAL"
    }
  }
}
```

### Status & error codes

| Status | `error.code` | When | REQ |
| ------ | ------------ | ---- | --- |
| `201` | — | captured + triaged successfully | REQ-CAP-001, REQ-RST-001 |
| `400` | `MISSING_FIELDS` | one or more required fields absent; `missingFields` lists them | REQ-CAP-002/003 |
| `400` | `INVALID_CAPTURE_DATE` | `disputeCaptureDate` earlier than `transactionDate` | REQ-VAL-002 |
| `422` | `DISPUTE_TOO_OLD` | filing age (`disputeCaptureDate − transactionDate`) > `DISPUTE_MAX_DAYS` (90) | REQ-VAL-001 |
| `400` | `INVALID_ENUM` | a supplied enum value is outside its closed set | REQ-LKP-004 boundary |
| `500` | `INTERNAL` | unexpected error | — |

```json
{ "error": { "code": "MISSING_FIELDS", "message": "Required fields are missing.", "missingFields": ["customerId", "transactionDate"] } }
```

```json
{ "error": { "code": "DISPUTE_TOO_OLD", "message": "Dispute filing age (91 days) exceeds DISPUTE_MAX_DAYS (90)." } }
```

---

## GET /api/disputes — triage queue

Lists triaged disputes for the operator queue.

**Implements:** REQ-RST-001 (each row carries one disposition/route/priority/ruleId),
REQ-EXP-001.
**Entities touched:** `Dispute` (read) + `TriageDecision` (read).

### Query parameters (optional filters)

| Param | Type | Notes |
| ----- | ---- | ----- |
| `priority` | enum `HIGH\|MEDIUM\|LOW` | filter by priority |
| `route` | enum (any `route`) | filter by route |
| `disposition` | enum (any `disposition`) | filter by disposition |
| `disputeType` | enum (any `disputeType`) | filter by type |

### Response `200 OK`

```json
[
  {
    "id": "cuid-abc123",
    "customerId": "cust-001",
    "disputeType": "UNAUTHORISED",
    "transactionAmount": 4200,
    "disputeAgeDays": 2,
    "disposition": "ESCALATE",
    "route": "FRAUD_TEAM",
    "priority": "HIGH",
    "ruleId": "DR-01"
  }
]
```

| Status | When |
| ------ | ---- |
| `200` | list returned (empty array if none) |
| `400` | `INVALID_ENUM` — an unknown filter value |

---

## GET /api/disputes/:id — dispute detail

Full detail for one dispute, including the triage decision and the audit / rule trace.

**Implements:** REQ-EXP-001/002/003, REQ-RST-001.
**Entities touched:** `Dispute` (read) + `TriageDecision` (read) + `AuditLog` (read).

### Response `200 OK`

```json
{
  "id": "cuid-abc123",
  "customerId": "cust-001",
  "accountNumber": "1000001",
  "accountType": "CURRENT",
  "transactionAmount": 4200,
  "disputeType": "UNAUTHORISED",
  "disputeAgeDays": 2,
  "decision": {
    "disposition": "ESCALATE",
    "route": "FRAUD_TEAM",
    "priority": "HIGH",
    "ruleId": "DR-01",
    "decisionReason": "Unauthorised transactions are escalated to the fraud team first…",
    "version": "decision_rules@2026-06-22",
    "inputs": { "...": "the six triage inputs" }
  },
  "auditLogs": [
    {
      "id": "cuid-log1",
      "action": "TRIAGE",
      "createdAt": "2026-06-20T08:12:00.000Z",
      "ruleTrace": "{\"ruleId\":\"DR-01\",\"reason\":\"…\"}"
    }
  ]
}
```

| Status | `error.code` | When |
| ------ | ------------ | ---- |
| `200` | — | found |
| `404` | `NOT_FOUND` | no dispute with that id |

---

## Endpoint ↔ requirement summary

| Endpoint | Primary REQs | Entities |
| -------- | ------------ | -------- |
| `POST /api/disputes` | REQ-CAP-*, REQ-VAL-*, REQ-LKP-*, REQ-CALC-*, REQ-TRG-*, REQ-EXP-*, REQ-RST-* | Dispute, TriageDecision, AuditLog |
| `GET /api/disputes` | REQ-RST-001, REQ-EXP-001 | Dispute, TriageDecision |
| `GET /api/disputes/:id` | REQ-EXP-001/002/003, REQ-RST-001 | Dispute, TriageDecision, AuditLog |

> Every field above maps to an entity attribute in [`architecture.md`](architecture.md)
> (Dispute / TriageDecision / AuditLog). No orphan fields. If implementation introduces a
> new field/endpoint/status, it is added here in the same change (docs/code lockstep,
> Reconciliation 6).

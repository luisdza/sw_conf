

# Architecture Document — Dispute Triage System (UC1)

## Components

### Frontend (React + Vite)
- Call-centre UI for dispute capture
- Displays triage outcome (disposition, route, priority, ruleId)

### API Layer (Node.js + Express)
- REST endpoints
- Validation and enrichment
- Executes decision rules (DR-01 → DR-14)
- Persists results and audit logs

### Decision Engine
- Implements frozen rules (first-match-wins)
- Outputs: disposition, route, priority, ruleId

### Message Broker (RabbitMQ)
- Topic-based routing: dispute.<route>.<priority>
- Decouples services and enables async processing

### Database (SQLite + Prisma)
- Stores disputes, decisions, and audit logs
- Lightweight for demo purposes

## Data Model

### Dispute
- id, customerId, accountNumber, transactionId
- transactionAmount, transactionType, transactionStatus
- transactionDate, disputeType, disputeAgeDays
- customerType, accountType, operatorId

### TriageDecision
- id, disputeId
- disposition, route, priority
- ruleId, decisionReason, version

### AuditLog
- id, disputeId
- inputSnapshot (JSON)
- outputDecision (JSON)
- ruleTrace

### Relationships
- Dispute (1) → (1) TriageDecision
- Dispute (1) → (M) AuditLog

## Integrations

### Message Broker (RabbitMQ)
- Publishes triaged disputes to queues by route

### Notification Service (Simulated)
- Sends SMS alerts (mocked)

### External Systems (Stubbed)
- Core Banking
- Customer lookup
- Payments systems

### Incident Management
- Optional integration for high-priority escalations

## Key Decisions

### SQLite for Demo
- Simple, zero setup, replaceable in production

### RabbitMQ for Messaging
- Flexible routing aligned with business rules

### Embedded Rule Engine
- Deterministic and easy to control

### First-Match Rule Evaluation
- Guarantees exactly one outcome

### Audit-First Design
- Enables traceability and compliance

### Enum-Based Contracts
- Ensures consistency and prevents invalid states

## Summary

- Deterministic decisioning aligned to frozen rules
- Clean separation of concerns
- Event-driven extensibility
- Demo-friendly with production upgrade path

---

## Addendum (2026-06-22) — operational assumptions & data-model delta

> Additive notes appended by the spec-pack generation. They do not alter the components,
> decisions, or relationships above. Each item is recorded in
> [`../CONSISTENCY-REPORT.md`](../CONSISTENCY-REPORT.md).

### A1. `disputeAgeDays` reference date & DR-02 reachability (Reconciliation 1)

`disputeAgeDays` is derived at the API boundary from a **single, explicit, injectable
reference date** — never `Date.now()` inside the engine — so triage is deterministic.

- **Operating mode — triage-at-capture (default):** `referenceDate ≈ disputeCaptureDate`.
  Because REQ-VAL-001 rejects filings older than `DISPUTE_MAX_DAYS` (90), `disputeAgeDays`
  cannot exceed 90 at capture. Consequently **DR-02 (`> 365`) and the `> 90` portion of
  DR-05 are unreachable at capture-time triage.**
- **Operating mode — re-triage:** a later `referenceDate` (e.g. periodic re-evaluation of
  open disputes) can push `disputeAgeDays` past 365, making DR-02 reachable.

This is **flagged for a possible re-freeze** of `decision_rules.md`; the frozen rule is left
unchanged here. The engine's full input domain (where DR-02 fires) is covered by the
totality grid test; system-level reachability under the 90-day filing limit is noted there.

### A2. Performance SLA (REQ-RST-003, Reconciliation 2)

The source SLA was `[TBD]`. The spec pack assumes **2 seconds** for a valid
`POST /api/disputes` response, labelled as an assumption in `api-spec.md`, the steering
notes, and the consistency report. Treat as parameterised until the Architect confirms.

### A3. Dispute entity — full data contract (Reconciliation 3)

The persisted **Dispute** entity is extended (in `backend/prisma/schema.prisma`) to carry
every operator-submitted, resolved, and computed field from the data contract, in addition
to the attributes listed under *Data Model* above:

- operator-submitted: `disputeReason`, `disputeCaptureDate`, `operatorId`
- resolved lookups: `transactionId`, `transactionType`, `disputeType`, `customerType`,
  `accountType` (display-only)
- computed: `disputeAgeDays`

**TriageDecision** (`disposition / route / priority / ruleId / decisionReason / version`)
and **AuditLog** (`inputSnapshot / outputDecision / ruleTrace`) and the **1↔1 / 1↔M**
relationships are unchanged.

### A4. Messaging is simulated (Reconciliation 4)

The RabbitMQ topic publish `dispute.<route>.<priority>` is implemented behind a `Publisher`
interface with a logging/fake implementation (`backend/src/messaging/publisher.ts`). No
broker is required for the prototype or its tests; production swaps in a real AMQP client.
Publish occurs **after** persistence (publish-after-persist).

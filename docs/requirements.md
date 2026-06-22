# Requirements — Dispute Triage System (UC1)

**Format:** EARS (Easy Approach to Requirements Syntax)
**Owner:** Feature Analyst
**Status:** First draft — based on frozen `decision_rules.md`, `evaluation.md`, and `spec_draft.md`

> **Advisory system:** The triage engine recommends a disposition, route, and priority. It does not
> automatically action the dispute. A human operator acts on the recommendation.

---

## Scope & Assumptions

- Channel: call-centre / ops capture form
- Operator has already authenticated the customer before submitting a dispute
- All monetary amounts are in ZAR
- Rules are evaluated top-down; the first matching rule wins (first-match semantics)

---

## Data Contract

### Operator-submitted fields (capture form)

| Field               | Type    | Description                                                  |
| ------------------- | ------- | ------------------------------------------------------------ |
| `operatorId`        | string  | ID of the call-centre operator capturing the dispute         |
| `customerId`        | string  | Customer identifier                                          |
| `accountNumber`     | integer | Used to look up `customerType` and `accountType`             |
| `transactionDate`   | Date    | Date the original transaction occurred                       |
| `transactionAmount` | decimal | Amount of the original transaction (ZAR)                     |
| `transactionStatus` | enum    | `SUCCESS / FAILED / PENDING`                                 |
| `disputeCaptureDate`| Date    | Date the dispute was raised (used to compute `disputeAgeDays`)|
| `disputeReason`     | string  | Free-text reason supplied by the customer; mapped to `disputeType` via lookup |

### Backend-resolved fields (lookups)

| Field              | Type    | Values                                                                                   | Source                                                  |
| ------------------ | ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `customerType`     | enum    | `BUSINESS / PERSONAL / PRIVATE_BANKING`                                                  | Lookup: `accountNumber` → customer record               |
| `accountType`      | enum    | `SAVINGS / CURRENT`                                                                      | Lookup: `accountNumber` → account record                |
| `transactionId`    | string  | —                                                                                        | Lookup: `accountNumber` + `transactionDate` + `transactionAmount` |
| `transactionType`  | enum    | `CARD / EFT / INTERNAL`                                                                  | Lookup: `transactionId` → transaction record            |
| `disputeType`      | enum    | `UNAUTHORISED / DUPLICATE / NON_RECEIPT / FAILED_TRANSFER / AUTHORIZATION_ISSUE / OTHER` | Lookup: `disputeReason` → configured mapping table      |

> `customerType` and `accountType` are resolved for display purposes and are not used in triage rules.

### Backend-computed fields

| Field             | Type    | Derivation                                          |
| ----------------- | ------- | --------------------------------------------------- |
| `disputeAgeDays`  | integer | `systemDate − disputeCaptureDate` (whole days)      |

### Thresholds (constants)

| Constant               | Value  | Description                                         |
| ---------------------- | ------ | --------------------------------------------------- |
| `HIGH_VALUE_THRESHOLD` | 100 000| ZAR amount above which a dispute is high-value      |
| `AGING_DAYS`           | 3      | Days after which a dispute is approaching SLA       |
| `SLA_BREACH_DAYS`      | 7      | Days after which a dispute has breached SLA         |
| `DISPUTE_MAX_DAYS`     | 90     | Maximum age of transaction eligible for dispute     |

### Outputs (closed sets)

| Axis          | Values                                                                      |
| ------------- | --------------------------------------------------------------------------- |
| `disposition` | `RESOLVE_NOW / INVESTIGATE / ESCALATE / REFER`                              |
| `route`       | `FRONTLINE / PAYMENTS_PROCESSING / CARD_OPS / FRAUD_TEAM / LEDGER_CONTROL`  |
| `priority`    | `HIGH / MEDIUM / LOW`                                                       |

---

## REQ-CAP — Dispute Capture

**REQ-CAP-001:** When an operator submits a dispute with all required fields present, the system shall accept the request and initiate the triage pipeline.

**REQ-CAP-002:** When an operator submits a dispute with any required field missing, the system shall reject the request and return a validation error identifying each missing field.

**REQ-CAP-003:** The system shall require the following fields for every dispute submission: `operatorId`, `customerId`, `accountNumber`, `transactionDate`, `transactionAmount`, `transactionStatus`, `disputeCaptureDate`, `disputeReason`.

---

## REQ-VAL — Validation

**REQ-VAL-001:** Where the difference between `disputeCaptureDate` and `transactionDate` exceeds `DISPUTE_MAX_DAYS` (90 days), the system shall reject the dispute and return status `DISPUTE_TOO_OLD` without proceeding to triage.

**REQ-VAL-002:** Where `disputeCaptureDate` is earlier than `transactionDate`, the system shall reject the dispute and return a validation error indicating an invalid dispute capture date.

---

## REQ-LKP — Lookups

**REQ-LKP-001:** When a dispute is submitted, the system shall look up `customerType` (`BUSINESS / PERSONAL / PRIVATE_BANKING`) using `accountNumber`.

**REQ-LKP-002:** When a dispute is submitted, the system shall look up `accountType` (`SAVINGS / CURRENT`) using `accountNumber`.

**REQ-LKP-003:** When a dispute is submitted, the system shall look up `transactionId` using `accountNumber`, `transactionDate`, and `transactionAmount`.

**REQ-LKP-004:** When `transactionId` is resolved, the system shall look up `transactionType` (`CARD / EFT / INTERNAL`) and confirm `transactionStatus` (`SUCCESS / FAILED / PENDING`).

**REQ-LKP-005:** When a `disputeReason` is submitted, the system shall map it to a `disputeType` value (`UNAUTHORISED / DUPLICATE / NON_RECEIPT / FAILED_TRANSFER / AUTHORIZATION_ISSUE / OTHER`) using a configured lookup table.

**REQ-LKP-006:** If no mapping exists in the lookup table for a submitted `disputeReason`, the system shall assign `disputeType = OTHER`.

---

## REQ-CALC — Calculations

**REQ-CALC-001:** The system shall compute `disputeAgeDays` as the number of whole days between `disputeCaptureDate` and `systemDate`.

**REQ-CALC-002:** The system shall determine whether `disputeAgeDays` exceeds `AGING_DAYS` (3).

**REQ-CALC-003:** The system shall determine whether `disputeAgeDays` exceeds `SLA_BREACH_DAYS` (7).

**REQ-CALC-004:** The system shall determine whether `transactionAmount` exceeds `HIGH_VALUE_THRESHOLD` (100 000 ZAR).

---

## REQ-TRG — Triage: Disposition & Route

Rules are evaluated top-down. The first matching rule wins and sets both `disposition` and `route`.
Each rule maps to a decision rule ID from `evaluation.md`.

**REQ-TRG-001** *(D1):* When `disputeType` is `UNAUTHORISED`, the system shall set `disposition` to `ESCALATE` and `route` to `FRAUD_TEAM`.

**REQ-TRG-002** *(D2):* When `disputeType` is `DUPLICATE` and `transactionStatus` is `SUCCESS` and `transactionAmount` does not exceed `HIGH_VALUE_THRESHOLD`, the system shall set `disposition` to `RESOLVE_NOW` and `route` to `FRONTLINE`.

**REQ-TRG-003** *(D3):* When `disputeType` is `DUPLICATE` and `transactionAmount` exceeds `HIGH_VALUE_THRESHOLD`, the system shall set `disposition` to `INVESTIGATE` and `route` to `LEDGER_CONTROL`, regardless of `transactionStatus`.

**REQ-TRG-004** *(D4):* When `disputeType` is `DUPLICATE` and neither REQ-TRG-002 nor REQ-TRG-003 applies, the system shall set `disposition` to `INVESTIGATE` and `route` to `PAYMENTS_PROCESSING`.

**REQ-TRG-005** *(D5):* When `disputeType` is `FAILED_TRANSFER` and `transactionStatus` is `FAILED`, the system shall set `disposition` to `RESOLVE_NOW` and `route` to `FRONTLINE`.

**REQ-TRG-006** *(D6):* When `disputeType` is `FAILED_TRANSFER` and `transactionStatus` is `SUCCESS`, the system shall set `disposition` to `INVESTIGATE` and `route` to `PAYMENTS_PROCESSING`.

**REQ-TRG-007** *(D7):* When `disputeType` is `NON_RECEIPT` and `transactionStatus` is `FAILED`, the system shall set `disposition` to `RESOLVE_NOW` and `route` to `FRONTLINE`.

**REQ-TRG-008** *(D8):* When `disputeType` is `NON_RECEIPT` and `transactionStatus` is not `FAILED`, the system shall set `disposition` to `INVESTIGATE` and `route` to `PAYMENTS_PROCESSING`.

**REQ-TRG-009** *(D9):* When `transactionType` is `CARD` and no `disputeType`-based rule has matched, the system shall set `disposition` to `REFER` and `route` to `CARD_OPS`.

**REQ-TRG-010** *(D10):* Where no other disposition rule matches, the system shall set `disposition` to `INVESTIGATE` and `route` to `PAYMENTS_PROCESSING`.

---

## REQ-PRI — Triage: Priority

Rules are evaluated top-down. The first matching rule wins and sets `priority`.

**REQ-PRI-001** *(P1):* When `disputeType` is `UNAUTHORISED`, the system shall set `priority` to `HIGH`.

**REQ-PRI-002** *(P2):* When `disputeAgeDays` exceeds `SLA_BREACH_DAYS` (7), the system shall set `priority` to `HIGH`.

**REQ-PRI-003** *(P3):* When `transactionAmount` exceeds `HIGH_VALUE_THRESHOLD` (100 000 ZAR), the system shall set `priority` to `HIGH`.

**REQ-PRI-004** *(P4):* When `disputeAgeDays` exceeds `AGING_DAYS` (3) and does not exceed `SLA_BREACH_DAYS` (7), the system shall set `priority` to `MEDIUM`.

**REQ-PRI-005** *(P5):* Where no priority rule matches, the system shall set `priority` to `LOW`.

---

## REQ-EXP — Explainability

**REQ-EXP-001:** The system shall record the ID of the disposition rule that fired (`D1`–`D10`) in every triage result.

**REQ-EXP-002:** The system shall record the ID of the priority rule that fired (`P1`–`P5`) in every triage result.

**REQ-EXP-003:** The system shall record the rationale text associated with both the disposition rule and the priority rule in every triage result.

**REQ-EXP-004:** The system shall record all triage input values (`disputeType`, `transactionType`, `transactionStatus`, `transactionAmount`, `disputeAgeDays`) as part of every triage result payload.

---

## REQ-RST — Result

**REQ-RST-001:** The system shall always return exactly one `disposition`, exactly one `route`, and exactly one `priority` for every valid dispute submission.

**REQ-RST-002:** The system shall treat every triage result as advisory — it shall not automatically action the dispute; the recommendation is presented to the operator for human decision.

**REQ-RST-003:** The system shall return a triage result within **[TBD — response time SLA to be confirmed by Architect]** seconds of receiving a valid dispute submission.

---

## Coverage cross-reference

| Rule | Requirement | Covered |
| ---- | ----------- | ------- |
| D1   | REQ-TRG-001 | ✓       |
| D2   | REQ-TRG-002 | ✓       |
| D3   | REQ-TRG-003 | ✓       |
| D4   | REQ-TRG-004 | ✓       |
| D5   | REQ-TRG-005 | ✓       |
| D6   | REQ-TRG-006 | ✓       |
| D7   | REQ-TRG-007 | ✓       |
| D8   | REQ-TRG-008 | ✓       |
| D9   | REQ-TRG-009 | ✓       |
| D10  | REQ-TRG-010 | ✓       |
| P1   | REQ-PRI-001 | ✓       |
| P2   | REQ-PRI-002 | ✓       |
| P3   | REQ-PRI-003 | ✓       |
| P4   | REQ-PRI-004 | ✓       |
| P5   | REQ-PRI-005 | ✓       |

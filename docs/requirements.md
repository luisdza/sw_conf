# Requirements — Dispute Triage System (UC1)

**Format:** EARS (Easy Approach to Requirements Syntax)
**Owner:** Business Analyst
**Status:** First draft — aligned to frozen `decision_rules.md` (2026-06-22)

> **Advisory system:** The triage engine recommends a disposition, route, and priority. It does not
> automatically action the dispute. A human operator acts on the recommendation.

---

## Scope & Assumptions

- Channel: call-centre / ops capture form
- Operator has already authenticated the customer before submitting a dispute
- All monetary amounts are in ZAR
- Rules are evaluated top-down; the first matching rule wins (first-match semantics)
- Every valid dispute submission returns exactly one disposition, one route, and one priority

---

## Data Contract

### Operator-submitted fields (capture form)

| Field                | Type    | Description                                                              |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| `operatorId`         | string  | ID of the call-centre operator capturing the dispute                     |
| `customerId`         | string  | Customer identifier                                                      |
| `accountNumber`      | integer | Used to look up `customerType`, `accountType`, and `transactionId`       |
| `transactionDate`    | Date    | Date the original transaction occurred; source for `disputeAgeDays`      |
| `transactionAmount`  | decimal | Amount of the original transaction (ZAR)                                 |
| `transactionStatus`  | enum    | `SUCCESS / FAILED / PENDING`                                             |
| `disputeCaptureDate` | Date    | Date the dispute was raised — kept for audit trail                       |
| `disputeReason`      | string  | Free-text reason supplied by the customer; mapped to `disputeType` via lookup |

### Backend-resolved fields (lookups)

| Field             | Type    | Values                                                                                    | Source                                                       |
| ----------------- | ------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `customerType`    | enum    | `BUSINESS / PERSONAL / PRIVATE_BANKING`                                                   | Lookup: `accountNumber` → customer record                    |
| `accountType`     | enum    | `SAVINGS / CURRENT`                                                                       | Lookup: `accountNumber` → account record                     |
| `transactionId`   | string  | —                                                                                         | Lookup: `accountNumber` + `transactionDate` + `transactionAmount` |
| `transactionType` | enum    | `CARD / EFT / INTERNAL`                                                                   | Lookup: `transactionId` → transaction record                 |
| `disputeType`     | enum    | `UNAUTHORISED / DUPLICATE / NON_RECEIPT / FAILED_TRANSFER / AUTHORIZATION_ISSUE / OTHER`  | Lookup: `disputeReason` → configured mapping table           |

> `accountType` is resolved for display purposes and is not used in triage rules.

### Backend-computed fields

| Field            | Type    | Derivation                                      |
| ---------------- | ------- | ----------------------------------------------- |
| `disputeAgeDays` | integer | `today − transactionDate` (whole days)          |

### Thresholds (constants)

| Constant                 | Value   | Description                                                  |
| ------------------------ | ------- | ------------------------------------------------------------ |
| `HIGH_VALUE_THRESHOLD`   | 100 000 | ZAR amount at or above which a dispute is high-value         |
| `DISPUTE_MAX_DAYS`       | 90      | Max transaction age (days) at which a dispute can be filed   |
| `AGING_DAYS`             | 3       | Transaction age (days) after which frontline escalates       |
| `COMPLIANCE_REVIEW_DAYS` | 30      | Transaction age (days) triggering compliance review          |
| `REGULATORY_LIMIT_DAYS`  | 365     | Transaction age (days) triggering regulatory escalation      |

### Outputs (closed sets)

| Axis          | Values                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `disposition` | `RESOLVE_NOW / INVESTIGATE / ESCALATE / REFER`                                                      |
| `route`       | `FRONTLINE / PAYMENTS_PROCESSING / CARD_OPS / FRAUD_TEAM / LEDGER_CONTROL / SENIOR_OPS / COMPLIANCE` |
| `priority`    | `HIGH / MEDIUM / LOW`                                                                               |

---

## REQ-CAP — Dispute Capture

**REQ-CAP-001:** When an operator submits a dispute with all required fields present, the system shall accept the request and initiate the triage pipeline.

**REQ-CAP-002:** When an operator submits a dispute with any required field missing, the system shall reject the request and return a validation error identifying each missing field.

**REQ-CAP-003:** The system shall require the following fields for every dispute submission: `operatorId`, `customerId`, `accountNumber`, `transactionDate`, `transactionAmount`, `transactionStatus`, `disputeCaptureDate`, `disputeReason`.

---

## REQ-VAL — Validation

**REQ-VAL-001:** Where the difference between `transactionDate` and `disputeCaptureDate` exceeds `DISPUTE_MAX_DAYS` (90 days), the system shall reject the dispute and return status `DISPUTE_TOO_OLD` without proceeding to triage.

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

**REQ-CALC-001:** The system shall compute `disputeAgeDays` as the number of whole days between `transactionDate` and today.

**REQ-CALC-002:** The system shall determine whether `disputeAgeDays` exceeds `AGING_DAYS` (3).

**REQ-CALC-003:** The system shall determine whether `disputeAgeDays` exceeds `COMPLIANCE_REVIEW_DAYS` (30).

**REQ-CALC-004:** The system shall determine whether `disputeAgeDays` exceeds `REGULATORY_LIMIT_DAYS` (365).

**REQ-CALC-005:** The system shall determine whether `transactionAmount` meets or exceeds `HIGH_VALUE_THRESHOLD` (100 000 ZAR).

---

## REQ-TRG — Triage: Disposition, Route & Priority

Rules are evaluated top-down. The first matching rule wins and sets `disposition`, `route`, and
`priority` together. Each rule maps to a decision rule ID from `decision_rules.md`.

**REQ-TRG-001** *(DR-01):* When `disputeType` is `UNAUTHORISED`, the system shall set `disposition` to `ESCALATE`, `route` to `FRAUD_TEAM`, and `priority` to `HIGH`.

**REQ-TRG-002** *(DR-02):* When `disputeAgeDays` exceeds `REGULATORY_LIMIT_DAYS` (365), the system shall set `disposition` to `ESCALATE`, `route` to `COMPLIANCE`, and `priority` to `HIGH`.

**REQ-TRG-003** *(DR-03):* When `transactionAmount` meets or exceeds `HIGH_VALUE_THRESHOLD` (100 000 ZAR), the system shall set `disposition` to `ESCALATE`, `route` to `SENIOR_OPS`, and `priority` to `HIGH`.

**REQ-TRG-004** *(DR-04):* When `customerType` is `BUSINESS` and `disputeAgeDays` does not exceed `COMPLIANCE_REVIEW_DAYS` (30), the system shall set `disposition` to `ESCALATE`, `route` to `SENIOR_OPS`, and `priority` to `HIGH`.

**REQ-TRG-005** *(DR-05):* When `disputeAgeDays` exceeds `COMPLIANCE_REVIEW_DAYS` (30) and no higher-priority rule has matched, the system shall set `disposition` to `REFER`, `route` to `COMPLIANCE`, and `priority` to `MEDIUM`.

**REQ-TRG-006** *(DR-06):* When `disputeType` is `NON_RECEIPT` and `transactionType` is `INTERNAL`, the system shall set `disposition` to `INVESTIGATE`, `route` to `LEDGER_CONTROL`, and `priority` to `MEDIUM`.

**REQ-TRG-007** *(DR-07):* When `disputeType` is `DUPLICATE` and `transactionStatus` is `SUCCESS` and `transactionAmount` is below `HIGH_VALUE_THRESHOLD`, the system shall set `disposition` to `RESOLVE_NOW`, `route` to `FRONTLINE`, and `priority` to `LOW`.

**REQ-TRG-008** *(DR-08):* When `disputeType` is `DUPLICATE` and no higher-priority duplicate rule has matched, the system shall set `disposition` to `INVESTIGATE`, `route` to `PAYMENTS_PROCESSING`, and `priority` to `MEDIUM`.

**REQ-TRG-009** *(DR-09):* When `disputeType` is `FAILED_TRANSFER` and `transactionStatus` is `FAILED`, the system shall set `disposition` to `RESOLVE_NOW`, `route` to `FRONTLINE`, and `priority` to `LOW`.

**REQ-TRG-010** *(DR-10):* When `disputeType` is `FAILED_TRANSFER` and `transactionStatus` is `SUCCESS`, the system shall set `disposition` to `INVESTIGATE`, `route` to `PAYMENTS_PROCESSING`, and `priority` to `MEDIUM`.

**REQ-TRG-011** *(DR-11):* When `disputeType` is `NON_RECEIPT` and `disputeAgeDays` does not exceed `AGING_DAYS` (3), the system shall set `disposition` to `INVESTIGATE`, `route` to `FRONTLINE`, and `priority` to `LOW`.

**REQ-TRG-012** *(DR-12):* When `disputeType` is `NON_RECEIPT` and no higher-priority NON_RECEIPT rule has matched, the system shall set `disposition` to `INVESTIGATE`, `route` to `PAYMENTS_PROCESSING`, and `priority` to `MEDIUM`.

**REQ-TRG-013** *(DR-13):* When `disputeType` is `AUTHORIZATION_ISSUE` or `transactionType` is `CARD` and no higher-priority rule has matched, the system shall set `disposition` to `INVESTIGATE`, `route` to `CARD_OPS`, and `priority` to `MEDIUM`.

**REQ-TRG-014** *(DR-14):* Where no other triage rule matches, the system shall set `disposition` to `INVESTIGATE`, `route` to `FRONTLINE`, and `priority` to `MEDIUM`.

---

## REQ-EXP — Explainability

**REQ-EXP-001:** The system shall record the ID of the rule that fired (`DR-01`–`DR-14`) in every triage result.

**REQ-EXP-002:** The system shall record the rationale text associated with the matched rule in every triage result.

**REQ-EXP-003:** The system shall record all triage input values (`disputeType`, `transactionType`, `transactionStatus`, `transactionAmount`, `disputeAgeDays`, `customerType`) as part of every triage result payload.

---

## REQ-RST — Result

**REQ-RST-001:** The system shall always return exactly one `disposition`, exactly one `route`, and exactly one `priority` for every valid dispute submission.

**REQ-RST-002:** The system shall treat every triage result as advisory — it shall not automatically action the dispute; the recommendation is presented to the operator for human decision.

**REQ-RST-003:** The system shall return a triage result within **[TBD — response time SLA to be confirmed by Architect]** seconds of receiving a valid dispute submission.

---

## Coverage cross-reference

| Rule  | Requirement  | Covered |
| ----- | ------------ | ------- |
| DR-01 | REQ-TRG-001  | ✓       |
| DR-02 | REQ-TRG-002  | ✓       |
| DR-03 | REQ-TRG-003  | ✓       |
| DR-04 | REQ-TRG-004  | ✓       |
| DR-05 | REQ-TRG-005  | ✓       |
| DR-06 | REQ-TRG-006  | ✓       |
| DR-07 | REQ-TRG-007  | ✓       |
| DR-08 | REQ-TRG-008  | ✓       |
| DR-09 | REQ-TRG-009  | ✓       |
| DR-10 | REQ-TRG-010  | ✓       |
| DR-11 | REQ-TRG-011  | ✓       |
| DR-12 | REQ-TRG-012  | ✓       |
| DR-13 | REQ-TRG-013  | ✓       |
| DR-14 | REQ-TRG-014  | ✓       |

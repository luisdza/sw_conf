# Decision Rules — Dispute Triage (UC1)

**Owner:** Business Analyst + Architect, co-signed by the Facilitator.
**Status:** FROZEN — 2026-06-22. Every requirement, test case, endpoint, and screen references this
file. Changes require a re-freeze and a note to all roles; the Revision note at the bottom is that
note for this revision.

## Purpose

Given one captured dispute, return exactly one `disposition`, exactly one `route`, and exactly one
`priority` — and record _why_ (the ID of the rule that matched). The system is advisory: it
recommends; a human acts.

## Scope & assumptions

- Channel: call-centre / ops capture form
- The customer has been authenticated before triage runs
- Local payments only; all amounts are in **ZAR**

---

## Data contract

### Form (captured by the operator at intake)

**Operator-submitted:**

- `operatorId`
- `customerId`
- `accountNumber`
- `transactionDate`
- `transactionAmount`
- `transactionStatus`
- `disputeCaptureDate` (date the dispute was raised — kept for audit trail)
- `disputeReason` (free text from customer; mapped to `disputeType` via backend lookup)

**Backend resolves via lookup:**

- `customerType` (from `accountNumber`)
- `accountType` (from `accountNumber`)
- `transactionId` (from `accountNumber` + `transactionDate` + `transactionAmount`)
- `transactionType` (from `transactionId`)
- `disputeType` (from `disputeReason` → configured mapping table)

**Backend computes:**

- `disputeAgeDays` = today − `transactionDate`

### Inputs (the triage context the rules read)

| Variable            | Type    | Values                                                                                   | Notes                                                  |
| ------------------- | ------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `transactionAmount` | decimal | ZAR                                                                                      |                                                        |
| `accountType`       | enum    | `SAVINGS / CURRENT`                                                                      | Display only — not used in current triage rules        |
| `transactionType`   | enum    | `CARD / EFT / INTERNAL`                                                                  |                                                        |
| `disputeType`       | enum    | `UNAUTHORISED / DUPLICATE / NON_RECEIPT / FAILED_TRANSFER / AUTHORIZATION_ISSUE / OTHER` | Mapped from `disputeReason` via lookup; drives routing |
| `transactionStatus` | enum    | `SUCCESS / FAILED / PENDING`                                                             |                                                        |
| `disputeAgeDays`    | integer |                                                                                          | Computed: today − `transactionDate`                    |
| `customerType`      | enum    | `BUSINESS / PERSONAL / PRIVATE_BANKING`                                                  |                                                        |

### Thresholds (constants)

| Constant                 | Value   | Description                                                |
| ------------------------ | ------- | ---------------------------------------------------------- |
| `HIGH_VALUE_THRESHOLD`   | 100 000 | ZAR amount at or above which a dispute is high-value       |
| `DISPUTE_MAX_DAYS`       | 90      | Max transaction age (days) at which a dispute can be filed |
| `AGING_DAYS`             | 3       | Transaction age (days) after which frontline escalates     |
| `COMPLIANCE_REVIEW_DAYS` | 30      | Transaction age (days) triggering compliance review        |
| `REGULATORY_LIMIT_DAYS`  | 365     | Transaction age (days) triggering regulatory escalation    |

### Outputs (closed sets)

| Axis          | Values                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| `disposition` | `RESOLVE_NOW / INVESTIGATE / ESCALATE / REFER`                                                       |
| `route`       | `FRONTLINE / PAYMENTS_PROCESSING / CARD_OPS / FRAUD_TEAM / LEDGER_CONTROL / SENIOR_OPS / COMPLIANCE` |
| `priority`    | `HIGH / MEDIUM / LOW`                                                                                |

---

## Decision rules

Rules are **ordered and evaluated top to bottom; the first rule whose condition is true wins** and
evaluation stops. DR-14 is an unconditional default. First-match-wins plus the default guarantee
that every valid input yields exactly one `disposition`, one `route`, and one `priority`. The
matched rule ID is the recorded _why_.

| ID    | Condition (first match wins)                                                                           | `disposition` | `route`               | `priority` |
| ----- | ------------------------------------------------------------------------------------------------------ | ------------- | --------------------- | ---------- |
| DR-01 | `disputeType = UNAUTHORISED`                                                                           | `ESCALATE`    | `FRAUD_TEAM`          | `HIGH`     |
| DR-02 | `disputeAgeDays > REGULATORY_LIMIT_DAYS`                                                               | `ESCALATE`    | `COMPLIANCE`          | `HIGH`     |
| DR-03 | `transactionAmount >= HIGH_VALUE_THRESHOLD`                                                            | `ESCALATE`    | `SENIOR_OPS`          | `HIGH`     |
| DR-04 | `customerType = BUSINESS AND disputeAgeDays <= COMPLIANCE_REVIEW_DAYS`                                 | `ESCALATE`    | `SENIOR_OPS`          | `HIGH`     |
| DR-05 | `disputeAgeDays > COMPLIANCE_REVIEW_DAYS`                                                              | `REFER`       | `COMPLIANCE`          | `MEDIUM`   |
| DR-06 | `disputeType = NON_RECEIPT AND transactionType = INTERNAL`                                             | `INVESTIGATE` | `LEDGER_CONTROL`      | `MEDIUM`   |
| DR-07 | `disputeType = DUPLICATE AND transactionStatus = SUCCESS AND transactionAmount < HIGH_VALUE_THRESHOLD` | `RESOLVE_NOW` | `FRONTLINE`           | `LOW`      |
| DR-08 | `disputeType = DUPLICATE`                                                                              | `INVESTIGATE` | `PAYMENTS_PROCESSING` | `MEDIUM`   |
| DR-09 | `disputeType = FAILED_TRANSFER AND transactionStatus = FAILED`                                         | `RESOLVE_NOW` | `FRONTLINE`           | `LOW`      |
| DR-10 | `disputeType = FAILED_TRANSFER AND transactionStatus = SUCCESS`                                        | `INVESTIGATE` | `PAYMENTS_PROCESSING` | `MEDIUM`   |
| DR-11 | `disputeType = NON_RECEIPT AND disputeAgeDays <= AGING_DAYS`                                           | `INVESTIGATE` | `FRONTLINE`           | `LOW`      |
| DR-12 | `disputeType = NON_RECEIPT`                                                                            | `INVESTIGATE` | `PAYMENTS_PROCESSING` | `MEDIUM`   |
| DR-13 | `disputeType = AUTHORIZATION_ISSUE OR transactionType = CARD`                                          | `INVESTIGATE` | `CARD_OPS`            | `MEDIUM`   |
| DR-14 | _(default — no earlier rule matched)_                                                                  | `INVESTIGATE` | `FRONTLINE`           | `MEDIUM`   |

### Rule notes

- **DR-01** routes all unauthorised transactions to the fraud team first, regardless of age, amount,
  or channel. If the dispute is also past `REGULATORY_LIMIT_DAYS`, the fraud team notifies compliance
  as a procedural step.
- **DR-02 before DR-03/DR-04**: regulatory age takes precedence over value and customer type. A very
  old high-value dispute goes to `COMPLIANCE`, not `SENIOR_OPS`.
- **DR-03 / DR-04**: high-value disputes and all business-customer disputes (within 30 days) escalate
  to senior ops before type-specific rules are applied. A business dispute older than 30 days falls
  through to DR-05.
- **DR-05** catches all disputes aged 31–365 days that are not unauthorised, not high-value, and not
  from a business customer. Effective window: 31–365 days.
- **DR-06** catches internal-transfer non-receipts (ledger reconciliation issues) before the general
  non-receipt rules.
- **DR-07** auto-resolves settled duplicates below the high-value threshold. A duplicate that is
  `PENDING` or `FAILED`, or that exceeds the threshold, is investigated instead (DR-08).
- **DR-08** is the duplicate catch-all. Covers `PENDING`/`FAILED` duplicates and high-value
  duplicates not resolved by DR-07 (those were already escalated via DR-03).
- **DR-09** closes failed-transfer disputes quickly when the transaction is confirmed `FAILED` —
  no funds moved, so the case can be explained and closed at frontline.
- **DR-10** investigates a reported failure where the transaction shows `SUCCESS` — funds may have
  settled; trace through payments processing.
- **DR-11 / DR-12**: NON_RECEIPT disputes 0–3 days old go to frontline for initial investigation;
  older cases route to payments processing for deeper tracing.
- **DR-13** handles card-scheme disputes (`AUTHORIZATION_ISSUE`) and any residual card-channel
  disputes not caught by earlier type rules.
- **DR-14** guarantees totality — covers `OTHER` dispute type, `FAILED_TRANSFER + PENDING`, and
  any combination not matched above.

### Determinism & coverage check

- **Exactly one output:** evaluation stops at the first match; no input receives two outcomes.
- **Total coverage:** DR-14 has no condition; no input falls through with zero outcomes.
- **No dead values:** every `disposition`, `route`, and `priority` value is reachable from at least
  one rule, and every constant is referenced.

# Decision Rules — Dispute Triage (UC1)

**Owner:** Business Analyst + Architect, co-signed by the Facilitator.
**Status:** FROZEN. Revision: final draft (2026-06-22).
Every requirement, test case, endpoint, and screen references this file. Changes require a re-freeze and a note to all roles; the "Revision note" at the bottom is that note for this revision.

## Purpose

Given one captured dispute, return exactly one `action`, exactly one `route`, and exactly one `priority`, and record *why* (the ID of the rule that matched). The system is advisory: it produces a recommendation; a human performs the action.

## Scope & assumptions

- Channel: call-centre / ops capture form.
- The customer has been authenticated before triage runs.
- Local payments only; all amounts are in **ZAR**.

---

## Data contract

### Form (captured by the operator at intake)

Raw fields the operator records on the call. The rule engine does **not** read these directly — it reads the derived triage inputs below.

- `customerId`
- `transactionId`
- `description`
- `operatorId`
- `accountNumber` — used to look up `customerType` and `accountType`
- `amount`
- authentication outcome (completed at intake — see Scope)

The operator performs a lookup on `accountNumber`/`transactionId`, which yields `accountType`, `customerType`, `transactionDate`, `transactionStatus`, and `paymentType`.

### Inputs (the triage context the rules read)

| Variable            | Type    | Values                                                          |
| ------------------- | ------- | --------------------------------------------------------------- |
| `amount`            | decimal | ZAR                                                             |
| `accountType`       | enum    | `SAVINGS` / `CURRENT`                                           |
| `transactionDate`   | date    | source for `disputeAgeDays` (= today − `transactionDate`)       |
| `disputeType`       | enum    | `FRAUD` / `DUPLICATE` / `NON_RECEIPT` / `AUTHORIZATION_ISSUE` / `OTHER` |
| `paymentType`       | enum    | `CARD` / `EFT` / `INTERNAL`                                     |
| `transactionStatus` | enum    | `SUCCESS` / `FAILED` / `PENDING`                                |
| `disputeAgeDays`    | integer | derived from `transactionDate`                                  |
| `customerType`      | enum    | `BUSINESS` / `PERSONAL` / `PRIVATE_BANKING`                     |

`disputeType` is the single routing taxonomy. If an `issueType` label is still captured on the form it is display-only and maps as: `Duplicate Debit → DUPLICATE`, `Missing Payment → NON_RECEIPT`, `Failed Transfer → NON_RECEIPT` (typically `paymentType = INTERNAL`), `Other → OTHER`.

## Thresholds (constants)

| Constant                  | Value       | Used in        |
| ------------------------- | ----------- | -------------- |
| `HIGH_VALUE_THRESHOLD`    | 100 000 ZAR | DR-03          |
| `AGING_DAYS`              | 3           | DR-08, DR-09   |
| `STANDARD_REVIEW_DAYS`    | 5           | DR-11          |
| `SLA_BREACH_DAYS`         | 7           | DR-07          |
| `COMPLIANCE_REVIEW_DAYS`  | 30          | DR-04, DR-05   |
| `REGULATORY_LIMIT_DAYS`   | 365         | DR-02          |

## Outputs (closed sets)

| Axis       | Values                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| `action`   | `RESOLVE_NOW` `INVESTIGATE` `ESCALATE` `REFER`                                           |
| `route`    | `FRONTLINE` `PAYMENTS_PROCESSING` `CARD_OPS` `FRAUD_TEAM` `LEDGER_CONTROL` `SENIOR_OPS` `COMPLIANCE` |
| `priority` | `HIGH` `MEDIUM` `LOW`                                                                    |

---

## Decision rules

Rules are **ordered and evaluated top to bottom; the first rule whose condition is true wins** and evaluation stops. DR-12 is an unconditional default. First-match-wins plus the default guarantee that every valid input yields exactly one `action`, one `route`, and one `priority`. The matched rule ID is the recorded *why*.

| ID    | Condition (first match wins)                                                                 | `action`     | `route`              | `priority` |
| ----- | -------------------------------------------------------------------------------------------- | ------------ | -------------------- | ---------- |
| DR-01 | `disputeType = FRAUD`                                                                         | `ESCALATE`   | `FRAUD_TEAM`         | `HIGH`     |
| DR-02 | `disputeAgeDays > REGULATORY_LIMIT_DAYS`                                                      | `ESCALATE`   | `COMPLIANCE`         | `HIGH`     |
| DR-03 | `amount >= HIGH_VALUE_THRESHOLD`                                                              | `ESCALATE`   | `SENIOR_OPS`         | `HIGH`     |
| DR-04 | `customerType = BUSINESS AND disputeAgeDays <= COMPLIANCE_REVIEW_DAYS`                        | `ESCALATE`   | `SENIOR_OPS`         | `HIGH`     |
| DR-05 | `disputeAgeDays > COMPLIANCE_REVIEW_DAYS`                                                     | `REFER`      | `COMPLIANCE`         | `MEDIUM`   |
| DR-06 | `disputeType = NON_RECEIPT AND paymentType = INTERNAL`                                        | `INVESTIGATE`| `LEDGER_CONTROL`     | `MEDIUM`   |
| DR-07 | `disputeType = DUPLICATE AND transactionStatus = SUCCESS AND disputeAgeDays <= SLA_BREACH_DAYS` | `RESOLVE_NOW`| `PAYMENTS_PROCESSING`| `MEDIUM`   |
| DR-08 | `disputeType = NON_RECEIPT AND disputeAgeDays <= AGING_DAYS`                                  | `INVESTIGATE`| `FRONTLINE`          | `LOW`      |
| DR-09 | `disputeType = NON_RECEIPT AND disputeAgeDays > AGING_DAYS`                                   | `INVESTIGATE`| `PAYMENTS_PROCESSING`| `MEDIUM`   |
| DR-10 | `disputeType = AUTHORIZATION_ISSUE`                                                           | `INVESTIGATE`| `CARD_OPS`           | `MEDIUM`   |
| DR-11 | `(accountType = SAVINGS OR accountType = CURRENT) AND disputeAgeDays <= STANDARD_REVIEW_DAYS` | `INVESTIGATE`| `FRONTLINE`          | `MEDIUM`   |
| DR-12 | *(default — no earlier rule matched)*                                                         | `INVESTIGATE`| `FRONTLINE`          | `MEDIUM`   |

### Rule notes

- **DR-01** routes all fraud to the fraud team regardless of age, channel, or payment type, so fraud expertise is always applied first. If a fraud dispute is also past `REGULATORY_LIMIT_DAYS`, the fraud team notifies compliance as a procedural step.
- **DR-02** before **DR-05**: over 365 days always escalates to compliance; 31–365 days is a compliance review. The two are mutually exclusive in effect.
- **DR-03 / DR-04** sit above the type-specific rules: a high-value dispute, or any business dispute within the review window, escalates to senior ops before type handling is considered. A business dispute older than 30 days falls through to DR-05.
- **DR-06** catches internal-transfer non-receipts (ledger issues) before the general non-receipt rules.
- **DR-07** only refunds settled (`SUCCESS`) duplicates within SLA; a pending or failed duplicate is investigated instead (via DR-11 or DR-12).
- **DR-09** has an effective window of 4–30 days (over 30 is caught by DR-05; internal transfers by DR-06). **DR-10** is effectively ≤30 days for the same reason.
- **DR-12** guarantees totality, covering `disputeType = OTHER`, non-settled or aged-8–30 duplicates, retail accounts aged 6–30 days, and any `PRIVATE_BANKING`/`PERSONAL` combination not caught above.

### Determinism & coverage check

- **Exactly one output:** evaluation stops at the first match, so no input receives two outcomes.
- **Total coverage:** DR-12 has no condition, so no input falls through with zero outcomes.
- **No dead values:** every `action`, `route`, and `priority` value is reachable, and every constant is used.

---

## Revision note (for re-freeze)

This revision resolved the open decisions from the prior draft. The following are policy choices baked in here; confirm them at re-freeze:

- **Routes.** `SENIOR_OPS` and `COMPLIANCE` were added to the `route` set; the draft's "Internal Operations" maps to `FRONTLINE`.
- **Ordering.** Rules are first-match-wins with a default; the severity order (fraud → regulatory → high-value → business → aging → internal-ledger → type-specific → retail → default) defines behaviour.
- **Business escalation.** Business disputes within 30 days escalate to senior ops (DR-04), overriding the duplicate-refund path.
- **High value.** DR-03 (`amount >= HIGH_VALUE_THRESHOLD` → senior ops / HIGH) sits above the aging rule, so a high-value aged item escalates rather than going to compliance.
- **Internal transfers.** Internal-transfer non-receipts route to `LEDGER_CONTROL` (DR-06).
- **Refund safety.** Duplicate refunds are gated on `transactionStatus = SUCCESS` (DR-07).
- **Escalation tier.** All escalations share priority `HIGH`; there is no separate "immediate" tier. Add an `action` or `priority` value if one is required.
- **Constants.** Threshold values 5 / 30 / 365 were carried over from the draft as named constants; confirm the values.
- **Owner role** was aligned to "Business Analyst" to match the rest of the spec pack.

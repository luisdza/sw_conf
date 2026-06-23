# Test Cases — Dispute Triage System (UC1)

**Purpose:** Turn each requirement and decision rule into verifiable Given/When/Then
acceptance criteria that map mechanically to Vitest.
**Owner:** Test Architect
**Last updated:** 2026-06-22
**Covers:** Feature-1 (Capture → Validate → Lookup → Triage → Explain), Feature-2 (Result,
Queue, Detail, Audit, simulated routing publish).

> Every case cites the `REQ-*` it verifies and the `DR-*` it exercises, and references the
> frozen spine [`decision_rules.md`](decision_rules.md). Each `TC-*` id is the name of a
> Vitest test in `backend/src/**`. Threshold constants are quoted from
> [`decision_rules.md`](decision_rules.md): `HIGH_VALUE_THRESHOLD = 100000`,
> `DISPUTE_MAX_DAYS = 90`, `AGING_DAYS = 3`, `COMPLIANCE_REVIEW_DAYS = 30`,
> `REGULATORY_LIMIT_DAYS = 365`.

## Test data conventions

- **Baseline context** (falls through to DR-14 on its own): `transactionAmount = 0`,
  `transactionType = EFT`, `disputeType = OTHER`, `transactionStatus = PENDING`,
  `disputeAgeDays = 0`, `customerType = PERSONAL`. Each case overrides only what it needs.
- `accountType` is never part of the triage context — see TC-ACCT-01.
- Engine tests assert **all three output axes** (`disposition`, `route`, `priority`) **and**
  the matched `ruleId`.

---

## 1. Per-rule outcomes (one per DR) — `recommend.test.ts`

| TC | GIVEN (overrides on baseline) | WHEN | THEN disposition / route / priority / ruleId | Verifies |
| -- | ----------------------------- | ---- | -------------------------------------------- | -------- |
| **TC-DR-01** | `disputeType = UNAUTHORISED` | triage runs | `ESCALATE / FRAUD_TEAM / HIGH / DR-01` | REQ-TRG-001, DR-01 |
| **TC-DR-02** | `disputeType = DUPLICATE`, `disputeAgeDays = 366` | triage runs | `ESCALATE / COMPLIANCE / HIGH / DR-02` | REQ-TRG-002, DR-02 |
| **TC-DR-03** | `disputeType = DUPLICATE`, `transactionAmount = 100000` | triage runs | `ESCALATE / SENIOR_OPS / HIGH / DR-03` | REQ-TRG-003, DR-03 |
| **TC-DR-04** | `customerType = BUSINESS`, `disputeAgeDays = 10` | triage runs | `ESCALATE / SENIOR_OPS / HIGH / DR-04` | REQ-TRG-004, DR-04 |
| **TC-DR-05** | `disputeType = DUPLICATE`, `disputeAgeDays = 31` | triage runs | `REFER / COMPLIANCE / MEDIUM / DR-05` | REQ-TRG-005, DR-05 |
| **TC-DR-06** | `disputeType = NON_RECEIPT`, `transactionType = INTERNAL` | triage runs | `INVESTIGATE / LEDGER_CONTROL / MEDIUM / DR-06` | REQ-TRG-006, DR-06 |
| **TC-DR-07** | `disputeType = DUPLICATE`, `transactionStatus = SUCCESS`, `transactionAmount = 50000` | triage runs | `RESOLVE_NOW / FRONTLINE / LOW / DR-07` | REQ-TRG-007, DR-07 |
| **TC-DR-08** | `disputeType = DUPLICATE`, `transactionStatus = PENDING` | triage runs | `INVESTIGATE / PAYMENTS_PROCESSING / MEDIUM / DR-08` | REQ-TRG-008, DR-08 |
| **TC-DR-09** | `disputeType = FAILED_TRANSFER`, `transactionStatus = FAILED` | triage runs | `RESOLVE_NOW / FRONTLINE / LOW / DR-09` | REQ-TRG-009, DR-09 |
| **TC-DR-10** | `disputeType = FAILED_TRANSFER`, `transactionStatus = SUCCESS` | triage runs | `INVESTIGATE / PAYMENTS_PROCESSING / MEDIUM / DR-10` | REQ-TRG-010, DR-10 |
| **TC-DR-11** | `disputeType = NON_RECEIPT`, `transactionType = EFT`, `disputeAgeDays = 2` | triage runs | `INVESTIGATE / FRONTLINE / LOW / DR-11` | REQ-TRG-011, DR-11 |
| **TC-DR-12** | `disputeType = NON_RECEIPT`, `transactionType = EFT`, `disputeAgeDays = 4` | triage runs | `INVESTIGATE / PAYMENTS_PROCESSING / MEDIUM / DR-12` | REQ-TRG-012, DR-12 |
| **TC-DR-13** | `disputeType = OTHER`, `transactionType = CARD` | triage runs | `INVESTIGATE / CARD_OPS / MEDIUM / DR-13` | REQ-TRG-013, DR-13 |
| **TC-DR-13b** | `disputeType = AUTHORIZATION_ISSUE`, `transactionType = EFT` | triage runs | `INVESTIGATE / CARD_OPS / MEDIUM / DR-13` | REQ-TRG-013, DR-13 |
| **TC-DR-14** | baseline (`disputeType = OTHER`, `EFT`) | triage runs | `INVESTIGATE / FRONTLINE / MEDIUM / DR-14` | REQ-TRG-014, DR-14 |
| **TC-DR-14b** | `disputeType = FAILED_TRANSFER`, `transactionStatus = PENDING` | triage runs | `INVESTIGATE / FRONTLINE / MEDIUM / DR-14` | REQ-TRG-014, DR-14 |

---

## 2. Precedence (first-match-wins) — `recommend.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-PR-01** | `disputeType = UNAUTHORISED` **and** `transactionAmount = 500000`, `disputeAgeDays = 400`, `customerType = BUSINESS`, `transactionType = CARD` | triage runs | `… / DR-01` — DR-01 beats every other rule | DR-01 precedence |
| **TC-PR-02** | `disputeType = DUPLICATE`, `transactionAmount = 500000`, `customerType = BUSINESS`, `disputeAgeDays = 400` | triage runs | `ESCALATE / COMPLIANCE / HIGH / DR-02` — regulatory age beats value & business (**not** SENIOR_OPS) | DR-02 > DR-03/04 |
| **TC-PR-03** | `disputeType = DUPLICATE`, `transactionStatus = SUCCESS`, `transactionAmount = 99999` | triage runs | `RESOLVE_NOW / FRONTLINE / LOW / DR-07` — settled sub-threshold duplicate auto-resolves | DR-07 > DR-08 |
| **TC-PR-04** | `disputeType = NON_RECEIPT`, `transactionType = INTERNAL`, `disputeAgeDays = 1` | triage runs | `INVESTIGATE / LEDGER_CONTROL / MEDIUM / DR-06` — internal non-receipt to ledger control | DR-06 > DR-11/12 |
| **TC-PR-05** | `disputeType = NON_RECEIPT`, `transactionType = EFT`, `disputeAgeDays = 3` | triage runs | `INVESTIGATE / FRONTLINE / LOW / DR-11` — fresh non-receipt to frontline | DR-11 > DR-12 |

---

## 3. Boundary values on the constants — `recommend.test.ts` + `validate.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-BV-01a** | `disputeType = DUPLICATE`, `transactionAmount = 99999` | triage runs | ruleId = `DR-08` (below `HIGH_VALUE_THRESHOLD`) | DR-03 `>=` boundary |
| **TC-BV-01b** | `disputeType = DUPLICATE`, `transactionAmount = 100000` | triage runs | ruleId = `DR-03` (at threshold; `>=`) | DR-03 `>=` boundary |
| **TC-BV-01c** | `disputeType = DUPLICATE`, `transactionAmount = 100001` | triage runs | ruleId = `DR-03` | DR-03 boundary |
| **TC-BV-02** | `disputeType = NON_RECEIPT`, `EFT`, `disputeAgeDays ∈ {3, 4}` | triage runs | age 3 → `DR-11`; age 4 → `DR-12` | `AGING_DAYS` boundary |
| **TC-BV-03** | `customerType = BUSINESS`, `DUPLICATE`, `disputeAgeDays ∈ {30, 31}` | triage runs | age 30 → `DR-04`; age 31 → `DR-05` | `COMPLIANCE_REVIEW_DAYS` boundary |
| **TC-BV-04** | `disputeType = DUPLICATE`, `disputeAgeDays ∈ {365, 366}` | triage runs | age 365 → `DR-05`; age 366 → `DR-02` | `REGULATORY_LIMIT_DAYS` boundary |
| **TC-BV-05a** | `transactionDate = 2026-03-01`, `disputeCaptureDate = 2026-05-30` (90-day filing) | validation runs | accepted (no error) | REQ-VAL-001 boundary |
| **TC-BV-05b** | `transactionDate = 2026-03-01`, `disputeCaptureDate = 2026-05-31` (91-day filing) | validation runs | rejected `DISPUTE_TOO_OLD` | REQ-VAL-001 boundary |

---

## 4. Validation, lookup & calculation — `validate.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-VAL-01a** | a complete submission | required-field check | no missing fields | REQ-CAP-001/003 |
| **TC-VAL-01b** | submission missing `customerId`, `accountNumber`, `transactionDate`, blank `disputeReason` | required-field check | each missing field is named; present fields are not | REQ-CAP-002/003 |
| **TC-VAL-02** | `transactionDate = 2026-03-01`, `disputeCaptureDate = 2026-05-31` | validation runs | `DISPUTE_TOO_OLD`, triage not run | REQ-VAL-001 |
| **TC-VAL-03** | `disputeCaptureDate (2026-06-01)` earlier than `transactionDate (2026-06-10)` | validation runs | `INVALID_CAPTURE_DATE` | REQ-VAL-002 |
| **TC-CALC-01** | `transactionDate`/reference-date pairs | derive `disputeAgeDays` | whole-day difference (0, 3, 365) | REQ-CALC-001 |
| **TC-LKP-01a** | `disputeReason = "Charged Twice"` / `"fraud"` | reason→type lookup | `DUPLICATE` / `UNAUTHORISED` | REQ-LKP-005 |
| **TC-LKP-01b** | `disputeReason = "something totally unmapped"` | reason→type lookup | `OTHER` | REQ-LKP-006 |

### Capture pipeline (advisory orchestration) — `pipeline/capture.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-VAL-PIPE-01** | submission missing `customerId`/`accountNumber` | `captureAndTriage` | `MISSING_FIELDS` (lists fields); **no** persist, **no** publish (triage never ran) | REQ-CAP-002, REQ-RST-002 |
| **TC-VAL-PIPE-02** | filing age 91 days | `captureAndTriage` | `DISPUTE_TOO_OLD`; no persist/publish | REQ-VAL-001, REQ-RST-002 |
| **TC-VAL-PIPE-03** | `transactionStatus = "NOT_A_STATUS"` | `captureAndTriage` | `INVALID_ENUM`; no persist/publish | REQ-LKP-004 |

> Lookups REQ-LKP-001..004 (`customerType`, `accountType`, `transactionId`,
> `transactionType`/`transactionStatus`) are resolved at the API boundary and exercised by
> the seed fixtures (each fixture carries resolved values); they are mapped in the
> traceability matrix to TC-SEED-01 and the API capture endpoint.

---

## 5. Explainability, cardinality & advisory — `recommend.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-EXP-01** | any context (`UNAUTHORISED`) | triage runs | result carries `ruleId`, non-empty `decisionReason`, and an `inputs` snapshot equal to (but not aliasing) the context | REQ-EXP-001/002/003 |
| **TC-CARD-01** | baseline | triage runs | `disposition ∈ Dispositions`, `route ∈ Routes`, `priority ∈ Priorities`, `ruleId ∈ RuleIds` — exactly one each | REQ-RST-001 |
| **TC-ACCT-01** | five scenarios, each run for `accountType ∈ {SAVINGS, CURRENT}` | triage runs | identical decision for both `accountType` values | accountType display-only (REQ-LKP-002) |
| **TC-RST-ADV** | a valid capture (via `captureAndTriage`, `pipeline/capture.test.ts`) | the dispute is triaged | **exactly one** record persisted and **exactly one** routing message published (publish-after-persist), exactly one value per axis, `inputs` excludes `accountType` — **no** other action | REQ-RST-001/002 |
| **TC-RST-ADV-b** | a valid capture run for both `accountType` values | `captureAndTriage` | identical decision | REQ-LKP-002 |
| **TC-RST-ADV-c** | valid filing but `referenceDate` a year later (re-triage) | `captureAndTriage` | reaches `DR-02` (age > 365) | Reconciliation 1 |

---

## 6. Totality grid — `recommend.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-TOT-00** | the cartesian grid `transactionType(3) × disputeType(6) × transactionStatus(3) × customerType(3) × amount{0,99999,100000,100001,500000} × age{0,3,4,30,31,90,365,366}` | grid built | exactly **6 480** contexts | totality scope |
| **TC-TOT-01** | every grid context | `recommend()` run twice per context | exactly one valid `disposition`/`route`/`priority`, a valid `ruleId`, identical output across the two runs (determinism), **every DR-01…DR-14 fires at least once**, and all four dispositions appear; the per-DR distribution is printed | REQ-RST-001, totality & determinism, DR reachability |
| **TC-TOT-02** | the rule list | inspect `RULES` | exactly 14 ordered rules ending in the unconditional DR-14 default | first-match-wins structure |

> **System-level reachability note (Reconciliation 1):** the grid runs the engine over its
> full input domain, where DR-02 (`age > 365`) fires. Under REQ-VAL-001 (filing within 90
> days), `disputeAgeDays` cannot exceed 90 at capture, so **DR-02 (and the >90 portion of
> DR-05) is unreachable at capture-time triage** and only reachable on later re-triage. This
> is flagged — not silently changed — in [`../CONSISTENCY-REPORT.md`](../CONSISTENCY-REPORT.md).

---

## 7. Routing publish & seed coverage — `publisher.test.ts`, `seed-data.test.ts`

| TC | GIVEN | WHEN | THEN | Verifies |
| -- | ----- | ---- | ---- | -------- |
| **TC-MSG-01** | route + priority | build routing key | `dispute.<route>.<priority>` (lower-cased) | simulated routing (Reconciliation 4) |
| **TC-MSG-02** | a DR-01 decision | `publishTriage` | message recorded with route `FRAUD_TEAM`, priority `HIGH`, ruleId `DR-01`; no broker required | REQ-RST-002, routing publish |
| **TC-SEED-01** | each of the 14 seed fixtures | `recommend()` | lands on the fixture's documented `expectedDR` | seed correctness |
| **TC-SEED-02** | all seed fixtures | `recommend()` | all four dispositions present | seed coverage |
| **TC-SEED-03** | all seed fixtures | inspect `expectedDR` | DR-01 … DR-14 each represented | seed coverage |

---

## Coverage summary

- **Decision rules:** DR-01 … DR-14 each have ≥1 dedicated per-rule test **and** appear in
  the totality grid (each fires ≥1 time) — see [`traceability-matrix.md`](traceability-matrix.md).
- **Requirements:** every `REQ-*` maps to ≥1 TC (REQ-TRG via TC-DR-*, REQ-VAL/CAP/LKP/CALC
  via TC-VAL/CALC/LKP-*, REQ-EXP/RST via TC-EXP/CARD/RST/MSG-*).
- **Edge & negative:** boundaries (TC-BV-*), precedence (TC-PR-*), rejection paths
  (TC-VAL-02/03), unknown lookup (TC-LKP-01b), display-only field (TC-ACCT-01).

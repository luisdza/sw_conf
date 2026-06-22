# Decision Rules — Dispute Triage (UC1)

**Owner:** Feature Analyst + Architect, co-signed by the Facilitator.

**Status:** FROZEN before parallel drafting. Every requirement, test case, endpoint, and screen references this file. Changes require a re-freeze and a note to all roles.

## Purpose

Given one captured dispute, return exactly one **disposition**, exactly one **route**, and exactly one **priority** — and record _why_. The system is advisory: it recommends; a human action.

## Scope & assumptions

- Channel: call-centre / ops capture form
- User has been authenticated
- Local payments (currency: **ZAR** throughout)

---

## Data contract

### Form (Captured by operator / not inputed into system)

- customerId
- transactionId
- description
- operatorId
- accountNumber (to lookup customerType + accountType)
- amount
- authentication questions

Operator performs lookup on this transaction.

### Inputs (the triage context)

| Variable            | Type    | Values                                                          |
| ------------------- | ------- | --------------------------------------------------------------- |
| `amount`            | decimal |                                                                 |
| `accountType`       | enum    | `SAVINGS / CURRENT`                                             |
| `transactionDate`   | Date    |                                                                 |
| `disputeType`       | enum    | `FRAUD / DUPLICATE / NON_RECEIPT / AUTHORIZATION_ISSUE / OTHER` |
| `paymentType`       | enum    | `CARD / EFT / INTERNAL`                                         |
| `issueType`         | enum    | `Duplicate Debit / Missing Payment / Failed Transfer / Other`   |
| `transactionStatus` | enum    | `SUCCESS / FAILED / PENDING`                                    |
| `disputeAgeDays`    | integer |                                                                 |
| `customerType`      | enum    | `BUSINESS / PERSONAL / PRIVATE_BANKING`                         |

## Thresholds (constants)

| Constant               | Value   |
| ---------------------- | ------- |
| `HIGH_VALUE_THRESHOLD` | 100 000 |
| `AGING_DAYS`           | 3       |
| `SLA_BREACH_DAYS`      | 7       |

## Outputs (closed sets)

| Axis          | Values                                                                     |
| ------------- | -------------------------------------------------------------------------- |
| `action`      | `RESOLVE_NOW` `INVESTIGATE` `ESCALATE` `REFER`                             |
| `route`       | `FRONTLINE` `PAYMENTS_PROCESSING` `CARD_OPS` `FRAUD_TEAM` `LEDGER_CONTROL` |
| `priority`    | `HIGH` `MEDIUM` `LOW`                                                      

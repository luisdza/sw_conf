

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

# Day 1 — Role Deliverables

At the end of Day 1 each role hands over one or more spec-pack artefacts. Together they form the complete input Kiro consumes on Day 2. The BA's requirements are the spine: every other artefact references the requirement IDs the BA assigns, so a screen, an endpoint, a test, and a slice of the data model can each be traced back to the requirement it satisfies.

## Shared rules (every artefact)

- The BA assigns stable IDs (`REQ-###`). Every other doc references those IDs rather than restating the requirement.
- Markdown, committed at the exact path shown in the spec pack.
- Each doc opens with: purpose, owner, last-updated, and the feature(s) it covers.
- Open questions live in one explicit "Open questions" block per doc — not scattered as inline TODOs.
- Written for Kiro to read: declarative, unambiguous, one statement per line where it helps.

## 1. Business Analyst — `docs/requirements.md`

The spine of the pack; everything else derives from it. Deliver functional requirements in EARS format, grouped by feature, each with an ID and a priority.

Ready when:
- [ ] Every requirement uses an EARS pattern — ubiquitous ("The system shall…"), event-driven ("When…, the system shall…"), state-driven ("While…, the system shall…"), unwanted ("If…, then the system shall…"), or optional ("Where…, the system shall…").
- [ ] Each requirement has a unique `REQ-###` ID and a priority (MoSCoW or similar).
- [ ] Requirements are grouped under named features that match the folder names under `.kiro/specs/`.
- [ ] Non-functional requirements (performance, security, availability, compliance) are captured and marked as such.
- [ ] Assumptions, dependencies, and explicit out-of-scope items are listed.
- [ ] No requirement bundles two behaviours, uses "and/or", or relies on vague verbs ("handle", "support").

## 2. Test Architect — `docs/test-cases.md`

Turns each requirement into verifiable acceptance criteria. Deliver Given/When/Then scenarios mapped to requirement IDs, plus the edge and negative cases.

Ready when:
- [ ] Every Must/Should requirement has at least one scenario that references its `REQ-###`.
- [ ] Scenarios are in Given/When/Then form (the same shape Kiro carries into `specs/feature-X/requirements.md`).
- [ ] Happy path, boundary values, and negative/error cases are each covered.
- [ ] Test data and preconditions are named for each scenario.
- [ ] A coverage table maps `REQ-###` IDs to scenarios and flags any requirement with no test.

## 3. API Designer — `docs/api-spec.md`

The contract for every endpoint the features need. Deliver per-endpoint specifications consistent with the data model.

Ready when:
- [ ] Every endpoint lists method, path, auth, request schema, response schema, and all status/error codes.
- [ ] Request and response fields map to entities defined in `architecture.md` — no orphan fields.
- [ ] Each endpoint traces to the `REQ-###` it serves.
- [ ] Shared conventions (error format, pagination, versioning, auth scheme) are defined once, up front.
- [ ] At least one example request and response per endpoint.

## 4. UI/UX Designer — `docs/ui-spec.md`

Defines every screen and its states. Deliver screen-by-screen specifications and the flow between them.

Ready when:
- [ ] Every screen lists its purpose, key components, and the `REQ-###` it satisfies.
- [ ] All states are specified: loading, empty, error, success, and disabled/permission states.
- [ ] Field-level validation rules and user-facing messages are defined and consistent with `test-cases.md`.
- [ ] Navigation between screens is explicit — entry points, transitions, and exits.
- [ ] Data each screen reads or writes maps to endpoints in `api-spec.md`.
- [ ] Accessibility and responsive expectations are stated.

## 5. Architect — `docs/architecture.md`

System design plus the canonical data model everything else points to. Deliver the component design and the data model.

Ready when:
- [ ] Components/services are listed with responsibilities and how they interact.
- [ ] The data model defines every entity, its attributes and types, and the relationships between them — this is the source of truth `api-spec.md` and `ui-spec.md` reference.
- [ ] Key flows for the high-priority requirements are shown as sequence or flow diagrams.
- [ ] Integration points and external dependencies are identified.
- [ ] Cross-cutting concerns are addressed: auth, security, scaling, observability.
- [ ] Technology choices agree with `.kiro/steering/tech.md` — no conflict between the two.

## 6. Harness Engineer — `.kiro/steering/`, `.kiro/hooks/`, `.kiro/skills/`

Makes the repo ready for Kiro to consume the pack. Works in parallel with the other five.

Ready when:
- [ ] `product.md` — what's being built and why, aligned with the scope in `requirements.md`.
- [ ] `tech.md` — stack, versions, and key technical decisions, consistent with `architecture.md`.
- [ ] `structure.md` — the file/folder organisation Kiro should follow.
- [ ] `conventions.md` — coding rules (naming, formatting, error handling, test style).
- [ ] Custom steering added where the project needs it (e.g. `api-standards.md`, `testing.md`).
- [ ] Hooks in place: `lint-on-save`, `test-on-create`, and any others the team relies on.
- [ ] Custom skills added if required; otherwise the folder is intentionally left empty.
- [ ] Feature directories under `.kiro/specs/` are scaffolded to match the BA's feature grouping — Kiro fills in `requirements.md`, `design.md`, and `tasks.md` on Day 2.

## Hand-off check (end of Day 1)

The pack is ready to hand to Kiro when all six artefacts exist at their paths, every `REQ-###` is referenced by at least a test case plus an endpoint or a screen, `architecture.md` and `tech.md` don't conflict, and the steering files load cleanly. Day 2 is Kiro's.

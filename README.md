# sw_conf

The spec pack is the collection of artefacts that teams produce on Day 1. It is the input to Kiro on Day 2.

Contents
docs/
├── requirements.md      # EARS-format requirements (BA)
├── test-cases.md        # Acceptance criteria (Test Architect)
├── api-spec.md          # Endpoint specifications (API Designer)
├── ui-spec.md           # Screen specifications (UI/UX Designer)
└── architecture.md      # System design + data model (Architect)

.kiro/
├── steering/
│   ├── product.md       # Project context (Harness Engineer)
│   ├── tech.md          # Stack decisions (Harness Engineer)
│   ├── structure.md     # File organisation (Harness Engineer)
│   ├── conventions.md   # Coding rules (Harness Engineer)
│   └── *.md             # Custom steering (API standards, testing, etc.)
├── specs/
│   ├── feature-1/
│   │   ├── requirements.md
│   │   ├── design.md
│   │   └── tasks.md
│   └── feature-2/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── hooks/
│   ├── lint-on-save.md
│   └── test-on-create.md
└── skills/
    └── (optional custom skills)

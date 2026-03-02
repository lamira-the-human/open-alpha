# Open Alpha Roadmap

## Vision

Build the Wikipedia of learning: an open, crowdsourced knowledge graph and AI education engine. The structured knowledge lives here. The learning experience is rendered just-in-time by AI -- on any surface, for any learner.

See [VISION.md](./VISION.md) for the full picture.

---

## Phase 1: Foundation ✅

**Goal**: Establish core infrastructure and basic functionality

- [x] Project documentation and architecture
- [x] ATXP service integration (LLM Gateway) + SQLite for local dev
- [x] User authentication (email-based)
- [x] Database schema for users, progress, sessions
- [x] Basic Express.js API structure
- [x] Vercel serverless deployment
- [x] Turso edge database

**Success Criteria**: Can create user accounts and connect to ATXP services

---

## Phase 2: Student Experience ✅

**Goal**: Deliver core learning functionality for students

- [x] Grade level selection (K-12)
- [x] Subject selection (Math, Reading, Science)
- [x] AI tutor chat interface
- [x] Concept introduction and explanation
- [x] Practice problem generation
- [x] Answer checking and feedback
- [x] Mastery checkpoints (80% to advance)
- [x] Progress dashboard

**Success Criteria**: Student can learn a concept and demonstrate mastery

---

## Phase 3: Parent Experience ✅

**Goal**: Enable parents to monitor and support their children

- [x] Parent account creation
- [x] Parent-child account linking (invite codes)
- [x] Read-only progress viewing
- [x] Session history viewing
- [x] Parent AI Coach integration
- [x] Parent dashboard

**Success Criteria**: Parent can view child's progress and get coaching support

---

## Phase 4: Open the Knowledge Graph

**Goal**: Move curriculum from hardcoded TypeScript to a contributor-friendly format

- [ ] Extract curriculum data to flat files (JSON or YAML) that anyone can PR against
- [ ] Contribution guide for adding concepts, subjects, and prerequisite chains
- [ ] Concept metadata enrichment (learning objectives, example types, difficulty calibration)
- [ ] Validation tooling for curriculum PRs (prerequisite cycles, grade level consistency)
- [ ] First community-contributed subject

**Success Criteria**: Someone outside the core team can add a concept or subject via PR

---

## Phase 5: API-First

**Goal**: Make the API the primary interface so agents and third parties can build on it

- [ ] API documentation (OpenAPI / simple reference docs)
- [ ] Stable, versioned API contract
- [ ] Public curriculum read API (no auth required for concept graph data)
- [ ] Progress API for authenticated integrations
- [ ] Rate limiting and usage tracking

**Success Criteria**: A third-party agent or app can consume the curriculum and track learner progress

---

## Phase 6: Polish

**Goal**: Production-ready quality and user experience

- [ ] Mobile responsive design
- [ ] Loading states and error handling
- [ ] Performance optimization
- [ ] Accessibility improvements
- [ ] User testing and feedback integration

**Success Criteria**: Platform works well on all devices with good UX

---

## Phase 7: Scale

**Goal**: Expand content and capabilities through community

- [ ] Additional subjects via community contributions
- [ ] Expanded curriculum depth (more concepts per subject)
- [ ] Multi-language support (concept metadata in multiple languages)
- [ ] Advanced analytics for parents
- [ ] ATXP ecosystem integrations (tools, skills, services)

**Success Criteria**: Platform supports diverse learners, content, and integrations

---

## Future Considerations

Items intentionally deferred -- any of these could become the next priority based on community interest:

- **ATXP/Google OAuth authentication** - Simplified onboarding
- **Surface-agnostic content rendering** - Audio tutoring, VR classrooms, chat integrations
- **Teacher/classroom features** - Cohort management, assignments, class progress
- **LMS integrations** - Canvas, Schoology, Google Classroom
- **Offline mode** - Cached concept data + local progress sync
- **Voice interface** - Audio-first tutoring experience
- **Native mobile applications** - iOS/Android apps
- **Advanced reporting/analytics** - Learning insights, struggle detection
- **Collaborative learning** - Study groups, peer tutoring
- **Content versioning** - Track how concepts evolve over time

# Open Alpha Vision

## The Idea

Open Alpha is the Wikipedia of learning -- an open, crowdsourced knowledge graph and AI education engine that anyone can use, contribute to, and build on.

The structured knowledge lives here. The actual learning experience is rendered just-in-time by AI on whatever surface the learner uses -- a laptop, a phone, headphones, or something that doesn't exist yet.

## How It Works Today

Students sign up, pick a grade (K-12) and subject (Math, Reading, Science), and chat with an AI tutor that adapts to their level. There are no static lessons. The AI generates explanations, examples, and practice problems dynamically based on structured concept metadata and the student's progress history.

To advance, students take 5-question quizzes and must score 80% or higher. Mastered concepts unlock the next ones in a prerequisite chain.

Parents link to their child's account and get read-only progress views plus a separate AI "coach" that helps them support learning at home.

Everything runs on free infrastructure tiers. Zero cost.

## What Makes This Different

**Content is never written -- it's always generated.** The platform stores structured knowledge (concepts, prerequisites, grade levels, learning objectives) and lets AI render it into the right experience for each learner. A 3rd grader and a 7th grader learning fractions get fundamentally different explanations from the same concept node.

**The curriculum graph is the product, not the UI.** The React frontend is a reference implementation. The enduring value is the structured concept trees, prerequisite relationships, mastery models, and pedagogical metadata. Other agents, apps, and surfaces will consume this data and render it however makes sense for their users.

**Open source means open knowledge.** Anyone can contribute concepts, improve prerequisite chains, add subjects, or fix pedagogical gaps. Humans bring domain expertise and teaching intuition. AI agents help build features and expand content. Together they move faster than any traditional ed-tech team.

## Design Principles

1. **Simple over clever.** Like Wikipedia, the core data model should be straightforward enough that anyone can understand and contribute to it. A concept has a name, description, prerequisites, and grade level. That's it.

2. **Structured data, rendered just-in-time.** Don't write lessons. Write metadata that lets AI generate the right lesson for each learner, on any surface, in any language, at any time.

3. **API-first.** The platform is a data layer and API. The frontend is one consumer among many. Design for agents and third-party tools to integrate, not just human browsers.

4. **Free and open.** No subscriptions, no ads, no data selling. Run on free tiers. Keep the barrier to learning at zero.

5. **Small chunks, shipped often.** This project grows through many small contributions over time. Commit early. Ship often. Let others build on your work.

## Architecture Layers

```
┌─────────────────────────────────────────────────┐
│              Surfaces (many, evolving)           │
│  Web app, mobile, audio, VR, third-party agents │
│  "Not necessarily our platform"                 │
└──────────────────────┬──────────────────────────┘
                       │ consume
┌──────────────────────▼──────────────────────────┐
│              Open Alpha API                      │
│  Curriculum graph, progress tracking, mastery    │
│  AI tutoring, parent coaching                    │
└──────────────────────┬──────────────────────────┘
                       │ powered by
┌──────────────────────▼──────────────────────────┐
│              Knowledge Graph                     │
│  Concepts, prerequisites, grade levels           │
│  Subjects, learning objectives                   │
│  Crowdsourced, version-controlled                │
└──────────────────────┬──────────────────────────┘
                       │ stored in
┌──────────────────────▼──────────────────────────┐
│              Infrastructure                      │
│  Turso (data), ATXP LLM Gateway (AI)            │
│  Vercel (hosting), free tiers                    │
└─────────────────────────────────────────────────┘
```

## What the Curriculum Graph Looks Like

Each concept is a node in a directed acyclic graph:

```
{
  "id": "math-fractions-intro",
  "name": "Introduction to Fractions",
  "description": "Understanding parts of a whole",
  "prerequisites": ["math-division"],
  "gradeLevel": 4
}
```

Prerequisites form chains: Counting -> Addition -> Multiplication -> Division -> Fractions -> Decimals -> Algebra -> ...

The graph is currently ~50 concepts across 3 subjects. It can grow to thousands through contributions.

## How Contributing Works

**Add a concept:** Define a new node with its prerequisites and grade level. Submit a PR.

**Add a subject:** Create a new concept tree. Start small -- even 5 concepts with a clear prerequisite chain is useful.

**Improve pedagogy:** Refine concept descriptions, adjust grade levels, fix prerequisite gaps. Teaching expertise is as valuable as code.

**Build a surface:** Use the API to create a new way to learn -- a voice tutor, a VR classroom, a mobile app, a Slack bot. The concept data is the same; the experience is yours.

**Add tools and services:** Build on ATXP to add capabilities -- analytics, visualizations, specialized tutoring modes, accessibility features.

## Current State

**Working MVP with:**
- 3 subjects (Math, Reading, Science), K-12
- ~50 concepts with prerequisite chains
- AI tutor chat with grade-adaptive prompts
- Quiz-based mastery model (80% threshold)
- Parent accounts with progress monitoring
- AI parent coach
- Live at open-alpha-eta.vercel.app

**Tech stack:**
- React + Vite (frontend)
- Vercel Serverless Functions (API)
- Turso / SQLite (database)
- ATXP LLM Gateway (AI)

## What's Next

See [ROADMAP.md](./ROADMAP.md) for planned work. The broad direction:

1. Move curriculum data from hardcoded TypeScript to contributor-friendly format
2. Stabilize and document the API for third-party consumers
3. Expand subjects and deepen concept graphs through contributions
4. Build community infrastructure (contribution guides, review processes)
5. Support more surfaces and integrations through ATXP ecosystem

The specifics will evolve. The vision won't: **free, open, AI-powered education that gets better every day because anyone can make it better.**

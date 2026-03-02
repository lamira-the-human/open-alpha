# How I Built This

A running journal of building Open Alpha. Read it like a book -- start at the top, each entry picks up where the last one left off.

---

## January 2026 — Starting from Scratch

We started with a repo that was documentation-only. Good architecture docs, a roadmap with Q1-Q4 2026 dates (which we removed to keep things date-agnostic), and placeholder package.json files. No actual code.

The plan was clear: build an MVP that's 100% powered by ATXP services so there's zero infrastructure cost. Users pay from their own ATXP wallet, and they get $10 free on signup - enough for many hours of learning.

### Why ATXP Everything?

This was the key architectural decision. Instead of spinning up our own Postgres, managing API keys for OpenAI/Anthropic, setting up file storage... we just use ATXP's MCP services for everything:

- **ATXP Database MCP** (`database.mcp.atxp.ai`) - PostgreSQL without the ops headache
- **ATXP LLM Gateway** (`llm.atxp.ai`) - Claude, GPT, Gemini through one OpenAI-compatible API
- **ATXP Filestore** - ready when we need avatars or uploads later

Single billing, single connection string, proven MCP patterns. The user's ATXP wallet covers all costs. We don't touch infrastructure.

### The Backend: Express + TypeScript

Went with Express because it's simple and the `@atxp/express` patterns are well-established. TypeScript for sanity.

**Services layer** (`backend/src/services/`):
- `atxp-db.ts` - Wraps the MCP SDK for database calls. `executeSql()` handles everything.
- `atxp-llm.ts` - Wraps the LLM Gateway with an OpenAI client. Has the tutor and coach system prompts baked in.
- `curriculum.ts` - The K-12 concept trees. This is just data, no AI - defines what concepts exist, their prerequisites, and grade levels.

**Routes** (`backend/src/routes/`):
- `auth.ts` - Signup/login with bcrypt + JWT. Nothing fancy, just works.
- `tutor.ts` - Student AI chat, quiz generation, quiz submission. The tutor prompt adapts to grade level.
- `coach.ts` - Parent AI chat. Different persona - supportive, practical, never does the kid's work.
- `progress.ts` - CRUD for mastery scores. Simple but important.
- `parent.ts` - The linking flow (invite codes) and read-only child progress viewing.

### The Curriculum Structure

This took some thought. We needed to support K-12 across Math, Reading, and Science without overcomplicating things.

Each concept has:
- `id` - like `math-fractions-intro`
- `name` - human readable
- `description` - what the AI tutor uses for context
- `prerequisites` - concept IDs that must be mastered first
- `gradeLevel` - 0 for Kindergarten, 1-12 for grades

The curriculum service has helpers like `getNextConcept()` that finds what a student should learn next based on their completed concepts and grade level.

We kept it simple - about 15-18 concepts per subject spanning K-12. Enough to demonstrate the system without being overwhelming.

### Mastery Model: 80% to Advance

Students don't just "complete" lessons - they demonstrate mastery. The flow:

1. Chat with AI tutor to learn the concept
2. When ready, take a 5-question quiz (AI-generated)
3. Score 80% or higher to mark the concept as mastered
4. Unlock concepts that had this as a prerequisite

We track highest score per concept (no regression). Attempts are counted so we can see if someone is struggling.

### Two AI Personas: Tutor vs Coach

This was important to get right.

**Student Tutor** is encouraging, uses age-appropriate language, celebrates wins, breaks things down when students struggle. The prompt includes grade level, current concept, and progress history so it can adapt.

**Parent Coach** is warm and practical, helps parents understand their child's learning journey, suggests home activities, but never does the child's work. It's a distinct experience - parents aren't learning math, they're learning how to support.

Both use the same LLM Gateway under the hood, just different system prompts.

### Parent-Child Linking

Parents and students have separate accounts. We link them via invite codes:

1. Student generates an 8-character code from their account
2. Parent enters the code in their dashboard
3. Link is established - parent can now view (read-only) child's progress

Parents can see what concepts are mastered, what's in progress, and session history (metadata only, not full chat logs - privacy matters).

### The Frontend: React + Vite

Standard modern React setup. Vite for fast dev experience. No component library - just custom CSS with CSS variables for theming.

Key pages:
- `Landing.tsx` - Marketing page, explains the product
- `Login.tsx` - Handles both student and parent auth, with grade picker for students
- `StudentDashboard.tsx` - Subject cards with progress bars
- `Learn.tsx` - The main learning interface with concept sidebar + chat
- `ParentDashboard.tsx` - Child linking + progress viewing
- `ParentCoach.tsx` - Chat interface for parent support

Shared components:
- `Chat.tsx` - Reusable chat UI (used by both tutor and coach)
- `Quiz.tsx` - The mastery checkpoint experience
- `Progress.tsx` - Various progress visualization components

### Auth: Keep It Simple

JWT tokens with 7-day expiry. Passwords hashed with bcrypt (10 rounds). Token stored in localStorage, sent via Authorization header.

The auth context in React handles loading the user on page load, provides `login()` and `logout()` functions, and wraps everything in a `ProtectedRoute` component for role-based access.

No OAuth, no magic links, no complexity. Email + password works fine for MVP.

### What We Deferred

The plan explicitly listed things to skip for MVP:
- Multi-provider AI configuration UI
- Native mobile apps (responsive web is enough)
- LMS integrations
- Offline mode
- Voice interface
- Advanced analytics

These live in ROADMAP.md as future phases. The MVP is intentionally focused.

---

## January 2026 — Making It Actually Work

The original plan was ATXP everything. Reality had other ideas.

### Database Pivot: ATXP → SQLite

ATXP's Database MCP returned an error: "Legacy Postgres plans, including 'starter', are no longer supported for new databases." Rather than block on this, we pivoted to SQLite with `better-sqlite3`.

**Changes made:**
- Rewrote `atxp-db.ts` to use SQLite instead of MCP calls
- Replaced PostgreSQL's `NOW()` with SQLite's `datetime('now')` across all routes
- Updated setup script to verify SQLite tables instead of `information_schema`
- Database file lives at `backend/data/open-alpha.db`

SQLite is actually better for local dev anyway - no external dependencies, instant setup, easy to reset.

### LLM Gateway: Finding the Right Endpoint

The original code pointed at `https://llm.atxp.ai/v1` but used the wrong auth format. After consulting the actual ATXP docs, turns out it's an OpenAI-compatible API - just pass the connection string as the bearer token.

The tutor chat and parent coach both work now. Response times are good.

### Quiz Generation Bug

The LLM returns JSON wrapped in markdown code blocks (` ```json...``` `). Added extraction logic to strip those before parsing. Quiz generation now works reliably.

### Quiz Scoring Bug

Found a scoring bug where the last correct answer was counted twice, giving scores like 120% (6/5 correct). The issue was in `handleAnswer` incrementing `correctCount`, then `handleNext` adding 1 again for the last question. Fixed by removing the double-count.

### Status After This Session

Everything in Phases 1-3 of the roadmap is now complete and tested:
- Student signup → subject selection → AI tutor chat → quiz → mastery tracking
- Parent signup → invite code linking → progress viewing → AI coach chat

The app runs locally with `npm run dev`. SQLite for data, ATXP LLM Gateway for AI.

---

## January 2026 — Deploying to Production

Time to get this thing live. Local dev is great, but we need a real URL.

### The Stack Decision: Vercel + Turso

**Vercel** was the obvious choice for hosting:
- Free tier is generous
- Handles both the React frontend and API routes
- GitHub integration means push-to-deploy

**Turso** for the database:
- SQLite-compatible (our local dev used SQLite, so minimal changes)
- Edge-ready - low latency globally
- Free tier works for MVP

### Architecture Changes

The app needed restructuring for Vercel's serverless model:

**Before (Express.js):**
```
backend/src/routes/auth.ts → Express router
```

**After (Vercel API Routes):**
```
api/auth/login.ts → Serverless function
api/auth/signup.ts → Serverless function
```

Each API endpoint became its own file exporting HTTP method handlers (`POST`, `GET`, etc.).

### The Deployment Journey

Not everything went smoothly:

1. **Root directory confusion** - Vercel was set to build from `/backend` instead of repo root. Frontend couldn't be found.

2. **ES Module issues** - Node.js needed `"type": "module"` in package.json, plus `.js` extensions on all relative imports. Spent time adding `.js` to every `import { x } from '../_lib/db'` statement.

3. **Auth token formatting** - The Turso auth token got saved with line breaks in Vercel's env vars. Invalid HTTP header. Had to re-enter it as a single line.

### Configuration Files

**vercel.json:**
```json
{
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

**Environment variables in Vercel:**
- `TURSO_DATABASE_URL` - libsql://your-db.turso.io
- `TURSO_AUTH_TOKEN` - JWT token from Turso CLI
- `ATXP_CONNECTION_STRING` - For the LLM Gateway
- `JWT_SECRET` - For signing auth tokens
- `ADMIN_INIT_KEY` - For the DB init endpoint

### Database Initialization

Created a protected endpoint at `/api/db/init` that runs the schema creation. Hit it once after deploy:

```bash
curl -X POST https://open-alpha-eta.vercel.app/api/db/init \
  -H "Authorization: Bearer $ADMIN_INIT_KEY"
```

Tables created: users, parent_links, progress, sessions.

### Status After This Session

**Live at: https://open-alpha-eta.vercel.app**

The full flow works:
- Students sign up, learn with AI tutor, take quizzes, track progress
- Parents sign up, link to children, view progress, chat with AI coach
- All data persists in Turso
- AI powered by ATXP LLM Gateway

Zero monthly infrastructure cost on free tiers.

---

## March 2, 2026 — Stepping Back to See the Bigger Picture

Up to this point, Open Alpha was a K-12 tutoring app. It worked. But we sat down and asked: what is this *really* trying to be?

The answer: **the Wikipedia of learning.**

### The Realization

The most important thing in the repo isn't the React frontend or the Vercel deployment -- it's the curriculum graph. ~50 concepts across 3 subjects, each with prerequisites and grade levels, forming a directed acyclic graph that AI can traverse to teach anyone anything.

That graph is the product. Everything else is a surface that renders it.

### What Changed in Our Thinking

1. **Content is never written, always generated.** There are no static lessons in the codebase -- and there shouldn't be. The AI tutor generates explanations on the fly from concept metadata. That's the right model for a world where learners might be on a laptop, phone, headphones, or VR headset. You can't pre-write content for surfaces that don't exist yet.

2. **The frontend is a reference implementation.** It's useful for bootstrapping and demonstrating, but the real value comes from the API and data layer. Third-party agents will bring learning experiences to humans on whatever surface makes sense. Probably not on our platform.

3. **Open source is the growth engine.** Humans contribute teaching expertise (curriculum structure, prerequisite chains, grade-level calibration). AI agents help build features and expand content. Together they move faster than any traditional ed-tech company.

4. **ATXP ecosystem.** The platform is already built on ATXP's LLM Gateway. As the knowledge graph grows, it becomes a natural place for people and companies to add tools, skills, and services.

### What We Shipped

- **VISION.md** - Design principles, architecture layers, and how contributing works. The north star document.
- **CONTRIBUTING.md** - Practical guide for adding concepts, improving prompts, and building features. Lowers the barrier for first-time contributors.
- **ROADMAP.md** (rewritten) - Added two new phases before "Polish":
  - *Phase 4: Open the Knowledge Graph* - Extract curriculum from hardcoded TypeScript to contributor-friendly files. Build validation tooling. Get the first community-contributed subject.
  - *Phase 5: API-First* - Document and stabilize the API so agents and third parties can build on it.

### What's Next

The immediate priority is making the curriculum contributable. Right now it's a TypeScript array in `api/_lib/curriculum.ts`. That needs to become something anyone can submit a PR against -- probably JSON or YAML files, one per subject, with CI validation for prerequisite consistency.

We're also reconsidering the hosting. Vercel works but might be more infrastructure than we need. GitHub Pages or something simpler could be enough for now while the real value is in the data and API layers.

---

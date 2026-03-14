# Open Alpha — Backlog

Near-term improvements, observations from the first on-demand lesson renders, and ideas to explore. Not prioritised — use this as a scratchpad.

→ For the big-picture roadmap see [ROADMAP.md](./ROADMAP.md).

---

## Lesson rendering

### Bullet-point formatting
The LLM emits `• item` lines as plain text. `FormattedText` splits on `\n\n`/`\n` but doesn't detect list lines, so bullets render as small prose paragraphs with a `•` glyph prefix rather than as a styled list. Fix: detect lines starting with `•` or `- ` inside `FormattedText` and wrap them in `<ul><li>` elements.

### Inline formula / equation highlighting
Key expressions like `Assets = Liabilities + Equity` are buried in prose with no visual treatment. They should be visually distinct — a subtle pill, monospace block, or coloured highlight — so learners can scan for the formula quickly.

### Markdown-aware rendering
The LLM occasionally emits `**bold**` or `*italic*` inline. `FormattedText` doesn't strip or render these. Either scrub the asterisks before rendering or use a minimal markdown renderer (e.g. `marked` or a tiny custom regex pass).

### Visual / infographic explanations
The "See it visually" alternate explanation is currently a text description of a visual. This is the wrong level of abstraction. Better approach:
- Generation prompt produces a *structured data payload* for the visual (key terms, relationships, a central formula, 2–3 annotated callouts) rather than prose
- A dedicated `<LessonInfographic>` component renders that payload as a styled diagram — equation in the centre, components radiating out with labels and short definitions
- The infographic layout/style is fixed in code; only the *content* is LLM-supplied
- This decouples "what the concept is" from "how to draw it" and avoids brittle prose-to-SVG attempts

---

## Lesson generation pipeline

### Pre-warm lessons in the background
Right now the first learner to hit a stub concept pays the 15–30 s generation cost. Fix: when any user loads a subject for the first time, fire-and-forget generation requests for all stub concepts in that subject (after a short stagger to avoid thundering herd). Subsequent visitors get the cached version instantly.

### Generation for sibling concepts
Related: once the accounting equation lesson generates, kick off background generation for Debits and Credits, Chart of Accounts, etc. — the likely next concepts.

### Lesson quality review queue
Generated lessons should enter a lightweight review state before being served. Add an admin UI (or a simple `GET /api/quality/review-queue` endpoint) to spot-check and approve/flag generated content. The `contributions` + `contribution_reviews` tables already exist for this.

### Regeneration / invalidation
Add a way to force-regenerate a cached lesson (e.g. `DELETE /api/curriculum/lesson?subject=X&concept=Y` for admins) so outdated or low-quality cached lessons can be replaced without a full DB migration.

---

## Content & curriculum

### Subjects list is stale in README
README still lists only Math, Reading, Science. Live subjects now include: Accounting & Bookkeeping, Personal Tax & Finance, AI, Marketing, Computer Science, Algebra 1.

### "What Is Accounting?" lesson
The first concept in the accounting tree is also a stub — it needs a lesson generated. Same for all other non-math subjects.

### `childVersion` / `adultVersion` in explanation
The LLM generates both but `LessonIntro` never surfaces them. Consider a toggle ("Explain it simply" / "Give me the full version") that swaps the displayed explanation text.

### Alternate explanation types
Currently the prompt asks for `visual` and `realWorld`. The UI supports more (`analogy`, `stepByStep`, `formal`). Consider asking the LLM for 3–4 types and letting learners pick.

---

## UX / polish

### Generation loading screen timing
The "Writing your lesson…" screen has no timing feedback. Add an elapsed-time counter or a rough "usually takes ~20 seconds" hint so users don't bounce.

### Worked example — show all examples
`LessonIntro` only renders `workedExamples[0]`. The prompt now generates two. Consider a "Next example →" affordance or show them all collapsed.

### Lesson tab memory
Switching from Lesson → Tutor and back resets scroll position. The Lesson tab should restore scroll.

### Mobile layout
The sidebar/main-content split breaks below ~600 px. The mobile `☰ Lessons` toggle exists but the sidebar z-index and overlay need work on small screens.

---

## Infrastructure

### Vercel plan / function limits
`api/curriculum/lesson.ts` has `maxDuration: 120`. The circuit-and-chisel Vercel team plan determines whether this is honoured (Pro = up to 300 s, Hobby = 60 s cap). Worth confirming the plan tier.

### Model ID coupling
`claude-sonnet-4-6` is hardcoded in `llm.ts` and `lesson.ts`. Move to a single `DEFAULT_MODEL` constant (or env var) so upgrading the model across all generation calls is a one-line change.

### Error boundary on lesson generation failure
Currently a generation failure silently falls back to Chat with no user-visible explanation. Show a brief inline error ("Couldn't load the lesson — try refreshing") so users know what happened.

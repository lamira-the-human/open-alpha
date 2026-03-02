# Contributing to Open Alpha

Open Alpha is a knowledge graph. Contributing means adding nodes to that graph.

## The Graph

The curriculum lives in `curriculum/*.json` -- one file per subject. Each concept is a node:

```json
{
  "id": "math-fractions-intro",
  "name": "Introduction to Fractions",
  "description": "Understanding parts of a whole",
  "prerequisites": ["math-division"],
  "level": 4
}
```

Prerequisites form edges. Together they create a directed acyclic graph that any AI can traverse to teach anyone anything.

**Don't write lessons.** Write metadata that lets AI generate the right lesson for each learner. The `description` field is what the AI tutor uses as context -- make it clear and specific enough to teach from, but the actual content is always rendered just-in-time.

## Ways to Contribute

### Add a Concept

Add a node to an existing subject's JSON file. Define its parents (prerequisites) and level.

### Add a Subject

Create a new `curriculum/{subject}.json` file. Start small -- even 5 concepts with a clear prerequisite chain is useful. You can reference prerequisites from other subjects (e.g., a physics concept can require `math-trigonometry`).

### Fix the Graph

- Adjust prerequisites (this concept should require X first)
- Fix levels based on real teaching experience
- Improve descriptions to give the AI tutor better context
- Fill gaps where a concept exists but its path from the roots is missing

### Improve AI Prompts

The tutor and coach system prompts are in `api/_lib/llm.ts`. Teaching experience directly improves every learner's experience.

### Build Features

Check [ROADMAP.md](./ROADMAP.md) for planned work, or open an issue.

## Validating Your Changes

Before submitting, run the graph validator:

```bash
node curriculum/validate.js
```

This checks for:
- Missing prerequisites (referencing a concept that doesn't exist)
- Circular dependencies
- Level inconsistencies (a prerequisite at a higher level than its dependent)
- Duplicate concept IDs across subjects

All checks must pass.

## Concept Schema

See `curriculum/schema.json` for the full spec. The key fields:

| Field | Description |
|-------|-------------|
| `id` | Unique. Convention: `{subject}-{topic}` |
| `name` | Human-readable name |
| `description` | What the AI tutor uses to teach. Be specific, not lengthy. |
| `prerequisites` | Concept IDs that must be mastered first. Can cross subjects. |
| `level` | Difficulty. 0-12 maps roughly to K-12 grades, but the scale is open-ended. What matters is that prerequisites have lower levels than dependents. |

## Pull Request Guidelines

1. **Keep PRs small.** One concept, one feature, one fix.
2. **Explain your reasoning.** Why this level? Why these prerequisites?
3. **Run the validator.** `node curriculum/validate.js` must pass.
4. **Don't write lesson content.** Write metadata. The AI handles the rest.

## Getting Started (for code contributions)

```bash
git clone https://github.com/YOUR-USERNAME/open-alpha.git
cd open-alpha
npm install
npm run dev
```

## Questions?

Open an issue. We're friendly.

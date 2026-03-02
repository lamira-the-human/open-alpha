# Contributing to Open Alpha

Open Alpha grows through many small contributions. Here's how to help.

## Ways to Contribute

### Add or Improve Concepts (No Code Required)

The curriculum is currently in `api/_lib/curriculum.ts`. Each concept is a simple object:

```typescript
{
  id: 'math-fractions-intro',
  name: 'Introduction to Fractions',
  description: 'Understanding parts of a whole',
  prerequisites: ['math-division'],
  gradeLevel: 4
}
```

You can:
- **Add a concept** to an existing subject
- **Fix a prerequisite chain** (e.g., "this concept should require X first")
- **Adjust grade levels** based on teaching experience
- **Improve descriptions** to give the AI tutor better context
- **Add a new subject** (start small -- even 5 concepts with a clear chain is valuable)

### Improve the AI Tutoring

The tutor and coach system prompts are in `api/_lib/llm.ts`. If you have teaching experience, your improvements to these prompts directly improve every student's learning experience.

### Build Features

Check the [ROADMAP.md](./ROADMAP.md) for planned work, or open an issue with your idea.

### Report Issues

Found a bug? Concept in the wrong grade level? Quiz generating bad questions? Open an issue.

## Getting Started

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/open-alpha.git
cd open-alpha

# Install dependencies
npm install

# Set up environment
# You'll need ATXP credentials for the LLM Gateway
# and optionally Turso credentials for the database
# See README.md for details

# Run locally
npm run dev
```

## Pull Request Guidelines

1. **Keep PRs small.** One concept, one feature, one fix. Small PRs get reviewed faster.
2. **Explain your reasoning.** Especially for curriculum changes -- why is this the right grade level? Why does this prerequisite make sense?
3. **Test what you can.** If you changed API code, make sure the endpoint works. If you changed curriculum data, verify the prerequisite chain makes sense.
4. **Don't over-engineer.** Simple and working beats clever and complex.

## Curriculum Contribution Checklist

When adding or modifying concepts:

- [ ] Concept ID follows the pattern: `{subject}-{topic}` (e.g., `math-fractions-intro`)
- [ ] Grade level is reasonable (check what's taught in real curricula)
- [ ] Prerequisites exist and form a valid chain (no cycles)
- [ ] Description gives enough context for the AI tutor to teach well
- [ ] Concept fits naturally in the existing graph

## Code Style

- TypeScript throughout
- Keep files small and focused
- No unnecessary abstractions
- Prefer clarity over cleverness

## Questions?

Open an issue. We're friendly.

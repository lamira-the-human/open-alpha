# Open Alpha

**Free AI-powered tutoring for K-12 students and support for parents.**

Try it now: **[open-alpha-eta.vercel.app](https://open-alpha-eta.vercel.app)**

---

## What is Open Alpha?

Open Alpha is a learning platform where students get their own AI tutor that adapts to their grade level and learning pace. Parents get a separate AI coach to help them support their child's education at home.

No subscriptions. No ads. Just learning.

---

## For Students

**Learn at your own pace with an AI tutor that actually understands you.**

1. **Sign up** with your email and grade level
2. **Pick a subject** - Math, Reading, or Science
3. **Chat with your tutor** - Ask questions, work through problems, get explanations that make sense
4. **Show what you know** - Take short quizzes to prove you've mastered a concept
5. **Keep going** - Unlock new concepts as you progress

The AI tutor adjusts to your grade level. A 3rd grader learning fractions gets different explanations than a 7th grader. Stuck on something? Just ask - the tutor will try a different approach.

---

## For Parents

**Stay connected to your child's learning without hovering.**

1. **Create a parent account**
2. **Link to your child** using a simple invite code they generate
3. **See their progress** - Which subjects they're working on, what they've mastered, where they might need help
4. **Get coaching** - Chat with an AI that helps you support your child's learning at home

You can see what your child is learning, but you can't do their work for them. The parent coach gives you practical tips - like how to make math practice fun or what questions to ask about their reading.

---

## Why Open Alpha?

**Learning should be personal.** Every student learns differently. AI tutoring adapts to each student instead of forcing everyone through the same lessons.

**Parents want to help.** But not everyone knows how to explain long division or help with reading comprehension. The parent coach bridges that gap.

**Education shouldn't break the bank.** Open Alpha runs on free infrastructure tiers. No venture capital, no pressure to monetize your children's data.

---

## Subjects Available

- **Mathematics** - From counting to calculus, adapted to grade level
- **Algebra 1** - Variables, equations, functions, and graphing
- **Reading & Language Arts** - Comprehension, vocabulary, writing skills
- **Science** - Biology, chemistry, physics, earth science basics
- **Computer Science** - Programming concepts, algorithms, data structures
- **Accounting & Bookkeeping** - Financial records, statements, the language of business
- **Personal Tax & Finance** - Taxes, budgeting, investing basics
- **Artificial Intelligence** - How AI systems work, prompt engineering, ethics
- **Marketing** - Strategy, branding, consumer behaviour

Subjects with pre-authored lessons load instantly. Newer subjects generate lessons on-demand via AI on first visit and cache them for everyone after — usually 15–30 seconds the first time, instant on every subsequent load.

---

## How Mastery Works

Students don't just click through lessons. They demonstrate understanding:

1. Learn a concept through conversation with the AI tutor
2. When ready, take a 5-question quiz
3. Score 80% or higher to "master" the concept
4. Mastered concepts unlock the next topics

This isn't about speed - it's about actually understanding the material before moving on.

---

## Getting Started

### Students
1. Go to [open-alpha-eta.vercel.app](https://open-alpha-eta.vercel.app)
2. Click "Sign Up"
3. Choose "I'm a Student"
4. Enter your email, create a password, and select your grade
5. Start learning!

### Parents
1. Go to [open-alpha-eta.vercel.app](https://open-alpha-eta.vercel.app)
2. Click "Sign Up"
3. Choose "I'm a Parent"
4. Create your account
5. Ask your child to generate an invite code from their dashboard
6. Enter the code to link your accounts

---

## Questions?

**Is this free?**
Yes. Open Alpha runs on free hosting and database tiers. The AI is powered by ATXP, which provides generous free usage.

**Is my child's data safe?**
We store only what's needed: email, progress, and chat history for tutoring context. We don't sell data or show ads.

**What ages is this for?**
Kindergarten through 12th grade. The AI adapts its language and difficulty to the student's grade level.

**Can I use this for homeschooling?**
Absolutely. Open Alpha works great as a supplement to any curriculum.

**My child is struggling with a concept. What do I do?**
Check their progress in your parent dashboard, then chat with the parent coach for specific strategies. The coach can see what concepts your child is working on and suggest ways to help.

---

## Open Source

Open Alpha is open source. You can see exactly how it works, suggest improvements, or run your own instance.

**Repository**: [github.com/lamira-the-human/open-alpha](https://github.com/lamira-the-human/open-alpha)

---

## Technical Details

*For developers and curious folks.*

### Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite |
| API | Vercel Serverless Functions |
| Database | Turso (SQLite-compatible edge DB) |
| AI | ATXP LLM Gateway (Claude, GPT, Gemini) |
| Hosting | Vercel |

### Local Development

```bash
# Clone the repo
git clone https://github.com/lamira-the-human/open-alpha.git
cd open-alpha

# Install dependencies
npm install

# Set up environment variables
# Create .env files with your TURSO and ATXP credentials

# Run locally
npm run dev
```

### Project Structure

```
open-alpha/
├── api/                  # Vercel serverless functions
│   ├── _lib/            # Shared utilities (db, auth, llm)
│   ├── auth/            # Login, signup, session
│   ├── tutor/           # Student AI chat, quizzes
│   ├── coach/           # Parent AI chat
│   ├── parent/          # Child linking, progress viewing
│   └── progress/        # Student progress tracking
├── frontend/            # React application
│   ├── src/pages/       # Route components
│   └── src/components/  # Shared UI
└── docs/               # Additional documentation
```

### Environment Variables

For production (Vercel):
- `TURSO_DATABASE_URL` - Your Turso database URL
- `TURSO_AUTH_TOKEN` - Turso authentication token
- `ATXP_CONNECTION_STRING` - ATXP LLM Gateway credentials
- `JWT_SECRET` - Secret for signing auth tokens
- `ADMIN_INIT_KEY` - Key for database initialization endpoint

### Contributing

See [ROADMAP.md](./ROADMAP.md) for the phased feature plan and [TODO.md](./TODO.md) for near-term improvements and known rough edges. Pull requests welcome!

---

*Built with Claude Code*

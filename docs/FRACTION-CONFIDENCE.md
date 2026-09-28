# Fraction Confidence: first learner, first slice

## Initial customer profile

**Learner:** English-speaking 10–12-year-old, usually grade 5 or 6. Can multiply
and divide whole numbers through 12, but guesses at fractions. Treats numerator
and denominator as independent whole numbers, thinks bigger denominators mean
bigger amounts, and cannot explain why 1/2 = 2/4.

**Emotional context:** avoids fraction homework and is embarrassed to ask again
in class. Needs private, calm practice without timers or a guessing penalty.

**Initiator:** parent who sees homework avoidance and wants a useful independent
activity, not a dashboard to manage. Occasion: after school on a phone or laptop,
before returning to homework. No account, payment, or LLM setup for this slice.

**Not yet:** early numeracy, fraction arithmetic, exam prep, localization, or a
general tutor. This learner definition is our initial product hypothesis, not a
claim that all children in this age group have the same needs.

## One experience, three connected skills

1. Name an amount: selected equal parts / all equal parts.
2. Make equivalent fractions: change the pieces, keep the amount.
3. Compare amounts: same-size wholes and common denominators.

Promise: “Understand fractions instead of guessing.” We own the vision, teaching,
content, checking rules, and iteration. Outside approval is not a prerequisite.
That does not make our first implementation proof of educational effectiveness.

## This release: a runnable vertical slice

`/fractions` teaches each skill with a visual worked example, asks one fixed
transfer question, checks on the server, and explains the answer. A wrong answer
gets misconception-specific feedback and another attempt; only a correct response
enables the next question. Worked examples use different values from the questions.
The page shows first-try successes separately from completion after feedback.

This is **guided practice, not a trusted assessment or durable mastery**. Answer
feedback intentionally includes solutions. Three fixed questions cannot establish
retention. Results are session-local, reset on refresh, and do not write to the
legacy mastery system. The public endpoint stores no identity or learning data,
makes no LLM calls, and uses deterministic fraction arithmetic. Express and Vercel
share the same content, checker, and handler. No new environment variables needed.

Run `npm run dev`, then visit `http://localhost:3000/fractions`.
The checker and shared HTTP handler can be exercised without a database or LLM.

## Next slices, in order

1. Fresh unassisted exit checks, with server-owned state and no exposed key;
   report first responses, never corrected practice as mastery.
2. Diagnostic routing and targeted remediation, including a whole-number
   prerequisite check. Add a short “why” task with an explicit reasoning rubric.
3. A next-day retention check and consented persistence. Measure retention and
   learner friction before expanding subjects or building more dashboards.

We can test our math, contracts, UI states, and pedagogy internally now. Once the
experience reaches learners, measure what they can do without help rather than
claiming learning gains from completion alone. Do not add a second language yet.

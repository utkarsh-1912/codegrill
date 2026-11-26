# Core DSA Patterns & Behavioral STAR+R Playbook

## 1. DSA Constraint-to-Pattern Matrix

| Input Size $n$ | Target Complexity | Go-To Patterns |
| --- | --- | --- |
| $n \le 20$ | $O(2^n)$ / $O(n!)$ | Backtracking, Subset / Bitmask DP |
| $n \le 10^3$ | $O(n^2)$ | 2D DP, Interval DP, All-Pairs Shortest Path |
| $n \le 10^5$ | $O(n \log n)$ / $O(n)$ | Sliding Window, Two Pointers, Heap, Monotonic Stack, Binary Search on Answer |
| $n \le 10^9$ | $O(\log n)$ / $O(1)$ | Binary Search, Math, Fast Exponentiation |

---

## 2. Behavioral STAR+R Story Matrix

Spend **15%** on Situation/Task, **65%** on Action (focus on *your* trade-offs and decisions), and **20%** on quantified Result + Reflection.

1. **Ambiguous Scope**: How you broke down an unclear goal into milestones and shipped early.
2. **Production Incident**: Immediate mitigation first, calm stakeholder updates, blameless postmortem + guardrail.
3. **Technical Disagreement**: Data-driven prototype, listening to counter-arguments, aligning on user outcome.
4. **Mistake & Growth**: Clear ownership without excuses, plus the systemic check you added afterward.
5. **Cross-Team Influence / Mentorship**: Multiplying velocity across teams or leveling up a teammate.

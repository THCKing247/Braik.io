## Summary

<!-- What changed and why (1–3 sentences). -->

## Owning feature area (required)

<!-- e.g. Dashboard / Roster, Messaging, Playbooks, Film & game video, Billing, Marketing, Player portal, Admin, Platform / auth -->

**Area:**

See [TECH_DEBT_GUARDRAILS.md](../TECH_DEBT_GUARDRAILS.md) §6.

## Performance impact (required for perf-related PRs)

Answer each item; use N/A only if this PR is unrelated to loading, data fetching, or UX timing.

- **Does this affect first render?** (Y/N — which route or layout segment)
- **Does it add a new fetch?** (endpoint; could the data come from shell/bootstrap instead?)
- **Can the data come from shell/bootstrap instead?** (Y/N — brief note)
- **Does it add a new Suspense/loading state?** (scope of fallback; full-page vs widget)
- **What before/after measurement proves the improvement?** (e.g. `[braik-perf]` event, DevTools trace, LCP, bundle analyzer screenshot, Network waterfall)

See [PERFORMANCE_GUIDELINES.md](../PERFORMANCE_GUIDELINES.md) and [PERFORMANCE_BASELINE.md](../PERFORMANCE_BASELINE.md).

**Technical debt guardrails:** [TECH_DEBT_GUARDRAILS.md](../TECH_DEBT_GUARDRAILS.md) (fetch ownership, client boundaries, API shapes).

## Checklist

- [ ] Lint / typecheck / tests as appropriate for the change
- [ ] No unintended behavior change (or called out in Summary)

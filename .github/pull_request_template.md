## Summary

<!-- What changed and why (1–3 sentences). -->

## Test plan

- [ ] Typecheck / build (as appropriate)
- [ ] Smoke-tested affected flows

---

### Performance checklist

- [ ] Does this add a new **`"use client"`** boundary?
- [ ] Does this import a **heavy dependency** into a client component (or without `dynamic` / server split)?
- [ ] Does this render **hidden desktop/mobile duplicate UI** (expensive subtrees)?
- [ ] Does this add **continuous animation** (pulse, gradients)?
- [ ] Does this add **polling**?
- [ ] Does this **broaden a realtime** subscription?
- [ ] Does this **fetch media eagerly** (large images/video without lazy paths)?
- [ ] Does this **add or alter database queries** — needs index / RPC review?
- [ ] Did you run **`npm run typecheck`** / **`npm run build`** for meaningful changes?
- [ ] For large UI: **`npm run analyze`** or **`npm run perf:bundle`** after build?

_Use `npm run perf:audit` locally if unsure (warning-first)._

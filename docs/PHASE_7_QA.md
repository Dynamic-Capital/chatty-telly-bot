# Phase 7 QA

## How to run tests locally

```
deno test -A supabase/functions/_tests
```

## How to enable integration smoke in CI

Set the `MINI_APP_URL` secret (optional). `FUNCTIONS_BASE` is already configured in the workflow.

## What's covered

- initData verification
- keeper secret precedence
- miniapp-health path
- ops-health & miniapp reachability

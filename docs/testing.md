# Testing

This project uses separate test suites for the Next.js app and the Cloud Run functions.

## Commands

```bash
npm run test
npm run verify
npm --prefix functions test
```

`npm run verify` runs lint, typecheck, unit/component tests, and the Next.js production build.

## Pre-commit

The repository uses `.githooks/pre-commit` through Git's `core.hooksPath`. The hook runs:

```bash
npm run precommit
```

That command runs the root verification suite and the Cloud Run functions tests before a commit is created.

## Cloud Run Functions

The functions are exported through the same production entrypoints, but their handlers are also built through factories so tests can inject mock Firestore, RSS parser, and Gemini clients. This keeps tests offline and prevents accidental writes to production Firestore.

`make deploy-functions` runs the root `verify` command and the functions test suite before any `gcloud run deploy` call.

For CI/CD, `.github/workflows/ci.yml` runs the app and functions checks on pull requests and pushes to `main`. `cloudbuild.functions.yaml` shows the same gate in Google Cloud Build: Cloud Build only reaches the `gcloud run deploy` steps when the earlier install, verify, and functions test steps pass.

# gh-actions

Reusable composite GitHub Actions for the Bun monorepo stack. Each top-level directory is one action, referenced as `hyoretsu/gh-actions/<action>@<ref>`.

All actions assume the consumer repo is **already checked out** before they run (they do not `actions/checkout` themselves), use **Bun** (`oven-sh/setup-bun@v2`), and run `bun install` internally.

**Turbo is optional.** Per-package actions run via Turbo when a `turbo.json` exists at the repo root, otherwise they fall back to `bun run --filter <package> <task>`. Everything is also **skip-friendly**: `detect-affected` only emits packages that actually declare a task as a script, so a package missing a script — or a task no package declares — yields an empty matrix and the job is simply skipped. (`detect-affected` itself is the one always-run piece; without it there is nothing to drive the matrix.)

## Actions

| Action | Purpose | Key inputs |
| --- | --- | --- |
| [`android-build`](android-build/action.yml) | Build the signed Tauri Android APK + AAB once (store-agnostic). Outputs `version`, `version-code`, `apk-glob`, `aab-glob`. | `ndk-home` (required), `project-path` (default `frontend`), `tauri-path` (default `frontend/src-tauri`), `args` (default `--apk --aab`) |
| [`build`](build/action.yml) | Build one workspace package (Turbo or `bun --filter`). | `package` (required) |
| [`check-types`](check-types/action.yml) | Type-check one workspace package (Turbo or `bun --filter`). | `package` (required) |
| [`detect-affected`](detect-affected/action.yml) | Resolve affected packages per task; emits JSON for a downstream matrix. Built-in Turbo-free resolver by default. Needs `fetch-depth: 0`. | `tasks` (required), `base-sha`, `script` (optional custom resolver) |
| [`ghcr`](ghcr/action.yml) | Buildx + metadata + login + build/push a Docker image with gha cache. Defaults to GHCR. | `image` (required), `dockerfile` (required), `cache-scope` (required), `password` (required), `context`, `build-args`, `secrets`, `registry`, `username`, `push` |
| [`migrate`](migrate/action.yml) | Apply pending Prisma migrations (`--force` unless `check`). | `database-url` (required), `check`, `package` (default `sql`), `task` (default `migrate:deploy`) |
| [`play-deploy`](play-deploy/action.yml) | Upload a release AAB to Google Play on the chosen track. | `service-account-json` (required), `package-name` (required), `aab` (required), `track` (default `production`), `status` (default `completed`) |
| [`setup-tauri-android`](setup-tauri-android/action.yml) | Prepare the Tauri Android toolchain + signing keystore. Outputs `ndk-home`. | `keystore-base64`, `keystore-password`, `key-alias`, `tauri-path` (default `frontend/src-tauri`) |
| [`tauri-build`](tauri-build/action.yml) | Build + publish the Tauri desktop app to a GitHub release. | `github-token` (required), `project-path` (default `frontend`), `tag-name`, `release-name` |
| [`test-e2e`](test-e2e/action.yml) | Run one package's E2E suite (Turbo `--force`, or `bun --filter`). | `package` (required), `database-url` (required) |
| [`test-unit`](test-unit/action.yml) | Run one package's unit tests (Turbo or `bun --filter`). | `package` (required) |

## Mobile store deploys

`android-build` compiles the signed artifacts **once** and exposes their paths; each store is then a thin `*-deploy` action consuming those outputs. Add a sibling action per store (Amazon Appstore, Samsung Galaxy Store, …) that takes the same `aab-glob`/`apk-glob` — the build never re-runs per store.

```yaml
- uses: hyoretsu/gh-actions/setup-tauri-android@main
  id: setup
  with: { keystore-base64: "${{ secrets.ANDROID_KEYSTORE_BASE64 }}", keystore-password: "${{ secrets.ANDROID_KEYSTORE_PASSWORD }}", key-alias: "${{ secrets.ANDROID_KEY_ALIAS }}" }
- uses: hyoretsu/gh-actions/android-build@main
  id: build
  with: { ndk-home: "${{ steps.setup.outputs.ndk-home }}" }
- uses: hyoretsu/gh-actions/play-deploy@main
  with:
    service-account-json: ${{ secrets.PLAY_SERVICE_ACCOUNT_JSON }}
    package-name: com.example.app
    aab: ${{ steps.build.outputs.aab-glob }}
```

## Usage

```yaml
- uses: actions/checkout@v5
  with:
    fetch-depth: 0
- id: detect
  uses: hyoretsu/gh-actions/detect-affected@main
  with:
    tasks: "check-types build test:unit"
    base-sha: ${{ github.event.pull_request.base.sha }}
```

## Versioning

`@main` tracks the latest. Cut release tags (`v1`, `v1.2.0`) if you need pinned, immutable references.

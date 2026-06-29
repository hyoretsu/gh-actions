# gh-actions

Reusable composite GitHub Actions for the Bun + Turbo monorepo stack. Each
top-level directory is one action, referenced as
`hyoretsu/gh-actions/<action>@<ref>`.

All actions assume the consumer repo is **already checked out** before they run
(they do not `actions/checkout` themselves), use **Bun** (`oven-sh/setup-bun@v2`)
and **Turbo**, and run `bun install` internally.

## Actions

| Action | Purpose | Key inputs |
| --- | --- | --- |
| [`build`](build/action.yml) | Build one workspace package via Turbo. | `package` (required) |
| [`check-types`](check-types/action.yml) | Type-check one workspace package via Turbo. | `package` (required) |
| [`detect-affected`](detect-affected/action.yml) | Resolve affected packages per Turbo task; emits JSON for a downstream matrix. Needs `fetch-depth: 0`. | `tasks` (required), `base-sha`, `script` (default `scripts/affected-packages.ts`) |
| [`migrate`](migrate/action.yml) | Apply pending Prisma migrations (`--force` unless `check`). | `database-url` (required), `check`, `package` (default `sql`), `task` (default `migrate:deploy`) |
| [`setup-tauri-android`](setup-tauri-android/action.yml) | Prepare the Tauri Android toolchain + signing keystore. Outputs `ndk-home`. | `keystore-base64`, `keystore-password`, `key-alias`, `tauri-path` (default `frontend/src-tauri`) |
| [`tauri-build`](tauri-build/action.yml) | Build + publish the Tauri desktop app to a GitHub release. | `github-token` (required), `project-path` (default `frontend`), `tag-name`, `release-name` |
| [`test-e2e`](test-e2e/action.yml) | Run one package's E2E suite (`--force`, no Turbo cache). | `package` (required), `database-url` (required) |
| [`test-unit`](test-unit/action.yml) | Run one package's unit tests via Turbo. | `package` (required) |

## Usage

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
- id: detect
  uses: hyoretsu/gh-actions/detect-affected@main
  with:
    tasks: "check-types build test:unit"
    base-sha: ${{ github.event.pull_request.base.sha }}
```

Defaults match the [`reqspec`](https://github.com/hyoretsu/reqspec) repo; override
the inputs above to reuse these actions elsewhere.

## Versioning

`@main` tracks the latest. Cut release tags (`v1`, `v1.2.0`) if you need pinned,
immutable references.

# Chiwire

Chiwire is a TypeScript monorepo for personal and business idea projects.
It is set up to hold multiple applications and shared packages while keeping a
single baseline for TypeScript configuration and developer scripts.

## Repository layout

```text
.
├── apps/              # Deployable apps and experiments
├── packages/          # Shared libraries, utilities, and project modules
├── package.json       # Root workspace metadata and scripts
├── tsconfig.base.json # Shared TypeScript compiler options
└── tsconfig.json      # Root TypeScript project references entrypoint
```

## Getting started

Install dependencies from the repository root:

```sh
npm install
```

Run the workspace type check:

```sh
npm run typecheck
```

## Workspaces

This repository uses npm workspaces:

- `apps/*` for application projects.
- `packages/*` for shared TypeScript packages.

When adding a new app or package, create a `package.json` in the workspace
folder and add its TypeScript project to the root `tsconfig.json` references if
it should be included in `npm run typecheck`.

## TypeScript

The root TypeScript setup is intentionally small:

- `tsconfig.base.json` contains strict shared compiler options.
- `tsconfig.json` is a solution-style project that can reference apps and
  packages as they are added.

Individual workspaces should extend `../../tsconfig.base.json` and define their
own `rootDir`, `outDir`, `include`, and `exclude` settings.

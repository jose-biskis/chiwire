# Dependency map

The dependency map records local source-file relationships so CI can understand
which files are affected by a change. It is intended as a foundation for future
test targeting, such as running tests for changed files and every file that
depends on them.

## Generate the map

Run this from the repository root:

```sh
npm run dependency-map
```

The command prints JSON with one entry per local source file:

```json
{
  "version": 1,
  "files": {
    "apps/example/src/index.ts": {
      "dependencies": ["packages/shared/src/index.ts"],
      "dependents": []
    },
    "packages/shared/src/index.ts": {
      "dependencies": [],
      "dependents": ["apps/example/src/index.ts"]
    }
  }
}
```

- `dependencies` are files imported by the key file.
- `dependents` are files that import the key file.

The script scans source files under the repository, ignores generated folders
such as `dist` and `node_modules`, and resolves local relative imports plus npm
workspace package imports. External packages and Node built-ins are not included
because they do not identify local files to retest.

## Find affected files

Use `npm run affected` to print a changed file plus all transitive dependents.

Pass changed files explicitly:

```sh
npm run affected -- --changed apps/hello-http/src/index.ts
```

Or compare the current branch to a git ref:

```sh
npm run affected -- --base origin/main
```

For line-delimited output that can be piped into other tools:

```sh
npm run affected -- --base origin/main --format text
```

## Future test targeting

The affected-file output can later feed a test-selection step:

1. Get changed files from git or the CI provider.
2. Expand the set to include every transitive dependent from the dependency map.
3. Match affected source files to colocated tests, package test scripts, or app
   build/typecheck commands.
4. Run the selected tests first, and fall back to the full suite when an
   unmapped file type changes.

This keeps the current implementation small while preserving the information
needed to make deploy checks faster over time.

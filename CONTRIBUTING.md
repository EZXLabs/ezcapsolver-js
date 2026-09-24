# Contributing Guide

Thanks for taking the time. This document covers what you need to build, test
and ship a change.

## Development Environment

### Node

Node **22.12 or newer**. The floor is set by `require(esm)`, which the CommonJS
half of the published package depends on; anything older cannot load it.

```bash
node --version
```

### Package Manager

pnpm, pinned by the `packageManager` field in `package.json`. Corepack picks up
the right version on its own:

```bash
corepack enable
pnpm install
```

### Toolchain

Everything is a dev dependency, so `pnpm install` is all the setup there is:

| Tool | Job |
| --- | --- |
| [Biome](https://biomejs.dev) | Lint and format, in one tool |
| [TypeScript](https://www.typescriptlang.org) | Type checking only — the build is separate |
| [Vitest](https://vitest.dev) | Tests and coverage |
| [tsdown](https://tsdown.dev) | Builds the ESM and CommonJS artifacts |
| [publint](https://publint.dev) + [@arethetypeswrong/cli](https://arethetypeswrong.github.io) | Verify the published package |

One tool is not a dev dependency: [`typos`](https://github.com/crate-ci/typos)
runs in CI and in the pre-commit hook. Install it with
`cargo install typos-cli` or `brew install typos-cli`.

## Local Checks

```bash
pnpm lint              # biome, fixing what it can
pnpm build             # ESM + CJS + both sets of declarations
pnpm typecheck         # src, tests and examples in one pass
pnpm test              # the full suite
pnpm test:coverage
pnpm verify:package    # publint + are-the-types-wrong
typos
```

Two ordering rules worth knowing:

- **`pnpm build` has to run before `pnpm typecheck`.** The examples import the
  package by its own name, which resolves through `exports` to `dist/`, so they
  are checked against the artifact that actually ships rather than against
  `src/`. That is deliberate — it means a published example cannot compile
  against something users never receive.
- **Check `biome.jsonc` itself when you change it.** Biome falls back to its
  built-in defaults when the config does not parse, and says nothing about it;
  a broken config reformats the whole tree with the wrong settings and still
  reports success. `pnpm exec biome check biome.jsonc` catches that, and both
  CI and the pre-commit hook run it.

Optionally install the hooks:

```bash
pre-commit install
```

## Adding A Task Type

Adding a task type touches five places, and the test suite fails if any of them
is missed:

1. `src/task-type.ts` — add the wire name to `KNOWN_TASK_TYPES`, and to
   `SYNC_TASK_TYPES` if the service documents it as synchronous
2. `src/tasks.ts` — the parameter model, with wire names copied byte for byte
   from the task catalog, plus an entry in `ParamsByTaskType`
3. `src/solutions.ts` — the solution model unless an existing one fits, plus an
   entry in `SolutionByTaskType`, and in `REQUIRED_SOLUTION_FIELDS` for any
   field the service has confirmed a worker always returns
4. `src/client.ts` — one `solveX` and one `syncSolveX`, named after the wire
   type exactly
5. `examples/<vendor>/<wire-name>.ts` — a runnable example, plus a row in both
   `examples/README.md` and `examples/README.zh-CN.md`

Then add the type to the table in `tests/shortcuts.test.ts`. That table calls
every named method and asserts the type string it puts on the wire — it is what
stands between a mistyped wire name and a task that is billed as one type while
being decoded as another.

Wire names carry the service's own irregularities: `FuncaptchaTaskProxyless`
has a lowercase `c` while `FunCaptchaClassification` does not, and
`AkamaiWEBTaskProxyless` is shouted. Send them as the task catalog spells them.

There is one deliberate exception, shared with the other SDKs: the catalog
writes the V3 Enterprise S9 type as `RecaptchaV3EnterpriseTaskProxylessS9`, and
the SDKs send `ReCaptchaV3EnterpriseTaskProxylessS9` so that one capitalisation
runs through the whole ReCaptcha family. The service matches task types
case-insensitively, so this reaches the same worker. Do not "fix" it back.

## Testing

- **Never point a test at the real API.** Creating a task is billed. Inject a
  `fetch` double, or start a local `node:http` server for anything that needs a
  real socket.
- Name a test after what it asserts, not after its input. `it("carries the
  billed task's id out of a failure that lost it")` beats
  `it("handles error case 3")`.
- Coverage should stay at or above 90%, with the transport and error-mapping
  paths close to complete. Those are the paths hardest to verify by hand.
- A comment explaining *why* a check exists is worth more than the check. If a
  test guards against a specific failure — a billing hazard, a contract break —
  say so.

## Code Style

- Biome decides formatting. Do not argue with it in review.
- **All comments in English**, doc comments and inline ones alike. A doc
  comment is published API documentation and shows up in every editor; an
  inline comment explains a decision to whoever maintains the file next, and
  that reader may be anyone.
- Say why, not what. `// Wait before every query, the first one included: a
  task that was just created is still queued` earns its place; `// wait` does
  not.

## Commit Convention

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation change |
| `refactor:` | Refactor that is neither a feature nor a bug fix |
| `perf:` | Performance improvement |
| `test:` | Test-related change |
| `chore:` | Build, toolchain, or miscellaneous maintenance |

The changelog is generated by git-cliff from commit history, so keep commit
messages consistent.

## Branches And Pull Requests

- Create feature branches from `main`.
- Keep each pull request focused on a single topic.
- Pull requests must pass CI: lint, typecheck, the test matrix, the package
  checks and typos.

## Releasing

Versions follow [SemVer](https://semver.org/). Adding a task type, adding an
optional field to a parameter model, adding an error kind, or adding a solution
model are **not** breaking changes — the type design is built to keep it that
way.

To release, bump the version in **both** `package.json` and the `SDK_VERSION`
constant in `src/config.ts`, then push a matching `vX.Y.Z` tag. A test asserts
the two agree, and the release workflow checks both against the tag before
anything is published — an npm version, once published, cannot be replaced.

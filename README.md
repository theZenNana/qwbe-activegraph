# ActiveGraph plugin for Qwbe

External plugin source (QWB-28), installed into a Qwbe checkout via `install-from`. Lives
outside the Qwbe repository; nothing in the kernel knows this directory exists.

The Qwbe cube owns HTTP, authentication and authorization. A short-lived Python subprocess
owns ActiveGraph state and writes only to its cube-specific data directory
(`$QWBE_DATA_DIR/CUBE`, override `QWBE_AGENT_DATA`). Goals use the configured LiteLLM
OpenAI-compatible endpoint; no model credential reaches the browser.

## Layout

- `qwbe-package.json` — install-from manifest (name must equal the directory name: `activegraph`)
- `cubes/agentlab/` — the cube: four routes of the generic agent surface (`qwbe-core/agent`)
- `runtime.ts` — subprocess boundary; public contract in, JSON over stdin/stdout out
- `agent.py` — the ActiveGraph half; never opens a port, answers one command per invocation
- `requirements.lock` — pinned Python dependencies
- `setup.mjs` — creates `.venv/` inside this directory and installs the lock file
- `probes/` — the probe pair that proves the surface end-to-end (see below)
- `docs/` — the original integration research

## Prepare

Python 3.11+ required. The venv belongs to the INSTALLED copy, not to this source: venvs
contain symlinks, and install-from refuses any package tree with symlinks in it. So the
order is install first, setup second (or point `QWBE_ACTIVEGRAPH_PYTHON` at any interpreter
that already has `requirements.lock` installed).

## Install into Qwbe

From a Qwbe checkout (server stopped or running, both work; a restart is required after):

```sh
# HTTP surface (authenticate first and substitute TOKEN):
curl -X POST http://localhost:4500/settings/packages/install-from \
  -H 'authorization: Bearer TOKEN' -H 'content-type: application/json' \
  --data '{"path":"/home/lucian/Projects/qwbe-packs/plugins/activegraph"}'

# CLI command through its real HTTP adapter, POST /cli/exec:
curl -X POST http://localhost:4500/cli/exec \
  -H 'authorization: Bearer TOKEN' -H 'content-type: application/json' \
  --data '{"line":"settings:install-from /home/lucian/Projects/qwbe-packs/plugins/activegraph"}'
```

The kernel copies the package into its store, typechecks it against the public contract,
then installs it under `core/plugins/activegraph/` at the next boot. Then build the runtime:

```sh
node <qwbe>/core/plugins/activegraph/setup.mjs   # creates .venv/ in the installed copy
```

## Runtime environment

| Variable | Default | Purpose |
|---|---|---|
| `QWBE_ACTIVEGRAPH_PYTHON` | `<plugin>/.venv/bin/python` | interpreter for the subprocess |
| `QWBE_LITELLM_BASE_URL` | — (required for goals) | LiteLLM base, e.g. `http://host:4000/v1` |
| `QWBE_LITELLM_API_KEY` | — (required for goals) | LiteLLM key; without both, goals answer 503 |
| `QWBE_AGENT_MODEL` | `sub/k3` | model name passed to LiteLLM |
| `QWBE_AGENT_DATA` | `$QWBE_DATA_DIR/CUBE` | the cube's SQLite + run-id directory |

Secrets arrive via env only; nothing is stored in this package, in logs, or in git.

## Source checks

The source test needs Node plus an interpreter prepared by `setup.mjs`; it does not copy
credentials into the package. `QWBE_ACTIVEGRAPH_TEST_PYTHON` may point at an already prepared
interpreter when testing the clean, installable source tree:

```sh
npm run setup
npm test

QWBE_ACTIVEGRAPH_TEST_PYTHON=/path/to/prepared/python npm test
```

## Probes (after install, from the Qwbe repo root)

The probes boot the real server against scratch data (`QWBE_DATA_DIR` in a mkdtemp) and a
fake LiteLLM; they import `probes/lib.mjs` from the Qwbe repo:

```sh
# from the Qwbe repo root, with the plugin installed and its venv in place:
node /home/lucian/Projects/qwbe-packs/plugins/activegraph/probes/activegraph.mjs
```

(If run from a different cwd, set `QWBE_REPO` to the Qwbe checkout — the probe resolves
`lib.mjs` relative to itself first, then to `$QWBE_REPO/probes/lib.mjs`.)

ActiveGraph is Apache-2.0; its upstream license and NOTICE remain authoritative.

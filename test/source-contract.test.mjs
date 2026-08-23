import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = resolve(fileURLToPath(new URL("..", import.meta.url)))
const source = (path) => readFileSync(join(root, path), "utf8")

test("plugin imports Qwbe contracts only through public versioned subpaths", () => {
  const cube = source("cubes/agentlab/index.ts")
  assert.doesNotMatch(cube, /core\/src\/kernel|src\/kernel/)
  assert.match(cube, /from "qwbe-core\/auth"/)
  assert.match(cube, /from "qwbe-core\/errors"/)
})

test("runtime identity and storage scope come from the mounted cube", () => {
  assert.doesNotMatch(source("runtime.ts"), /QWBE_AGENTLAB_DATA|QWBE_AGENT_CUBE: "agentlab"/)
  assert.doesNotMatch(source("agent.py"), /agentlab/)

  const python = process.env.QWBE_ACTIVEGRAPH_TEST_PYTHON ?? join(root, ".venv/bin/python")
  const env = {
    ...process.env,
    QWBE_AGENT_CUBE: "sales",
    QWBE_AGENT_DATA: "/tmp/qwbe-activegraph-source-contract",
  }
  const context = JSON.parse(execFileSync(python, [join(root, "agent.py"), "context"], { env, input: "{}" }))
  assert.deepEqual(context, {
    cube: "sales",
    allowed: ["/sales/health", "/sales/context", "/sales/goals", "/sales/trace"],
    crossCube: false,
  })
})

test("README documents the real HTTP and CLI install surfaces", () => {
  const readme = source("README.md")
  assert.match(readme, /POST http:\/\/localhost:4500\/settings\/packages\/install-from/)
  assert.match(readme, /POST \/cli\/exec/)
  assert.doesNotMatch(readme, /node core\/src\/main\.ts settings:install-from/)
})

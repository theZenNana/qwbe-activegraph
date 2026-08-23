// This plugin's own environment, run by the Qwbe root `npm run setup` ONLY after the plugin
// has been installed from this directory into <qwbe>/core/plugins/activegraph (QWB-28). The
// kernel's setup installs no Python of its own -- see scripts/setup.mjs in the Qwbe repo.
//
// Run standalone from this directory to prepare the runtime BEFORE install:
//
//   node setup.mjs
//
// Creates an isolated virtual environment inside THIS directory (.venv) and installs this
// plugin's pinned dependencies into it. System Python is never modified.

import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const pluginDir = dirname(fileURLToPath(import.meta.url))
const venv = join(pluginDir, ".venv")
const python = process.platform === "win32" ? "python" : "python3"
const venvPython = process.platform === "win32" ? join(venv, "Scripts/python.exe") : join(venv, "bin/python")
const checkOnly = process.argv.includes("--check")

const parseVersion = (v) =>
  v
    .replace(/^v/, "")
    .split(".")
    .map((n) => Number.parseInt(n, 10))

const isOlder = (have, want) => {
  for (let i = 0; i < want.length; i++) {
    const h = have[i] ?? 0
    if (h < want[i]) return true
    if (h > want[i]) return false
  }
  return false
}

const pythonVersion = spawnSync(python, ["--version"], { encoding: "utf8" })
if (pythonVersion.status !== 0) {
  console.error("\nThe ActiveGraph plugin needs Python 3.11 or newer. No system package was installed.\n")
  process.exit(1)
}
const pythonParts = parseVersion(`${pythonVersion.stdout}${pythonVersion.stderr}`.replace(/^Python\s+/, "").trim())
if (isOlder(pythonParts, [3, 11, 0])) {
  console.error(`\nThe ActiveGraph plugin needs Python 3.11 or newer -- found ${pythonParts.join(".")}.\n`)
  process.exit(1)
}

if (checkOnly) {
  console.log(`      activegraph-plugin setup prerequisites ready (Python ${pythonParts.join(".")})`)
  process.exit(0)
}

if (!existsSync(venvPython)) {
  const made = spawnSync(python, ["-m", "venv", venv], { stdio: "inherit" })
  if (made.status !== 0) process.exit(made.status ?? 1)
}
const installed = spawnSync(venvPython, ["-m", "pip", "install", "-r", join(pluginDir, "requirements.lock")], {
  stdio: "inherit",
})
if (installed.status !== 0) process.exit(installed.status ?? 1)
console.log("      activegraph-plugin environment ready")

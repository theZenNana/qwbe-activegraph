import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Effect, Schema } from "effect"
import { AgentContext, AgentGoalPayload, AgentHealth, AgentTrace, AgentUnavailable } from "qwbe-core/agent"
import { Authorization, requirePermission } from "qwbe-core/auth"
import { defineCube } from "qwbe-core/cube"
import { Forbidden } from "qwbe-core/errors"
import { invokeAgent } from "../../runtime.ts"

const cubeName = "agentlab"
const permission = {
  read: `${cubeName}:read`,
  run: `${cubeName}:run`,
} as const

// The plugin-specific responses, composed FROM the generic contract. `llm` and `object` are
// this pilot's own facts; the kernel's web client decodes the generic subset and never sees
// them -- which is exactly how a second agent plugin arrives without touching the shell.
const PilotHealth = AgentHealth.pipe(
  Schema.extend(Schema.Struct({ activegraph: Schema.String, llm: Schema.Boolean })),
).annotations({ identifier: "AgentlabHealth" })

// This pilot's goals always go through a model, so its response fixes the fields the generic
// contract leaves optional -- stated outright rather than extended, because a Schema cannot
// narrow `string | undefined` into `string`.
const PilotGoalResult = Schema.Struct({
  cube: Schema.String,
  state: Schema.String,
  goal: Schema.String,
  answer: Schema.String,
  model: Schema.String,
  usage: Schema.Struct({ promptTokens: Schema.Number, completionTokens: Schema.Number }),
  object: Schema.Struct({ type: Schema.String, cube: Schema.String, text: Schema.String }),
  llm: Schema.Literal(true),
}).annotations({ identifier: "AgentlabGoalResult" })

const group = HttpApiGroup.make(cubeName)
  .add(
    HttpApiEndpoint.get("health")`/agentlab/health`
      .addSuccess(PilotHealth)
      .addError(AgentUnavailable)
      .addError(Forbidden),
  )
  .add(
    HttpApiEndpoint.get("context")`/agentlab/context`
      .addSuccess(AgentContext)
      .addError(AgentUnavailable)
      .addError(Forbidden),
  )
  .add(
    HttpApiEndpoint.post("goal")`/agentlab/goals`
      .setPayload(AgentGoalPayload)
      .addSuccess(PilotGoalResult)
      .addError(AgentUnavailable)
      .addError(Forbidden),
  )
  .add(
    HttpApiEndpoint.get("trace")`/agentlab/trace`
      .addSuccess(AgentTrace)
      .addError(AgentUnavailable)
      .addError(Forbidden),
  )
  .middleware(Authorization)

export const cube = defineCube(group, {
  manifest: {
    name: cubeName,
    tables: [],
    screen: false,
    agent: true,
    requiresAuth: true,
    permissions: [
      { name: permission.read, roles: ["admin", "reader"] },
      { name: permission.run, roles: ["admin"] },
    ],
  },
  create: () => ({
    handlers: {
      health: () =>
        requirePermission(permission.read).pipe(
          Effect.flatMap(() => invokeAgent(cubeName, "health", {}, PilotHealth)),
        ),
      context: () =>
        requirePermission(permission.read).pipe(
          Effect.flatMap(() => invokeAgent(cubeName, "context", {}, AgentContext)),
        ),
      goal: ({ payload }: { payload: typeof AgentGoalPayload.Type }) =>
        requirePermission(permission.run).pipe(
          Effect.flatMap(() => invokeAgent(cubeName, "goal", { ...payload, cube: cubeName }, PilotGoalResult)),
        ),
      trace: () =>
        requirePermission(permission.read).pipe(
          Effect.flatMap(() => invokeAgent(cubeName, "trace", {}, AgentTrace)),
        ),
    },
  }),
})

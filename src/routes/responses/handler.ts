import type { Context } from "hono"

import consola from "consola"

import type { ResponsesPayload } from "./types"

export async function handleResponses(c: Context): Promise<Response> {
  const payload = await c.req.json<ResponsesPayload>()
  consola.debug("Responses API request payload:", JSON.stringify(payload))

  // TODO(#4): wire up createResponses() service client
  // For now return a structured 501 so the route is exercisable
  consola.warn(
    "POST /v1/responses is not yet implemented — service client pending (#4)",
  )
  return c.json(
    {
      error: {
        message:
          "Responses API service client not yet implemented. See issue #4.",
        type: "not_implemented",
        code: "responses_not_implemented",
      },
    },
    501,
  )
}

import { Hono } from "hono"

import { forwardError } from "~/lib/error"

import { handleResponses } from "./handler"

const responses = new Hono()

responses.post("/", async (c) => {
  try {
    return await handleResponses(c)
  } catch (error) {
    return await forwardError(c, error)
  }
})

export default responses

import { Hono } from "hono"

import { handleResponses } from "./handler"

const responses = new Hono()

responses.post("/", handleResponses)

export default responses

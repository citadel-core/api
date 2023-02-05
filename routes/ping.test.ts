import ping from "./ping.ts";
import { assert } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { routerToSuperDeno, setEnv } from "../utils/test.ts";

setEnv();

Deno.test("It correctly responds to a ping", async () => {
  const app = await routerToSuperDeno(ping);
  const response = await app.get("/ping");
  assert(response.ok);
  assert(typeof response.body.version == "string");
});

import { cleanup, setEnv } from "../utils/test.ts";
import constants from "../utils/const.ts";
import { assert, assertFalse } from "https://deno.land/std@0.159.0/testing/asserts.ts";
import { exists } from "https://deno.land/std@0.159.0/fs/mod.ts";
setEnv();

Deno.test("JWT pubkeys are automatically generated", async () => {
  try {
    await Deno.remove(constants.JWT_PUBLIC_KEY_FILE);
    await Deno.remove(constants.JWT_PRIVATE_KEY_FILE);
  } catch {
    assertFalse(await exists(constants.JWT_PUBLIC_KEY_FILE), "Deleting keys failed!");
    assertFalse(await exists(constants.JWT_PRIVATE_KEY_FILE), "Deleting keys failed!");
  }
  await import("./auth.ts");
  assert(await exists(constants.JWT_PUBLIC_KEY_FILE));
  assert(await exists(constants.JWT_PRIVATE_KEY_FILE));
  await cleanup();
});

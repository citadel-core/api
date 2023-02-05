import * as diskLogic from "./disk.ts";
import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { setEnv } from "../utils/test.ts";

setEnv();

Deno.test("getRandomString() returns a string for an even length argument", () => {
  const randomString = diskLogic.getRandomString(8);
  assertEquals(typeof randomString, "string");
  assertEquals(randomString.length, 8);
});

Deno.test("getRandomString() fails with a not even length argument", () => {
  assertThrows(() => diskLogic.getRandomString(9));
});

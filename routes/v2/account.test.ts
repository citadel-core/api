import {
  FakeKaren,
  routerToSuperDeno,
  runTest,
  setEnv,
  testAndValidateRequest,
  cleanup
} from "../../utils/test.ts";
import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.176.0/testing/asserts.ts";
import { generateJwt } from "../../utils/jwt.ts";
import { TOTP } from "https://deno.land/x/god_crypto@v1.4.10/otp.ts";

setEnv();
await cleanup();

const account = (await import("./account.ts")).default;

const karen = new FakeKaren();

Deno.test("Login with valid password works", async () => {
  await karen.start();
  const app = await routerToSuperDeno(account);
  const response = await app
    .post("/v2/account/login")
    .set("Content-Type", "application/json")
    .send('{"password":"password1234"}');
  await karen.stop();
  assert(response.ok, "Response should return status 200");
  assert(
    typeof response.body.jwt === "string",
    "JWT should be present and a string",
  );
});

testAndValidateRequest("Login with invalid password fails", {
  router: account,
  method: "POST",
  url: "/v2/account/login",
  expectedStatus: 401,
  expectedData: "Incorrect password",
  body: { password: "password12345" },
});

testAndValidateRequest("Can get the seed with valid password", {
  router: account,
  method: "POST",
  url: "/v2/account/seed",
  expectedStatus: 200,
  expectedData: {
    seed: ["this", "is", "the", "seed"],
  },
  body: { password: "password1234" },
});

testAndValidateRequest("/registered returns true if user file exists", {
  router: account,
  method: "GET",
  url: "/v2/account/registered",
  expectedStatus: 200,
  expectedData: { registered: true },
});

testAndValidateRequest("Password change fails password is too short", {
  router: account,
  method: "POST",
  url: "/v2/account/change-password",
  expectedStatus: 400,
  expectedData: "New password does not meet the security requirements.",
  body: { password: "password1234", newPassword: "password123" },
});

testAndValidateRequest("Password change fails passwords are the same", {
  router: account,
  method: "POST",
  url: "/v2/account/change-password",
  expectedStatus: 400,
  expectedData: "The new password must not be the same as existing password",
  body: { password: "password1234", newPassword: "password1234" },
});

testAndValidateRequest("Password change fails if new password is missing", {
  router: account,
  method: "POST",
  url: "/v2/account/change-password",
  expectedStatus: 400,
  expectedData: "Received invalid data.",
  body: { password: "password1234" },
});

testAndValidateRequest("Password change fails if new password is an object", {
  router: account,
  method: "POST",
  url: "/v2/account/change-password",
  expectedStatus: 400,
  expectedData: "Received invalid data.",
  body: { password: "password1234", newPassword: { value: "password12345" } },
});

testAndValidateRequest("Password change works with valid password", {
  router: account,
  method: "POST",
  url: "/v2/account/change-password",
  expectedStatus: 200,
  expectedData: { percent: 100 },
  body: { password: "password1234", newPassword: "password12345" },
  expectedKarenMessages: ["trigger change-password"],
});

testAndValidateRequest(
  "Password change progress always returns 100% for backwards compat",
  {
    router: account,
    method: "GET",
    url: "/v2/account/change-password/status",
    expectedStatus: 200,
    expectedData: { percent: 100 },
    includeJwt: true,
  },
);

testAndValidateRequest("getinfo returns valid data", {
  router: account,
  method: "GET",
  url: "/v2/account/info",
  expectedStatus: 200,
  expectedData: {
    name: "Tester with password password123",
    installedApps: ["example-app"],
  },
  includeJwt: true,
});

runTest("TOTP can be enabled", null, async () => {
  let app = await routerToSuperDeno(account);
  const request = app.get("/v2/account/totp/setup");
  request.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  const setupResult = await request.send();
  const key = setupResult.body?.key;
  assert(setupResult.ok, "Response should return status 200");
  assert(
    typeof key === "string",
    "Key should be present and a string",
  );
  const totp = new TOTP(key);
  const currentToken = totp.generate();
  app = await routerToSuperDeno(account);
  const enableRequest = app.post("/v2/account/totp/enable");
  enableRequest.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  enableRequest.set("Content-Type", "application/json");
  const enableResult = await enableRequest.send(JSON.stringify({
    authenticatorToken: currentToken,
  }));
  assert(enableResult.ok, "Response should return status 200");
  assert(
    enableResult.body?.success,
    "It should return success: true",
  );
  app = await routerToSuperDeno(account);
  const statusRequest = app.get("/v2/account/totp/status");
  return await statusRequest.send();
}, ({ result }) => {
  assert(result.ok, "Getting the enabled status of TOTP should succeed");
  assert(result.body?.totpEnabled, "TOTP should be set to enabled");
});

runTest("TOTP can be enabled and disabled", null, async () => {
  // Setup
  let app = await routerToSuperDeno(account);
  const request = app.get("/v2/account/totp/setup");
  request.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  const setupResult = await request.send();
  const key = setupResult.body?.key;
  assert(setupResult.ok, "Response should return status 200");
  assert(
    typeof key === "string",
    "Key should be present and a string",
  );
  const totp = new TOTP(key);
  let currentToken = totp.generate();

  // Enable
  app = await routerToSuperDeno(account);
  const enableRequest = app.post("/v2/account/totp/enable");
  enableRequest.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  enableRequest.set("Content-Type", "application/json");
  const enableResult = await enableRequest.send(JSON.stringify({
    authenticatorToken: currentToken,
  }));
  assert(enableResult.ok, "Response should return status 200");
  assert(
    enableResult.body?.success,
    "It should return success: true",
  );

  // Check
  app = await routerToSuperDeno(account);
  const statusRequest = app.get("/v2/account/totp/status");
  const statusResult = await statusRequest.send();
  assert(statusResult.ok, "Getting the enabled status of TOTP should succeed");
  assert(statusResult.body?.totpEnabled, "TOTP should be set to enabled");

  // Check if disable fails without token
  app = await routerToSuperDeno(account);
  currentToken = totp.generate();
  const disableRequestInvalid = app.post("/v2/account/totp/disable");
  disableRequestInvalid.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  disableRequestInvalid.set("Content-Type", "application/json");
  const disableResultInvalid = await disableRequestInvalid.send(JSON.stringify({}));
  assertEquals(disableResultInvalid.status, 401, "Response should return status 401");
  assertEquals(
    disableResultInvalid.body,
    "Missing authenticator token",
    "It should return an error message",
  );

  // Check if disable fails with invalid token
  app = await routerToSuperDeno(account);
  const disableRequestInvalid2 = app.post("/v2/account/totp/disable");
  disableRequestInvalid2.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  disableRequestInvalid2.set("Content-Type", "application/json");
  const disableResultInvalid2 = await disableRequestInvalid2.send(JSON.stringify({
    authenticatorToken: Number(totp.generate()) + 1,
  }));
  assertEquals(disableResultInvalid2.status, 401, "Response should return status 401");
  assertEquals(
    disableResultInvalid2.body,
    'TOTP token invalid',
    "It should return an error message",
  );

  // Disable
  app = await routerToSuperDeno(account);
  currentToken = totp.generate();
  const disableRequest = app.post("/v2/account/totp/disable");
  disableRequest.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  disableRequest.set("Content-Type", "application/json");
  const disableResult = await disableRequest.send(JSON.stringify({
    authenticatorToken: currentToken,
  }));
  assert(disableResult.ok, "Response should return status 200");
  assert(
    disableResult.body?.success,
    "It should return success: true",
  );

  // Check again
  app = await routerToSuperDeno(account);
  const statusRequest2 = app.get("/v2/account/totp/status");
  const statusResult2 = await statusRequest2.send();
  assert(statusResult2.ok, "Getting the enabled status of TOTP should succeed");
  assertFalse(statusResult2.body?.totpEnabled, "TOTP should be set to disabled");

  // Disable should fail now
  app = await routerToSuperDeno(account);
  currentToken = totp.generate();
  const disableRequest2 = app.post("/v2/account/totp/disable");
  disableRequest2.set("Authorization", `Bearer ${await generateJwt("admin")}`);
  disableRequest2.set("Content-Type", "application/json");
  const disableResult2 = await disableRequest2.send(JSON.stringify({
    authenticatorToken: currentToken,
  }));
  assertEquals(disableResult2.status, 400, "Response should return status 400");
  assertEquals(
    disableResult2.body,
    "TOTP is already disabled",
    "It should return an error message",
  );
});

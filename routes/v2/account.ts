import { Router, Status } from "https://deno.land/x/oak@v11.1.0/mod.ts";

import * as diskLogic from "../../logic/disk.ts";
import * as auth from "../../middlewares/auth.ts";
import * as typeHelper from "../../utils/types.ts";
import { runCommand } from "../../services/karen.ts";

import { TOTP } from "https://deno.land/x/god_crypto@v1.4.10/otp.ts";
import * as authLogic from "../../logic/auth.ts";
import { getPasswordFromContext } from "../../utils/auth.ts";
import { getUserData, removeAllRecords, setRecord } from "../../logic/runningcitadel.ts";

import constants from "../../utils/const.ts";

const router = new Router({
  prefix: "/v2/account",
});

// Endpoint to change your password.
router.post(
  "/change-password",
  auth.basic,
  async (ctx, next) => {
    const body = await ctx.request.body({
      type: "json",
    }).value;
    if (
      typeof body.password !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      ctx.throw(Status.BadRequest, "Received invalid data.");
    }

    const currentPassword: string = body.password as string;
    const newPassword: string = body.newPassword as string;

    try {
      typeHelper.isString(newPassword, ctx);
      typeHelper.isMinPasswordLength(newPassword, ctx);
    } catch {
      ctx.throw(
        Status.BadRequest,
        "New password does not meet the security requirements.",
      );
      return;
    }
    if (newPassword === currentPassword) {
      ctx.throw(
        Status.BadRequest,
        "The new password must not be the same as existing password",
      );
    }

    try {
      // Start change password process in the background and immediately return
      await authLogic.changePassword(currentPassword, newPassword);
      ctx.response.status = Status.OK;
      ctx.response.body = { percent: 100 };
    } catch (error: unknown) {
      ctx.throw(
        Status.InternalServerError,
        typeof error === "string"
          ? error
          : ((error as { message?: string }).message || JSON.stringify(error)),
      );
    }

    await next();
  },
);

// Returns the current status of the change password process.
router.get("/change-password/status", auth.jwt, async (ctx, next) => {
  ctx.response.body = { percent: 100 };
  await next();
});

// Registered does not need auth. This is because the user may not be registered at the time and thus won't always have
// an auth token.
router.get("/registered", async (ctx, next) => {
  ctx.response.body = { registered: await authLogic.isRegistered() };
  await next();
});

// Endpoint to register a password with the device. Wallet must not exist. This endpoint is authorized with basic auth
// or the property password from the body.
router.post(
  "/register",
  async (ctx, next) => {
    const body = await ctx.request.body({
      type: "json",
    }).value;
    const plainTextPassword = await getPasswordFromContext(ctx);
    typeHelper.isString(plainTextPassword, ctx);
    const seed: string[] = body.seed as string[];

    if (seed.length !== 24) {
      ctx.throw(Status.BadRequest, "Invalid seed length");
    }

    typeHelper.isString(body.name, ctx);
    typeHelper.isString(plainTextPassword, ctx);
    typeHelper.isMinPasswordLength(plainTextPassword, ctx);

    const jwt = await authLogic.register(body.name, plainTextPassword, seed);

    ctx.response.body = { jwt };
    await next();
  },
);

router.post(
  "/login",
  auth.basic,
  async (ctx, next) => {
    const plainTextPassword = await getPasswordFromContext(ctx);
    typeHelper.isString(plainTextPassword, ctx);
    const jwt = await authLogic.login(plainTextPassword);

    ctx.response.body = { jwt };
    await next();
  },
);

router.get("/info", auth.jwt, async (ctx, next) => {
  ctx.response.body = await authLogic.getInfo();
  await next();
});

router.post(
  "/seed",
  auth.basic,
  async (ctx, next) => {
    const plainTextPassword = await getPasswordFromContext(ctx);
    const seed = await authLogic.seed(plainTextPassword);
    ctx.response.body = { seed };
    await next();
  },
);

router.post("/refresh", auth.jwt, async (ctx, next) => {
  const jwt = await authLogic.refresh();
  ctx.response.body = { jwt };
  await next();
});

router.get("/totp/setup", auth.jwt, async (ctx, next) => {
  const info = await authLogic.getInfo();
  const key = await authLogic.generateTotpKey(info.totpSecret);
  ctx.response.body = { key };
  await next();
});

router.post("/totp/enable", auth.jwt, async (ctx) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;
  const info = await authLogic.getInfo();

  if (info.totpSecret && body.authenticatorToken) {
    // TOTP should be already set up
    const key = info.totpSecret;

    typeHelper.isString(body.authenticatorToken, ctx);
    const totp = new TOTP(key as string);
    const isValid = totp.verify(body.authenticatorToken as string);

    if (isValid) {
      await authLogic.enableTotp();
      ctx.response.body = { success: true };
    } else {
      ctx.throw(Status.Unauthorized, "TOTP token invalid");
    }
  } else {
    ctx.throw(Status.InternalServerError, "TOTP enable failed");
  }
});

router.post("/totp/disable", auth.jwt, async (ctx, next) => {
  const info = await authLogic.getInfo();
  const body = await ctx.request.body({
    type: "json",
  }).value;

  if (await diskLogic.isTotpEnabled() && body.authenticatorToken) {
    // TOTP should be already set up
    const key = info.totpSecret;

    typeHelper.isString(body.authenticatorToken, ctx);
    const totp = new TOTP(key as string);
    const isValid = totp.verify(body.authenticatorToken as string);

    if (isValid) {
      await diskLogic.disableTotp();
      ctx.response.body = { success: true };
    } else {
      ctx.throw(Status.Unauthorized, "TOTP token invalid");
    }
  } else {
    ctx.throw(Status.InternalServerError, "TOTP disable failed");
  }

  await next();
});

// Returns the current status of TOTP.
router.get("/totp/status", async (ctx, next) => {
  ctx.response.body = { totpEnabled: await diskLogic.isTotpEnabled() };
  await next();
});

router.get("/runningcitadel", auth.jwt, async (ctx, next) => {
  ctx.response.body = await getUserData();
  await next();
});

router.get("/letsencrypt", auth.jwt, async (ctx, next) => {
  const userFile = await diskLogic.readUserFile();
  ctx.response.status = Status.OK;
  ctx.response.body = userFile.https || {};
  await next();
});

router.post("/letsencrypt", auth.jwt, async (ctx, next) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;
  if (
    typeof body.email !== "string" ||
    body.acceptedTos !== true
  ) {
    ctx.throw(
      Status.BadRequest,
      "Received invalid data (Missing email/Not agreed to the ToS).",
    );
    return;
  }
  await diskLogic.enableLetsencrypt(body.email);
  ctx.response.status = Status.OK;
  ctx.response.body = {"success": true};
  await next();
});

router.get("/ip-addr", auth.jwt, async (ctx, next) => {
  ctx.response.body = JSON.stringify(constants.IP_ADDR);
  ctx.response.headers.set("Content-Type", "application/json");
  await next();
});

router.post("/domain", auth.jwt, async (ctx, next) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;
  if (
    typeof body.app !== "string" ||
    typeof body.domain !== "string"
  ) {
    ctx.throw(Status.BadRequest, "Received invalid data.");
    return;
  }
  if (body.domain.endsWith(`.runningcitadel.com`)) {
    if(!constants.IP_ADDR) {
      ctx.throw(Status.InternalServerError, "IP address not set");
      return;
    }
    const subdomain = body.domain.slice(0, -19);
    const recordType = constants.IP_ADDR.includes(":") ? "AAAA" : "A";
    setRecord(subdomain, recordType, constants.IP_ADDR);
  }
  await diskLogic.addAppDomain(body.app, body.domain);
  await runCommand("trigger caddy-config-update");
  ctx.response.status = Status.OK;
  await next();
});

router.delete("/domain", auth.jwt, async (ctx, next) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;
  if (
    typeof body.app !== "string"
  ) {
    ctx.throw(Status.BadRequest, "Received invalid data.");
    return;
  }
  const userData = await diskLogic.readUserFile();
  if (typeof userData.https?.app_domains![body.app] !== "string") {
    ctx.throw(Status.NotFound, "This app has no domain configured");
  }
  if (body.domain.endsWith(`.runningcitadel.com`)) {
    if(!constants.IP_ADDR) {
      ctx.throw(Status.InternalServerError, "IP address not set");
      return;
    }
    const subdomain = body.domain.slice(0, -19);
    await removeAllRecords(subdomain);
  }
  await diskLogic.removeAppDomain(body.app);
  await runCommand("trigger caddy-config-update");
  ctx.response.status = Status.OK;
  await next();
});

export default router;

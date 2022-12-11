import { Router, Status } from "https://deno.land/x/oak@v11.1.0/mod.ts";

import * as appsLogic from "../../logic/apps.ts";
import * as diskLogic from "../../logic/disk.ts";

import * as auth from "../../middlewares/auth.ts";
import { runCommand } from "../../services/karen.ts";

const router = new Router({
  prefix: "/v2/apps",
});

router.get("/", auth.jwt, async (ctx, next) => {
  // auth.jwt ensures this exists
  const jwt = ctx.request.headers.get("Authorization")?.split(" ")[1];
  const query = {
    installed: ctx.request.url.searchParams.get("installed") === "1",
  };
  const apps = await appsLogic.get(query);
  ctx.response.body = { apps, jwt };
  await next();
});

router.post("/:id/install", auth.jwt, async (ctx, next) => {
  const { id } = ctx.params;
  await appsLogic.install(id);
  ctx.response.body = {};
  ctx.response.status = Status.OK;
  await next();
});

router.post("/:id/uninstall", auth.jwt, async (ctx, next) => {
  const { id } = ctx.params;
  await appsLogic.uninstall(id);
  ctx.response.body = {};
  ctx.response.status = Status.OK;
  await next();
});

router.post("/:id/update", auth.jwt, async (ctx, next) => {
  const { id } = ctx.params;
  await appsLogic.update(id);
  ctx.response.body = {};
  ctx.response.status = Status.OK;
  await next();
});

router.get("/updates", auth.jwt, async (ctx, next) => {
  ctx.response.body = await appsLogic.getAvailableUpdates();
  ctx.response.status = Status.OK;
  await next();
});

router.post("/update", auth.jwt, async (ctx, next) => {
  await runCommand("trigger app-update");
  ctx.response.body = {};
  ctx.response.status = Status.OK;
  await next();
});

router.get("/update-status", auth.jwt, async (ctx, next) => {
  ctx.response.body = await diskLogic.readAppUpdateStatusFile();
  ctx.response.status = Status.OK;
  await next();
});

router.get("/stores", auth.jwt, async (ctx, next) => {
  ctx.response.body = await appsLogic.getAppRepos();
  ctx.response.status = Status.OK;
  await next();
});

router.post("/sources", auth.jwt, async (ctx, next) => {
  const body = await ctx.request.body({
    type: "json",
  }).value;
  if (
    typeof body.repo !== "string" ||
    typeof body.branch !== "string"
  ) {
    ctx.throw(Status.BadRequest, "Received invalid data.");
    return;
  }
  await appsLogic.addAppSrc({
    repo: body.repo,
    branch: body.branch,
  });
  ctx.response.status = Status.OK;
  await next();
});

export default router;

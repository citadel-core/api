import { Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";

const router = new Router({
  prefix: "/ping",
});

router.get("/", async (ctx, next) => {
  ctx.response.body = {
    version: "Citadel API 0.0.1",
  };
  await next();
});

export default router;

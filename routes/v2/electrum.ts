import { Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";

import * as systemLogic from "../../logic/system.ts";

import * as auth from "../../middlewares/auth.ts";
import constants from "../../utils/const.ts";
import ElectrumClient from "../../services/electrum.ts";

const router = new Router({
  prefix: "/v2/electrum",
});

if (constants.ELECTRUM_HOST && constants.ELECTRUM_PORT) {
  let electrumClient;
  async function initClient() {
    try {
      if (!electrumClient)
        electrumClient = new ElectrumClient(
          constants.ELECTRUM_HOST,
          constants.ELECTRUM_PORT,
        );
    } catch (err) {
      console.error(err);
    }
  };
  initClient();
  router.get("/connection-details", auth.jwt, async (ctx, next) => {
    ctx.response.body = await systemLogic.getElectrumConnectionDetails();
    await next();
  });

  router.get("/height", auth.jwt, async (ctx, next) => {
    initClient();
    await electrumClient.connect();
    const data = await electrumClient.sendRequest<{
      height: number;
    }>("blockchain.headers.subscribe", []);
    ctx.response.body = JSON.stringify(data.height);
    await next();
  });
} else {
  console.warn("Electrum does not seem to be installed");
}

export default router;

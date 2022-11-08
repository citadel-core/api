import { config } from "https://deno.land/x/dotenv@v3.2.0/mod.ts";
import {
  Application,
} from "https://deno.land/x/oak@v11.1.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import logger from "https://deno.land/x/oak_logger@1.0.0/mod.ts";

import ping from "./routes/ping.ts";
import account from "./routes/v2/account.ts";
import apps from "./routes/v2/apps.ts";
import bitcoin from "./routes/v2/bitcoin.ts";
import electrum from "./routes/v2/electrum.ts";
import external from "./routes/v2/external.ts";
import system from "./routes/v2/system.ts";

config();

const app = new Application();

app.use(logger.logger);
app.use(logger.responseTime);

app.use(oakCors({ origin: "*" }));

// Handle errors
app.use(async ({ response }, next) => {
  try {
    await next();
    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    response.status = err.status || 500;
    response.body = JSON.stringify(err.message || err);
  }
});

app.use(ping.routes());
app.use(ping.allowedMethods());

// V2 API
app.use(apps.routes());
app.use(apps.allowedMethods());
app.use(account.routes());
app.use(account.allowedMethods());
app.use(bitcoin.routes());
app.use(bitcoin.allowedMethods());
app.use(electrum.routes());
app.use(electrum.allowedMethods());
app.use(external.routes());
app.use(external.allowedMethods());
app.use(system.routes());
app.use(system.allowedMethods());

app.listen("0.0.0.0:3000");

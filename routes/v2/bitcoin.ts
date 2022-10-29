import { Router } from "https://deno.land/x/oak@v11.1.0/mod.ts";

import * as systemLogic from "../../logic/system.ts";
import BitcoinRPC from "https://deno.land/x/bitcoin_rpc@v1.0.2/mod.ts";

import * as auth from "../../middlewares/auth.ts";
import constants from "../../utils/const.ts";
import { FetchedRawTransaction, MempoolInfo, Block, getInfoResponse } from "../../types/bitcoin.d.ts";

const router = new Router({
  prefix: '/v2/bitcoin',
});

async function getBlocks(bitcoinClient: BitcoinRPC, fromHeight: number, toHeight: number): Promise<Block[]> {
  const startingBlockHashRaw = await bitcoinClient.getblockhash(
    toHeight,
  );

  let currentHash = startingBlockHashRaw;

  const blocks = [];

  // Loop from 'to height' till 'from Height'
  for (
    let currentHeight = toHeight;
    currentHeight >= fromHeight;
    currentHeight--
  ) {
    // eslint-disable-next-line no-await-in-loop
    const block = await bitcoinClient.getblock(currentHash);

    const formattedBlock = {
      hash: block.hash as string,
      height: block.height as number,
      numTransactions: block.tx.length as number,
      confirmations: block.confirmations as number,
      time: block.time as number,
      size: block.size as number,
    };

    blocks.push(formattedBlock);

    currentHash = block.previousblockhash;
    // Terminate loop if we reach the genesis block
    if (!currentHash) {
      break;
    }
  }

  return blocks;
}

if (constants.BITCOIN_HOST && constants.BITCOIN_RPC_PORT && constants.BITCOIN_RPC_USER && constants.BITCOIN_RPC_PASSWORD) {
  const bitcoinClient = new BitcoinRPC({
    host: constants.BITCOIN_HOST,
    port: constants.BITCOIN_RPC_PORT,
    username: constants.BITCOIN_RPC_USER,
    password: constants.BITCOIN_RPC_PASSWORD,
  });

  router.get('/mempool', auth.jwt, async (ctx, next) => {
    ctx.response.body = await bitcoinClient.getmempoolinfo() as MempoolInfo;
    await next();
  });

  router.get('/blockcount', auth.jwt, async (ctx, next) => {
    ctx.response.body = await bitcoinClient.getblockcount() as number
    await next();
  });

  router.get('/connections', auth.jwt, async (ctx, next) => {
    ctx.response.body = await bitcoinClient.request("getconnectioncount", []) as number;
    await next();
  });

  router.get('/chain', auth.jwt, async (ctx, next) => {
    ctx.response.body = await bitcoinClient.getblockchaininfo() as getInfoResponse;
    await next();
  });

  router.get('/version', auth.jwt, async (ctx, next) => {
    ctx.response.body = JSON.stringify((await bitcoinClient.getnetworkinfo()).subversion as string);
    await next();
  });

  router.get('/blocks', auth.jwt, async (ctx, next) => {
    const fromHeight = Number.parseInt(ctx.request.url.searchParams.get("from") as string);
    const toHeight = Number.parseInt(ctx.request.url.searchParams.get("to") as string);
    ctx.response.body = await getBlocks(bitcoinClient, fromHeight, toHeight);
    await next();
  });

  router.get('/tx/:id', auth.jwt, async (ctx, next) => {
    ctx.response.body = await bitcoinClient.getrawtransaction(ctx.params.id) as FetchedRawTransaction;
    await next();
  });

  router.get("/connection-details/p2p", auth.jwt, async (ctx, next) => {
    ctx.response.body = await systemLogic.getBitcoinP2pConnectionDetails();
    await next();
  });

  router.get("/connection-details/rpc", auth.jwt, async (ctx, next) => {
    ctx.response.body = await systemLogic.getBitcoinRpcConnectionDetails();
    await next();
  });
} else {
  console.warn("Bitcoin does not seem to be installed");
}

export default router;
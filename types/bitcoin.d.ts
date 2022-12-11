export type MempoolInfo = {
  size: number;
  bytes: number;
  usage: number;
  maxmempol: number;
  mempoolminfee: number;
  minrelaytxfee: number;
};

export type DecodedRawTransaction = {
  txid: string;
  hash: string;
  size: number;
  vsize: number;
  version: number;
  locktime: number;
  vin: TxIn[];
  vout: TxOut[];
};

export interface FetchedRawTransaction extends DecodedRawTransaction {
  hex: string;
  blockhash: string;
  confirmations: number;
  time: number;
  blocktime: number;
}

export type TxIn = {
  txid: string;
  vout: number;
  scriptSig: {
    asm: string;
    hex: string;
  };
  txinwitness?: string[];
  sequence: number;
};

export type TxOut = {
  value: number;
  n: number;
  scriptPubKey: {
    asm: string;
    hex: string;
    reqSigs: number;
    type: string;
    addresses: string[];
  };
};

export type Block = {
  hash: string;
  height: number;
  numTransactions: number;
  confirmations: number;
  time: number;
  size: number;
};

export type getInfoResponse = {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  time: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
  warnings: string;
};

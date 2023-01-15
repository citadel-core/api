import constants from "../utils/const.ts";
import { deriveEntropy } from "./system.ts";
import type { DnsRecord } from "https://cdn.skypack.dev/cloudflare-client?dts";

export async function getUserData() {
  const response = await fetch("https://runningcitadel.com/api/dns/getInfo", {
    headers: {
      "Authorization": "Basic " +
        btoa(
          `${await deriveEntropy("runningcitadel-username")}:${
            await deriveEntropy("runningcitadel-password")
          }`,
        ),
    },
    client: Deno.createHttpClient({
      proxy: {
        url: `socks5h://${constants.TOR_PROXY_IP}:${constants.TOR_PROXY_PORT}`,
      },
    }),
  });
  if (response.status !== 200) {
    return {
      isSetup: false,
      username: await deriveEntropy("runningcitadel-username"),
      password: await deriveEntropy("runningcitadel-password"),
      subdomain: "",
    };
  }
  const data = await response.json();
  return {
    isSetup: true,
    username: await deriveEntropy("runningcitadel-username"),
    password: await deriveEntropy("runningcitadel-password"),
    subdomain: data.domain,
  };
}

export async function setRecord(subdomain: string, type: string, content: string) {
  const response = await fetch("https://runningcitadel.com/api/dns/create", {
    headers: {
      "Authorization": "Basic " +
        btoa(
          `${await deriveEntropy("runningcitadel-username")}:${
            await deriveEntropy("runningcitadel-password")
          }`,
        ),
    },
    method: "POST",
    body: JSON.stringify({
      type,
      name: subdomain,
      content,
      ttl: 120,
    }),
    client: Deno.createHttpClient({
      proxy: {
        url: `socks5h://${constants.TOR_PROXY_IP}:${constants.TOR_PROXY_PORT}`,
      },
    }),
  });
  if (response.status !== 200) {
    throw new Error(await response.text());
  }
  return await response.json();
}

export async function removeAllRecords(subdomain: string) {
  const response = await fetch("https://runningcitadel.com/api/dns/find", {
    headers: {
      "Authorization": "Basic " +
        btoa(
          `${await deriveEntropy("runningcitadel-username")}:${
            await deriveEntropy("runningcitadel-password")
          }`,
        ),
    },
    method: "POST",
    body: JSON.stringify({
      name: subdomain,
      ttl: 120,
    }),
    client: Deno.createHttpClient({
      proxy: {
        url: `socks5h://${constants.TOR_PROXY_IP}:${constants.TOR_PROXY_PORT}`,
      },
    }),
  });
  if (response.status !== 200) {
    throw new Error(await response.text());
  }
  const records: DnsRecord[] = await response.json();
  for (const record of records) {
    const response = await fetch(`https://runningcitadel.com/api/dns/records/${record.id}`, {
      headers: {
        "Authorization": "Basic " +
          btoa(
            `${await deriveEntropy("runningcitadel-username")}:${
              await deriveEntropy("runningcitadel-password")
            }`,
          ),
      },
      method: "DELETE",
      client: Deno.createHttpClient({
        proxy: {
          url: `socks5h://${constants.TOR_PROXY_IP}:${constants.TOR_PROXY_PORT}`,
        },
      }),
    });
    if (response.status !== 200) {
      console.warn(await response.text());
    }
  }
}

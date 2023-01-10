import constants from "../utils/const.ts";
import { deriveEntropy } from "./system.ts";

const tor = Deno.createHttpClient({
  proxy: {
    url: `socks5h://${constants.TOR_PROXY_IP}:${constants.TOR_PROXY_PORT}`,
  },
});

export async function getUserData() {
  const response = await fetch("https://runningcitadel.com/api/dns/getInfo", {
    headers: {
      "Authorization": "Basic " +
        btoa(
          `${deriveEntropy("runningcitadel-username")}:${
            deriveEntropy("runningcitadel-password")
          }`,
        ),
    },
    client: tor,
  });
  if (response.status !== 200) {
    console.warn(`Request to https://runningcitadel.com/api/dns/getInfo failed with status ${response.status}: ${await response.text()}`);
    console.log("Basic " +
        btoa(
          `${deriveEntropy("runningcitadel-username")}:${
            deriveEntropy("runningcitadel-password")
          }`));
                console.log(`${deriveEntropy("runningcitadel-username")}:${
            deriveEntropy("runningcitadel-password")
          }`);
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
          `${deriveEntropy("runningcitadel-username")}:${
            deriveEntropy("runningcitadel-username")
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
    client: tor,
  });
  if (response.status !== 200) {
    throw new Error(await response.text());
  }
  return await response.json();
}

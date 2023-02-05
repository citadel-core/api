import type {
  appUpdateStatus,
  backupStatus,
  debugStatus,
  updateStatus,
  versionFile,
} from "../utils/types.ts";
import constants from "../utils/const.ts";
import type { MetadataV4 } from "./apps.ts";
import {
  ensureFile,
  exists,
  existsSync,
} from "https://deno.land/std@0.176.0/fs/mod.ts";
import { join } from "https://deno.land/std@0.176.0/path/mod.ts";
import * as YAML from "https://deno.land/std@0.176.0/encoding/yaml.ts";
import { getUserData as getRunningCitadelUserData } from "./runningcitadel.ts";

export type UserFile = {
  /** The user's name */
  name?: string;
  /** The users password, hashed by bcrypt */
  password?: string;
  /** The users mnemoic LND seed */
  seed?: string;
  /** The list of IDs of installed apps */
  installedApps?: string[];
  /** Auth type */
  secondFactors?: ("totp" | "webauthn")[];
  totpSecret?: string;
  webauthnSecret?: string;
  // /** User settings */
  // settings?: UserSettings;
  https?: {
    email: string;
    agreed_lets_encrypt_tos: boolean;
    app_domains?: Record<string, string>;
    user?: {
      isSetup: boolean;
      username: string;
      password: string;
      subdomain: string;
    };
  };
};

export function getRandomString(s: number) {
  if (s % 2 == 1) {
    throw new Deno.errors.InvalidData("Only even sizes are supported");
  }
  const buf = new Uint8Array(s / 2);
  crypto.getRandomValues(buf);
  let ret = "";
  for (let i = 0; i < buf.length; ++i) {
    ret += ("0" + buf[i].toString(16)).slice(-2);
  }
  return ret;
}

export async function readJsonFile<T = unknown>(path: string): Promise<T> {
  const contents = await Deno.readTextFile(path);
  return JSON.parse(contents) as T;
}

export function writeJsonFile(path: string, data: unknown): Promise<void> {
  return Deno.writeTextFile(path, JSON.stringify(data));
}

export async function readYAMLFile<T = unknown>(path: string): Promise<T> {
  const contents = await Deno.readTextFile(path);
  return YAML.parse(contents) as T;
}

export function writeYAMLFile(path: string, data: unknown): Promise<void> {
  return Deno.writeTextFile(
    path,
    YAML.stringify(data as Record<string, unknown>),
  );
}

async function safeWriteTextFile(
  filePath: string,
  data: string,
): Promise<void> {
  const tempFileName = `${filePath}.${getRandomString(8)}`;

  await Deno.writeTextFile(tempFileName, data);
  try {
    await Deno.rename(tempFileName, filePath);
  } catch (err) {
    await Deno.remove(tempFileName);
    throw err;
  }
}

export async function resetUserFile() {
  const userfile = await readUserFile();
  await writeUserFile({
    installedApps: userfile.installedApps,
  });
}
export async function disableTotp(): Promise<void> {
  const userFile = await readUserFile();
  userFile.secondFactors = [];
  await writeUserFile(userFile);
}

export async function saveTotpKey(key: string): Promise<void> {
  const userFile = await readUserFile();
  userFile.totpSecret = key;
  await writeUserFile(userFile);
}

export async function enableTotp(): Promise<void> {
  const userFile = await readUserFile();
  userFile.secondFactors = ["totp"];
  if (!userFile.totpSecret) {
    throw new Error("No TOTP secret stored!");
  }
  await writeUserFile(userFile);
}

export async function enableLetsencrypt(email: string): Promise<void> {
  const userFile = await readUserFile();
  userFile.https = {
    email,
    agreed_lets_encrypt_tos: true,
    user: await getRunningCitadelUserData(),
    ...(userFile.https || {}),
  };
  await writeUserFile(userFile);
}

export async function addAppDomain(app: string, domain: string): Promise<void> {
  const userFile = await readUserFile();
  if (!userFile.https!.app_domains) userFile.https!.app_domains = {};
  userFile.https!.app_domains![app] = domain;
  await writeUserFile(userFile);
}

export async function removeAppDomain(app: string): Promise<void> {
  const userFile = await readUserFile();
  if (!userFile.https!.app_domains) userFile.https!.app_domains = {};
  delete userFile.https!.app_domains![app];
  await writeUserFile(userFile);
}

export async function isTotpEnabled(): Promise<boolean> {
  const userFile = await readUserFile();
  return userFile.secondFactors?.includes("totp") || false;
}

export async function isWebauthnEnabled(): Promise<boolean> {
  const userFile = await readUserFile();
  return userFile.secondFactors?.includes("webauthn") || false;
}

export async function readUserFile(): Promise<UserFile> {
  const defaultProperties: UserFile = {
    name: "",
    password: "",
    seed: "",
    installedApps: [],
  };
  const userFile = (await readJsonFile(constants.USER_FILE)) as UserFile;
  return { ...defaultProperties, ...userFile };
}

export async function writeUserFile(json: UserFile): Promise<void> {
  await writeJsonFile(constants.USER_FILE, json);
}

export async function writeSeedFile(
  seed: string,
): Promise<void> {
  await ensureFile(constants.SEED_FILE);
  return Deno.writeTextFile(constants.SEED_FILE, seed);
}

export function readSeedFile(): Promise<string> {
  return Deno.readTextFile(constants.SEED_FILE);
}

export function seedFileExists(): boolean {
  return existsSync(constants.SEED_FILE);
}

export function readBitcoinP2pHiddenService(): Promise<string> {
  return readHiddenService("bitcoin-p2p");
}

export function readBitcoinRpcHiddenService(): Promise<string> {
  return readHiddenService("bitcoin-rpc");
}

export function readLndRestHiddenService(): Promise<string> {
  return readHiddenService("lnd-rest");
}

export function readLndGrpcHiddenService(): Promise<string> {
  return readHiddenService("lnd-grpc");
}

export function readLndCert(): Promise<string> {
  return Deno.readTextFile(constants.LND_CERT_FILE);
}

export function readLndAdminMacaroon(): Promise<Uint8Array> {
  return Deno.readFile(constants.LND_ADMIN_MACAROON_FILE);
}

export function readVersionFile() {
  return readJsonFile<versionFile>(constants.VERSION_FILE);
}

export function readUpdateStatusFile() {
  return readJsonStatusFile<updateStatus>("update");
}

export function readAppUpdateStatusFile() {
  return readJsonStatusFile<appUpdateStatus>("app-update");
}

export async function writeUpdateStatusFile(json: updateStatus): Promise<void> {
  await writeJsonStatusFile("update", json);
}

export function updateLockFileExists(): Promise<boolean> {
  return statusFileExists("update-in-progress");
}

export function readBackupStatusFile(): Promise<backupStatus> {
  return readJsonStatusFile<backupStatus>("backup");
}

export function readJwtPrivateKeyFile(): Promise<string> {
  return Deno.readTextFile(constants.JWT_PRIVATE_KEY_FILE);
}

export function readJwtPublicKeyFile(): Promise<string> {
  return Deno.readTextFile(constants.JWT_PUBLIC_KEY_FILE);
}

export function writeJwtPrivateKeyFile(data: string): Promise<void> {
  return safeWriteTextFile(constants.JWT_PRIVATE_KEY_FILE, data);
}

export function writeJwtPublicKeyFile(data: string): Promise<void> {
  return safeWriteTextFile(constants.JWT_PUBLIC_KEY_FILE, data);
}

export function readDebugStatusFile(): Promise<debugStatus> {
  return readJsonStatusFile<debugStatus>("debug");
}

export async function writeStatusFile(
  statusFile: string,
  contents: string,
): Promise<void> {
  if (!/^[\w-]+$/.test(statusFile)) {
    throw new Error("Invalid status file characters");
  }

  const statusFilePath = join(constants.STATUS_DIR, statusFile);
  await ensureFile(statusFilePath);
  return Deno.writeTextFile(statusFilePath, contents);
}

export async function readStatusFile<FileType = unknown>(
  statusFile: string,
): Promise<FileType> {
  if (!/^[\w-]+$/.test(statusFile)) {
    throw new Error("Invalid status file characters");
  }

  const statusFilePath = join(constants.STATUS_DIR, statusFile);
  return (await readJsonFile(statusFilePath)) as FileType;
}

export function statusFileExists(statusFile: string): Promise<boolean> {
  if (!/^[\w-]+$/.test(statusFile)) {
    throw new Error("Invalid status file characters");
  }

  const statusFilePath = join(constants.STATUS_DIR, statusFile);
  return exists(statusFilePath);
}

export function deleteStatusFile(statusFile: string): Promise<void> {
  if (!/^[\w-]+$/.test(statusFile)) {
    throw new Error("Invalid status file characters");
  }

  const statusFilePath = join(constants.STATUS_DIR, statusFile);
  return Deno.remove(statusFilePath);
}

export function readAppRegistry(): Promise<MetadataV4[]> {
  const appRegistryFile = join(constants.APPS_DIR, "registry.json");
  return readJsonFile<MetadataV4[]>(appRegistryFile);
}

export function readVirtualApps(): Promise<Record<string, string[]>> {
  const appRegistryFile = join(constants.APPS_DIR, "virtual-apps.json");
  return readJsonFile<Record<string, string[]>>(appRegistryFile);
}

export function readHiddenService(id: string): Promise<string> {
  if (!/^[\w-]+$/.test(id)) {
    throw new Error("Invalid hidden service ID");
  }

  const hiddenServiceFile = join(
    constants.TOR_HIDDEN_SERVICE_DIR,
    id,
    "hostname",
  );
  return Deno.readTextFile(hiddenServiceFile);
}

export function readTextStatusFile(resource: string): Promise<string> {
  const statusFilePath = join(constants.STATUS_DIR, resource);
  return Deno.readTextFile(statusFilePath);
}

export async function readJsonStatusFile<FileType = unknown>(
  resource: string,
): Promise<FileType> {
  const statusFilePath = join(
    constants.STATUS_DIR,
    `${resource}-status.json`,
  );
  return (await readJsonFile(statusFilePath).catch(() => null)) as FileType;
}

export async function writeJsonStatusFile(
  resource: string,
  data: unknown,
): Promise<void> {
  const statusFilePath = join(
    constants.STATUS_DIR,
    `${resource}-status.json`,
  );
  await ensureFile(statusFilePath);
  return writeJsonFile(statusFilePath, data);
}

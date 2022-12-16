import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.0/mod.ts";
import aezeed from "npm:aezeed";
import iocane from "https://esm.sh/iocane@5.1.1/web/index";
import * as lightningApiService from "../services/lightning-api.ts";
import { generateJwt } from "../utils/jwt.ts";
import { runCommand } from "../services/karen.ts";
import * as diskLogic from "./disk.ts";
import { hmac } from "https://deno.land/x/god_crypto@v1.4.10/hmac.ts";
import { TOTP } from "https://deno.land/x/god_crypto@v1.4.10/otp.ts";

function getRandomString(s: number) {
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

export function generateRandomKey(): string {
  return getRandomString(10);
}

export type UserInfo = {
  username?: string;
  name: string;
  password?: string;
  plainTextPassword?: string;
  seed?: string;
  installedApps?: string[];
};

// Sets system password
const setSystemPassword = async (password: string) => {
  await diskLogic.writeStatusFile("password", password);
  await runCommand(`trigger change-password`);
};

// Change the dashboard and system password.
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  try {
    // Update user file
    const user = await diskLogic.readUserFile();
    const encryptedPassword = await hashPassword(newPassword);

    // Re-encrypt seed with new password
    const decryptedSeed = await iocane
      .createAdapter()
      .decrypt(user.seed as string, currentPassword);
    const encryptedSeed = await iocane
      .createAdapter()
      .encrypt(decryptedSeed, newPassword);

    // Update user file
    await diskLogic.writeUserFile({
      ...user,
      password: encryptedPassword,
      seed: encryptedSeed,
    });

    // Update system password
    await setSystemPassword(newPassword);
  } catch (err) {
    console.error(err);
    throw new Error("Unable to change password");
  }
}

// Returns an object with the hashed credentials inside.
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password);
}

// Returns true if the user is registered otherwise false.
export async function isRegistered(): Promise<boolean> {
  try {
    const userData = await diskLogic.readUserFile();

    return !!userData.name && !!userData.password;
  } catch {
    return false;
  }
}

// Derives the root seed and persists it to disk to be used for
// determinstically deriving further entropy for any other service.
export async function deriveSeed(
  plainTextPassword: string,
): Promise<void> {
  if (diskLogic.seedFileExists()) {
    return;
  }

  const userSeed = await seed(plainTextPassword);
  const mnemonic = userSeed.join(" ");
  const { entropy } = aezeed.CipherSeed.fromMnemonic(mnemonic);
  const generatedSeed = hmac("sha256", entropy, "umbrel-seed").hex();
  return diskLogic.writeSeedFile(generatedSeed);
}

// Derives the root seed and persists it to disk to be used for
// determinstically deriving further entropy for any other service.
export function deriveCitadelSeed(
  mnemonic: string[],
): void | Promise<void> {
  if (diskLogic.seedFileExists()) {
    return;
  }

  const { entropy } = aezeed.CipherSeed.fromMnemonic(mnemonic.join(" "));
  const generatedSeed = hmac("sha256", entropy, "umbrel-seed").hex();
  return diskLogic.writeSeedFile(generatedSeed);
}

// Log the user into the device. Caches the password if login is successful. Then returns jwt.
export async function login(plainTextPassword: string): Promise<string> {
  try {
    const jwt = await generateJwt("admin");

    await deriveSeed(plainTextPassword);

    await setSystemPassword(plainTextPassword);

    return jwt;
  } catch (err) {
    console.error(err);
    throw new Error("Unable to generate JWT");
  }
}

export async function getInfo(): Promise<diskLogic.UserFile> {
  try {
    const user = await diskLogic.readUserFile();

    // Remove sensitive info
    delete user.password;
    delete user.seed;

    return user;
  } catch {
    throw new Error("Unable to get account info");
  }
}

export async function seed(plainTextPassword: string): Promise<string[]> {
  // Decrypt mnemonic seed
  try {
    const { seed } = await diskLogic.readUserFile();

    const decryptedSeed = (await iocane
      .createAdapter()
      .decrypt(seed as string, plainTextPassword!)) as string;

    return decryptedSeed.split(",");
  } catch {
    throw new Error("Unable to decrypt mnemonic seed");
  }
}

// Registers the the user to the device. Returns an error if a user already exists.
export async function register(
  name: string,
  plainTextPassword: string,
  seed: string[],
): Promise<string> {
  if (await isRegistered()) {
    throw new Error("User already exists");
  }

  // Encrypt mnemonic seed for storage
  let encryptedSeed;
  try {
    encryptedSeed = await iocane
      .createAdapter()
      .encrypt(seed.join(","), plainTextPassword);
  } catch {
    throw new Error("Unable to encrypt mnemonic seed");
  }

  // Save user
  try {
    const hashedPassword = await hashPassword(plainTextPassword);
    const userfile = await diskLogic.readUserFile();
    await diskLogic.writeUserFile({
      ...userfile,
      name: name,
      password: hashedPassword,
      seed: encryptedSeed,
    });
  } catch {
    throw new Error("Unable to register user");
  }

  // Update system password
  try {
    await setSystemPassword(plainTextPassword);
  } catch {
    throw new Error("Unable to set system password");
  }

  // Derive seed
  try {
    await deriveCitadelSeed(seed);
  } catch (error: unknown) {
    console.error(error);
    throw new Error("Unable to create seed");
  }

  // Generate JWt
  let jwt;
  try {
    jwt = await generateJwt("admin");
  } catch {
    await diskLogic.resetUserFile();
    throw new Error("Unable to generate JWT");
  }

  // Initialize lnd wallet
  try {
    await lightningApiService.initializeWallet(seed, jwt);
  } catch (error: unknown) {
    await diskLogic.resetUserFile();
    console.error(error);
    throw new Error("Unable to initialize wallet");
  }

  await runCommand("trigger app-update");
  // Return token
  return jwt;
}

// Generate and return a new jwt token.
export async function refresh(): Promise<string> {
  try {
    const jwt = await generateJwt("admin");
    return jwt;
  } catch {
    throw new Error("Unable to generate JWT");
  }
}

export function enableTotp(): Promise<void> {
  return diskLogic.enableTotp();
}

export async function generateTotpKey(key?: string): Promise<string> {
  const newKey = key ? key : TOTP.generateSecret(16);
  await diskLogic.saveTotpKey(newKey);
  return newKey;
}

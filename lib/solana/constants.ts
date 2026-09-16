import { PublicKey } from "@solana/web3.js";
import { PASTA_MINT, PROGRAM_ID } from "../config";

export const PROGRAM = new PublicKey(PROGRAM_ID);
export const PASTA = new PublicKey(PASTA_MINT);
export const LOCK_SEED = "lock";
export const CREATE_LOCK_DISCRIMINATOR = Uint8Array.from([171, 216, 92, 167, 165, 8, 153, 90]);
export const LOCK_ACCOUNT_DISCRIMINATOR = Uint8Array.from([8, 255, 36, 202, 210, 22, 57, 137]);
export const LOCK_ACCOUNT_SIZE = 105;

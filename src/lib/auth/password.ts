import "server-only";
import { compare, hash } from "bcryptjs";

const ROUNDS = 12;
// Hash used to keep login timing similar for unknown emails (computed once, lazily).
let dummyHash: Promise<string> | null = null;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) {
    dummyHash ??= hash("timing-equaliser", ROUNDS);
    await compare(password, await dummyHash);
    return false;
  }
  return compare(password, passwordHash);
}

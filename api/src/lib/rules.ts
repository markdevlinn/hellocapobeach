// Plain rules with no database or network in them, so they can be tested directly.

export const MEMBER_INVITE_LIMIT = 5;

export type MemberStatus = "pending" | "approved" | "declined" | "removed";
export type MemberRole = "resident" | "admin";

export interface MemberLike {
  status: MemberStatus;
  role: MemberRole;
}

export type Access = "public" | "signed-in" | "approved" | "admin";

/** The single gate every endpoint goes through. */
export function allowed(need: Access, signedIn: boolean, member: MemberLike | null): boolean {
  if (need === "public") return true;
  if (!signedIn) return false;
  if (need === "signed-in") return true;
  if (!member || member.status !== "approved") return false;
  if (need === "approved") return true;
  return member.role === "admin";
}

/** How many more invite codes this member may create. Admins have no limit. */
export function invitesLeft(member: MemberLike, alreadyCreated: number): number | "unlimited" {
  if (member.status !== "approved") return 0;
  if (member.role === "admin") return "unlimited";
  return Math.max(0, MEMBER_INVITE_LIMIT - alreadyCreated);
}

/** A neighbor with a valid invite code skips the holding area. Everyone else waits. */
export function statusAfterSignup(hasValidInvite: boolean): MemberStatus {
  return hasValidInvite ? "approved" : "pending";
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

/** Codes are stored without spaces or dashes, in capitals. */
export function normalizeCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const c = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 4 && c.length <= 40 ? c : null;
}

export function newCode(random: (maxExclusive: number) => number): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

export function displayCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export interface SignupInput {
  fullName: string;
  streetId: number;
  houseNumber: string;
  phone: string | null;
  inviteCode: string | null;
}

/** Cleans and checks the sign-up form. Returns a message for the first problem found. */
export function parseSignup(body: unknown): { ok: true; value: SignupInput } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const fullName = typeof b.fullName === "string" ? b.fullName.trim().replace(/\s+/g, " ") : "";
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, message: "Please enter your full name." };
  const streetId = Number(b.streetId);
  if (!Number.isInteger(streetId) || streetId <= 0) return { ok: false, message: "Please choose your street." };
  const houseNumber = typeof b.houseNumber === "string" ? b.houseNumber.trim() : "";
  if (!/^[0-9]{1,6}[A-Za-z]?$/.test(houseNumber)) return { ok: false, message: "Please enter your house number." };
  let phone: string | null = null;
  if (typeof b.phone === "string" && b.phone.trim() !== "") {
    const digits = b.phone.replace(/[^0-9]/g, "");
    if (digits.length < 10 || digits.length > 15) return { ok: false, message: "That phone number does not look right." };
    phone = b.phone.trim().slice(0, 30);
  }
  let inviteCode: string | null = null;
  if (typeof b.inviteCode === "string" && b.inviteCode.trim() !== "") {
    inviteCode = normalizeCode(b.inviteCode);
    if (!inviteCode) return { ok: false, message: "That invite code does not look right." };
  }
  return { ok: true, value: { fullName, streetId, houseNumber, phone, inviteCode } };
}

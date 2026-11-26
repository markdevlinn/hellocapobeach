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

// ---------------------------------------------------------------
// Feed, events, marketplace and profile: form checks
// ---------------------------------------------------------------

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

export const POST_CATEGORIES = ["general", "safety", "lost_found", "recommendations"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export function isCategory(v: unknown): v is PostCategory {
  return typeof v === "string" && (POST_CATEGORIES as readonly string[]).includes(v);
}

export function parsePost(body: unknown): Parsed<{ category: PostCategory; title: string; body: string | null }> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isCategory(b.category)) return { ok: false, message: "Please choose a category." };
  const title = text(b.title);
  if (title.length < 3 || title.length > 140) return { ok: false, message: "Please give your post a short title." };
  const details = text(b.body);
  if (details.length > 5000) return { ok: false, message: "That post is too long." };
  return { ok: true, value: { category: b.category, title, body: details || null } };
}

export function parseComment(body: unknown): Parsed<{ body: string; parentId: string | null }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const words = text(b.body);
  if (words.length < 1) return { ok: false, message: "Please write a comment first." };
  if (words.length > 2000) return { ok: false, message: "That comment is too long." };
  if (b.parentId != null && b.parentId !== "" && !isUuid(b.parentId)) return { ok: false, message: "That comment was not found." };
  return { ok: true, value: { body: words, parentId: isUuid(b.parentId) ? b.parentId : null } };
}

export function parseEvent(
  body: unknown,
  now: Date
): Parsed<{ title: string; place: string; details: string | null; startsAt: Date }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = text(b.title);
  if (title.length < 3 || title.length > 140) return { ok: false, message: "Please give the event a name." };
  const place = text(b.place);
  if (place.length < 2 || place.length > 200) return { ok: false, message: "Please say where it is." };
  const details = text(b.details);
  if (details.length > 5000) return { ok: false, message: "Those details are too long." };
  const startsAt = new Date(typeof b.startsAt === "string" ? b.startsAt : NaN);
  if (Number.isNaN(startsAt.getTime())) return { ok: false, message: "Please choose a date and time." };
  const day = 24 * 60 * 60 * 1000;
  if (startsAt.getTime() < now.getTime() - day) return { ok: false, message: "That date has already passed." };
  if (startsAt.getTime() > now.getTime() + 730 * day) return { ok: false, message: "That date is too far away." };
  return { ok: true, value: { title, place, details: details || null, startsAt } };
}

export const LISTING_KINDS = ["for_sale", "free", "wanted"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

export function isListingKind(v: unknown): v is ListingKind {
  return typeof v === "string" && (LISTING_KINDS as readonly string[]).includes(v);
}

function cleanPhone(v: unknown): { ok: true; value: string | null } | { ok: false } {
  const t = text(v);
  if (t === "") return { ok: true, value: null };
  const digits = t.replace(/[^0-9]/g, "");
  if (digits.length < 10 || digits.length > 15) return { ok: false };
  return { ok: true, value: t.slice(0, 30) };
}

export function parseListing(body: unknown): Parsed<{
  kind: ListingKind;
  title: string;
  details: string | null;
  priceCents: number | null;
  contactPhone: string | null;
  contactEmail: string | null;
}> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isListingKind(b.kind)) return { ok: false, message: "Please choose For sale, Free or Wanted." };
  const title = text(b.title);
  if (title.length < 3 || title.length > 140) return { ok: false, message: "Please say what the item is." };
  const details = text(b.details);
  if (details.length > 5000) return { ok: false, message: "Those details are too long." };
  let priceCents: number | null = null;
  if (b.kind === "for_sale") {
    const dollars = typeof b.price === "number" ? b.price : Number(text(b.price).replace(/[$,]/g, ""));
    if (text(b.price) === "" && typeof b.price !== "number") return { ok: false, message: "Please enter a price." };
    if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1_000_000) return { ok: false, message: "That price does not look right." };
    priceCents = Math.round(dollars * 100);
  }
  const phone = cleanPhone(b.contactPhone);
  if (!phone.ok) return { ok: false, message: "That phone number does not look right." };
  const email = text(b.contactEmail).toLowerCase();
  if (email !== "" && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)) {
    return { ok: false, message: "That email address does not look right." };
  }
  if (!phone.value && email === "") return { ok: false, message: "Please add a phone number or email so neighbors can reach you." };
  return {
    ok: true,
    value: { kind: b.kind, title, details: details || null, priceCents, contactPhone: phone.value, contactEmail: email || null },
  };
}

export function parseProfile(body: unknown): Parsed<{
  phone: string | null;
  showPhone: boolean;
  showEmail: boolean;
  showHouseNumber: boolean;
  inDirectory: boolean;
}> {
  const b = (body ?? {}) as Record<string, unknown>;
  const phone = cleanPhone(b.phone);
  if (!phone.ok) return { ok: false, message: "That phone number does not look right." };
  return {
    ok: true,
    value: {
      phone: phone.value,
      // Only a real true switches something on. Anything else stays private.
      showPhone: b.showPhone === true && phone.value !== null,
      showEmail: b.showEmail === true,
      showHouseNumber: b.showHouseNumber === true,
      inDirectory: b.inDirectory === true,
    },
  };
}

/** Authors can remove their own things. Admins can remove anything. */
export function canRemove(member: MemberLike & { id: string }, ownerId: string): boolean {
  return member.status === "approved" && (member.role === "admin" || member.id.toLowerCase() === ownerId.toLowerCase());
}

// ---------------------------------------------------------------
// Admin area
// ---------------------------------------------------------------

export type MemberDecision = "approve" | "decline" | "remove" | "restore";

export function isMemberDecision(v: unknown): v is MemberDecision {
  return v === "approve" || v === "decline" || v === "remove" || v === "restore";
}

/** The status a member moves to, or null when that step is not allowed from where they are. */
export function memberTransition(current: MemberStatus, decision: MemberDecision): MemberStatus | null {
  if (decision === "approve") return current === "pending" ? "approved" : null;
  if (decision === "decline") return current === "pending" ? "declined" : null;
  if (decision === "remove") return current === "approved" ? "removed" : null;
  return current === "removed" || current === "declined" ? "approved" : null;
}

/** An admin cannot remove or decline themselves. It would lock the app with no admin. */
export function adminMayChange(selfId: string, targetId: string, decision: MemberDecision): boolean {
  const same = selfId.toLowerCase() === targetId.toLowerCase();
  return !(same && (decision === "remove" || decision === "decline"));
}

export function parseMemberEdit(body: unknown): Parsed<{ fullName: string; streetId: number; houseNumber: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const fullName = text(b.fullName).replace(/\s+/g, " ");
  if (fullName.length < 2 || fullName.length > 80) return { ok: false, message: "Please enter the full name." };
  const streetId = Number(b.streetId);
  if (!Number.isInteger(streetId) || streetId <= 0) return { ok: false, message: "Please choose a street." };
  const houseNumber = text(b.houseNumber);
  if (!/^[0-9]{1,6}[A-Za-z]?$/.test(houseNumber)) return { ok: false, message: "Please enter the house number." };
  return { ok: true, value: { fullName, streetId, houseNumber } };
}

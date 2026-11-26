import test from "node:test";
import assert from "node:assert/strict";
import { allowed, displayCode, invitesLeft, newCode, normalizeCode, parseSignup, statusAfterSignup } from "../src/lib/rules";

const pending = { status: "pending", role: "resident" } as const;
const resident = { status: "approved", role: "resident" } as const;
const admin = { status: "approved", role: "admin" } as const;
const declined = { status: "declined", role: "resident" } as const;
const removedAdmin = { status: "removed", role: "admin" } as const;

test("visitors with no login only reach public endpoints", () => {
  assert.equal(allowed("public", false, null), true);
  for (const need of ["signed-in", "approved", "admin"] as const) assert.equal(allowed(need, false, null), false);
});

test("signed in but not joined: can reach sign-up, nothing else", () => {
  assert.equal(allowed("signed-in", true, null), true);
  assert.equal(allowed("approved", true, null), false);
  assert.equal(allowed("admin", true, null), false);
});

test("pending and declined members see nothing members-only", () => {
  for (const m of [pending, declined]) {
    assert.equal(allowed("approved", true, m), false);
    assert.equal(allowed("admin", true, m), false);
  }
});

test("approved residents are in but are not admins", () => {
  assert.equal(allowed("approved", true, resident), true);
  assert.equal(allowed("admin", true, resident), false);
});

test("admins must also be approved", () => {
  assert.equal(allowed("admin", true, admin), true);
  assert.equal(allowed("admin", true, removedAdmin), false);
  assert.equal(allowed("approved", true, removedAdmin), false);
});

test("a member record never grants access without a login", () => {
  assert.equal(allowed("approved", false, admin), false);
  assert.equal(allowed("admin", false, admin), false);
});

test("members get 5 invites, admins unlimited, pending none", () => {
  assert.equal(invitesLeft(resident, 0), 5);
  assert.equal(invitesLeft(resident, 3), 2);
  assert.equal(invitesLeft(resident, 5), 0);
  assert.equal(invitesLeft(resident, 9), 0);
  assert.equal(invitesLeft(admin, 500), "unlimited");
  assert.equal(invitesLeft(pending, 0), 0);
});

test("an invite code skips the holding area, no code waits", () => {
  assert.equal(statusAfterSignup(true), "approved");
  assert.equal(statusAfterSignup(false), "pending");
});

test("codes: typed with dashes, spaces or lowercase still match", () => {
  assert.equal(normalizeCode("abcd-2345"), "ABCD2345");
  assert.equal(normalizeCode(" ABCD 2345 "), "ABCD2345");
  assert.equal(normalizeCode("ab"), null);
  assert.equal(normalizeCode(42), null);
  assert.equal(displayCode("ABCD2345"), "ABCD-2345");
});

test("new codes are 8 characters with no look-alike letters", () => {
  let i = 0;
  const code = newCode((max) => i++ % max);
  assert.equal(code.length, 8);
  assert.match(code, /^[A-HJKMNP-Z2-9]{8}$/);
});

test("sign-up form: good input is cleaned", () => {
  const r = parseSignup({ fullName: "  Dolores   Ibarra ", streetId: "3", houseNumber: " 4012 ", phone: "(949) 555-0100", inviteCode: "abcd-2345" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.value, { fullName: "Dolores Ibarra", streetId: 3, houseNumber: "4012", phone: "(949) 555-0100", inviteCode: "ABCD2345" });
  }
});

test("sign-up form: phone and invite code are optional", () => {
  const r = parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "12" });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.phone, null);
    assert.equal(r.value.inviteCode, null);
  }
});

test("sign-up form: bad input is refused", () => {
  assert.equal(parseSignup(null).ok, false);
  assert.equal(parseSignup({ fullName: "A", streetId: 1, houseNumber: "1" }).ok, false);
  assert.equal(parseSignup({ fullName: "Tom Kessler", streetId: 0, houseNumber: "1" }).ok, false);
  assert.equal(parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "" }).ok, false);
  assert.equal(parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "12; drop table" }).ok, false);
  assert.equal(parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "12", phone: "123" }).ok, false);
  assert.equal(parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "12", inviteCode: "!!" }).ok, false);
});

test("sign-up form: the visitor cannot set their own status or role", () => {
  const r = parseSignup({ fullName: "Tom Kessler", streetId: 1, houseNumber: "12", status: "approved", role: "admin" });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(Object.keys(r.value).sort(), ["fullName", "houseNumber", "inviteCode", "phone", "streetId"]);
});

// ---------------------------------------------------------------
// Feed, events, marketplace, profile
// ---------------------------------------------------------------
import { canRemove, parseComment, parseEvent, parseListing, parsePost, parseProfile } from "../src/lib/rules";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

test("posts: need a real category and a title", () => {
  assert.equal(parsePost({ category: "general", title: "Lost cat on Via Manzana", body: " seen today " }).ok, true);
  assert.equal(parsePost({ category: "politics", title: "Hello there" }).ok, false);
  assert.equal(parsePost({ category: "general", title: "x" }).ok, false);
  const r = parsePost({ category: "safety", title: "Heads up", body: "" });
  if (r.ok) assert.equal(r.value.body, null);
});

test("posts: nobody can pin or set the author through the form", () => {
  const r = parsePost({ category: "general", title: "Hello neighbors", pinned: true, is_pinned: true, authorId: A });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(Object.keys(r.value).sort(), ["body", "category", "title"]);
});

test("comments: need words, and a reply must point at a real id", () => {
  assert.equal(parseComment({ body: "  " }).ok, false);
  assert.equal(parseComment({ body: "Thanks", parentId: "nope" }).ok, false);
  const r = parseComment({ body: "Thanks", parentId: A });
  if (r.ok) assert.equal(r.value.parentId, A);
});

test("events: need a name, a place and a date that has not passed", () => {
  const now = new Date("2026-11-26T20:00:00Z");
  assert.equal(parseEvent({ title: "Holiday meet-up", place: "Calle Mayo", startsAt: "2026-12-12T16:00:00-08:00" }, now).ok, true);
  assert.equal(parseEvent({ title: "Holiday meet-up", place: "Calle Mayo", startsAt: "2026-01-01T16:00:00Z" }, now).ok, false);
  assert.equal(parseEvent({ title: "Holiday meet-up", place: "Calle Mayo", startsAt: "not a date" }, now).ok, false);
  assert.equal(parseEvent({ title: "Holiday meet-up", place: "", startsAt: "2026-12-12T16:00:00Z" }, now).ok, false);
});

test("listings: for sale needs a price, free has none, and a contact is required", () => {
  const sale = parseListing({ kind: "for_sale", title: "Beach cruiser", price: "$120", contactEmail: "A@B.co" });
  assert.equal(sale.ok, true);
  if (sale.ok) {
    assert.equal(sale.value.priceCents, 12000);
    assert.equal(sale.value.contactEmail, "a@b.co");
  }
  assert.equal(parseListing({ kind: "for_sale", title: "Beach cruiser", contactEmail: "a@b.co" }).ok, false);
  const free = parseListing({ kind: "free", title: "Patio umbrella", price: 50, contactPhone: "949-555-0100" });
  if (free.ok) assert.equal(free.value.priceCents, null);
  assert.equal(parseListing({ kind: "free", title: "Patio umbrella" }).ok, false);
  assert.equal(parseListing({ kind: "auction", title: "Patio umbrella", contactEmail: "a@b.co" }).ok, false);
});

test("profile: everything stays private unless it is switched on with a real true", () => {
  const r = parseProfile({ phone: "949-555-0100", showPhone: "yes", showEmail: 1, showHouseNumber: "true", inDirectory: null });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value, { phone: "949-555-0100", showPhone: false, showEmail: false, showHouseNumber: false, inDirectory: false });
});

test("profile: a phone number cannot be shown if there is none", () => {
  const r = parseProfile({ phone: "", showPhone: true, inDirectory: true });
  if (r.ok) {
    assert.equal(r.value.showPhone, false);
    assert.equal(r.value.inDirectory, true);
  }
});

test("removing: your own things, or anything if you are an admin", () => {
  assert.equal(canRemove({ id: A, status: "approved", role: "resident" }, A), true);
  assert.equal(canRemove({ id: A, status: "approved", role: "resident" }, B), false);
  assert.equal(canRemove({ id: A, status: "approved", role: "admin" }, B), true);
  assert.equal(canRemove({ id: A, status: "removed", role: "admin" }, B), false);
});

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

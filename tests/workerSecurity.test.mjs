import assert from "node:assert/strict";
import test from "node:test";

import {
  boundedText,
  nonNegativeInteger,
  sessionBelongsToIdentity,
} from "../worker/src/index.js";

test("session ownership requires matching user id once an owner id exists", () => {
  const identity = { ownerId: "user-new", ownerEmail: "same@example.com" };
  assert.equal(
    sessionBelongsToIdentity(
      { owner_id: "user-old", owner_email: "same@example.com" },
      identity,
    ),
    false,
  );
});

test("legacy email ownership is accepted only when owner id is empty", () => {
  const identity = { ownerId: "user-new", ownerEmail: "same@example.com" };
  assert.equal(
    sessionBelongsToIdentity(
      { owner_id: "", owner_email: "same@example.com" },
      identity,
    ),
    true,
  );
});

test("bounded text trims and caps untrusted payload strings", () => {
  assert.equal(boundedText("  abcdef  ", 4), "abcd");
  assert.equal(boundedText({ value: "abc" }, 10), "");
});

test("non-negative integer normalization rejects negative and excessive values", () => {
  assert.equal(nonNegativeInteger(-12, 100), 0);
  assert.equal(nonNegativeInteger(12.9, 100), 12);
  assert.equal(nonNegativeInteger(999, 100), 100);
  assert.equal(nonNegativeInteger("not-a-number", 100), 0);
});

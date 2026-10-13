import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRIENDS, ZONES, MAX_LEN } from "../config.js";

const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

function listAfter(field) {
  const match = rules.match(new RegExp(`data\\.${field} in \\[([^\\]]*)\\]`));
  assert.ok(match, `liste « ${field} » introuvable dans firestore.rules`);
  return [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

test("firestore.rules contient exactement les prénoms de FRIENDS", () => {
  assert.deepEqual(listAfter("name"), FRIENDS);
});

test("firestore.rules contient exactement les zones de ZONES", () => {
  assert.deepEqual(listAfter("zone"), ZONES.map((z) => z.id));
});

test("firestore.rules utilise la même longueur max que MAX_LEN", () => {
  assert.match(rules, new RegExp(`item\\.size\\(\\) <= ${MAX_LEN}\\b`));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConfigured,
  textLength,
  validateEntry,
  groupByZone,
  loadName,
  saveName,
} from "../logic.js";

const ZONE_IDS = ["tete", "pieds", "autre"];
const FRIENDS = ["Henri", "Simon"];
const OPTS = { zoneIds: ZONE_IDS, friends: FRIENDS };

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("SecurityError");
  },
};

test("isConfigured exige apiKey et projectId", () => {
  assert.equal(isConfigured({ apiKey: "", projectId: "" }), false);
  assert.equal(isConfigured({ apiKey: "k", projectId: "" }), false);
  assert.equal(isConfigured({ apiKey: "k", projectId: "p" }), true);
  assert.equal(isConfigured(undefined), false);
});

// Même comptage que size() des règles Firestore (vérifié en réel) et que maxlength : unités UTF-16.
test("textLength compte comme Firestore : un emoji vaut 2, un « é » vaut 1", () => {
  assert.equal(textLength("abc"), 3);
  assert.equal(textLength("é"), 1);
  assert.equal(textLength("🎩"), 2);
});

test("validateEntry nettoie les espaces et accepte une entrée valide", () => {
  const r = validateEntry({ zone: "tete", item: "  perruque  ", name: "Henri" }, OPTS);
  assert.deepEqual(r, { ok: true, value: { zone: "tete", item: "perruque", name: "Henri" } });
});

test("validateEntry refuse un accessoire vide ou fait d'espaces", () => {
  const expected = { ok: false, error: "Indique ce que tu ramènes." };
  assert.deepEqual(validateEntry({ zone: "tete", item: "   ", name: "Henri" }, OPTS), expected);
  assert.deepEqual(validateEntry({ zone: "tete", item: "", name: "Henri" }, OPTS), expected);
  assert.deepEqual(validateEntry({ zone: "tete", item: undefined, name: "Henri" }, OPTS), expected);
});

test("validateEntry refuse un prénom absent ou hors liste", () => {
  const expected = { ok: false, error: "Choisis ton prénom." };
  assert.deepEqual(validateEntry({ zone: "tete", item: "x", name: null }, OPTS), expected);
  assert.deepEqual(validateEntry({ zone: "tete", item: "x", name: "Marc" }, OPTS), expected);
});

test("validateEntry refuse une zone inconnue", () => {
  assert.equal(validateEntry({ zone: "nez", item: "x", name: "Henri" }, OPTS).ok, false);
});

test("validateEntry limite à 60 caractères comptés comme Firestore", () => {
  assert.equal(validateEntry({ zone: "tete", item: "a".repeat(60), name: "Henri" }, OPTS).ok, true);
  assert.deepEqual(validateEntry({ zone: "tete", item: "a".repeat(61), name: "Henri" }, OPTS), {
    ok: false,
    error: "Description trop longue (60 caractères max).",
  });
  assert.equal(validateEntry({ zone: "tete", item: "é".repeat(60), name: "Henri" }, OPTS).ok, true);
  assert.equal(validateEntry({ zone: "tete", item: "🎩".repeat(30), name: "Henri" }, OPTS).ok, true);
  assert.equal(validateEntry({ zone: "tete", item: "🎩".repeat(31), name: "Henri" }, OPTS).ok, false);
});

test("groupByZone crée toutes les zones, garde l'ordre et ignore les zones inconnues", () => {
  const items = [
    { id: "1", zone: "pieds" },
    { id: "2", zone: "nez" },
    { id: "3", zone: "pieds" },
    { id: "4", zone: "tete" },
  ];
  const g = groupByZone(items, ZONE_IDS);
  assert.deepEqual(Object.keys(g), ZONE_IDS);
  assert.deepEqual(g.pieds.map((i) => i.id), ["1", "3"]);
  assert.deepEqual(g.tete.map((i) => i.id), ["4"]);
  assert.deepEqual(g.autre, []);
});

test("groupByZone ignore une zone nommée comme une propriété d'Object", () => {
  const g = groupByZone([{ id: "1", zone: "toString" }, { id: "2", zone: "__proto__" }], ZONE_IDS);
  assert.deepEqual(Object.keys(g), ZONE_IDS);
  assert.deepEqual(Object.values(g).flat(), []);
});

test("saveName puis loadName renvoie le prénom", () => {
  const storage = fakeStorage();
  assert.equal(loadName(storage, FRIENDS), null);
  saveName(storage, "Simon");
  assert.equal(loadName(storage, FRIENDS), "Simon");
});

test("loadName ignore un prénom qui n'est plus dans la liste", () => {
  const storage = fakeStorage();
  saveName(storage, "Marc");
  assert.equal(loadName(storage, FRIENDS), null);
});

test("loadName renvoie null sans stockage ou avec un stockage qui lève", () => {
  assert.equal(loadName(null, FRIENDS), null);
  assert.equal(loadName(throwingStorage, FRIENDS), null);
});

test("saveName ne lève pas sans stockage ou avec un stockage qui lève", () => {
  assert.doesNotThrow(() => saveName(null, "Simon"));
  assert.doesNotThrow(() => saveName(throwingStorage, "Simon"));
});

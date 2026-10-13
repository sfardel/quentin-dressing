import { test } from "node:test";
import assert from "node:assert/strict";
import { startWrite } from "../logic.js";

test("startWrite rend la main sans attendre une écriture qui ne se termine jamais (hors ligne)", () => {
  let started = false;
  const result = startWrite(() => {
    started = true;
    return new Promise(() => {});
  }, () => assert.fail("onError ne doit pas être appelé"));
  assert.equal(started, true);
  assert.equal(result, undefined);
});

test("startWrite signale une écriture rejetée", async () => {
  const errors = [];
  startWrite(() => Promise.reject(new Error("permission-denied")), (err) => errors.push(err.message));
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(errors, ["permission-denied"]);
});

test("startWrite signale une erreur levée immédiatement", () => {
  const errors = [];
  startWrite(() => {
    throw new Error("boom");
  }, (err) => errors.push(err.message));
  assert.deepEqual(errors, ["boom"]);
});

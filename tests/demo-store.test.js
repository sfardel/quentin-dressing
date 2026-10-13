import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoStore } from "../demo-store.js";

function fakeStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  };
}

// Bus synchrone qui imite BroadcastChannel : un message n'est pas renvoyé à son émetteur.
function fakeBus() {
  const channels = [];
  return () => {
    const listeners = [];
    const channel = {
      postMessage(data) {
        for (const other of channels) {
          if (other !== channel) other.listeners.forEach((fn) => fn({ data }));
        }
      },
      addEventListener(_type, fn) {
        listeners.push(fn);
      },
      listeners,
    };
    channels.push(channel);
    return channel;
  };
}

const entry = { zone: "tete", item: "perruque", name: "Henri" };

test("subscribe reçoit d'abord une liste vide", () => {
  const store = createDemoStore({ storage: fakeStorage(), channel: null });
  const calls = [];
  store.subscribe((items) => calls.push(items));
  assert.deepEqual(calls, [[]]);
});

test("addItem notifie avec un id, et deleteItem retire l'entrée", async () => {
  const store = createDemoStore({ storage: fakeStorage(), channel: null });
  let latest = [];
  store.subscribe((items) => (latest = items));
  await store.addItem(entry);
  assert.equal(latest.length, 1);
  const { id, ...rest } = latest[0];
  assert.equal(typeof id, "string");
  assert.deepEqual(rest, entry);
  await store.deleteItem(id);
  assert.deepEqual(latest, []);
});

test("un autre onglet partageant le stockage est notifié via le channel", async () => {
  const storage = fakeStorage();
  const newChannel = fakeBus();
  const tabA = createDemoStore({ storage, channel: newChannel() });
  const tabB = createDemoStore({ storage, channel: newChannel() });
  let seenByB = [];
  tabB.subscribe((items) => (seenByB = items));
  await tabA.addItem(entry);
  assert.equal(seenByB.length, 1);
  assert.equal(seenByB[0].item, "perruque");
});

test("fonctionne sans stockage", async () => {
  const store = createDemoStore({ storage: null, channel: null });
  let latest = [];
  store.subscribe((items) => (latest = items));
  await store.addItem(entry);
  assert.equal(latest.length, 1);
});

test("unsubscribe arrête les notifications", async () => {
  const store = createDemoStore({ storage: fakeStorage(), channel: null });
  let count = 0;
  const unsubscribe = store.subscribe(() => count++);
  unsubscribe();
  await store.addItem(entry);
  assert.equal(count, 1);
});

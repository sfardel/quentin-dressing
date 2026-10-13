# Body map EVG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page web statique « Déguisons Quentin ! » où des amis cliquent sur une zone d'une silhouette et indiquent l'accessoire qu'ils ramènent, avec une liste partagée en temps réel via Firestore.

**Architecture:** HTML/CSS/JS vanilla en ES modules, sans build. La logique pure (validation, regroupement, identité locale) est dans `logic.js` et testée avec `node --test`. L'accès aux données passe par une interface « store » (`subscribe` / `addItem` / `deleteItem`) qui a deux implémentations : Firestore (`store.js`) et une démo locale (`demo-store.js`, activée par `?demo`). La démo sert à vérifier l'interface sans projet Firebase. `app.js` gère le rendu et les événements.

**Tech Stack:** HTML5, CSS, JavaScript ES modules, Firebase JS SDK 10.14.1 (modulaire, CDN `gstatic`), Node 22 (`node --test`) pour les tests unitaires, `http-server@14.1.1` (via `npx`) pour servir en local, Chrome DevTools MCP pour les vérifications navigateur.

**Spec:** `docs/superpowers/specs/2026-10-13-body-map-evg-design.md`

**Écart assumé par rapport au spec :** ajout de `logic.js` (logique pure testable), de `demo-store.js` (mode `?demo`, utilisé pour tester sans Firebase, car Java et donc l'émulateur Firestore ne sont pas disponibles sur la machine) et de `package.json` (script de test uniquement, aucune dépendance).

## Global Constraints

- Prénom du marié : `Quentin` ; titre : « Déguisons Quentin ! 🎉 ».
- 10 zones, dans cet ordre : `tete`, `visage`, `cou`, `torse`, `bras`, `mains`, `taille`, `jambes`, `pieds`, `autre`.
- `item` et `name` : 1 à 60 caractères après suppression des espaces en début et fin.
- Collection Firestore unique `items` ; document `{ zone, item, name, ownerId, createdAt }` ; `createdAt` = `serverTimestamp()`.
- Aucun texte venant de la base n'est inséré via `innerHTML` : uniquement via `textContent`.
- Tout accès à `localStorage` est protégé (try/catch) ; l'app fonctionne sans.
- Le bouton « Supprimer » n'apparaît que sur les entrées dont `ownerId` est égal à celui du navigateur.
- Aucune dépendance npm à l'exécution ; aucune étape de build.
- Mobile-first : la page doit fonctionner à 390 px de large sans scroll horizontal.

## Review Focus

1. Champs remplis uniquement d'espaces → refusés avec un message, rien n'est écrit (test dans Task 1).
2. Accessoire contenant des emojis → la limite de 60 compte les caractères visibles (points de code), pas les unités UTF-16, pour rester cohérente avec `size()` des règles Firestore (test dans Task 1 ; vérification live dans Task 5).
3. `localStorage` indisponible ou qui lève une exception (navigation privée, cookies bloqués) → l'app se charge et l'ajout fonctionne (test dans Task 1).
4. Document avec une zone inconnue dans la base (donnée corrompue ou ancienne) → ignoré, pas de plantage (test dans Task 1).
5. Double tap rapide sur « Ajouter » → une seule entrée créée (vérification navigateur dans Task 4).

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `package.json` | `"type": "module"` et script `test`. |
| `config.js` | Prénom, zones (id, label, position du badge), longueur max, `firebaseConfig`. |
| `logic.js` | Fonctions pures : `isConfigured`, `textLength`, `validateEntry`, `groupByZone`, `loadIdentity`, `saveName`. |
| `demo-store.js` | Store local (localStorage + BroadcastChannel) pour `?demo`. |
| `store.js` | Store Firestore. |
| `index.html` | Structure, silhouette SVG, panneau, récapitulatif. |
| `style.css` | Styles. |
| `app.js` | Rendu et interactions. |
| `firestore.rules` | Règles de sécurité. |
| `README.md` | Mise en place et publication. |
| `tests/logic.test.js`, `tests/demo-store.test.js` | Tests unitaires. |

---

### Task 1: Config et logique pure

**Files:**
- Create: `package.json`
- Create: `config.js`
- Create: `logic.js`
- Test: `tests/logic.test.js`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `config.js` : `GROOM_NAME: string`, `ZONES: Array<{ id: string, label: string, badge: { x: number, y: number } | null }>`, `MAX_LEN: number` (60), `firebaseConfig: object`.
  - `logic.js` :
    - `isConfigured(cfg: object) → boolean`
    - `textLength(s: string) → number` (nombre de points de code)
    - `validateEntry({ zone, item, name }, zoneIds: string[], maxLen = 60) → { ok: true, value: { zone, item, name } } | { ok: false, error: string }`
    - `groupByZone(items: Array<{ zone: string }>, zoneIds: string[]) → Record<zoneId, item[]>` (toutes les zones présentes, ordre d'entrée conservé, zones inconnues ignorées)
    - `loadIdentity(storage: Storage | null, makeId: () => string) → { ownerId: string, name: string }`
    - `saveName(storage: Storage | null, name: string) → void`

- [ ] **Step 1: Créer `package.json`**

```json
{
  "name": "quentin-dressing",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: Créer `config.js`**

```js
export const GROOM_NAME = "Quentin";

export const MAX_LEN = 60;

// badge : position (coordonnées du viewBox SVG) du compteur affiché sur la zone.
export const ZONES = [
  { id: "tete", label: "Tête", badge: { x: 130, y: 24 } },
  { id: "visage", label: "Visage", badge: { x: 134, y: 64 } },
  { id: "cou", label: "Cou", badge: { x: 120, y: 86 } },
  { id: "torse", label: "Torse", badge: { x: 124, y: 118 } },
  { id: "bras", label: "Bras", badge: { x: 30, y: 140 } },
  { id: "mains", label: "Mains", badge: { x: 50, y: 218 } },
  { id: "taille", label: "Taille", badge: { x: 132, y: 212 } },
  { id: "jambes", label: "Jambes", badge: { x: 124, y: 260 } },
  { id: "pieds", label: "Pieds", badge: { x: 146, y: 390 } },
  { id: "autre", label: "Autre (pancarte, sac…)", badge: null },
];

// À remplir avec la config du projet Firebase (voir README).
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
```

- [ ] **Step 3: Écrire les tests qui échouent — `tests/logic.test.js`**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isConfigured,
  textLength,
  validateEntry,
  groupByZone,
  loadIdentity,
  saveName,
} from "../logic.js";

const ZONE_IDS = ["tete", "pieds", "autre"];

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    data,
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

test("textLength compte les emojis comme un caractère", () => {
  assert.equal(textLength("abc"), 3);
  assert.equal(textLength("🎩"), 1);
  assert.equal(textLength("🎩🎩"), 2);
});

test("validateEntry nettoie les espaces et accepte une entrée valide", () => {
  const r = validateEntry({ zone: "tete", item: "  perruque  ", name: " Marc " }, ZONE_IDS);
  assert.deepEqual(r, { ok: true, value: { zone: "tete", item: "perruque", name: "Marc" } });
});

test("validateEntry refuse les champs vides ou faits d'espaces", () => {
  assert.equal(validateEntry({ zone: "tete", item: "x", name: "   " }, ZONE_IDS).ok, false);
  assert.equal(validateEntry({ zone: "tete", item: "   ", name: "Marc" }, ZONE_IDS).ok, false);
  assert.equal(validateEntry({ zone: "tete", item: undefined, name: "Marc" }, ZONE_IDS).ok, false);
});

test("validateEntry renvoie un message en français", () => {
  assert.deepEqual(validateEntry({ zone: "tete", item: "x", name: "" }, ZONE_IDS), {
    ok: false,
    error: "Indique ton prénom.",
  });
  assert.deepEqual(validateEntry({ zone: "tete", item: "", name: "Marc" }, ZONE_IDS), {
    ok: false,
    error: "Indique ce que tu ramènes.",
  });
});

test("validateEntry refuse une zone inconnue", () => {
  assert.equal(validateEntry({ zone: "nez", item: "x", name: "Marc" }, ZONE_IDS).ok, false);
});

test("validateEntry limite à 60 caractères en comptant les emojis comme un seul", () => {
  assert.equal(validateEntry({ zone: "tete", item: "a".repeat(60), name: "M" }, ZONE_IDS).ok, true);
  assert.equal(validateEntry({ zone: "tete", item: "a".repeat(61), name: "M" }, ZONE_IDS).ok, false);
  assert.equal(validateEntry({ zone: "tete", item: "🎩".repeat(60), name: "M" }, ZONE_IDS).ok, true);
  assert.equal(validateEntry({ zone: "tete", item: "x", name: "b".repeat(61) }, ZONE_IDS).ok, false);
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
});

test("loadIdentity crée puis réutilise l'ownerId", () => {
  const storage = fakeStorage();
  const first = loadIdentity(storage, () => "id-1");
  assert.deepEqual(first, { ownerId: "id-1", name: "" });
  const second = loadIdentity(storage, () => "id-2");
  assert.equal(second.ownerId, "id-1");
});

test("saveName est relu par loadIdentity", () => {
  const storage = fakeStorage();
  saveName(storage, "Marc");
  assert.equal(loadIdentity(storage, () => "id").name, "Marc");
});

test("loadIdentity et saveName fonctionnent sans stockage ou avec un stockage qui lève", () => {
  assert.deepEqual(loadIdentity(null, () => "id-x"), { ownerId: "id-x", name: "" });
  assert.deepEqual(loadIdentity(throwingStorage, () => "id-y"), { ownerId: "id-y", name: "" });
  assert.doesNotThrow(() => saveName(null, "Marc"));
  assert.doesNotThrow(() => saveName(throwingStorage, "Marc"));
});
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../logic.js'`.

- [ ] **Step 5: Implémenter `logic.js`**

```js
const OWNER_KEY = "evg-owner-id";
const NAME_KEY = "evg-name";

export function isConfigured(cfg) {
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

export function textLength(s) {
  return Array.from(s).length;
}

export function validateEntry({ zone, item, name }, zoneIds, maxLen = 60) {
  if (!zoneIds.includes(zone)) return { ok: false, error: "Zone inconnue." };
  const cleanName = String(name ?? "").trim();
  const cleanItem = String(item ?? "").trim();
  if (!cleanName) return { ok: false, error: "Indique ton prénom." };
  if (!cleanItem) return { ok: false, error: "Indique ce que tu ramènes." };
  if (textLength(cleanName) > maxLen) {
    return { ok: false, error: `Prénom trop long (${maxLen} caractères max).` };
  }
  if (textLength(cleanItem) > maxLen) {
    return { ok: false, error: `Description trop longue (${maxLen} caractères max).` };
  }
  return { ok: true, value: { zone, item: cleanItem, name: cleanName } };
}

export function groupByZone(items, zoneIds) {
  const groups = Object.fromEntries(zoneIds.map((id) => [id, []]));
  for (const item of items) {
    if (zoneIds.includes(item.zone)) groups[item.zone].push(item);
  }
  return groups;
}

export function loadIdentity(storage, makeId) {
  let ownerId = safeGet(storage, OWNER_KEY);
  if (!ownerId) {
    ownerId = makeId();
    safeSet(storage, OWNER_KEY, ownerId);
  }
  return { ownerId, name: safeGet(storage, NAME_KEY) ?? "" };
}

export function saveName(storage, name) {
  safeSet(storage, NAME_KEY, name);
}

function safeGet(storage, key) {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Stockage indisponible : on continue sans mémoriser.
  }
}
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils passent**

Run: `npm test`
Expected: PASS — 12 tests, 0 échec.

- [ ] **Step 7: Commit**

```bash
git add package.json config.js logic.js tests/logic.test.js
git commit -m "feat: config et logique pure (validation, regroupement, identité)"
```

---

### Task 2: Stores (démo et Firestore)

**Files:**
- Create: `demo-store.js`
- Create: `store.js`
- Test: `tests/demo-store.test.js`

**Interfaces:**
- Consumes: rien (les entrées reçues sont déjà validées par `validateEntry`).
- Produces (interface « store », identique pour les deux implémentations) :
  - `subscribe(onChange: (items: Item[]) => void, onError?: (err) => void) → unsubscribe: () => void`
  - `addItem({ zone, item, name, ownerId }) → Promise<void>`
  - `deleteItem(id: string) → Promise<void>`
  - `Item = { id: string, zone: string, item: string, name: string, ownerId: string }`
  - `createDemoStore({ storage: Storage | null, channel: BroadcastChannel-like | null })` dans `demo-store.js`
  - `createFirebaseStore(firebaseConfig)` dans `store.js`

- [ ] **Step 1: Écrire les tests qui échouent — `tests/demo-store.test.js`**

```js
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

const entry = { zone: "tete", item: "perruque", name: "Marc", ownerId: "o1" };

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
  assert.equal(typeof latest[0].id, "string");
  assert.deepEqual({ ...latest[0], id: undefined }, { ...entry, id: undefined });
  await store.deleteItem(latest[0].id);
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
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../demo-store.js'`.

- [ ] **Step 3: Implémenter `demo-store.js`**

```js
// Store local pour le mode ?demo : données dans localStorage, synchronisées entre onglets.
const KEY = "evg-demo-items";

export function createDemoStore({ storage, channel }) {
  let memory = [];
  const listeners = new Set();

  function read() {
    try {
      const raw = storage?.getItem(KEY);
      return raw ? JSON.parse(raw) : memory;
    } catch {
      return memory;
    }
  }

  function notify() {
    const items = read();
    listeners.forEach((fn) => fn(items));
  }

  function write(items) {
    memory = items;
    try {
      storage?.setItem(KEY, JSON.stringify(items));
    } catch {
      // Stockage indisponible : on garde la copie en mémoire.
    }
    notify();
    channel?.postMessage("changed");
  }

  channel?.addEventListener("message", notify);

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      onChange(read());
      return () => listeners.delete(onChange);
    },
    async addItem(entry) {
      write([...read(), { id: crypto.randomUUID(), ...entry }]);
    },
    async deleteItem(id) {
      write(read().filter((item) => item.id !== id));
    },
  };
}
```

- [ ] **Step 4: Lancer les tests et vérifier qu'ils passent**

Run: `npm test`
Expected: PASS — 17 tests, 0 échec.

- [ ] **Step 5: Implémenter `store.js` (Firestore)**

Pas de test unitaire (il faudrait l'émulateur Firestore, qui demande Java, absent de la machine). Il est vérifié en live dans Task 5.

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export function createFirebaseStore(firebaseConfig) {
  const db = getFirestore(initializeApp(firebaseConfig));
  const items = collection(db, "items");

  return {
    subscribe(onChange, onError) {
      return onSnapshot(
        query(items, orderBy("createdAt")),
        (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
        onError,
      );
    },
    async addItem({ zone, item, name, ownerId }) {
      await addDoc(items, { zone, item, name, ownerId, createdAt: serverTimestamp() });
    },
    async deleteItem(id) {
      await deleteDoc(doc(items, id));
    },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add demo-store.js store.js tests/demo-store.test.js
git commit -m "feat: stores démo (local) et Firestore"
```

---

### Task 3: Page statique (HTML + CSS + silhouette)

**Files:**
- Create: `index.html`
- Create: `style.css`

**Interfaces:**
- Consumes: les ids de zone de `config.js` (via les attributs `data-zone`).
- Produces (identifiants DOM utilisés par `app.js`) : `#title`, `#banner`, `#body` (svg), `#badges` (g), `[data-zone]` (10 éléments, dont `#zone-autre`), `#other-count`, `#recap-list`, `#sheet`, `#sheet-title`, `#sheet-list`, `#add-form`, `#name-input`, `#item-input`, `#submit-btn`, `[data-close]`, `#toast`. Classes CSS : `.filled` (zone avec accessoires), `.badge`, `.empty`, `.delete`, `.show` (toast visible).

- [ ] **Step 1: Créer `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Déguisons Quentin !</title>
    <link rel="stylesheet" href="style.css" />
    <script type="module" src="app.js"></script>
  </head>
  <body>
    <header>
      <h1 id="title">Déguisons Quentin ! 🎉</h1>
      <p class="intro">Touche une partie du corps pour dire ce que tu ramènes.</p>
    </header>

    <div id="banner" class="banner" hidden></div>

    <main>
      <div class="map">
        <svg id="body" viewBox="0 0 200 420" role="group" aria-label="Silhouette de Quentin">
          <g class="zone" data-zone="tete" tabindex="0" role="button" aria-label="Tête">
            <path d="M68,48 A32,32 0 0 1 132,48 Z" />
          </g>
          <g class="zone" data-zone="visage" tabindex="0" role="button" aria-label="Visage">
            <path d="M68,48 A32,32 0 0 0 132,48 Z" />
          </g>
          <g class="zone" data-zone="cou" tabindex="0" role="button" aria-label="Cou">
            <rect x="88" y="78" width="24" height="18" rx="4" />
          </g>
          <g class="zone" data-zone="torse" tabindex="0" role="button" aria-label="Torse">
            <path d="M60,96 Q100,88 140,96 L134,200 L66,200 Z" />
          </g>
          <g class="zone" data-zone="bras" tabindex="0" role="button" aria-label="Bras">
            <path d="M58,98 L40,104 L24,210 L44,212 L62,132 Z" />
            <path d="M142,98 L160,104 L176,210 L156,212 L138,132 Z" />
          </g>
          <g class="zone" data-zone="mains" tabindex="0" role="button" aria-label="Mains">
            <circle cx="34" cy="226" r="13" />
            <circle cx="166" cy="226" r="13" />
          </g>
          <g class="zone" data-zone="taille" tabindex="0" role="button" aria-label="Taille">
            <rect x="66" y="200" width="68" height="28" rx="4" />
          </g>
          <g class="zone" data-zone="jambes" tabindex="0" role="button" aria-label="Jambes">
            <path d="M66,228 L98,228 L96,386 L72,386 Z" />
            <path d="M102,228 L134,228 L128,386 L104,386 Z" />
          </g>
          <g class="zone" data-zone="pieds" tabindex="0" role="button" aria-label="Pieds">
            <path d="M72,386 L96,386 L96,404 L58,404 Q58,392 72,386 Z" />
            <path d="M128,386 L104,386 L104,404 L142,404 Q142,392 128,386 Z" />
          </g>
          <g id="badges" aria-hidden="true"></g>
        </svg>

        <button type="button" id="zone-autre" class="zone zone-other" data-zone="autre">
          🎒 Autre (pancarte, sac…)<span id="other-count" class="count"></span>
        </button>
      </div>

      <section class="recap" aria-labelledby="recap-title">
        <h2 id="recap-title">Qui ramène quoi ?</h2>
        <div id="recap-list"></div>
      </section>
    </main>

    <div id="sheet" class="sheet" hidden>
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div class="sheet-head">
          <h2 id="sheet-title"></h2>
          <button type="button" class="close" data-close aria-label="Fermer">✕</button>
        </div>
        <ul id="sheet-list" class="entries"></ul>
        <form id="add-form" class="add-form" novalidate>
          <label>
            Ton prénom
            <input id="name-input" name="name" maxlength="60" autocomplete="given-name" />
          </label>
          <label>
            Ce que tu ramènes
            <input id="item-input" name="item" maxlength="60" placeholder="Ex. perruque fluo" autocomplete="off" />
          </label>
          <button type="submit" id="submit-btn">Ajouter</button>
        </form>
      </div>
    </div>

    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  </body>
</html>
```

- [ ] **Step 2: Créer `style.css`**

```css
:root {
  --bg: #fff8f0;
  --ink: #2b2118;
  --muted: #7a6a5c;
  --line: #eadfd3;
  --zone: #e9dccd;
  --zone-hover: #dcc7b0;
  --zone-stroke: #b9a48f;
  --filled: #ff7a59;
  --filled-stroke: #d9532f;
  --danger: #c0392b;
  --panel: #ffffff;
  --warn-bg: #fff1c2;
  --warn-border: #e8c95a;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--ink);
}

header {
  padding: 20px 16px 8px;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: 1.6rem;
}

.intro {
  margin: 6px 0 0;
  color: var(--muted);
}

.banner {
  max-width: 520px;
  margin: 8px auto;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  font-size: 0.9rem;
}

main {
  max-width: 520px;
  margin: 0 auto;
  padding: 0 16px 32px;
}

.map {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

#body {
  width: 100%;
  max-width: 280px;
  height: auto;
}

svg .zone {
  cursor: pointer;
  outline: none;
}

svg .zone :is(path, rect, circle) {
  fill: var(--zone);
  stroke: var(--zone-stroke);
  stroke-width: 1.5;
  transition: fill 0.15s;
}

svg .zone:hover :is(path, rect, circle) {
  fill: var(--zone-hover);
}

svg .zone.filled :is(path, rect, circle) {
  fill: var(--filled);
  stroke: var(--filled-stroke);
}

svg .zone:focus-visible :is(path, rect, circle) {
  stroke: var(--ink);
  stroke-width: 3;
}

.badge {
  pointer-events: none;
}

.badge circle {
  fill: var(--ink);
}

.badge text {
  fill: #fff;
  font-size: 11px;
  font-weight: 700;
}

.zone-other {
  font: inherit;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1.5px solid var(--zone-stroke);
  background: var(--zone);
  color: var(--ink);
  cursor: pointer;
}

.zone-other.filled {
  background: var(--filled);
  border-color: var(--filled-stroke);
  color: #fff;
}

.count:not(:empty) {
  margin-left: 8px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--ink);
  color: #fff;
  font-size: 0.8rem;
}

.recap h2 {
  margin: 24px 0 8px;
  font-size: 1.2rem;
}

.recap h3 {
  margin: 14px 0 4px;
  font-size: 1rem;
}

.entries {
  list-style: none;
  margin: 0;
  padding: 0;
}

.entries li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
  overflow-wrap: anywhere;
}

.empty {
  color: var(--muted);
  font-style: italic;
}

.delete {
  flex-shrink: 0;
  padding: 4px 6px;
  border: none;
  background: none;
  color: var(--danger);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.sheet {
  position: fixed;
  inset: 0;
  z-index: 10;
}

.sheet[hidden] {
  display: none;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
}

.sheet-panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 520px;
  max-height: 85vh;
  margin: 0 auto;
  overflow-y: auto;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom));
  border-radius: 16px 16px 0 0;
  background: var(--panel);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.15);
}

.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sheet-head h2 {
  margin: 0;
  font-size: 1.2rem;
}

.close {
  padding: 6px;
  border: none;
  background: none;
  font-size: 1.2rem;
  cursor: pointer;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 14px;
}

.add-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.9rem;
  color: var(--muted);
}

.add-form input {
  padding: 10px 12px;
  border: 1.5px solid var(--zone-stroke);
  border-radius: 10px;
  color: var(--ink);
  font-size: 16px; /* évite le zoom automatique sur iOS */
}

.add-form button {
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: var(--filled);
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.add-form button:disabled {
  opacity: 0.6;
  cursor: wait;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  z-index: 20;
  max-width: calc(100% - 32px);
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--ink);
  color: #fff;
  font-size: 0.9rem;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%);
  transition: opacity 0.2s;
}

.toast.show {
  opacity: 1;
}
```

- [ ] **Step 3: Servir la page et vérifier le rendu**

Run (en arrière-plan) : `npx --yes http-server@14.1.1 -p 5173 -c-1 .`
Puis, avec Chrome DevTools MCP : `new_page` sur `http://localhost:5173/`, `emulate` (ou `resize_page`) à 390×844, `take_screenshot`.
Expected : titre visible ; silhouette complète et reconnaissable (tête, visage, cou, torse, 2 bras, 2 mains, taille, 2 jambes, 2 pieds), centrée ; bouton « 🎒 Autre » dessous ; pas de scroll horizontal (`evaluate_script` : `document.documentElement.scrollWidth <= innerWidth` → `true`). L'erreur console `app.js 404` est attendue à ce stade.

- [ ] **Step 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: page statique et silhouette SVG"
```

---

### Task 4: Application (rendu et interactions)

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes :
  - `config.js` : `GROOM_NAME`, `ZONES`, `MAX_LEN`, `firebaseConfig`
  - `logic.js` : `isConfigured`, `validateEntry`, `groupByZone`, `loadIdentity`, `saveName`
  - `demo-store.js` : `createDemoStore({ storage, channel })` (import dynamique)
  - `store.js` : `createFirebaseStore(firebaseConfig)` (import dynamique)
  - Les identifiants DOM de Task 3.
- Produces : rien (point d'entrée).

- [ ] **Step 1: Implémenter `app.js`**

```js
import { GROOM_NAME, ZONES, MAX_LEN, firebaseConfig } from "./config.js";
import { isConfigured, validateEntry, groupByZone, loadIdentity, saveName } from "./logic.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const zoneIds = ZONES.map((z) => z.id);
const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z]));

const $ = (id) => document.getElementById(id);
const els = {
  title: $("title"),
  banner: $("banner"),
  badges: $("badges"),
  otherCount: $("other-count"),
  recapList: $("recap-list"),
  sheet: $("sheet"),
  sheetTitle: $("sheet-title"),
  sheetList: $("sheet-list"),
  form: $("add-form"),
  nameInput: $("name-input"),
  itemInput: $("item-input"),
  submitBtn: $("submit-btn"),
  toast: $("toast"),
};

const storage = safeLocalStorage();
const identity = loadIdentity(storage, () => crypto.randomUUID());

let store = null;
let grouped = groupByZone([], zoneIds);
let openZone = null;
let lastTrigger = null;
let toastTimer = null;

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function zoneElement(zoneId) {
  return document.querySelector(`[data-zone="${zoneId}"]`);
}

// --- Rendu ---

function render() {
  renderZones();
  renderSheet();
  renderRecap();
}

function renderZones() {
  els.badges.replaceChildren();
  for (const zone of ZONES) {
    const count = grouped[zone.id].length;
    const el = zoneElement(zone.id);
    el.classList.toggle("filled", count > 0);
    el.setAttribute("aria-label", `${zone.label} : ${count} accessoire${count > 1 ? "s" : ""}`);
    if (zone.badge && count > 0) els.badges.append(badge(zone.badge, count));
  }
  els.otherCount.textContent = grouped.autre.length ? String(grouped.autre.length) : "";
}

function badge({ x, y }, count) {
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "badge");
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", 10);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("dy", "0.35em");
  text.setAttribute("text-anchor", "middle");
  text.textContent = String(count);
  g.append(circle, text);
  return g;
}

function entryRow(entry, { withDelete }) {
  const li = document.createElement("li");
  const text = document.createElement("span");
  text.textContent = `${entry.name} → ${entry.item}`;
  li.append(text);
  if (withDelete && store && entry.ownerId === identity.ownerId) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "delete";
    btn.textContent = "Supprimer";
    btn.setAttribute("aria-label", `Supprimer ${entry.item}`);
    btn.addEventListener("click", () => onDelete(entry.id, btn));
    li.append(btn);
  }
  return li;
}

function emptyRow(message) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = message;
  return li;
}

function renderSheet() {
  if (!openZone) return;
  els.sheetTitle.textContent = zoneById[openZone].label;
  const entries = grouped[openZone];
  els.sheetList.replaceChildren(
    ...(entries.length
      ? entries.map((e) => entryRow(e, { withDelete: true }))
      : [emptyRow("Rien de prévu pour l'instant. À toi de jouer !")]),
  );
}

function renderRecap() {
  const sections = ZONES.filter((z) => grouped[z.id].length > 0).flatMap((zone) => {
    const title = document.createElement("h3");
    title.textContent = zone.label;
    const list = document.createElement("ul");
    list.className = "entries";
    list.append(...grouped[zone.id].map((e) => entryRow(e, { withDelete: false })));
    return [title, list];
  });
  if (sections.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = `Personne n'a encore rien prévu pour ${GROOM_NAME}.`;
    sections.push(empty);
  }
  els.recapList.replaceChildren(...sections);
}

function showBanner(message) {
  els.banner.textContent = message;
  els.banner.hidden = false;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2500);
}

// --- Panneau ---

function openSheet(zoneId, trigger) {
  openZone = zoneId;
  lastTrigger = trigger;
  renderSheet();
  els.sheet.hidden = false;
  els.nameInput.value = identity.name;
  (identity.name ? els.itemInput : els.nameInput).focus();
}

function closeSheet() {
  if (!openZone) return;
  els.sheet.hidden = true;
  openZone = null;
  lastTrigger?.focus();
}

// --- Actions ---

async function onSubmit(event) {
  event.preventDefault();
  if (els.submitBtn.disabled) return;
  if (!store) {
    toast("Config Firebase manquante : voir le README.");
    return;
  }
  const result = validateEntry(
    { zone: openZone, item: els.itemInput.value, name: els.nameInput.value },
    zoneIds,
    MAX_LEN,
  );
  if (!result.ok) {
    toast(result.error);
    return;
  }
  els.submitBtn.disabled = true;
  try {
    await store.addItem({ ...result.value, ownerId: identity.ownerId });
    identity.name = result.value.name;
    saveName(storage, identity.name);
    els.itemInput.value = "";
    toast("Ajouté ! 🎉");
  } catch (err) {
    console.error(err);
    toast("Oups, l'ajout a échoué. Réessaie.");
  } finally {
    els.submitBtn.disabled = false;
  }
}

async function onDelete(id, btn) {
  btn.disabled = true;
  try {
    await store.deleteItem(id);
  } catch (err) {
    console.error(err);
    toast("Oups, la suppression a échoué.");
    btn.disabled = false;
  }
}

// --- Démarrage ---

function bindEvents() {
  for (const zone of ZONES) {
    const el = zoneElement(zone.id);
    el.addEventListener("click", () => openSheet(zone.id, el));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSheet(zone.id, el);
      }
    });
  }
  document.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeSheet));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSheet();
  });
  els.form.addEventListener("submit", onSubmit);
}

async function createStore() {
  if (new URLSearchParams(location.search).has("demo")) {
    const { createDemoStore } = await import("./demo-store.js");
    showBanner("Mode démo : les données restent dans ce navigateur.");
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("evg-demo") : null;
    return createDemoStore({ storage, channel });
  }
  if (!isConfigured(firebaseConfig)) {
    showBanner("Config Firebase manquante : voir le README.");
    return null;
  }
  const { createFirebaseStore } = await import("./store.js");
  return createFirebaseStore(firebaseConfig);
}

async function start() {
  const title = `Déguisons ${GROOM_NAME} ! 🎉`;
  els.title.textContent = title;
  document.title = title;
  bindEvents();
  render();
  try {
    store = await createStore();
  } catch (err) {
    console.error(err);
    showBanner("Impossible de charger Firebase. Vérifie ta connexion puis recharge la page.");
    return;
  }
  store?.subscribe(
    (items) => {
      grouped = groupByZone(items, zoneIds);
      render();
    },
    (err) => {
      console.error(err);
      toast("Impossible de charger les données.");
    },
  );
}

start();
```

- [ ] **Step 2: Vérifier le mode sans config**

Avec le serveur de Task 3 lancé, ouvrir `http://localhost:5173/` (390×844).
Expected : bandeau « Config Firebase manquante : voir le README. » ; titre « Déguisons Quentin ! 🎉 » ; récapitulatif « Personne n'a encore rien prévu pour Quentin. » ; aucune erreur console (`list_console_messages`). Un clic sur « Torse » ouvre le panneau ; « Ajouter » affiche le toast « Config Firebase manquante… ».

- [ ] **Step 3: Vérifier le flux complet en mode démo**

Ouvrir `http://localhost:5173/?demo` (390×844), puis :
1. Cliquer sur « Tête » → panneau « Tête » avec « Rien de prévu pour l'instant… ».
2. Prénom `Marc`, accessoire `perruque fluo`, Ajouter → toast « Ajouté ! 🎉 » ; entrée « Marc → perruque fluo » avec « Supprimer » ; la tête devient orange avec un badge « 1 » ; le récapitulatif affiche « Tête ».
3. Fermer avec Échap, rouvrir « Pieds » → le prénom est pré-rempli et le focus est sur l'accessoire.
4. Accessoire `<b>tongs</b>` → s'affiche tel quel en texte, pas en gras.
5. Prénom effacé et accessoire `   ` → toast « Indique ton prénom. », aucune entrée créée.
6. Double tap rapide sur Ajouter (via `evaluate_script` : `document.getElementById('submit-btn').click(); document.getElementById('submit-btn').click();` avec un accessoire valide) → une seule nouvelle entrée.
7. « Autre » → ajout `pancarte` → le compteur du bouton affiche « 1 ».
8. Ouvrir un 2ᵉ onglet `?demo` → les entrées y sont. Ajouter une entrée dans l'onglet 2 → elle apparaît dans l'onglet 1 sans rechargement.
9. Dans l'onglet 1, cliquer sur « Supprimer » d'une entrée → elle disparaît dans les deux onglets.
10. Vérifier qu'une entrée créée avec un autre `ownerId` n'a pas de bouton Supprimer : `evaluate_script` → `localStorage.setItem('evg-owner-id','autre'); location.reload()`, puis ouvrir « Tête » → aucun bouton « Supprimer ». Remettre ensuite l'ancien id (relevé avant via `localStorage.getItem('evg-owner-id')`).
11. Pas de scroll horizontal, panneau ouvert compris ; capture d'écran finale.

Expected : chaque point se comporte comme décrit ; aucune erreur console.

- [ ] **Step 4: Ajuster les positions des badges si besoin**

Si un badge chevauche mal sa zone sur la capture, corriger `badge: { x, y }` dans `config.js` et recapturer.

- [ ] **Step 5: Commit**

```bash
git add app.js config.js
git commit -m "feat: rendu, panneau d'ajout, suppression et temps réel"
```

---

### Task 5: Règles Firestore, README et vérification live

**Files:**
- Create: `firestore.rules`
- Create: `README.md`
- Create: `.gitignore`
- Modify: `config.js` (`firebaseConfig`, seulement si l'utilisateur fournit sa config)

**Interfaces:**
- Consumes : schéma de document de Task 2 (`zone`, `item`, `name`, `ownerId`, `createdAt`) ; ids de zone de `config.js`.
- Produces : rien.

- [ ] **Step 1: Créer `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /items/{itemId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly(['zone', 'item', 'name', 'ownerId', 'createdAt'])
        && request.resource.data.keys().hasAll(['zone', 'item', 'name', 'ownerId', 'createdAt'])
        && request.resource.data.zone in ['tete', 'visage', 'cou', 'torse', 'bras', 'mains', 'taille', 'jambes', 'pieds', 'autre']
        && request.resource.data.item is string
        && request.resource.data.item.size() >= 1
        && request.resource.data.item.size() <= 60
        && request.resource.data.name is string
        && request.resource.data.name.size() >= 1
        && request.resource.data.name.size() <= 60
        && request.resource.data.ownerId is string
        && request.resource.data.ownerId.size() >= 1
        && request.resource.data.ownerId.size() <= 64
        && request.resource.data.createdAt == request.time;

      allow update: if false;

      // Sans authentification, le serveur ne peut pas vérifier l'auteur :
      // la restriction « seulement ses entrées » est faite dans l'interface.
      allow delete: if true;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Créer `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 3: Créer `README.md`**

````markdown
# Déguisons Quentin ! 🎉

Petite page pour que chaque ami indique, sur une silhouette, l'habit ou l'accessoire qu'il ramène pour déguiser Quentin à son EVG. La liste est partagée en temps réel.

## Essayer sans Firebase

```bash
npx --yes http-server@14.1.1 -p 5173 -c-1 .
```

Puis ouvrir http://localhost:5173/?demo (les données restent dans ce navigateur).

## Mise en place Firebase (5 min, gratuit)

1. Aller sur https://console.firebase.google.com, puis « Ajouter un projet » (Google Analytics n'est pas nécessaire).
2. Menu « Build › Firestore Database », puis « Créer une base de données ». Choisir une région en Europe (ex. `eur3`) et le mode production.
3. Onglet « Règles » : remplacer le contenu par celui de `firestore.rules`, puis « Publier ».
4. Engrenage « Paramètres du projet », section « Vos applications », puis l'icône `</>` (Web). Donner un nom, sans Hosting.
5. Copier l'objet `firebaseConfig` affiché dans `config.js`, à la place de l'objet vide.

Les clés de `firebaseConfig` ne sont pas des secrets : la sécurité repose sur `firestore.rules`.

## Publier sur GitHub Pages

1. Créer un dépôt GitHub et y pousser ce dossier.
2. « Settings › Pages », source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. Envoyer au groupe l'URL affichée (`https://<compte>.github.io/<dépôt>/`).

## Personnaliser

Le prénom, les zones et la limite de caractères sont dans `config.js`.

## Tests

```bash
npm test
```

## Limites connues

Sans compte, n'importe qui ayant le lien peut techniquement supprimer une entrée : le bouton « Supprimer » n'est affiché qu'à son auteur, mais le serveur ne le vérifie pas. C'est suffisant entre amis.
````

- [ ] **Step 4: Lancer les tests unitaires**

Run: `npm test`
Expected: PASS — 17 tests, 0 échec.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules README.md .gitignore
git commit -m "docs: règles Firestore et README"
```

- [ ] **Step 6: Vérification live avec Firebase (dépend de l'utilisateur)**

Demander à l'utilisateur de créer le projet (README, étapes 1 à 4) et de fournir son `firebaseConfig`. S'il préfère ne pas le faire maintenant, sauter cette étape et le signaler.

Sinon, coller la config dans `config.js`, puis ouvrir `http://localhost:5173/` (sans `?demo`) dans deux onglets :
1. Le bandeau n'est pas affiché ; aucune erreur console.
2. Ajout dans l'onglet 1 → l'entrée apparaît dans l'onglet 2.
3. Ajout de `🎩` répété 60 fois → accepté par le serveur (pas de toast d'erreur). Si les règles le refusent, `size()` ne compte pas comme `textLength` : passer la limite des règles à 240 pour `item` et `name`, et garder la limite de 60 côté client.
4. Suppression → propagée dans l'autre onglet.
5. Règle refusant une zone inconnue : `evaluate_script` avec une app Firebase nommée à part (pour ne pas entrer en conflit avec l'app par défaut) :

```js
async () => {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const { getFirestore, collection, addDoc, serverTimestamp } = await import(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
  );
  const { firebaseConfig } = await import("/config.js");
  const db = getFirestore(initializeApp(firebaseConfig, "rules-test"));
  try {
    await addDoc(collection(db, "items"), {
      zone: "nez", item: "x", name: "x", ownerId: "x", createdAt: serverTimestamp(),
    });
    return "ACCEPTÉ (anormal)";
  } catch (err) {
    return err.code;
  }
}
```

Expected : `"permission-denied"`.

Expected : chaque point se comporte comme décrit.

- [ ] **Step 7: Commit (si la config a été ajoutée)**

```bash
git add config.js
git commit -m "chore: config Firebase"
```

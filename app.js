import { GROOM_NAME, FRIENDS, ZONES, MAX_LEN, firebaseConfig } from "./config.js";
import { isConfigured, validateEntry, groupByZone, loadName, saveName, startWrite } from "./logic.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const zoneIds = ZONES.map((z) => z.id);
const zoneById = Object.fromEntries(ZONES.map((z) => [z.id, z]));

const $ = (id) => document.getElementById(id);
const els = {
  title: $("title"),
  whoami: $("whoami"),
  currentName: $("current-name"),
  changeName: $("change-name"),
  banner: $("banner"),
  badges: $("badges"),
  otherCount: $("other-count"),
  recapList: $("recap-list"),
  picker: $("picker"),
  pickerList: $("picker-list"),
  pickerClose: $("picker-close"),
  sheet: $("sheet"),
  sheetTitle: $("sheet-title"),
  sheetList: $("sheet-list"),
  form: $("add-form"),
  itemInput: $("item-input"),
  submitBtn: $("submit-btn"),
  toast: $("toast"),
};

const storage = safeLocalStorage();

let currentName = loadName(storage, FRIENDS);
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
  renderWhoami();
  renderZones();
  renderSheet();
  renderRecap();
}

function renderWhoami() {
  els.whoami.hidden = !currentName;
  els.currentName.textContent = currentName ?? "";
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
  if (withDelete && store && currentName && entry.name === currentName) {
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

// --- Choix du prénom ---

function showPicker() {
  const buttons = FRIENDS.map((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = name;
    btn.setAttribute("aria-pressed", String(name === currentName));
    btn.addEventListener("click", () => chooseName(name));
    return btn;
  });
  els.pickerList.replaceChildren(...buttons);
  els.pickerClose.hidden = !currentName;
  els.picker.hidden = false;
  (buttons.find((b) => b.textContent === currentName) ?? buttons[0]).focus();
}

function hidePicker() {
  if (!currentName || els.picker.hidden) return;
  els.picker.hidden = true;
  els.changeName.focus();
}

function chooseName(name) {
  currentName = name;
  saveName(storage, name);
  els.picker.hidden = true;
  render();
}

// --- Panneau ---

function openSheet(zoneId, trigger) {
  if (!currentName) {
    showPicker();
    return;
  }
  openZone = zoneId;
  lastTrigger = trigger;
  renderSheet();
  els.sheet.hidden = false;
  els.itemInput.focus();
}

function closeSheet() {
  if (!openZone) return;
  els.sheet.hidden = true;
  openZone = null;
  lastTrigger?.focus();
}

// --- Actions ---

function onSubmit(event) {
  event.preventDefault();
  if (els.submitBtn.disabled) return;
  if (!store) {
    toast("Config Firebase manquante : voir le README.");
    return;
  }
  const result = validateEntry(
    { zone: openZone, item: els.itemInput.value, name: currentName },
    { zoneIds, friends: FRIENDS, maxLen: MAX_LEN },
  );
  if (!result.ok) {
    toast(result.error);
    return;
  }
  // Bref verrou contre le double tap ; on n'attend pas le serveur (réseau lent ou hors ligne).
  els.submitBtn.disabled = true;
  setTimeout(() => (els.submitBtn.disabled = false), 600);
  startWrite(
    () => store.addItem(result.value),
    (err) => {
      console.error(err);
      toast("Oups, l'ajout a échoué. Réessaie.");
    },
  );
  els.itemInput.value = "";
  toast("Ajouté ! 🎉");
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
  els.changeName.addEventListener("click", showPicker);
  els.pickerClose.addEventListener("click", hidePicker);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.picker.hidden) hidePicker();
    else closeSheet();
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
  if (!currentName) showPicker();
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

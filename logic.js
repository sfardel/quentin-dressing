const NAME_KEY = "evg-name";

export function isConfigured(cfg) {
  return Boolean(cfg && cfg.apiKey && cfg.projectId);
}

export function textLength(s) {
  return Array.from(s).length;
}

export function validateEntry({ zone, item, name }, { zoneIds, friends, maxLen = 60 }) {
  if (!zoneIds.includes(zone)) return { ok: false, error: "Zone inconnue." };
  if (!friends.includes(name)) return { ok: false, error: "Choisis ton prénom." };
  const cleanItem = String(item ?? "").trim();
  if (!cleanItem) return { ok: false, error: "Indique ce que tu ramènes." };
  if (textLength(cleanItem) > maxLen) {
    return { ok: false, error: `Description trop longue (${maxLen} caractères max).` };
  }
  return { ok: true, value: { zone, item: cleanItem, name } };
}

export function groupByZone(items, zoneIds) {
  const groups = Object.fromEntries(zoneIds.map((id) => [id, []]));
  for (const item of items) {
    if (zoneIds.includes(item.zone)) groups[item.zone].push(item);
  }
  return groups;
}

export function loadName(storage, friends) {
  let name = null;
  try {
    name = storage ? storage.getItem(NAME_KEY) : null;
  } catch {
    // Stockage indisponible : il faudra choisir son prénom.
  }
  return friends.includes(name) ? name : null;
}

export function saveName(storage, name) {
  try {
    storage?.setItem(NAME_KEY, name);
  } catch {
    // Stockage indisponible : on continue sans mémoriser.
  }
}

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

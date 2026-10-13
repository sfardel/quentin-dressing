export const GROOM_NAME = "Quentin";

// Si tu modifies cette liste, recopie-la aussi dans firestore.rules.
export const FRIENDS = [
  "Adrien",
  "Antoine",
  "Cletch",
  "Constantin",
  "Eli",
  "Fel",
  "Gui",
  "Henri",
  "Jo",
  "Nico",
  "Pierre",
  "Simon",
  "Sofiane",
  "Thieum",
  "Val",
];

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
  apiKey: "AIzaSyABFf7SSiMSR9ddqk-dvYbkDXlyVxyOlH8",
  authDomain: "quentin-dressing.firebaseapp.com",
  projectId: "quentin-dressing",
  storageBucket: "quentin-dressing.firebasestorage.app",
  messagingSenderId: "1042486864512",
  appId: "1:1042486864512:web:27b5f30b319beed5f65465",
};

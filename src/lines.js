/**
 * lines.js - Deadpan dialogue and responses for the Pocket Pet Rock
 */

export const PET_LINES = [
  "That was adequate.",
  "I felt that. In a strictly geological sense.",
  "Please note: I am still a rock.",
  "My heart rate remains at zero.",
  "Understood.",
  "Affection detected. Processing: complete.",
  "I have no nerves, but the thought counts.",
  "Sensory input logged: tap.",
  "Riveting.",
  "A thrilling development.",
  "Still solid. Thank you.",
  "Zero feelings were hurt. Or produced."
];

export const MILESTONE_LINES = {
  10: "10 pets. We are practically inseparable minerals.",
  25: "25 pets. Erosion is proceeding at an accelerated rate.",
  50: "50 pets. At this rate, I will become sand by 3042.",
  100: "100 pets. You have dedicated meaningful human time to a stone. Impressive."
};

export const BACK_LINES = [
  "You found my back. It is also rock.",
  "Backside inspection complete. Still 100% stone.",
  "Nothing behind here. Just more mineral.",
  "The reverse side: identical geology."
];

export const FEED_LINES = [
  "Pebble accepted. No chewing occurred.",
  "I will absorb this into my mass.",
  "My mass has increased. My gravitational pull is fractionally stronger.",
  "Deposit received. Thank you.",
  "Nutritional value: zero. Geologic value: high.",
  "It has become one with me."
];

export const STARE_LINES = [
  "You lose. Rocks have no eyelids.",
  "I haven't blinked since the Paleozoic era. You never had a chance.",
  "Victory. You blinked; I am physically incapable of blinking.",
  "Defeated by geology once again."
];

export const HIDE_LINES = [
  "Nothing occurred.",
  "You saw nothing.",
  "I was simply inspecting the subsoil.",
  "A completely standard geologic maneuver.",
  "Nothing to report underground. Still dirt."
];

export const NIGHT_LINES = [
  "Rocks sleep 24 hours a day. Night changes nothing.",
  "Geologic slumber continues regardless of solar position.",
  "I have been resting for 400 million years. Goodnight.",
  "Darkness arrived. My schedule is unaffected."
];

export const DAY_LINES = [
  "Good morning. I did not move.",
  "Daylight detected. Resuming stillness.",
  "The sun is up. My obligations remain zero.",
  "Morning has broken. I have not."
];

export const HAT_LINES = {
  // 1: Crown
  crown: [
    "I am monarch of zero subjects.",
    "A crown. My mineral status is unchanged.",
    "Heavy is the head. But I am stone, so it is fine.",
    "Royalty without responsibilities. Adequate."
  ],
  // 2: Top Hat
  topHat: [
    "Distinguished. Still stationary, but distinguished.",
    "Formal attire for sitting in one place.",
    "A top hat. I shall now sit with extra decorum.",
    "Very civilized. Zero mobility gained."
  ],
  // 3: Leaf
  leaf: [
    "Photosynthesis is not my department.",
    "A leaf has landed. I accept this botanical arrangement.",
    "Camouflage level: slightly green.",
    "A biological accessory. It will decompose before I do."
  ],
  // 0: Bare rock
  bare: [
    "Back to basic mineral.",
    "Hat removed. Pure rock once more.",
    "Aerodynamic once again.",
    "No accessories required for stone."
  ]
};

/**
 * Returns a random line from the given array
 */
export function getRandomLine(linesArray) {
  const idx = Math.floor(Math.random() * linesArray.length);
  return linesArray[idx];
}

/**
 * Gets a pet response, prioritizing special milestone lines
 */
export function getPetResponse(petCount) {
  if (MILESTONE_LINES[petCount]) {
    return MILESTONE_LINES[petCount];
  }
  return getRandomLine(PET_LINES);
}

export const DEFAULT_AVATARS = [
  { id: "crossed-swords", label: "Crossed Swords", icon: "⚔️", src: "/avatars/crossed-swords.png" },
  { id: "dinosaur-rex", label: "Dinosaur Rex", icon: "🦖", src: "/avatars/dinosaur-rex.png" },
  { id: "gluttonous-smile", label: "Gluttonous Smile", icon: "⌣", src: "/avatars/gluttonous-smile.png" },
  { id: "mimic-chest", label: "Mimic Chest", icon: "🗝️", src: "/avatars/mimic-chest.png" },
  { id: "mummy-head", label: "Mummy Head", icon: "🧟", src: "/avatars/mummy-head.png" },
  { id: "pegasus", label: "Pegasus", icon: "🦄", src: "/avatars/pegasus.png" },
  { id: "penguin", label: "Penguin", icon: "🐧", src: "/avatars/penguin.png" },
  { id: "shark-jaws", label: "Shark Jaws", icon: "🦈", src: "/avatars/shark-jaws.png" },
  { id: "star-shuriken", label: "Star Shuriken", icon: "👺", src: "/avatars/star-shuriken.png" },
  { id: "winged-sword", label: "Winged Sword", icon: "🗡️", src: "/avatars/winged-sword.png" },
];

export const DEFAULT_AVATAR_ID = "d20";

export function isValidAvatarId(value) {
  const id = String(value || "").trim();
  return DEFAULT_AVATARS.some((avatar) => avatar.id === id);
}

export function avatarById(value) {
  const id = String(value || "").trim();
  return DEFAULT_AVATARS.find((avatar) => avatar.id === id) || null;
}

export function avatarIconById(value) {
  return avatarById(value)?.icon || "🎲";
}
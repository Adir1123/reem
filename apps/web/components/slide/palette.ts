// Brand palette — locked to the new black-and-gold values after the Phase 0
// comparison. Prop drilling stays in place so the slide renderer can be
// re-themed in the future without touching every hex literal.

export type Palette = {
  navy: string;
  cream: string;
  gold: string;
};

export const PALETTE_CURRENT: Palette = {
  navy: "#0a0a0a",
  cream: "#ece1c8",
  gold: "#b8924a",
};

// Kept around so /preview?palette=legacy still works for emergency comparisons,
// but the default surface uses PALETTE_CURRENT now.
export const PALETTE_LEGACY: Palette = {
  navy: "#0f1b2d",
  cream: "#f5f1ea",
  gold: "#c9a961",
};

export function getPalette(name: string | undefined): Palette {
  return name === "legacy" ? PALETTE_LEGACY : PALETTE_CURRENT;
}

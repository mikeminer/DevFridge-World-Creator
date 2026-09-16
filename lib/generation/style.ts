/**
 * Visual language for World Creator GLBs shown in Three.js.
 * Matches the Italian kitchen-brainrot mascot look used by PASTA/CAST
 * (exaggerated cartoon food/kitchen creature, PBR, game-ready) without
 * copying those assets.
 */
export const PASTACAST_STYLE_PROMPT = [
  "Stylized Italian kitchen-brainrot 3D mascot character for a Three.js / WebGL game.",
  "Same visual family as DevFridge PASTA/CAST kitchen creatures: exaggerated cartoon proportions, bold silhouette, food-or-kitchen identity, cursed and funny, never cheap or scammy.",
  "Full body standing on the ground plane, A-pose or idle, centered, no environment, no floor, no text, no logos, no watermark.",
  "Clean game-ready topology, PBR materials, GLB, readable at game camera distance, strong color blocking.",
  "Preserve the uploaded reference identity (face, colors, signature props).",
].join(" ");

export function characterPrompt(name: string, description: string): string {
  const extra = [name, description].filter(Boolean).join(". ");
  return extra ? `${PASTACAST_STYLE_PROMPT} Character: ${extra}` : PASTACAST_STYLE_PROMPT;
}

/**
 * Shared class strings for key-style controls (see Button.tsx).
 *
 * A raised key has a darker edge under its face. Pressing pushes the face
 * down onto the edge, so the control answers the finger like a real button.
 * Each user sets the edge colour with `[--edge:…]`.
 */
export const RAISED =
  "shadow-[0_3px_0_var(--edge)] transition-[translate,box-shadow] duration-75 active:translate-y-[2px] active:shadow-[0_1px_0_var(--edge)]";

/**
 * Classes for a key that stays down while it is the chosen one (a speed, the
 * current sign). A chosen key sits level with the bottom edge of its raised
 * neighbours, so it reads as pushed in rather than just recoloured.
 */
export function toggleKey(chosen: boolean) {
  const base =
    "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-ctl border px-3.5 text-nav transition-[translate,box-shadow] duration-75";
  return chosen
    ? `${base} translate-y-[3px] border-forest bg-forest font-semibold text-white shadow-[inset_0_2px_0_var(--color-forest-edge)]`
    : `${base} ${RAISED} border-control bg-white text-ink [--edge:var(--color-control-edge)] hover:bg-cream`;
}

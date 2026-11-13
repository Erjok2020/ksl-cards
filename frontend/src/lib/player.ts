/** Playback speeds offered under every sign video. */
export const SPEEDS = [0.5, 0.75, 1] as const;
export type Speed = (typeof SPEEDS)[number];

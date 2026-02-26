export type FrameAnalysisMode = "sway" | "non-sway";

/**
 * Entry-point mode selector for frame equation assembly.
 * Uses kinematic sway susceptibility to choose the solver path.
 */
export function resolveFrameAnalysisMode(
  swaySusceptible: boolean,
): FrameAnalysisMode {
  return swaySusceptible ? "sway" : "non-sway";
}


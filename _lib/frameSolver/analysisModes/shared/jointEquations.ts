import { Node } from "../../../elements/node";
import { SlopeDeflection } from "../../slopeDeflectionEqn";

const EQUATION_TOLERANCE = 1e-9;

/**
 * Build rotational joint equilibrium equations:
 * sum(M_end_at_joint) + M_applied_joint = 0.
 *
 * This helper is shared by both sway and non-sway analysis modes.
 */
export function buildJointEquations(
  nodes: Node[],
  slopeDeflection: SlopeDeflection,
) {
  const rawJointEqns = nodes
    .filter((node) => node.support?.type !== "fixed")
    .map((node) => slopeDeflection.updatedGetEquations(node));

  return rawJointEqns.filter((eq) => {
    const hasVariable = Object.keys(eq).some((k) => k !== "c");
    if (hasVariable) return true;

    const c = eq.c ?? 0;
    if (Math.abs(c) > EQUATION_TOLERANCE) {
      throw new Error(
        `Inconsistent joint equation detected (constant-only residual ${c}).`,
      );
    }

    return false;
  });
}


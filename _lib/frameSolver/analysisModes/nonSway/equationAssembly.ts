import { Node } from "../../../elements/node";
import { SlopeDeflection } from "../../slopeDeflectionEqn";
import { buildJointEquations } from "../shared/jointEquations";

/**
 * Non-sway mode:
 * - rotational joint equations only.
 * - no translational DELTA equations are assembled.
 */
export function assembleNonSwayEquations(
  nodes: Node[],
  slopeDeflection: SlopeDeflection,
) {
  return buildJointEquations(nodes, slopeDeflection);
}


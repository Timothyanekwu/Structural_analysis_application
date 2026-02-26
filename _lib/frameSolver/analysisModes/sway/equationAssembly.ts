import { Beam, Column, InclinedMember } from "../../../elements/member";
import { Node } from "../../../elements/node";
import { SlopeDeflection } from "../../slopeDeflectionEqn";
import { buildJointEquations } from "../shared/jointEquations";

/**
 * Sway mode:
 * - rotational joint equations, plus
 * - translational sway equations (DELTA unknowns).
 */
export function assembleSwayEquations(
  nodes: Node[],
  members: (Beam | Column | InclinedMember)[],
  slopeDeflection: SlopeDeflection,
) {
  const jointEqns = buildJointEquations(nodes, slopeDeflection);
  const swayEqns = slopeDeflection.getSwayEquations(nodes, members);
  return [...jointEqns, ...swayEqns];
}


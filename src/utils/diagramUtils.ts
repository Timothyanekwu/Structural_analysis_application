
import { Member } from "@/components/StructurePreview";

export type DiagramData = {
  x: number;
  shear: number;
  moment: number;
  axial: number;
}[];

type SolverResult = {
  leftMoment: number;
  rightMoment: number;
};

/**
 * Calculates internal forces diagram data using the Method of Sections.
 * Starts from the left end (x=0) and moves to the right.
 * 
 * V(0) is calculated such that M(L) matches the solver's result.
 * V(x) = V(0) - Sum[Loads_Vertical_Left]
 * M(x) = M(0) + V(0)*x - Sum[Moment_of_Loads_Left]
 * P(x) = P(0) - Sum[Loads_Horizontal_Left]
 */
export const calculateDiagramData = (
  member: Member,
  results: SolverResult,
  steps: number = 100
): DiagramData => {
  const dx = member.endNode.x - member.startNode.x;
  const dy = member.endNode.y - member.startNode.y;
  const L = Math.sqrt(dx * dx + dy * dy);

  // 1. Resolve Loads into Local Coordinates (Transverse & Axial)
  // Assuming 'angle' in load is angle w.r.t global X axis? 
  // OR angle w.r.t member axis? 
  // User UI shows "Vector Angle". 
  // Let's assume Global Angle for now, necessitating rotation to local.
  // Wait, the Load component treats "90" as down perpendicular to beam in visuals usually?
  // Let's check `StructurePreview` logic for drawing.
  // In StructurePreview: Angle 90 is drawn perpendicular to line.
  // So Angle is relative to Member Axis? Or Global?
  // Checking `StructurePreview`: `angle` is used with `Math.cos(angle)`, `sin`.
  // If Member is horizontal, 90 is down.
  // If Member is vertical, 90 is ... right?
  // Let's assume simpler case: Load Angle is relative to Horizontal (Global).
  // AND Member Angle is relative to Horizontal.
  // Then Local Angle = LoadAngle - MemberAngle.
  
  const memberAngle = Math.atan2(dy, dx);
  
  const processedLoads = member.loads.map(l => {
    // Default angle 90 (vertical down) if undefined
    // If user inputs 90, they likely mean "Down" in Global usually.
    // Let's stick to: Vector Angle is Global Angle. 0 = Right, 90 = Down, 270 = Up.
    // Visuals in Preview used `(load.angle ?? 90) * (Math.PI / 180)`.
    
    // NOTE: In standard Math, 90 is UP. In screen coords (SVG), Y is Down, so 90 is Down.
    // SVG standard: 0 is Right, 90 is Down.
    // So 90 degrees = Downward Vertical Load.
    
    const globalLoadAngle = (l.angle ?? 90) * (Math.PI / 180);
    
    // Project vector onto member (Axial) and Perpendicular (Shear)
    // Unit vector of member: (cos(theta), sin(theta))
    // Load Vector L: (cos(phi), sin(phi)) * Magnitude
    // Axial Component = Dot Product
    // Shear Component = Cross Product (2D)
    
    // Member Direction Vector
    const mx = Math.cos(memberAngle);
    const my = Math.sin(memberAngle);
    
    // Load Direction Vector
    const lx = Math.cos(globalLoadAngle);
    const ly = Math.sin(globalLoadAngle); // Remember Y is down in SVG, so +sin(90) = +1 (Down)
    
    // Dot Product (Axial): L . M = lx*mx + ly*my
    // If aligned, it's compression or tension.
    // Should be: P pushes on node?
    // Let's refine simple beam case first (Horizontal).
    // MemberAngle = 0. mx=1, my=0.
    // Load 90 (Down). lx=0, ly=1.
    // Axial = 0*1 + 1*0 = 0.
    // Shear = ? 
    // We want Transverse component.
    // Transverse = -lx*my + ly*mx (2D cross product scalar)
    // = -0*0 + 1*1 = 1. (Positive Load = Downward force).
    
    const axialComp = l.value * (lx * mx + ly * my);
    const shearComp = l.value * (-lx * my + ly * mx); // Positive = Downward (acting 'with' gravity)
    
    return {
      ...l,
      axialVal: axialComp,
      shearVal: shearComp, // Magnitude of downward transverse force
      pos: Number(l.position || 0),
      spanLen: Number(l.span || 0),
      // VDL specific
      highVal: Number(l.highValue || 0),
      highPos: Number(l.highPosition || 0),
      lowPos: Number(l.lowPosition || 0)
    };
  });

  // 2. Setup Boundary Conditions
  // M(0) and M(L) are given (Internal Moments).
  // Sign Convention: Sagging Positive?
  // If Solver gives Fixed End Moments:
  // Left: -ve (Hogging), Right: -ve (Hogging).
  // Let's trust the solver results are mapped to "Sagging +ve" or similar consistent internal moments.
  
  const M_start = results.leftMoment;
  const M_end = results.rightMoment;
  
  // Calculate Initial Shear V(0)
  // Formula: V(0) = (M(L) - M(0) + SumOfMomentsOfLoadsAboutEnd) / L
  // Check signs again.
  // Take moments about End (Right side).
  // Sum M_end = 0 (Equilibrium of whole beam)
  // V_start * L  (Clockwise -> +ve? Depends on convention. Let's start with basic statics)
  // Let Upward Force be +ve. Right Moment be +ve (CCW on Cartesian).
  // Sum M_right = 0
  // - V_start * L (Moment is V*L, direction is CW (since V is up, L is right). CW is -ve).
  // + M_start (Internal Moment at start?? No, Reaction Moment).
  // Let's stick to the Beam Equation:
  // M(x) = M(0) + integral(V) dx
  // M(L) = M(0) + integral_0_L (V(x)) dx
  // V(x) = V(0) - Load(x)
  // integral(V) = V(0)*L - MomentOfLoads
  // M(L) = M(0) + V(0)*L - MomentLoad_about_L
  // => V(0)*L = M(L) - M(0) + MomentLoad_about_L
  // => V(0) = (M(L) - M(0) + MomentLoad_about_L) / L
  // NOTE: MomentLoad_about_L is the "Static Moment of Area" of the loads? No, it's the moment caused by the loads.
  // Term: Sum(P * (L - a)).
  
  let momentOfLoadsAboutEnd = 0;
  let sumAxialLoads = 0; // For P(0) calculation? 
  // Axial is slightly diff. P(x) = P(0) - loads. P(L) is reaction.
  // We don't have P(L) from solver directly? Or do we?
  // Solver usually returns reactions.
  // For now, assume P(0) = - (Sum of Axial Loads) / 2? Or pinned-roller logic?
  // If Start is Roller, P(0) = 0.
  // If End is Roller, P(L) = 0.
  // Let's assume zero axial reaction at start unless otherwise determined, or distribute?
  // Let's start P(0) such that P(centroid) is 0? 
  // BETTER: Logic says Axial Force is usually 0 for beams unless inclined loaded.
  // Let's just accumulate axial loads.
  const totalAxialLoad = processedLoads.reduce((acc, l) => acc + (l.type === "Point" ? l.axialVal : l.axialVal * l.spanLen), 0);
  const P0 = -totalAxialLoad / 2; // Naive distribution of reaction.
  
  processedLoads.forEach(l => {
    let loadForce = 0;
    let loadMomentArm = 0;

    if (l.type === "Point") {
      loadForce = l.shearVal;
      loadMomentArm = L - l.pos;
    } else if (l.type === "UDL") {
      loadForce = l.shearVal * l.spanLen;
      loadMomentArm = L - (l.pos + l.spanLen / 2);
    } else if (l.type === "VDL") {
      const span = Math.abs(l.highPos - l.lowPos);
      loadForce = (l.shearVal * span) / 2; // Triangular load area
      // Centroid is 1/3 from the high end for a triangle starting at zero at low end
      const centroidOffsetFromHigh = span / 3;
      const centroidPos = l.highPos > l.lowPos ? l.highPos - centroidOffsetFromHigh : l.highPos + centroidOffsetFromHigh;
      loadMomentArm = L - centroidPos;
    }

    momentOfLoadsAboutEnd += loadForce * loadMomentArm;
    sumAxialLoads += l.type === "Point" ? l.axialVal : (l.type === "UDL" ? l.axialVal * l.spanLen : (l.axialVal * Math.abs(l.highPos - l.lowPos) / 2));
  });

  const V0 = (M_end + M_start + momentOfLoadsAboutEnd) / L;

  // 3. Marching Solution
  // 3. Marching Solution
  const data: DiagramData = [];
  
  // Collect all points of interest for accurate jumps and curves
  const interestPoints = new Set<number>([0, L]);
  processedLoads.forEach(l => {
    // Add point load locations
    if (l.type === "Point") interestPoints.add(l.pos);
    // Add UDL/VDL start and end points
    else if (l.type === "UDL") {
      interestPoints.add(l.pos);
      interestPoints.add(l.pos + l.spanLen);
    } else if (l.type === "VDL") {
      interestPoints.add(Math.min(l.lowPos, l.highPos));
      interestPoints.add(Math.max(l.lowPos, l.highPos));
    }
  });

  // Add intermediate steps for smooth curves (especially for moments)
  for (let i = 0; i <= steps; i++) {
    interestPoints.add((i / steps) * L);
  }

  // Sort and process each point
  const sortedPoints = Array.from(interestPoints).sort((a, b) => a - b);

  sortedPoints.forEach(x => {
    // Helper to calculate state at x
    const calculateAt = (includeAtX: boolean) => {
      let loadShear = 0;
      let loadMoment = 0;
      let loadAxial = 0;

      processedLoads.forEach(l => {
        if (l.type === "Point") {
          // Jump logic: include at X only if includeAtX is true
          const isPast = includeAtX ? l.pos <= x : l.pos < x;
          if (isPast) {
            loadShear += l.shearVal;
            loadMoment += l.shearVal * (x - l.pos);
            loadAxial += l.axialVal;
          }
        }
        else if (l.type === "UDL") {
          const start = l.pos;
          const end = l.pos + l.spanLen;
          if (x > start) {
            const activeEnd = Math.min(x, end);
            const activeLen = activeEnd - start;
            const activeForce = activeLen * l.shearVal;
            const activeAxial = activeLen * l.axialVal;
            loadShear += activeForce;
            const centroid = start + activeLen / 2;
            loadMoment += activeForce * (x - centroid);
            loadAxial += activeAxial;
          }
        }
        else if (l.type === "VDL") {
          const start = Math.min(l.lowPos, l.highPos);
          const end = Math.max(l.lowPos, l.highPos);
          if (x > start) {
            const activeEnd = Math.min(x, end);
            const activeLen = activeEnd - start;
            const totalSpan = end - start;
            const isIncreasing = l.highPos > l.lowPos;
            const distFromZeroAtActiveEnd = isIncreasing ? activeLen : (totalSpan - (x - start));
            const w_at_x = Math.max(0, l.shearVal * (distFromZeroAtActiveEnd / totalSpan));
            
            let activeForce = 0;
            let activeAxial = 0;
            let arm = 0;
            if (isIncreasing) {
              activeForce = (w_at_x * activeLen) / 2;
              activeAxial = (l.axialVal * (distFromZeroAtActiveEnd / totalSpan) * activeLen) / 2;
              arm = x - (start + (2 / 3) * activeLen);
            } else {
              const totalForce = (l.shearVal * totalSpan) / 2;
              const totalAxial = (l.axialVal * totalSpan) / 2;
              const remainingLen = totalSpan - activeLen;
              const w_remaining_peak = l.shearVal * (remainingLen / totalSpan);
              const w_axial_remaining_peak = l.axialVal * (remainingLen / totalSpan);
              
              const remainingForce = (w_remaining_peak * remainingLen) / 2;
              const remainingAxial = (w_axial_remaining_peak * remainingLen) / 2;
              
              activeForce = totalForce - remainingForce;
              activeAxial = totalAxial - remainingAxial;
              
              const totalMomentAboutX = totalForce * (x - (start + totalSpan / 3));
              const remainingMomentAboutX = remainingForce * (x - (activeEnd + remainingLen / 3));
              arm = (totalMomentAboutX - remainingMomentAboutX) / (activeForce || 1);
            }
            loadShear += activeForce;
            loadMoment += activeForce * arm;
            loadAxial += activeAxial;
          }
        }
      });

      const state = {
        shear: V0 - loadShear,
        moment: -results.leftMoment + (V0 * x) - loadMoment,
        axial: P0 - loadAxial
      };

      return state;
    };

    // 1. Calculate and add "Before" state at x (to show jumps)
    const isPointLoadX = processedLoads.some(l => l.type === "Point" && Math.abs(l.pos - x) < 1e-6);
    if (isPointLoadX && x > 0) {
      const before = calculateAt(false);
      data.push({ x, ...before });
    }

    // 2. Calculate and add "After" state at x (the definitive value at x)
    const after = calculateAt(true);
    data.push({ x, ...after });
  });

  return data;
};

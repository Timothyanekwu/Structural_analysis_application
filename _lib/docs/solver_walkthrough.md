# Frame and Beam Solver Analysis

## Overview

This document analyzes the implementation of the `FrameSolver` and `BeamSolver` classes, which utilize the **Slope Deflection Method** to analyze structural frames and continuous beams.

## Analysis & Effectiveness

### Frame Solver (`frameSolver.ts`)

**Status:** **Effective for Orthogonal Frames**
The solver correctly implements the Slope Deflection method for frames consisting of vertical columns and horizontal beams.

**Key Strengths:**

- **Sway Handling:** It correctly identifies "Sway Groups" – independent sets of nodes that can translate horizontally. This allows it to solve for partial sway (e.g., one floor swaying while another is braced) or full frame sway.
- **Matrix Formation:** It dynamically builds a system of simultaneous equations combining:
  - **Joint Equilibrium:** $\sum M = 0$ at every free node.
  - **Shear Equilibrium:** $\sum F_x = 0$ for each sway group (Sway Equation).
- **Support Settlement:** Includes terms for support settlement in the moment equations.

**Concerns / Limitations:**

- **Inclined Members:** The solver currently _explicitly throws an error_ if `InclinedMember` is used. It does not handle the geometry transformation required for non-orthogonal frames.
- **Axial Deformation:** The solver assumes members are inextensible (no axial deformation) for the purpose of sway grouping, which is standard for slope deflection but finding axial forces is done as a post-processing step (`solveAxialBalance`).
- **P-Delta:** No second-order effects (P-Delta) are calculated.

### Beam Solver (`beamSolver.ts`)

**Status:** **Functional but Simplified**
A specialized wrapper around the same `SlopeDeflection` logic, optimized for continuous beams.

**Key Strengths:**

- **Internal Moments:** calculates internal bending moments at any point $x$, which is essential for drawing BMDs.
- **Max/Min Detection:** Iteratively checks spans to find maximum sagging and hogging moments for design.

**Concerns:**

- **Redundant Calculations:** `getMaxMomentPerSpan` calls `updatedGetFinalMoments`, which re-solves the entire system. For large beams, this is inefficient.
- **VDL Support:** Variable Distributed Load (VDL) support seems partial or approximated in the internal moment calculation.

---

## Detailed Code Walkthrough

### 1. The Core: Slope Deflection Equations (`slopeDeflectionEqn.ts`)

This class generates the symbolic linear equations used by both solvers.

#### **A. Configuration (`configureModel`)**

- **Input:** List of Nodes and Members.
- **Sway Grouping:**
  - It treats beams as rigid links in the horizontal direction.
  - It runs a "Connected Components" search (BFS) on nodes connected by beams.
  - If a group of nodes is connected to a Fixed or Pinned support, it is **Restrained** (Sway = 0).
  - If a group has no horizontal restraint, it is assigned a **Sway Variable** (`DELTA_1`, `DELTA_2`, etc.).

#### **B. Building Member Equations (`getEndMomentTerms`)**

For each member end, it constructs the standard Slope Deflection equation:
$$M_{ij} = FEM_{ij} + \frac{2EI}{L} (2\theta_i + \theta_j - 3\psi)$$

- **Rotation ($\theta$):** Adds terms for $2\theta_{near}$ and $1\theta_{far}$.
- **Translation ($\psi$):**
  - **Beams:** $\psi = \frac{\Delta_{settlement}}{L}$.
  - **Columns:** $\psi = \frac{\Delta_{sway}}{L}$. The solver adds the Sway Variable (`DELTA_k`) with coefficient $\frac{-6EI}{L^2}$.
- **Fixed End Moments (FEM):** Calculates FEMs from applied loads (UDL, Point Load) and adds them as the constant term $C$.

#### **C. Joint Equilibrium (`updatedGetEquations`)**

For every node $i$ that is simple (not fixed):
$$ \sum M*{ij} = M*{load} $$

- Sums the end moments of all connected members.
- Equates them to the external nodal moment (if any).
- This creates one equation per unknown rotation $\theta_i$.

#### **D. Shear (Sway) Equations (`getSwayEquations`)**

For each Sway Group:
$$ \sum H*{column} + \sum H*{load} = 0 $$

- Calculates the shear force at the top/bottom of every column in the group using statics:
  $$ H = \frac{M*{top} + M*{bot} - M\_{loads}}{L} $$
- Sums these shears and equates them to the external horizontal nodal loads.
- This creates one equation per unknown sway $\Delta_k$.

### 2. The Solution Process (`FrameSolver.ts`)

#### **Step 1: System Assembly**

- The solver calls `slopeDeflection.updatedGetEquations()` to gather all Joint and Sway equations.
- The system looks like:
  $$ [K] \cdot \{X\} = \{F\} $$
    Where $\{X\}$ contains all $\theta$ and $\Delta$ unknowns.

#### **Step 2: Matrix Solution**

- Uses `Equation.solveEquations()` (via `mathjs`) to solve the linear system.
- Support for Least Squares is enabled to handle over-constrained or singular cases gracefully (though a well-formed structure should be square).

#### **Step 3: Back-Substitution (`updatedGetFinalMoments`)**

- The calculated values for $\theta$ and $\Delta$ are substituted back into the member end moment equations constructed in Step 1B.
- Result: Final end moments ($M_{start}$, $M_{end}$) for every member.

#### **Step 4: Reactions & Statics (`updatedSolveReactions`)**

Once end moments are known, the solver calculates reactions using simple statics on isolated free bodies of members:

1.  **Beam Shears:** $R_y = \frac{\sum M_{loads} - M_{start} - M_{end}}{L}$
2.  **Column Shears:** $R_x = \frac{\sum M_{loads} - M_{start} - M_{end}}{L}$
3.  **Axial Forces:**
    - The solver runs a separate `solveAxialBalance`.
    - It treats horizontal forces on beams and vertical forces on columns as a simple 1D truss problem to balance joint forces ($\sum F_x=0$ or $\sum F_y=0$).

### 3. Beam Design Features (`BeamSolver.ts`)

#### **Internal Moments & Envelopes**

- **`getInternalMoment(x)`**: Cuts the beam at distance $x$.
  $$ M(x) = R*{start} \cdot x - M*{start} - \sum (Load \cdot distance) $$
  - _Note:_ It correctly accounts for the sign of the start moment $M_{start}$ (subtracting it because Slope Deflection usually treats ACW as positive, which causes Hogging/Negative moment).
- **`getMaxMomentPerSpan`**:
  - Discretizes the beam (e.g., every 0.1m).
  - Calculates Internal Moment at every point.
  - Returns the peak positive (Sagging) and negative (Hogging) values for reinforcement design.

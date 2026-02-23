# FrameSolver Detailed Workflow

This document is a full theory-to-code walkthrough of the frame solver in this repository.
It explains:

1. The textbook slope-deflection equations for non-sway and sway systems.
2. How those equations are represented in this codebase.
3. The exact workflow used by the solver from model input to final reactions.
4. Worked examples (with real equation objects produced by the current implementation).

Line references are included so you can jump directly from theory to implementation.
All line references are for the current code state and may shift after future edits.

## 1. Scope and Main Files

The frame logic is concentrated in:

- `_lib/frameSolver/slopeDeflectionEqn.ts`
- `_lib/frameSolver/frameSolver.ts`

Supporting files used directly by these:

- `_lib/logic/simultaneousEqn.ts` (linear equation solver)
- `_lib/logic/FEMs.ts` (fixed-end moments from member loads)
- `_lib/elements/node.ts` (nodal loads/displacements)
- `_lib/elements/member.ts` (Beam/Column classes, geometry, equivalent loads)
- `_lib/elements/support.ts` (fixed/pinned/roller support behavior)

## 2. Theoretical Foundation (Textbook Form)

### 2.1 General slope-deflection member equations

For a prismatic member `i-j`:

`M_ij = FEM_ij + (2EI/L) * (2*theta_i + theta_j - 3*psi_ij)`

`M_ji = FEM_ji + (2EI/L) * (2*theta_j + theta_i - 3*psi_ij)`

Where:

- `FEM_ij`, `FEM_ji` = fixed-end moments due to member loading
- `theta_i`, `theta_j` = joint rotations
- `psi_ij` = chord rotation from relative transverse translation
- `E`, `I`, `L` = member properties

Equivalent sway/translation term is often written as `+- (6EI/L^2) * Delta`.

### 2.2 Non-sway special case

If lateral translation is restrained:

- `psi_ij = 0` for sway
- member equations reduce to rotation-only forms plus any settlement term

So:

`M_ij = FEM_ij + (4EI/L)*theta_i + (2EI/L)*theta_j + settlement_term`

`M_ji = FEM_ji + (4EI/L)*theta_j + (2EI/L)*theta_i + settlement_term`

### 2.3 Sway special case

If side sway is permitted, translational DOF(s) are unknown(s). In this project:

- one sway unknown is represented as `DELTA_k` per free sway group
- columns receive explicit sway contribution `+- (6EI/L^2) * DELTA_k`
- joint equilibrium and sway equilibrium are solved simultaneously

### 2.4 Joint equilibrium and sway equilibrium

Textbook system combines:

1. Joint moment equilibrium:
   `sum(M_at_joint) + M_external_joint = 0`
2. Lateral equilibrium:
   `sum(H_column_contributions) - sum(Fx_group) = 0`

This is exactly how the implementation is assembled.

## 3. How Equations Are Represented in Code

### 3.1 `Term[]` symbolic representation

In `_lib/frameSolver/slopeDeflectionEqn.ts:38`, each term is:

- `{ name: string; coefficient: number }`

Example symbolic end moment:

`M_BC = c + a*THETA_B + b*THETA_C + d*DELTA_1`

is stored as:

- `{ name: "c", coefficient: c }`
- `{ name: "THETA_B", coefficient: a }`
- `{ name: "THETA_C", coefficient: b }`
- `{ name: "DELTA_1", coefficient: d }`

### 3.2 Equation object format

After collecting like terms, each equation is an object:

`{ THETA_B: 1.6, THETA_C: 0.4, DELTA_1: -0.375, c: 7.5 }`

Interpreted as:

`1.6*THETA_B + 0.4*THETA_C - 0.375*DELTA_1 + 7.5 = 0`

In `_lib/logic/simultaneousEqn.ts:19`, solver builds RHS as `F = -(c)`, so the internal matrix form is:

`K * X = -c`

## 4. Symbol Mapping: Textbook vs Implementation

| Textbook symbol | Meaning | Code representation | Where created |
|---|---|---|---|
| `theta_i` | Joint rotation at node `i` | `THETA_<nodeId>` | `_lib/frameSolver/slopeDeflectionEqn.ts:197` |
| `Delta_k` | Sway translation unknown | `DELTA_<groupId>` | `_lib/frameSolver/slopeDeflectionEqn.ts:116` |
| `FEM_ij` | Fixed-end moment at member end | `c` term in end-moment expression | `_lib/frameSolver/slopeDeflectionEqn.ts:307` |
| `4EI/L` | near-end rotation coeff | `2*k` with `k = 2EI/L` | `_lib/frameSolver/slopeDeflectionEqn.ts:232`, `_lib/frameSolver/slopeDeflectionEqn.ts:314` |
| `2EI/L` | far-end rotation coeff | `k` | `_lib/frameSolver/slopeDeflectionEqn.ts:232`, `_lib/frameSolver/slopeDeflectionEqn.ts:317` |
| `6EI/L^2 * Delta` | sway contribution | `getColumnSwayTerms` | `_lib/frameSolver/slopeDeflectionEqn.ts:272` |
| `sum M = 0` | joint equilibrium | `updatedGetEquations(node)` | `_lib/frameSolver/slopeDeflectionEqn.ts:394` |
| `sum H - Fx = 0` | sway equilibrium | `getSwayEquations` | `_lib/frameSolver/slopeDeflectionEqn.ts:434` |

## 5. End-to-End Workflow in This Repository

## 5.1 Entry: `FrameSolver.updatedSolveReactions()`

Primary solve pipeline starts at `_lib/frameSolver/frameSolver.ts:276`.

Flow:

1. Validate model constraints (`Beam`/`Column` only, positive stiffness):
   `_lib/frameSolver/frameSolver.ts:34`
2. Solve final end moments:
   `_lib/frameSolver/frameSolver.ts:279`
3. Recover member shears and node reactions:
   `_lib/frameSolver/frameSolver.ts:289`
4. Recover axial balancing forces:
   `_lib/frameSolver/frameSolver.ts:313`
5. Return support reaction map:
   `_lib/frameSolver/frameSolver.ts:319`

## 5.2 Model configuration and sway grouping

`SlopeDeflection.configureModel(...)` at `_lib/frameSolver/slopeDeflectionEqn.ts:74` does three critical jobs:

1. Build beam-connectivity graph (BFS components):
   `_lib/frameSolver/slopeDeflectionEqn.ts:82`, `_lib/frameSolver/slopeDeflectionEqn.ts:95`
2. Classify each component:
   - if any node in the component has fixed/pinned support -> no sway variable (`null`)
   - else -> assign `DELTA_k`
   `_lib/frameSolver/slopeDeflectionEqn.ts:112` to `_lib/frameSolver/slopeDeflectionEqn.ts:119`
3. Solve compatible imposed displacements for settlement constants:
   `_lib/frameSolver/slopeDeflectionEqn.ts:122`

Interpretation:

- Non-sway component in this implementation means: no `DELTA` variable is created.
- Sway component means: one `DELTA` unknown is created and later used in column end moments.

## 5.3 Compatibility-based imposed displacements (settlement preprocessing)

`resolveCompatibleNodalDisplacements(...)` at `_lib/frameSolver/slopeDeflectionEqn.ts:135`:

1. Collect known translational DOFs from support conditions and imposed nodal displacements:
   `_lib/frameSolver/slopeDeflectionEqn.ts:147`
2. Add axial-rigid compatibility equations per member:
   `_lib/frameSolver/slopeDeflectionEqn.ts:170`
   Equation shape:
   `(u_end - u_start) dot member_axis = 0`
3. Solve with optional least-squares when non-square:
   `_lib/frameSolver/slopeDeflectionEqn.ts:211`
4. Cache `(dx, dy)` for each node:
   `_lib/frameSolver/slopeDeflectionEqn.ts:218`

This preprocessing feeds settlement constants used in member end-moment equations.

## 5.4 Member end-moment expression assembly

`getEndMomentTerms(member, node)` at `_lib/frameSolver/slopeDeflectionEqn.ts:317` builds each end equation as symbolic terms.

It handles:

1. Free-end special cases:
   `_lib/frameSolver/slopeDeflectionEqn.ts:322` to `_lib/frameSolver/slopeDeflectionEqn.ts:334`
2. Fixed-end moment constant from member loading:
   `_lib/frameSolver/slopeDeflectionEqn.ts:341`
3. Rotation coefficients (`2k` near, `k` far):
   `_lib/frameSolver/slopeDeflectionEqn.ts:347` to `_lib/frameSolver/slopeDeflectionEqn.ts:352`
4. Settlement constant:
   `_lib/frameSolver/slopeDeflectionEqn.ts:355`
5. Column sway terms (`DELTA` coupling):
   `_lib/frameSolver/slopeDeflectionEqn.ts:358`

## 5.5 Joint equations

At each non-fixed node, `updatedGetEquations(node)`:

- gets all end moments at that node
- sums them
- adds nodal moment load
- outputs one linear equation object

See `_lib/frameSolver/slopeDeflectionEqn.ts:394` and `_lib/frameSolver/frameSolver.ts:106`.

`FrameSolver.updatedGetEquations()` also checks for inconsistent constant-only equations and throws if residual is nonzero:

- `_lib/frameSolver/frameSolver.ts:109` to `_lib/frameSolver/frameSolver.ts:117`

## 5.6 Sway equations

`getSwayEquations(...)` at `_lib/frameSolver/slopeDeflectionEqn.ts:434`:

1. Loop free sway groups (`varName !== null`)
2. Sum column end-shear symbolic terms at group nodes
3. Subtract horizontal nodal loads (`node.xLoad`)
4. Return one equation per free sway group

Column end shear terms come from `_lib/frameSolver/slopeDeflectionEqn.ts:410`.

## 5.7 Solve unknowns and back-substitute

`FrameSolver.updatedGetFinalMoments()` at `_lib/frameSolver/frameSolver.ts:132`:

1. Build symbolic moments (`updatedGetSupportMoments`)
2. Build equation system (`updatedGetEquations`)
3. Solve unknowns (`Equation.solveEquations`)
4. Substitute solved unknown values into symbolic terms
5. Return numeric end moments map (`MOMENTij`)

Solver internals for matrix build are in `_lib/logic/simultaneousEqn.ts:9`.

## 5.8 Reactions and post-processing

After moments are known, `updatedSolveReactions()` computes:

1. Beam vertical shears:
   `_lib/frameSolver/frameSolver.ts:172`
   `RyEnd = (sum(load*pos) - Mend - Mstart)/L`
2. Column horizontal shears:
   `_lib/frameSolver/frameSolver.ts:192`
   `RxEnd = (sum(load*pos) - Mend - Mstart)/L`
3. Axial balancing unknowns for:
   - beam axial `x` forces
   - column axial `y` forces
   via `_lib/frameSolver/frameSolver.ts:212`
4. Final support reaction map:
   `_lib/frameSolver/frameSolver.ts:319`

## 6. Worked Example A (Non-Sway, No `DELTA` Unknown)

This example demonstrates the non-sway equation pattern as produced by the current code.

Model:

- Nodes: `A(0,0)`, `B(5,0)`, `C(10,0)`
- Supports: `A` pinned, `C` pinned
- Members: `AB` beam, `BC` beam
- Properties: `E=1`, `I=1` on both spans
- Load: point load `P=10` at `x=2.5` on span `AB`

Key outcome:

- `DELTA` is not created (component contains pinned supports), so this is a non-sway solve in code terms.

Actual equation objects from solver:

```json
[
  { "c": 6.25, "THETA_A": 0.8, "THETA_B": 0.4 },
  { "c": -6.25, "THETA_B": 1.6, "THETA_A": 0.4, "THETA_C": 0.4 },
  { "THETA_C": 0.8, "THETA_B": 0.4 }
]
```

Interpretation:

1. `0.8*THETA_A + 0.4*THETA_B + 6.25 = 0`
2. `0.4*THETA_A + 1.6*THETA_B + 0.4*THETA_C - 6.25 = 0`
3. `0.4*THETA_B + 0.8*THETA_C = 0`

Solved unknowns:

```json
{
  "THETA_A": -11.71875,
  "THETA_B": 7.8125,
  "THETA_C": -3.90625
}
```

Final end moments:

```json
{
  "MOMENTAB": 0,
  "MOMENTBA": -4.6875,
  "MOMENTBC": 4.6875,
  "MOMENTCB": 0
}
```

How this matches textbook non-sway equations:

- For span `AB` (`L=5`, `EI=1`):
  - `k = 2EI/L = 0.4`
  - near coeff `2k = 0.8`, far coeff `k = 0.4`
  - FEM from center point load: `+6.25` at `A`, `-6.25` at `B`
- For `BC`, FEM is zero, only rotation terms remain.

This is exactly the textbook non-sway shape:

- FEM terms + `(4EI/L)*theta_near + (2EI/L)*theta_far`
- no sway variable

Implementation references:

- end-moment assembly: `_lib/frameSolver/slopeDeflectionEqn.ts:317`
- joint equation assembly: `_lib/frameSolver/slopeDeflectionEqn.ts:394`
- equation solve: `_lib/logic/simultaneousEqn.ts:9`
- substitution to final moments: `_lib/frameSolver/frameSolver.ts:132`

## 7. Worked Example B (Sway Frame With Nonzero `DELTA`)

This example shows a genuine sway solve where `DELTA_1` is active and nonzero.

Model:

- Nodes:
  - `A(0,0)` fixed
  - `D(6,0)` fixed
  - `B(0,4)` free joint
  - `C(6,4)` free joint
- Members:
  - `AB` column
  - `BC` beam
  - `DC` column
- Properties: all members `E=1`, `I=1`
- Loading: horizontal nodal load `+10` at node `B` (`B.addHorizontalLoad(10)`)

Why sway variable exists:

- Beam-connected top component is `{B, C}`.
- It contains no fixed/pinned support node.
- So `configureModel` assigns `DELTA_1`.

Actual equation objects from solver:

```json
[
  { "THETA_B": 1.6666666666666665, "DELTA_1": -0.375, "THETA_C": 0.3333333333333333 },
  { "THETA_C": 1.6666666666666665, "THETA_B": 0.3333333333333333, "DELTA_1": -0.375 },
  { "THETA_B": -0.375, "DELTA_1": 0.375, "THETA_C": -0.375, "c": -10 }
]
```

Interpretation:

1. `1.6667*THETA_B + 0.3333*THETA_C - 0.375*DELTA_1 = 0`
2. `0.3333*THETA_B + 1.6667*THETA_C - 0.375*DELTA_1 = 0`
3. `-0.375*THETA_B - 0.375*THETA_C + 0.375*DELTA_1 - 10 = 0`

Solved unknowns:

```json
{
  "THETA_B": 8,
  "THETA_C": 8,
  "DELTA_1": 42.666666666666664
}
```

Final end moments:

```json
{
  "MOMENTAB": -12,
  "MOMENTBA": -8,
  "MOMENTBC": 8,
  "MOMENTCB": 8,
  "MOMENTCD": -8,
  "MOMENTDC": -12
}
```

Final support reactions:

```json
{
  "A": { "xReaction": -5, "yReaction": 2.6666666666666665 },
  "D": { "xReaction": -5, "yReaction": -2.6666666666666665 }
}
```

How the sway term appears in code:

- For each column end expression, `getColumnSwayTerms` contributes `+- (6EI/L^2)*DELTA_k`:
  `_lib/frameSolver/slopeDeflectionEqn.ts:272`
- Joint equations include these `DELTA` coefficients automatically via end-moment summation:
  `_lib/frameSolver/slopeDeflectionEqn.ts:394`
- Group lateral equilibrium contributes the third equation:
  `_lib/frameSolver/slopeDeflectionEqn.ts:434`

## 8. Where Non-Sway and Sway Equations Are Used

Use this section as a direct map for "equation X in theory is applied at line Y in code".

1. Non-sway rotational equation structure:
   - coded in `getEndMomentTerms` as `FEM + 2k*theta_near + k*theta_far`
   - location: `_lib/frameSolver/slopeDeflectionEqn.ts:311` to `_lib/frameSolver/slopeDeflectionEqn.ts:352`

2. Sway equation structure (`DELTA` terms):
   - column-only sway coupling
   - location: `_lib/frameSolver/slopeDeflectionEqn.ts:301` to `_lib/frameSolver/slopeDeflectionEqn.ts:315`

3. Joint equilibrium (`sum M = 0`):
   - location: `_lib/frameSolver/slopeDeflectionEqn.ts:394` to `_lib/frameSolver/slopeDeflectionEqn.ts:408`

4. Sway/lateral equilibrium (`sum H - Fx = 0`):
   - location: `_lib/frameSolver/slopeDeflectionEqn.ts:434` to `_lib/frameSolver/slopeDeflectionEqn.ts:468`

5. Combining and solving all equations:
   - equation assembly: `_lib/frameSolver/frameSolver.ts:98` to `_lib/frameSolver/frameSolver.ts:129`
   - solve: `_lib/frameSolver/frameSolver.ts:136` and `_lib/logic/simultaneousEqn.ts:9`

6. Back-substitution to numeric moments:
   - location: `_lib/frameSolver/frameSolver.ts:140` to `_lib/frameSolver/frameSolver.ts:169`

7. Conversion from moments to reactions:
   - beam shears: `_lib/frameSolver/frameSolver.ts:172`
   - column shears: `_lib/frameSolver/frameSolver.ts:192`
   - axial balancing: `_lib/frameSolver/frameSolver.ts:212`

## 9. Important Behavioral Notes

1. `isSideSway()` is a quick classification helper and not the primary equation builder:
   `_lib/frameSolver/frameSolver.ts:70`

2. Sway unknown assignment is based on beam-connected groups:
   `_lib/frameSolver/slopeDeflectionEqn.ts:82` to `_lib/frameSolver/slopeDeflectionEqn.ts:119`

3. A frame can be sway-enabled (has `DELTA`) but still solve to `DELTA ~ 0` for symmetric/no-lateral cases.

4. Equation objects with only constant terms are checked:
   - if residual constant is nonzero, solver throws inconsistency error
   - `_lib/frameSolver/frameSolver.ts:103` to `_lib/frameSolver/frameSolver.ts:107`

5. `InclinedMember` is explicitly unsupported in `FrameSolver`:
   `_lib/frameSolver/frameSolver.ts:37`

## 10. Practical "Textbook to Code" Checklist

When you are handed a frame problem and want to follow the exact code path:

1. Define nodes/members/supports/loads (`Node`, `Beam`, `Column`).
2. Identify unknowns:
   - rotational unknowns -> every non-fixed joint (`THETA_*`)
   - sway unknowns -> one per free beam-connected group (`DELTA_*`)
3. Build end-moment equations member-by-member:
   - FEM + rotation terms + settlement + (column sway if applicable)
4. Assemble node equilibrium equations (`sum M = 0`).
5. Assemble sway group equations (`sum H - sum Fx = 0`).
6. Solve simultaneous system (`KX = F`).
7. Back-substitute unknowns into all `MOMENTij`.
8. Recover shears/reactions and axial balancing contributions.

That sequence is implemented directly by:

- `_lib/frameSolver/frameSolver.ts:132` for moment solving
- `_lib/frameSolver/frameSolver.ts:276` for full reaction solving

## 11. Known Limits and Engineering Assumptions

1. Orthogonal Beam+Column only (no inclined members in FrameSolver).
2. Linear elastic, small-displacement slope-deflection formulation.
3. No second-order `P-Delta` effects.
4. Axial balancing is post-processed (`solveAxialBalance`) and not fully coupled geometric nonlinearity.

## 12. Quick Reference: Most Important Functions

- `configureModel`: `_lib/frameSolver/slopeDeflectionEqn.ts:74`
- `resolveCompatibleNodalDisplacements`: `_lib/frameSolver/slopeDeflectionEqn.ts:135`
- `getEndMomentTerms`: `_lib/frameSolver/slopeDeflectionEqn.ts:317`
- `updatedGetEquations(node)`: `_lib/frameSolver/slopeDeflectionEqn.ts:394`
- `getSwayEquations`: `_lib/frameSolver/slopeDeflectionEqn.ts:434`
- `FrameSolver.updatedGetEquations`: `_lib/frameSolver/frameSolver.ts:98`
- `FrameSolver.updatedGetFinalMoments`: `_lib/frameSolver/frameSolver.ts:132`
- `FrameSolver.updatedSolveReactions`: `_lib/frameSolver/frameSolver.ts:276`
- `Equation.solveEquations`: `_lib/logic/simultaneousEqn.ts:9`


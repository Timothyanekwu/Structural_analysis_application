import { add, identity, matrix, lusolve, multiply, transpose } from "mathjs";

type EquationProps = { [key: string]: number };
type SolveOptions = {
  allowLeastSquares?: boolean;
};

export class Equation {
  solveEquations(equations: EquationProps[], options: SolveOptions = {}) {
    // Step 1: collect all unknowns (exclude 'c')
    const variableNames = Array.from(
      new Set(
        equations.flatMap((eq) => Object.keys(eq).filter((k) => k !== "c"))
      )
    );

    // Step 2: build K matrix and F vector
    const K = equations.map((eq) => variableNames.map((v) => eq[v] || 0));
    const F = equations.map((eq) => -(eq.c || 0));

    const numEquations = K.length;
    const numUnknowns = variableNames.length;

    if (numUnknowns === 0) return {};
    if (numEquations !== numUnknowns && !options.allowLeastSquares) {
      throw new Error(
        `Slope-deflection system is not square: equations=${numEquations}, unknowns=${numUnknowns}`,
      );
    }

    // Step 3: solve
    let solutionArray;
    if (numEquations === numUnknowns) {
      solutionArray = lusolve(matrix(K), matrix(F));
    } else {
      // Regularized least-squares to avoid singular pseudo-inverse failures.
      const Km = matrix(K);
      const Ft = matrix(F);
      const Kt = transpose(Km);
      const KtK = multiply(Kt, Km);
      const n = variableNames.length;
      const lambda = 1e-9;
      const A = add(KtK, multiply(lambda, identity(n)));
      const b = multiply(Kt, Ft);
      solutionArray = lusolve(A as any, b as any);
    }

    // Step 4: convert to plain JS array
    let arr: any = solutionArray ? solutionArray.toArray() : solutionArray;

    // Flatten 2D [[x],[y]] -> [x,y]
    arr = arr.map((v: any) => (Array.isArray(v) ? v[0] : v));

    // Step 5: map variables to values
    const result: { [key: string]: number } = {};
    variableNames.forEach((name, i) => {
      result[name] = arr[i];
    });

    // console.log(result);
    return result;
  }
}

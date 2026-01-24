import { matrix, lusolve, multiply, pinv } from "mathjs";

type EquationProps = { [key: string]: number };

export class Equation {
  solveEquations(equations: EquationProps[]) {
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

    if (numEquations === 0) {
      return {};
    }

    // Step 3: solve (square vs non-square)
    let solutionArray;
    if (numEquations === numUnknowns) {
      solutionArray = lusolve(matrix(K), matrix(F));
    } else {
      solutionArray = multiply(pinv(matrix(K)), matrix(F));
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

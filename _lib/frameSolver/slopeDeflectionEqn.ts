import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { FixedEndMoments } from "../logic/FEMs";
import { Moment } from "../logic/moment";
import { Node } from "../elements/node";
import { InclinedMember, Beam, Column } from "../elements/member";

type Term = { name: string; coefficient: number };

// export class SlopeDeflection {
//   // Combine like terms
//   collectLikeTerms = (terms: Term[]) => {
//     const result: { [key: string]: { sum: number; c: number } } = {};

//     for (const term of terms) {
//       if (term.coefficient === 0) continue;

//       if (!(term.name in result)) {
//         result[term.name] = { sum: term.coefficient, c: 0 };
//       } else {
//         // Kahan summation
//         const y = term.coefficient - result[term.name].c;
//         const t = result[term.name].sum + y;
//         result[term.name].c = t - result[term.name].sum - y;
//         result[term.name].sum = t;
//       }
//     }

//     // Flatten the object to simple name -> number
//     const flatResult: { [key: string]: number } = {};
//     for (const key in result) {
//       flatResult[key] = result[key].sum;
//     }

//     return flatResult;
//   };

//   kahanPush = (arr: Term[], term: Term, compMap: { [key: string]: number }) => {
//     if (!term.coefficient || term.coefficient === 0) return;

//     if (!(term.name in compMap)) {
//       // first occurrence
//       arr.push({ ...term });
//       compMap[term.name] = 0; // initialize compensation
//     } else {
//       // Kahan summation
//       const existing = arr.find((t) => t.name === term.name)!;
//       const y = term.coefficient - compMap[term.name];
//       const t = existing.coefficient + y;
//       compMap[term.name] = t - existing.coefficient - y;
//       existing.coefficient = t;
//     }
//   };

//   private moment(member: Beam | Column | InclinedMember) {
//     if (!member.startNode.support && member.endNode.support) {
//       const moment = member.getEquivalentPointLoads().reduce((acc, curr) => {
//         const distance = member.length - curr.position;
//         const moment = curr.magnitude * distance;

//         return acc + moment;
//       }, 0);

//       return moment;
//     } else if (member.startNode.support && !member.endNode.support) {
//       const moment = member.getEquivalentPointLoads().reduce((acc, curr) => {
//         const moment = curr.magnitude * curr.position;

//         return acc + moment;
//       }, 0);
//       return moment * -1;
//     } else return;
//   }

//   updatedSupportEquation(node: Node) {
//     const Emember: { [key: string]: number } = {};
//     const Imember: { [key: string]: number } = {};

//     // console.log("NODE: ", node.id);

//     for (const member of node.connectedMembers) {
//       Emember[
//         `member${member.member.startNode.id}${member.member.endNode.id}`
//       ] = member.member.Ecoef;

//       Imember[
//         `member${member.member.startNode.id}${member.member.endNode.id}`
//       ] = member.member.Icoef;
//     }

//     const fem = new FixedEndMoments();
//     const moment = new Moment();

//     // let clk: Term[] = [];
//     // let antiClk: Term[] = [];

//     let clk: { [key: string]: Term[] } = {};
//     let antiClk: { [key: string]: Term[] } = {};

//     const curr = node;

//     // for a beam
//     const isTrmnlNode = (node: Node) => {
//       return (
//         !node.support?.type &&
//         node.connectedMembers.filter((member) => member.member instanceof Beam)
//           .length <= 1
//       );
//     };

//     for (const member of node.connectedMembers) {
//       const currMember = member.member;

//       // SETTLEMENT COMPARISON
//       const startSettlement = currMember.startNode.support?.settlement;
//       const endSettlement = currMember.endNode?.support?.settlement;

//       const signConvention =
//         startSettlement != null &&
//         endSettlement != null &&
//         startSettlement < endSettlement
//           ? -1
//           : 1;

//       if (currMember.startNode === node) {
//         // console.log("TRUE", currMember.startNode.id, node.id);
//         const isOverhang =
//           (member.member.startNode.connectedMembers.length > 1 &&
//             member.member.endNode.connectedMembers.length <= 1) ||
//           (member.member.endNode.connectedMembers.length > 1 &&
//             member.member.startNode.connectedMembers.length <= 1);
//         const span = currMember.length;
//         // console.log("SPAN: ", span);

//         const FEMToEnd = fem.getFixedEndMoment(
//           currMember.loads || [],
//           span,
//           "start",
//           currMember.startNode
//         );
//         // console.log(
//         //   `FEM${currMember.startNode.id}${currMember.endNode.id}: `,
//         //   FEMToEnd
//         // );

//         const E =
//           Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
//         const I =
//           Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

//         if (
//           currMember.endNode.support?.type === "pinned" &&
//           isTrmnlNode(currMember.endNode)
//         ) {
//           const FEMToStart = fem.getFixedEndMoment(
//             currMember.loads || [],
//             span,
//             "end",
//             currMember.startNode
//           );

//           antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
//             [
//               {
//                 name: "c",
//                 coefficient: (FEMToEnd ?? 0) - ((FEMToStart ?? 0) / 2), //prettier-ignore
//               },
//               {
//                 name: `EIteta${curr.id}`,
//                 coefficient: (3 / span) * (E * I),
//               },
//               {
//                 name: `EIteta${currMember.endNode.id}`,
//                 coefficient: 0,
//               },
//               {
//                 name: "EIdeta",
//                 coefficient: curr.support?.settlement
//                   ? (3 / span) *
//                     curr.support.settlement *
//                     (E * I) *
//                     signConvention
//                   : 0,
//               },
//             ];
//         } else {
//           antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
//             [
//               {
//                 name: "c",
//                 coefficient: FEMToEnd || 0,
//               },
//               {
//                 name: `EIteta${curr.id}`,
//                 coefficient:
//                   currMember.startNode.support?.type === "fixed"
//                     ? 0
//                     : (4 / span) * (E * I),
//               },
//               {
//                 name: `EIteta${currMember.endNode.id}`,
//                 coefficient:
//                   currMember.endNode.support?.type === "fixed"
//                     ? 0
//                     : (2 / span) * (E * I),
//               },
//               {
//                 name: "EIdeta",
//                 coefficient: curr.support?.settlement
//                   ? (6 / span ** 2) *
//                     curr.support.settlement *
//                     (E * I) *
//                     signConvention
//                   : 0,
//               },
//             ];
//         }
//       } else if (currMember.endNode === node) {
//         const span = currMember.length;
//         const FEMToStart = fem.getFixedEndMoment(
//           currMember.loads || [],
//           span,
//           "end",
//           currMember.startNode
//         );

//         // console.log(
//         //   `FEM${currMember.endNode.id}${currMember.startNode.id}: `,
//         //   FEMToStart
//         // );

//         const E =
//           Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
//         const I =
//           Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

//         if (
//           currMember.endNode.support?.type === "pinned" &&
//           isTrmnlNode(currMember.endNode)
//         ) {
//           clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
//             { name: "c", coefficient: 0 },
//             {
//               name: `EIteta${curr.id}`,
//               coefficient: 0,
//             },
//             {
//               name: `EIteta${currMember.startNode.id}`,
//               coefficient: 0,
//             },
//             {
//               name: "EIdeta",
//               coefficient: 0,
//             },
//           ];
//         } else {
//           clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
//             { name: "c", coefficient: FEMToStart || 0 },
//             {
//               name: `EIteta${curr.id}`,
//               coefficient:
//                 currMember.endNode.support?.type === "fixed"
//                   ? 0
//                   : (4 / span) * (E * I),
//             },
//             {
//               name: `EIteta${currMember.startNode.id}`,
//               coefficient:
//                 currMember.startNode.support?.type === "fixed"
//                   ? 0
//                   : (2 / span) * (E * I),
//             },
//             {
//               name: "EIdeta",
//               coefficient: curr.support?.settlement
//                 ? (6 / span ** 2) *
//                   curr.support.settlement *
//                   (E * I) *
//                   signConvention
//                 : 0,
//             },
//           ];
//         }
//       }
//     }

//     return { clk, antiClk };
//   }

//   updatedGetEquations(node: Node) {
//     const { clk, antiClk } = this.updatedSupportEquation(node);
//     // console.log(clk, antiClk);

//     // combine right + left with stable summation

//     // const supportEqn = [... Object.values(antiClk), ... Object.values(clk)];
//     const terms: Term[] = [
//       ...Object.values(antiClk).flat(),
//       ...Object.values(clk).flat(),
//     ];

//     const res = this.collectLikeTerms(terms);
//     return res;
//   }
// }

function isTrmnlNode(node: Node, member: Beam | Column | InclinedMember) {
  if (member instanceof Beam) {
    return (
      node.connectedMembers.filter((member) => member.member instanceof Beam)
        .length <= 1
    );
  } else if (member instanceof Column) {
    return (
      node.connectedMembers.filter((member) => member.member instanceof Column)
        .length <= 1
    );
  }
}

function isFreeNode(node: Node, member: Beam | Column | InclinedMember) {
  return (
    isTrmnlNode(node, member) &&
    !node.support &&
    node.connectedMembers.length <= 1
  );
}

function momtAbtNode(member: Beam | Column, node: Node) {
  let result = 0;

  for (const load of member.getEquivalentPointLoads()) {
    if (member.startNode === node) {
      const distance = 0 - load.position;
      const moment = load.magnitude * distance;
      result += moment;
    } else if (member.endNode === node) {
      const distance = member.length - load.position;
      const moment = load.magnitude * distance;
      result += moment;
    } else
      throw new Error(
        "INVALID END NODE: the node passed in the parameter does not match any of the member end nodes"
      );
  }

  return result * -1;
}

export class SlopeDeflection {
  collectLikeTerms = (terms: Term[]) => {
    const result: { [key: string]: { sum: number; c: number } } = {};

    for (const term of terms) {
      if (term.coefficient === 0) continue;

      if (!(term.name in result)) {
        result[term.name] = { sum: term.coefficient, c: 0 };
      } else {
        // Kahan summation
        const y = term.coefficient - result[term.name].c;
        const t = result[term.name].sum + y;
        result[term.name].c = t - result[term.name].sum - y;
        result[term.name].sum = t;
      }
    }

    // Flatten the object to simple name -> number
    const flatResult: { [key: string]: number } = {};
    for (const key in result) {
      flatResult[key] = result[key].sum;
    }

    return flatResult;
  };

  kahanPush = (arr: Term[], term: Term, compMap: { [key: string]: number }) => {
    if (!term.coefficient || term.coefficient === 0) return;

    if (!(term.name in compMap)) {
      // first occurrence
      arr.push({ ...term });
      compMap[term.name] = 0; // initialize compensation
    } else {
      // Kahan summation
      const existing = arr.find((t) => t.name === term.name)!;
      const y = term.coefficient - compMap[term.name];
      const t = existing.coefficient + y;
      compMap[term.name] = t - existing.coefficient - y;
      existing.coefficient = t;
    }
  };

  updatedSupportEquation(node: Node) {
    const Emember: { [key: string]: number } = {};
    const Imember: { [key: string]: number } = {};

    // console.log("NODE: ", node.id);

    for (const member of node.connectedMembers) {
      Emember[
        `member${member.member.startNode.id}${member.member.endNode.id}`
      ] = member.member.Ecoef;

      Imember[
        `member${member.member.startNode.id}${member.member.endNode.id}`
      ] = member.member.Icoef;
    }

    const fem = new FixedEndMoments();
    const moment = new Moment();

    let clk: { [key: string]: Term[] } = {};
    let antiClk: { [key: string]: Term[] } = {};

    const curr = node;

    // for a beam

    for (const member of node.connectedMembers) {
      const currMember = member.member;

      // SETTLEMENT COMPARISON
      const startSettlement = currMember.startNode.support?.settlement;
      const endSettlement = currMember.endNode?.support?.settlement;

      const signConvention =
        startSettlement != null &&
        endSettlement != null &&
        startSettlement < endSettlement
          ? -1
          : 1;

      if (currMember.startNode === node) {
        const span = currMember.length;

        const FEMToEnd = fem.getFixedEndMoment(currMember, "start");
        // console.log(
        //   `FEM${currMember.startNode.id}${currMember.endNode.id}: `,
        //   FEMToEnd
        // );

        const E =
          Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
        const I =
          Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

        if (
          !isFreeNode(node, currMember) &&
          isFreeNode(currMember.endNode, currMember)
        ) {
          antiClk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] =
            [
              { name: "c", coefficient: momtAbtNode(currMember, node) },
              {
                name: `EIteta${curr.id}`,
                coefficient: 0,
              },
              {
                name: `EIteta${currMember.startNode.id}`,
                coefficient: 0,
              },
              {
                name: "EIdeta",
                coefficient: 0,
              },
            ];
        } else if (
          (isTrmnlNode(node, currMember) && node.support?.type == "pinned") ||
          (isFreeNode(node, currMember) &&
            !isFreeNode(currMember.endNode, currMember))
        ) {
          antiClk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] =
            [
              { name: "c", coefficient: 0 },
              {
                name: `EIteta${curr.id}`,
                coefficient: 0,
              },
              {
                name: `EIteta${currMember.startNode.id}`,
                coefficient: 0,
              },
              {
                name: "EIdeta",
                coefficient: 0,
              },
            ];
        } else if (
          currMember.endNode.support?.type === "pinned" &&
          isTrmnlNode(currMember.endNode, currMember)
        ) {
          const FEMToStart = fem.getFixedEndMoment(currMember, "end");

          antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
            [
              {
                name: "c",
                coefficient: (FEMToEnd ?? 0) - ((FEMToStart ?? 0) / 2), //prettier-ignore
              },
              {
                name: `EIteta${curr.id}`,
                coefficient: (3 / span) * (E * I),
              },
              {
                name: `EIteta${currMember.endNode.id}`,
                coefficient: 0,
              },
              {
                name: "EIdeta",
                coefficient: curr.support?.settlement
                  ? (3 / span) *
                    curr.support.settlement *
                    (E * I) *
                    signConvention
                  : 0,
              },
            ];
        } else {
          antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
            [
              {
                name: "c",
                coefficient: FEMToEnd || 0,
              },
              {
                name: `EIteta${curr.id}`,
                coefficient:
                  currMember.startNode.support?.type === "fixed"
                    ? 0
                    : (4 / span) * (E * I),
              },
              {
                name: `EIteta${currMember.endNode.id}`,
                coefficient:
                  currMember.endNode.support?.type === "fixed"
                    ? 0
                    : (2 / span) * (E * I),
              },
              {
                name: "EIdeta",
                coefficient: curr.support?.settlement
                  ? (6 / span ** 2) *
                    curr.support.settlement *
                    (E * I) *
                    signConvention
                  : 0,
              },
            ];
        }
      } else if (currMember.endNode === node) {
        const span = currMember.length;
        const FEMToStart = fem.getFixedEndMoment(currMember, "end");

        // console.log(
        //   `FEM${currMember.endNode.id}${currMember.startNode.id}: `,
        //   FEMToStart
        // );

        const E =
          Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
        const I =
          Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

        if (
          !isFreeNode(node, currMember) &&
          isFreeNode(currMember.startNode, currMember)
        ) {
          clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
            { name: "c", coefficient: momtAbtNode(currMember, node) },
            {
              name: `EIteta${curr.id}`,
              coefficient: 0,
            },
            {
              name: `EIteta${currMember.startNode.id}`,
              coefficient: 0,
            },
            {
              name: "EIdeta",
              coefficient: 0,
            },
          ];
        } else if (
          (isTrmnlNode(node, currMember) && node.support?.type == "pinned") ||
          (isFreeNode(node, currMember) &&
            !isFreeNode(currMember.startNode, currMember))
        ) {
          clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
            { name: "c", coefficient: 0 },
            {
              name: `EIteta${curr.id}`,
              coefficient: 0,
            },
            {
              name: `EIteta${currMember.startNode.id}`,
              coefficient: 0,
            },
            {
              name: "EIdeta",
              coefficient: 0,
            },
          ];
        } else if (
          isTrmnlNode(currMember.startNode, currMember) &&
          currMember.startNode.support?.type === "pinned"
        ) {
          const FEMToEnd = fem.getFixedEndMoment(
            currMember,

            "start"
          );

          clk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] = [
            {
              name: "c",
              coefficient: (FEMToStart ?? 0) - ((FEMToEnd ?? 0) / 2), //prettier-ignore
            },
            {
              name: `EIteta${curr.id}`,
              coefficient: (3 / span) * (E * I),
            },
            {
              name: `EIteta${currMember.startNode.id}`,
              coefficient: 0,
            },
            {
              name: "EIdeta",
              coefficient: curr.support?.settlement
                ? (3 / span) *
                  curr.support.settlement *
                  (E * I) *
                  signConvention
                : 0,
            },
          ];
        } else {
          clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
            { name: "c", coefficient: FEMToStart || 0 },
            {
              name: `EIteta${curr.id}`,
              coefficient:
                node.support?.type === "fixed" ? 0 : (4 / span) * (E * I),
            },
            {
              name: `EIteta${currMember.startNode.id}`,
              coefficient:
                currMember.startNode.support?.type === "fixed"
                  ? 0
                  : (2 / span) * (E * I),
            },
            {
              name: "EIdeta",
              coefficient: curr.support?.settlement
                ? (6 / span ** 2) *
                  curr.support.settlement *
                  (E * I) *
                  signConvention
                : 0,
            },
          ];
        }
      }
    }

    return { clk, antiClk };
  }

  updatedGetEquations(node: Node) {
    const { clk, antiClk } = this.updatedSupportEquation(node);
    // console.log(clk, antiClk);

    // combine right + left with stable summation

    // const supportEqn = [... Object.values(antiClk), ... Object.values(clk)];
    const terms: Term[] = [
      ...Object.values(antiClk).flat(),
      ...Object.values(clk).flat(),
    ];

    const res = this.collectLikeTerms(terms);
    return res;
  }
}

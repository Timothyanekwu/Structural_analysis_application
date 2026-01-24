import {
  FixedSupport,
  PinnedSupport,
  RollerSupport,
} from "../elements/support";
import { FixedEndMoments } from "../logic/FEMs";
import { Moment } from "../logic/moment";
import { Node } from "../elements/node";
import { Beam } from "../elements/member";

type Term = { name: string; coefficient: number };

function isTrmnlNode(node: Node) {
  return (
    node.connectedMembers.filter((member) => member.member instanceof Beam)
      .length <= 1
  );
}

function isFreeNode(node: Node) {
  return isTrmnlNode(node) && !node.support;
}

function momtAbtNode(member: Beam, node: Node) {
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
        "INVALID END NODE: the node passed in the parameter does not match any of the member end nodes",
      );
  }

  return result * -1;
}

export class SlopeDeflection {
  collectLikeTerms = (terms: Term[]) => {
    const result: { [key: string]: { sum: number; c: number } } = {};

    for (const term of terms) {
      if (term.coefficient === 0) continue;

      // Treat EIdeta as a constant (c) as requested
      const variableName = term.name === "EIdeta" ? "c" : term.name;

      if (!(variableName in result)) {
        result[variableName] = { sum: term.coefficient, c: 0 };
      } else {
        // Kahan summation
        const y = term.coefficient - result[variableName].c;
        const t = result[variableName].sum + y;
        result[variableName].c = t - result[variableName].sum - y;
        result[variableName].sum = t;
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

    // let clk: Term[] = [];
    // let antiClk: Term[] = [];

    let clk: { [key: string]: Term[] } = {};
    let antiClk: { [key: string]: Term[] } = {};

    const curr = node;

    for (const member of node.connectedMembers) {
      const currMember = member.member;

      // SETTLEMENT COMPARISON
      const startSettlement = currMember.startNode.support?.settlement;
      const endSettlement = currMember.endNode?.support?.settlement;

      const settlement = (endSettlement ?? 0) - (startSettlement ?? 0);

      // const signConvention =
      //   startSettlement != null &&
      //   endSettlement != null &&
      //   startSettlement < endSettlement
      //     ? -1
      //     : 1;

      if (currMember.startNode === node) {
        // console.log("TRUE", currMember.startNode.id, node.id);

        const span = currMember.length;
        // console.log("SPAN: ", span);

        const FEMToEnd = fem.getFixedEndMoment(currMember, "start");
        // console.log(
        //   `FEM${currMember.startNode.id}${currMember.endNode.id}: `,
        //   FEMToEnd
        // );

        const E =
          Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
        const I =
          Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

        if (!isFreeNode(node) && isFreeNode(currMember.endNode)) {
          antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
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
          // if start node is terminal, the support is pinned or roller OR
          (isTrmnlNode(node) &&
            (node.support?.type == "pinned" ||
              node.support?.type == "roller")) ||
          (isFreeNode(node) && !isFreeNode(currMember.endNode))
        ) {
          antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
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
          (currMember.endNode.support?.type == "pinned" ||
            currMember.endNode.support?.type == "roller") &&
          isTrmnlNode(currMember.endNode)
        ) {
          const FEMToStart = fem.getFixedEndMoment(
            currMember,

            "end",
          );

          antiClk[`MOMENT${currMember.startNode.id}${currMember.endNode.id}`] =
            [
              {
                name: "c",
                coefficient: ((FEMToEnd ?? 0) - ((FEMToStart ?? 0) / 2)) * -1, //prettier-ignore
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
                coefficient: (3 / (span * span)) * settlement * (E * I),
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
                coefficient: (6 / (span * span)) * settlement * (E * I),
              },
            ];
        }
      } else if (currMember.endNode === node) {
        const span = currMember.length;
        const FEMToStart = fem.getFixedEndMoment(currMember, "end");

        const E =
          Emember[`member${currMember.startNode.id}${currMember.endNode.id}`];
        const I =
          Imember[`member${currMember.startNode.id}${currMember.endNode.id}`];

        if (!isFreeNode(node) && isFreeNode(currMember.startNode)) {
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
          (isTrmnlNode(node) &&
            (node.support?.type == "pinned" ||
              node.support?.type == "roller")) ||
          (isFreeNode(node) && !isFreeNode(currMember.startNode))
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
          isTrmnlNode(currMember.startNode) &&
          (currMember.startNode.support?.type == "pinned" ||
            currMember.startNode.support?.type == "roller")
        ) {
          const FEMToEnd = fem.getFixedEndMoment(
            currMember,

            "start",
          );

          clk[`MOMENT${currMember.endNode.id}${currMember.startNode.id}`] = [
            {
              name: "c",
              coefficient: ((FEMToStart ?? 0) - ((FEMToEnd ?? 0) / 2)) * -1, //prettier-ignore
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
              coefficient: (3 / (span * span)) * settlement * (E * I),
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
              coefficient: (6 / (span * span)) * settlement * (E * I),
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

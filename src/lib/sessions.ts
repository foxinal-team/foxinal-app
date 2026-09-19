import type { HostItem } from "@/inventory/types";
import { hostSummary } from "@/inventory/types";

export type TerminalSession =
  | { kind: "local" }
  | { kind: "ssh"; host: HostItem };

export type SplitDirection = "vertical" | "horizontal";

export type TerminalPaneLeaf = {
  type: "leaf";
  id: string;
  session: TerminalSession;
  title: string;
  subtitle: string;
};

export type TerminalSplitNode = {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number; // percentage for first child (e.g. 50)
  children: [TerminalLayoutNode, TerminalLayoutNode];
};

export type TerminalLayoutNode = TerminalPaneLeaf | TerminalSplitNode;

// Legacy alias
export type TerminalPane = TerminalPaneLeaf;
export type SplitLayout = "single" | "vertical" | "horizontal";

export type SessionTab = {
  id: string;
  /** Primary session */
  session: TerminalSession;
  title: string;
  subtitle: string;
  /** Binary split tree root layout */
  layout: TerminalLayoutNode;
  /** Currently focused pane id */
  activePaneId: string;
};

export function createLeaf(session: TerminalSession): TerminalPaneLeaf {
  return {
    type: "leaf",
    id: crypto.randomUUID(),
    session,
    title:
      session.kind === "local"
        ? "Local"
        : session.host.name || hostSummary(session.host),
    subtitle:
      session.kind === "local"
        ? "Your OS shell"
        : hostSummary(session.host),
  };
}

export const createPane = createLeaf;

export function collectLeaves(node: TerminalLayoutNode): TerminalPaneLeaf[] {
  if (node.type === "leaf") {
    return [node];
  }
  return [
    ...collectLeaves(node.children[0]),
    ...collectLeaves(node.children[1]),
  ];
}

export function splitLeafInTree(
  root: TerminalLayoutNode,
  targetLeafId: string,
  direction: SplitDirection,
  newSession: TerminalSession,
): { root: TerminalLayoutNode; newLeafId: string } {
  if (root.type === "leaf") {
    if (root.id === targetLeafId) {
      const newLeaf = createLeaf(newSession);
      const splitNode: TerminalSplitNode = {
        type: "split",
        id: crypto.randomUUID(),
        direction,
        ratio: 50,
        children: [root, newLeaf],
      };
      return { root: splitNode, newLeafId: newLeaf.id };
    }
    return { root, newLeafId: "" };
  }

  // Split node
  const leftRes = splitLeafInTree(
    root.children[0],
    targetLeafId,
    direction,
    newSession,
  );
  if (leftRes.newLeafId) {
    return {
      root: {
        ...root,
        children: [leftRes.root, root.children[1]],
      },
      newLeafId: leftRes.newLeafId,
    };
  }

  const rightRes = splitLeafInTree(
    root.children[1],
    targetLeafId,
    direction,
    newSession,
  );
  if (rightRes.newLeafId) {
    return {
      root: {
        ...root,
        children: [root.children[0], rightRes.root],
      },
      newLeafId: rightRes.newLeafId,
    };
  }

  return { root, newLeafId: "" };
}

export function removeLeafFromTree(
  root: TerminalLayoutNode,
  targetLeafId: string,
): TerminalLayoutNode | null {
  if (root.type === "leaf") {
    return root.id === targetLeafId ? null : root;
  }

  // If one of the direct children is the leaf to remove, return the sibling
  if (root.children[0].type === "leaf" && root.children[0].id === targetLeafId) {
    return root.children[1];
  }
  if (root.children[1].type === "leaf" && root.children[1].id === targetLeafId) {
    return root.children[0];
  }

  // Recurse into both branches
  const newChild0 = removeLeafFromTree(root.children[0], targetLeafId);
  const newChild1 = removeLeafFromTree(root.children[1], targetLeafId);

  if (!newChild0) return newChild1;
  if (!newChild1) return newChild0;

  return {
    ...root,
    children: [newChild0, newChild1],
  };
}

export function updateSplitNodeRatio(
  root: TerminalLayoutNode,
  splitNodeId: string,
  newRatio: number,
): TerminalLayoutNode {
  if (root.type === "leaf") return root;

  if (root.id === splitNodeId) {
    return {
      ...root,
      ratio: newRatio,
    };
  }

  return {
    ...root,
    children: [
      updateSplitNodeRatio(root.children[0], splitNodeId, newRatio),
      updateSplitNodeRatio(root.children[1], splitNodeId, newRatio),
    ],
  };
}

export function createLocalTab(): SessionTab {
  const leaf = createLeaf({ kind: "local" });
  return {
    id: crypto.randomUUID(),
    session: leaf.session,
    title: leaf.title,
    subtitle: leaf.subtitle,
    layout: leaf,
    activePaneId: leaf.id,
  };
}

export function createHostTab(host: HostItem): SessionTab {
  const leaf = createLeaf({ kind: "ssh", host });
  return {
    id: crypto.randomUUID(),
    session: leaf.session,
    title: leaf.title,
    subtitle: leaf.subtitle,
    layout: leaf,
    activePaneId: leaf.id,
  };
}

import { describe, expect, it } from "vitest";
import type { HostItem } from "@/inventory/types";
import {
  collectLeaves,
  createHostTab,
  createLeaf,
  createLocalTab,
  removeLeafFromTree,
  splitLeafInTree,
  updateSplitNodeRatio,
  type TerminalLayoutNode,
} from "./sessions";

const mockHost: HostItem = {
  id: "host-1",
  kind: "host",
  name: "Prod Server",
  address: "10.0.0.1",
  port: 22,
  username: "ubuntu",
  authMethod: "password",
  password: "",
  privateKey: "",
  parentId: null,
  createdAt: 1000,
};

describe("sessions module (Terminal Layout & Split Panes)", () => {
  describe("createLeaf", () => {
    it("creates a leaf for local session with standard metadata", () => {
      const leaf = createLeaf({ kind: "local" });
      expect(leaf.type).toBe("leaf");
      expect(typeof leaf.id).toBe("string");
      expect(leaf.title).toBe("Local");
      expect(leaf.subtitle).toBe("Your OS shell");
      expect(leaf.session.kind).toBe("local");
    });

    it("creates a leaf for ssh host session with host title and address", () => {
      const leaf = createLeaf({ kind: "ssh", host: mockHost });
      expect(leaf.type).toBe("leaf");
      expect(typeof leaf.id).toBe("string");
      expect(leaf.title).toBe("Prod Server");
      expect(leaf.subtitle).toBe("ubuntu@10.0.0.1");
      expect(leaf.session.kind).toBe("ssh");
    });
  });

  describe("collectLeaves", () => {
    it("collects single leaf", () => {
      const leaf = createLeaf({ kind: "local" });
      expect(collectLeaves(leaf)).toEqual([leaf]);
    });

    it("collects all nested leaves in exact depth-first left-to-right order", () => {
      const l1 = createLeaf({ kind: "local" });
      const l2 = createLeaf({ kind: "local" });
      const l3 = createLeaf({ kind: "local" });

      const tree: TerminalLayoutNode = {
        type: "split",
        id: "split-1",
        direction: "horizontal",
        ratio: 50,
        children: [
          l1,
          {
            type: "split",
            id: "split-2",
            direction: "vertical",
            ratio: 60,
            children: [l2, l3],
          },
        ],
      };

      const leaves = collectLeaves(tree);
      expect(leaves).toHaveLength(3);
      expect(leaves.map((l) => l.id)).toEqual([l1.id, l2.id, l3.id]);
    });
  });

  describe("splitLeafInTree (Hardened Invariants)", () => {
    it("splits a single leaf root horizontally and sets default 50% ratio", () => {
      const initial = createLeaf({ kind: "local" });
      const { root, newLeafId } = splitLeafInTree(
        initial,
        initial.id,
        "horizontal",
        { kind: "local" },
      );

      expect(newLeafId).toBeTruthy();
      expect(root.type).toBe("split");
      if (root.type !== "split") throw new Error("Expected root to be a split node");

      expect(root.direction).toBe("horizontal");
      expect(root.ratio).toBe(50);
      expect(root.children[0].id).toBe(initial.id);
      expect(root.children[1].id).toBe(newLeafId);
      expect(root.children[1].type).toBe("leaf");
    });

    it("splits a leaf inside a nested branch vertically and updates branch accurately", () => {
      const l1 = createLeaf({ kind: "local" });
      const l2 = createLeaf({ kind: "local" });
      const tree: TerminalLayoutNode = {
        type: "split",
        id: "split-1",
        direction: "horizontal",
        ratio: 50,
        children: [l1, l2],
      };

      const { root, newLeafId } = splitLeafInTree(
        tree,
        l2.id,
        "vertical",
        { kind: "ssh", host: mockHost },
      );

      expect(newLeafId).toBeTruthy();
      expect(root.type).toBe("split");
      if (root.type !== "split") throw new Error("Expected root to be split");

      // Left child remains untouched
      expect(root.children[0].id).toBe(l1.id);

      // Right child is replaced by a new vertical split node
      const rightChild = root.children[1];
      expect(rightChild.type).toBe("split");
      if (rightChild.type !== "split") throw new Error("Expected right child to be split");

      expect(rightChild.direction).toBe("vertical");
      expect(rightChild.children[0].id).toBe(l2.id);
      expect(rightChild.children[1].id).toBe(newLeafId);
      expect(rightChild.children[1].type).toBe("leaf");
    });

    it("returns unchanged root and empty newLeafId when targetLeafId does not exist", () => {
      const l1 = createLeaf({ kind: "local" });
      const { root, newLeafId } = splitLeafInTree(
        l1,
        "non-existent-id",
        "vertical",
        { kind: "local" },
      );
      expect(newLeafId).toBe("");
      expect(root).toBe(l1);
    });
  });

  describe("removeLeafFromTree (Tree Collapse & Cleanup)", () => {
    it("returns null if removing the only remaining leaf", () => {
      const leaf = createLeaf({ kind: "local" });
      expect(removeLeafFromTree(leaf, leaf.id)).toBeNull();
    });

    it("returns unchanged if leaf id does not match single leaf", () => {
      const leaf = createLeaf({ kind: "local" });
      expect(removeLeafFromTree(leaf, "other-id")).toBe(leaf);
    });

    it("collapses split node into sibling when one child leaf is removed", () => {
      const l1 = createLeaf({ kind: "local" });
      const l2 = createLeaf({ kind: "local" });
      const tree: TerminalLayoutNode = {
        type: "split",
        id: "split-1",
        direction: "horizontal",
        ratio: 50,
        children: [l1, l2],
      };

      // Removing l1 collapses the split to l2 directly
      const result = removeLeafFromTree(tree, l1.id);
      expect(result).toBe(l2);

      // Removing l2 collapses the split to l1 directly
      const result2 = removeLeafFromTree(tree, l2.id);
      expect(result2).toBe(l1);
    });

    it("handles removing leaf deeply nested in tree and preserves remaining hierarchy", () => {
      const l1 = createLeaf({ kind: "local" });
      const l2 = createLeaf({ kind: "local" });
      const l3 = createLeaf({ kind: "local" });

      const tree: TerminalLayoutNode = {
        type: "split",
        id: "split-1",
        direction: "horizontal",
        ratio: 50,
        children: [
          l1,
          {
            type: "split",
            id: "split-2",
            direction: "vertical",
            ratio: 50,
            children: [l2, l3],
          },
        ],
      };

      // Removing l3 should collapse split-2 into just l2, leaving split-1 with [l1, l2]
      const updated = removeLeafFromTree(tree, l3.id);
      expect(updated).not.toBeNull();
      if (!updated || updated.type !== "split") throw new Error("Expected split node");

      expect(updated.children[0]).toBe(l1);
      expect(updated.children[1]).toBe(l2);
    });
  });

  describe("updateSplitNodeRatio", () => {
    it("updates ratio of target split node without mutating other nodes", () => {
      const l1 = createLeaf({ kind: "local" });
      const l2 = createLeaf({ kind: "local" });
      const tree: TerminalLayoutNode = {
        type: "split",
        id: "split-1",
        direction: "horizontal",
        ratio: 50,
        children: [l1, l2],
      };

      const updated = updateSplitNodeRatio(tree, "split-1", 75);
      expect(updated.type).toBe("split");
      if (updated.type !== "split") throw new Error("Expected split node");
      expect(updated.ratio).toBe(75);
    });

    it("leaves tree intact if split id not found", () => {
      const l1 = createLeaf({ kind: "local" });
      const updated = updateSplitNodeRatio(l1, "split-unknown", 75);
      expect(updated).toBe(l1);
    });
  });

  describe("createLocalTab & createHostTab", () => {
    it("creates a complete SessionTab for local shell with activePaneId synced to layout id", () => {
      const tab = createLocalTab();
      expect(tab.id).toBeDefined();
      expect(tab.session.kind).toBe("local");
      expect(tab.title).toBe("Local");
      expect(tab.activePaneId).toBe(tab.layout.id);
      expect(tab.layout.type).toBe("leaf");
    });

    it("creates a complete SessionTab for SSH host with activePaneId synced to layout id", () => {
      const tab = createHostTab(mockHost);
      expect(tab.id).toBeDefined();
      expect(tab.session.kind).toBe("ssh");
      expect(tab.title).toBe("Prod Server");
      expect(tab.activePaneId).toBe(tab.layout.id);
      expect(tab.layout.type).toBe("leaf");
    });
  });
});

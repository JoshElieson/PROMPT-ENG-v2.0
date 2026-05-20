import type { CenterWorkspaceRoot } from "@/types/workspace-pane";

export type ArrowNavigationKey =
  | "ArrowUp"
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight";

/** Neighbour leaf id in on-screen direction, or null if none. */
export function adjacentLeafByArrow(
  root: CenterWorkspaceRoot,
  fromLeafId: string,
  key: ArrowNavigationKey,
): string | null {
  switch (root.kind) {
    case "single":
      return null;

    case "double": {
      const { direction, first, second } = root;
      if (direction === "horizontal") {
        if (fromLeafId === first.id) {
          if (key === "ArrowRight") return second.id;
          return null;
        }
        if (fromLeafId === second.id) {
          if (key === "ArrowLeft") return first.id;
          return null;
        }
        return null;
      }
      if (fromLeafId === first.id) {
        if (key === "ArrowDown") return second.id;
        return null;
      }
      if (fromLeafId === second.id) {
        if (key === "ArrowUp") return first.id;
        return null;
      }
      return null;
    }

    case "triple": {
      const { topLeft, topRight, bottom } = root;
      if (fromLeafId === topLeft.id) {
        if (key === "ArrowRight") return topRight.id;
        if (key === "ArrowDown") return bottom.id;
        return null;
      }
      if (fromLeafId === topRight.id) {
        if (key === "ArrowLeft") return topLeft.id;
        if (key === "ArrowDown") return bottom.id;
        return null;
      }
      if (fromLeafId === bottom.id) {
        if (key === "ArrowUp") return topLeft.id;
        if (key === "ArrowLeft") return topLeft.id;
        if (key === "ArrowRight") return topRight.id;
        return null;
      }
      return null;
    }

    case "quad": {
      const { topLeft, topRight, bottomLeft, bottomRight } = root;
      if (fromLeafId === topLeft.id) {
        if (key === "ArrowRight") return topRight.id;
        if (key === "ArrowDown") return bottomLeft.id;
        return null;
      }
      if (fromLeafId === topRight.id) {
        if (key === "ArrowLeft") return topLeft.id;
        if (key === "ArrowDown") return bottomRight.id;
        return null;
      }
      if (fromLeafId === bottomLeft.id) {
        if (key === "ArrowRight") return bottomRight.id;
        if (key === "ArrowUp") return topLeft.id;
        return null;
      }
      if (fromLeafId === bottomRight.id) {
        if (key === "ArrowLeft") return bottomLeft.id;
        if (key === "ArrowUp") return topRight.id;
        return null;
      }
      return null;
    }

    default:
      return null;
  }
}

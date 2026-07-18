import {
  computeBoardSummary,
  type BoardItem,
  type BoardSummary,
} from "./board-composer";

export type BoardAnnexResolutionState =
  | "complete"
  | "empty"
  | "partial"
  | "unresolvable";

interface BoardAnnexBoardBase {
  boardName: string;
  linkedItemCount: number;
  resolvedItemCount: number;
  unresolvedItemCount: number;
}

export interface ResolvedBoardAnnexBoard extends BoardAnnexBoardBase {
  state: "complete" | "partial";
  summary: BoardSummary;
}

export interface UnresolvedBoardAnnexBoard extends BoardAnnexBoardBase {
  state: "empty" | "unresolvable";
  summary?: never;
}

export type BoardAnnexBoard =
  | ResolvedBoardAnnexBoard
  | UnresolvedBoardAnnexBoard;

export type BoardAnnexData =
  | { state: "no_boards"; boards: [] }
  | {
      state: "available";
      boards: [BoardAnnexBoard, ...BoardAnnexBoard[]];
    };

export interface BoardAnnexBoardInput {
  boardName: string;
  linkedItemCount: number;
  resolvedItems: readonly BoardItem[];
}

function assertValidCounts(input: BoardAnnexBoardInput): void {
  if (!Number.isSafeInteger(input.linkedItemCount) || input.linkedItemCount < 0) {
    throw new RangeError("linkedItemCount must be a non-negative safe integer");
  }
  if (input.resolvedItems.length > input.linkedItemCount) {
    throw new RangeError("resolved item count cannot exceed linked item count");
  }
}

function buildBoard(input: BoardAnnexBoardInput): BoardAnnexBoard {
  assertValidCounts(input);

  const resolvedItemCount = input.resolvedItems.length;
  const unresolvedItemCount = input.linkedItemCount - resolvedItemCount;
  const counts = {
    boardName: input.boardName,
    linkedItemCount: input.linkedItemCount,
    resolvedItemCount,
    unresolvedItemCount,
  };

  if (input.linkedItemCount === 0) {
    return { ...counts, state: "empty" };
  }

  if (resolvedItemCount === 0) {
    return { ...counts, state: "unresolvable" };
  }

  return {
    ...counts,
    state: unresolvedItemCount === 0 ? "complete" : "partial",
    summary: computeBoardSummary([...input.resolvedItems]),
  };
}

/**
 * Converts an already authorized board/material snapshot into the truthful
 * issued-report contract. Database errors must be handled before calling this
 * function; an empty input means the scoped read succeeded and found no boards.
 */
export function buildBoardAnnexData(
  inputs: readonly BoardAnnexBoardInput[]
): BoardAnnexData {
  if (inputs.length === 0) {
    return { state: "no_boards", boards: [] };
  }

  const boards = inputs.map(buildBoard);
  return {
    state: "available",
    boards: boards as [BoardAnnexBoard, ...BoardAnnexBoard[]],
  };
}

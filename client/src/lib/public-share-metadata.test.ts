import { describe, expect, it, vi } from "vitest";

import {
  installPublicShareRobotsMeta,
  PUBLIC_SHARE_ROBOTS_DIRECTIVE,
} from "./public-share-metadata";

function fakeDocument(existing: HTMLMetaElement | null) {
  const created = {
    name: "",
    content: "",
    remove: vi.fn(),
  } as unknown as HTMLMetaElement;
  const appendChild = vi.fn();
  return {
    created,
    appendChild,
    document: {
      querySelector: vi.fn(() => existing),
      createElement: vi.fn(() => created),
      head: { appendChild },
    } as unknown as Document,
  };
}

describe("public-share robots metadata", () => {
  it("installs noindex metadata and removes an owned element on cleanup", () => {
    const target = fakeDocument(null);
    const restore = installPublicShareRobotsMeta(target.document);

    expect(target.created.name).toBe("robots");
    expect(target.created.content).toBe(PUBLIC_SHARE_ROBOTS_DIRECTIVE);
    expect(target.appendChild).toHaveBeenCalledWith(target.created);

    restore();
    expect(target.created.remove).toHaveBeenCalledOnce();
  });

  it("restores a pre-existing robots directive instead of removing it", () => {
    const existing = {
      name: "robots",
      content: "index, follow",
      remove: vi.fn(),
    } as unknown as HTMLMetaElement;
    const target = fakeDocument(existing);
    const restore = installPublicShareRobotsMeta(target.document);

    expect(existing.content).toBe(PUBLIC_SHARE_ROBOTS_DIRECTIVE);
    expect(target.appendChild).not.toHaveBeenCalled();

    restore();
    expect(existing.content).toBe("index, follow");
    expect(existing.remove).not.toHaveBeenCalled();
  });
});

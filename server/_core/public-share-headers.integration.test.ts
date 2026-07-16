import { createServer, type Server } from "node:http";
import { TRPCError } from "@trpc/server";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { PUBLIC_SHARE_HEADERS } from "./public-share-headers";
import { createNodeApplication } from "./index";
import { createServerlessApplication } from "../serverless";

const testRouter = router({
  design: router({
    resolveShareLink: publicProcedure
      .input(z.object({ token: z.string().min(8) }))
      .query(({ input }) => {
        if (input.token === "expired-token") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share unavailable" });
        }
        return { token: input.token };
      }),
    listAssets: publicProcedure.query(() => []),
  }),
});

const servers: Server[] = [];

async function startApplication(kind: "node" | "serverless") {
  const options = {
    trpcRouter: testRouter,
    contextFactory: () => ({ user: null, req: {} as any, res: {} as any }),
  };
  const created = kind === "node"
    ? createNodeApplication(options)
    : { app: createServerlessApplication(options), server: undefined };
  const server = created.server ?? createServer(created.app);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test address");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server =>
    new Promise<void>(resolve => server.close(() => resolve()))
  ));
});

function expectPrivacyHeaders(response: Response) {
  for (const [name, value] of Object.entries(PUBLIC_SHARE_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

describe.each(["node", "serverless"] as const)("%s Express public-share responses", kind => {
  it.each([
    [
      "successful",
      "/api/trpc/design.resolveShareLink?input=%7B%22json%22%3A%7B%22token%22%3A%22active-token%22%7D%7D",
    ],
    [
      "expired",
      "/api/trpc/design.resolveShareLink?input=%7B%22json%22%3A%7B%22token%22%3A%22expired-token%22%7D%7D",
    ],
    ["malformed", "/api/trpc/design.resolveShareLink?input=not-json"],
    [
      "comma-batched",
      "/api/trpc/design.listAssets,design.resolveShareLink?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%2C%221%22%3A%7B%22json%22%3A%7B%22token%22%3A%22active-token%22%7D%7D%7D",
    ],
    [
      "encoded-comma-batched",
      "/api/trpc/design.listAssets%2Cdesign.resolveShareLink?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%2C%221%22%3A%7B%22json%22%3A%7B%22token%22%3A%22active-token%22%7D%7D%7D",
    ],
  ])("sets privacy controls on %s responses", async (_label, path) => {
    const baseUrl = await startApplication(kind);
    const response = await fetch(`${baseUrl}${path}`);
    expectPrivacyHeaders(response);
  });

  it("does not apply share controls to unrelated tRPC responses", async () => {
    const baseUrl = await startApplication(kind);
    const response = await fetch(`${baseUrl}/api/trpc/design.listAssets`);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });
});

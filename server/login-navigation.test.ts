import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MutationOptions = { onSuccess: () => void };

const mutationOptions = vi.hoisted(() => ({
  login: undefined as MutationOptions | undefined,
  register: undefined as MutationOptions | undefined,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      login: {
        useMutation: (options: MutationOptions) => {
          mutationOptions.login = options;
          return { isPending: false };
        },
      },
      register: {
        useMutation: (options: MutationOptions) => {
          mutationOptions.register = options;
          return { isPending: false };
        },
      },
    },
  },
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/input", () => ({ Input: () => null }));
vi.mock("@/components/ui/label", () => ({ Label: () => null }));
vi.mock("@/components/ui/card", () => {
  const Passthrough = ({ children }: { children?: unknown }) => children ?? null;
  return {
    Card: Passthrough,
    CardContent: Passthrough,
    CardDescription: Passthrough,
    CardFooter: Passthrough,
    CardHeader: Passthrough,
    CardTitle: Passthrough,
  };
});
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("lucide-react", () => ({ Loader2: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Login from "../client/src/pages/Login";

describe("Login navigation", () => {
  const replace = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    mutationOptions.login = undefined;
    mutationOptions.register = undefined;
    vi.stubGlobal("React", { createElement });
    vi.stubGlobal("window", { location: { replace } });
    renderToStaticMarkup(createElement(Login));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("enters the dashboard after successful sign in", () => {
    mutationOptions.login?.onSuccess();

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("enters the dashboard after successful registration", () => {
    mutationOptions.register?.onSuccess();

    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});

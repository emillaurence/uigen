import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor, cleanup } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import {
  getAnonWorkData,
  clearAnonWork,
} from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { useRouter } from "next/navigation";

describe("useAuth", () => {
  const push = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue({ push });
  });

  afterEach(() => {
    cleanup();
  });

  describe("initial state", () => {
    test("returns signIn, signUp, and isLoading=false", () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.signIn).toBe("function");
      expect(typeof result.current.signUp).toBe("function");
    });
  });

  describe("signIn - happy paths", () => {
    test("calls signInAction with email and password", async () => {
      (signInAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(signInAction).toHaveBeenCalledWith(
        "user@example.com",
        "password123"
      );
    });

    test("returns the action result on success", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn(
          "user@example.com",
          "password123"
        );
      });

      expect(returned).toEqual({ success: true });
    });

    test("returns the action result on failure without running post-sign-in", async () => {
      (signInAction as any).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returned).toEqual({
        success: false,
        error: "Invalid credentials",
      });
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(getProjects).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    test("sets isLoading true during the call and false after success", async () => {
      let resolveSignIn: (value: any) => void;
      (signInAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignIn = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signInPromise: Promise<any>;
      act(() => {
        signInPromise = result.current.signIn(
          "user@example.com",
          "password123"
        );
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignIn!({ success: false });
        await signInPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("signUp - happy paths", () => {
    test("calls signUpAction with email and password", async () => {
      (signUpAction as any).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(signUpAction).toHaveBeenCalledWith(
        "new@example.com",
        "password123"
      );
    });

    test("returns the action result on success", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "p1" }]);

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp(
          "new@example.com",
          "password123"
        );
      });

      expect(returned).toEqual({ success: true });
    });

    test("returns the action result on failure without running post-sign-in", async () => {
      (signUpAction as any).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });

      const { result } = renderHook(() => useAuth());

      let returned: any;
      await act(async () => {
        returned = await result.current.signUp(
          "taken@example.com",
          "password123"
        );
      });

      expect(returned).toEqual({
        success: false,
        error: "Email already registered",
      });
      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(createProject).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    test("sets isLoading true during the call and false after success", async () => {
      let resolveSignUp: (value: any) => void;
      (signUpAction as any).mockReturnValue(
        new Promise((resolve) => {
          resolveSignUp = resolve;
        })
      );

      const { result } = renderHook(() => useAuth());

      let signUpPromise: Promise<any>;
      act(() => {
        signUpPromise = result.current.signUp(
          "new@example.com",
          "password123"
        );
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        resolveSignUp!({ success: false });
        await signUpPromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("handlePostSignIn - anonymous work claim", () => {
    test("creates project from anon work, clears anon storage, and redirects to it", async () => {
      const anonMessages = [
        { id: "m1", role: "user", content: "Hello" },
      ];
      const anonFs = { "/App.jsx": { type: "file", content: "x" } };

      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: anonMessages,
        fileSystemData: anonFs,
      });
      (createProject as any).mockResolvedValue({ id: "claimed-project" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^Design from /),
        messages: anonMessages,
        data: anonFs,
      });
      expect(clearAnonWork).toHaveBeenCalledTimes(1);
      expect(push).toHaveBeenCalledWith("/claimed-project");
      expect(getProjects).not.toHaveBeenCalled();
    });

    test("ignores anon work when messages array is empty and falls through to existing projects", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: [],
        fileSystemData: {},
      });
      (getProjects as any).mockResolvedValue([
        { id: "recent" },
        { id: "older" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/recent");
    });

    test("ignores null anon work and falls through", async () => {
      (signUpAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([{ id: "only" }]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password123");
      });

      expect(createProject).not.toHaveBeenCalled();
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(push).toHaveBeenCalledWith("/only");
    });
  });

  describe("handlePostSignIn - existing projects", () => {
    test("redirects to the first project when projects exist", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([
        { id: "first" },
        { id: "second" },
      ]);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(push).toHaveBeenCalledWith("/first");
      expect(createProject).not.toHaveBeenCalled();
    });
  });

  describe("handlePostSignIn - no existing projects", () => {
    test("creates a fresh project and redirects when user has none", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "brand-new" });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith({
        name: expect.stringMatching(/^New Design #\d+$/),
        messages: [],
        data: {},
      });
      expect(push).toHaveBeenCalledWith("/brand-new");
    });

    test("generated project name uses a random integer between 0 and 99999", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockResolvedValue([]);
      (createProject as any).mockResolvedValue({ id: "x" });

      const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.42);

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password123");
      });

      expect(createProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `New Design #${~~(0.42 * 100000)}`,
        })
      );

      randomSpy.mockRestore();
    });
  });

  describe("error states", () => {
    test("propagates errors from signInAction and resets isLoading", async () => {
      (signInAction as any).mockRejectedValue(new Error("network down"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "password123");
        })
      ).rejects.toThrow("network down");

      expect(result.current.isLoading).toBe(false);
      expect(push).not.toHaveBeenCalled();
    });

    test("propagates errors from signUpAction and resets isLoading", async () => {
      (signUpAction as any).mockRejectedValue(new Error("boom"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signUp("new@example.com", "password123");
        })
      ).rejects.toThrow("boom");

      expect(result.current.isLoading).toBe(false);
      expect(push).not.toHaveBeenCalled();
    });

    test("propagates errors from createProject when claiming anon work and resets isLoading", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue({
        messages: [{ id: "m1", role: "user", content: "Hi" }],
        fileSystemData: {},
      });
      (createProject as any).mockRejectedValue(new Error("db error"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "password123");
        })
      ).rejects.toThrow("db error");

      expect(result.current.isLoading).toBe(false);
      expect(clearAnonWork).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });

    test("propagates errors from getProjects and resets isLoading", async () => {
      (signInAction as any).mockResolvedValue({ success: true });
      (getAnonWorkData as any).mockReturnValue(null);
      (getProjects as any).mockRejectedValue(new Error("query failed"));

      const { result } = renderHook(() => useAuth());

      await expect(
        act(async () => {
          await result.current.signIn("user@example.com", "password123");
        })
      ).rejects.toThrow("query failed");

      expect(result.current.isLoading).toBe(false);
      expect(push).not.toHaveBeenCalled();
    });
  });
});

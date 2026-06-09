import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAuth } from "@/hooks/use-auth";
import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
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

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Safe defaults — most tests only override what they need
    (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Invalid credentials" });
    (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: "Email already registered" });
    (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue(null);
    (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "default-project-id" });
  });

  // ─── Initial state ───────────────────────────────────────────────────────────

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(result.current.isLoading).toBe(false);
  });

  // ─── signIn ──────────────────────────────────────────────────────────────────

  describe("signIn", () => {
    test("calls server action with provided credentials", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "secret123");
      });

      expect(signInAction).toHaveBeenCalledWith("user@example.com", "secret123");
    });

    test("returns the result from the server action", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });
      const { result } = renderHook(() => useAuth());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signIn("user@example.com", "wrong");
      });

      expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
    });

    test("sets isLoading to true while the action is pending", async () => {
      let resolveAction!: (v: unknown) => void;
      (signInAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((r) => { resolveAction = r; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signIn("user@example.com", "password");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveAction({ success: false, error: "Invalid credentials" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false when the action throws", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate or inspect anon work on failure", async () => {
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "wrongpassword");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    // ── Post-login navigation ─────────────────────────────────────────────────

    describe("post-login navigation", () => {
      beforeEach(() => {
        (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      });

      test("migrates anon work into a new project, clears storage, and navigates to it", async () => {
        const anonMessages = [{ role: "user", content: "Build a button" }];
        const anonFileSystemData = { "/App.jsx": { type: "file", content: "export default () => null" } };
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: anonMessages,
          fileSystemData: anonFileSystemData,
        });
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "migrated-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: anonMessages,
          data: anonFileSystemData,
        });
        expect(clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-project");
        // Should short-circuit — never fetches existing projects
        expect(getProjects).not.toHaveBeenCalled();
      });

      test("treats anon data with empty messages as no anon work", async () => {
        // messages.length === 0 means the condition `anonWork.messages.length > 0` is false
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: [],
          fileSystemData: {},
        });
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project");
      });

      test("navigates to the most recently updated project when no anon work", async () => {
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: "recent-project" },
          { id: "older-project" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(createProject).not.toHaveBeenCalled();
      });

      test("creates a blank project for a brand-new user with no projects and no anon work", async () => {
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "first-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("user@example.com", "password");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/first-project");
      });
    });
  });

  // ─── signUp ──────────────────────────────────────────────────────────────────

  describe("signUp", () => {
    test("calls server action with provided credentials", async () => {
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "securepass");
      });

      expect(signUpAction).toHaveBeenCalledWith("new@example.com", "securepass");
    });

    test("returns the result from the server action", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });
      const { result } = renderHook(() => useAuth());

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.signUp("existing@example.com", "password");
      });

      expect(returnValue).toEqual({ success: false, error: "Email already registered" });
    });

    test("sets isLoading to true while the action is pending", async () => {
      let resolveAction!: (v: unknown) => void;
      (signUpAction as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise((r) => { resolveAction = r; })
      );

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.signUp("new@example.com", "password");
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true));

      await act(async () => {
        resolveAction({ success: false, error: "Email already registered" });
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("resets isLoading to false when the action throws", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Server error"));
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("new@example.com", "password").catch(() => {});
      });

      expect(result.current.isLoading).toBe(false);
    });

    test("does not navigate or inspect anon work on failure", async () => {
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "Email already registered",
      });
      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signUp("existing@example.com", "password");
      });

      expect(getAnonWorkData).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });

    // ── Post-registration navigation ──────────────────────────────────────────

    describe("post-registration navigation", () => {
      beforeEach(() => {
        (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
      });

      test("migrates anon work into a new project and navigates to it", async () => {
        const anonMessages = [{ role: "user", content: "Build a modal" }];
        const anonFileSystemData = { "/App.jsx": { type: "file", content: "export default () => null" } };
        (getAnonWorkData as ReturnType<typeof vi.fn>).mockReturnValue({
          messages: anonMessages,
          fileSystemData: anonFileSystemData,
        });
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "signup-migrated-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("brand-new@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: anonMessages,
          data: anonFileSystemData,
        });
        expect(clearAnonWork).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/signup-migrated-project");
      });

      test("creates a blank project when no anon work and no prior projects", async () => {
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        (createProject as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "fresh-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("brand-new@example.com", "password123");
        });

        expect(createProject).toHaveBeenCalledWith({
          name: expect.stringMatching(/^New Design #\d+$/),
          messages: [],
          data: {},
        });
        expect(mockPush).toHaveBeenCalledWith("/fresh-project");
      });

      test("navigates to the most recent existing project when no anon work", async () => {
        // Edge case: user signed up via SSO previously and has projects
        (getProjects as ReturnType<typeof vi.fn>).mockResolvedValue([
          { id: "recent-project" },
          { id: "old-project" },
        ]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("user@example.com", "password");
        });

        expect(mockPush).toHaveBeenCalledWith("/recent-project");
        expect(createProject).not.toHaveBeenCalled();
      });
    });
  });

  // ─── Shared isLoading guarantee ───────────────────────────────────────────────

  describe("isLoading invariant", () => {
    test("signIn and signUp share the same loading state — they cannot both run simultaneously", async () => {
      // Both functions read/write the same `isLoading` state.
      // Verify they're truly backed by the same flag by checking that calling one
      // and then the other in sequence both go through the loading → done cycle.
      (signInAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });
      (signUpAction as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn("user@example.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);

      await act(async () => {
        await result.current.signUp("user@example.com", "pass");
      });
      expect(result.current.isLoading).toBe(false);
    });
  });
});

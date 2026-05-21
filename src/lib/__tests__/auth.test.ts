// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const cookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import {
  createSession,
  getSession,
  deleteSession,
  verifySession,
} from "@/lib/auth";

const COOKIE_NAME = "auth-token";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "development-secret-key"
);

function makeRequest(token: string | undefined) {
  return {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME && token ? { value: token } : undefined,
    },
  } as any;
}

beforeEach(() => {
  cookieStore.get.mockReset();
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createSession", () => {
  test("sets a signed cookie with expected attributes", async () => {
    await createSession("user-123", "user@example.com");

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const [name, token, options] = cookieStore.set.mock.calls[0];

    expect(name).toBe(COOKIE_NAME);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(options.expires).toBeInstanceOf(Date);

    const expectedExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const diff = Math.abs(options.expires.getTime() - expectedExpiry);
    expect(diff).toBeLessThan(5000);
  });

  test("issues a token whose payload carries userId and email", async () => {
    await createSession("user-abc", "abc@example.com");
    const token = cookieStore.set.mock.calls[0][1] as string;

    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("user-abc");
    expect(session?.email).toBe("abc@example.com");
  });

  test("uses secure cookie only in production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await createSession("u1", "u1@example.com");
    expect(cookieStore.set.mock.calls[0][2].secure).toBe(false);

    cookieStore.set.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    await createSession("u2", "u2@example.com");
    expect(cookieStore.set.mock.calls[0][2].secure).toBe(true);

    vi.unstubAllEnvs();
  });
});

describe("getSession", () => {
  test("returns null when no auth cookie is present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    expect(await getSession()).toBeNull();
    expect(cookieStore.get).toHaveBeenCalledWith(COOKIE_NAME);
  });

  test("returns null when the token is malformed", async () => {
    cookieStore.get.mockReturnValue({ value: "not-a-jwt" });
    expect(await getSession()).toBeNull();
  });

  test("returns null when the token signature is wrong", async () => {
    const badToken = await new SignJWT({ userId: "x", email: "x@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(new TextEncoder().encode("a-different-secret"));

    cookieStore.get.mockReturnValue({ value: badToken });
    expect(await getSession()).toBeNull();
  });

  test("returns null for an expired token", async () => {
    const expired = await new SignJWT({
      userId: "u",
      email: "u@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .sign(SECRET);

    cookieStore.get.mockReturnValue({ value: expired });
    expect(await getSession()).toBeNull();
  });

  test("returns the payload for a valid token", async () => {
    await createSession("session-user", "session@example.com");
    const token = cookieStore.set.mock.calls[0][1] as string;

    cookieStore.get.mockReturnValue({ value: token });
    const session = await getSession();

    expect(session).not.toBeNull();
    expect(session?.userId).toBe("session-user");
    expect(session?.email).toBe("session@example.com");
  });
});

describe("deleteSession", () => {
  test("removes the auth cookie", async () => {
    await deleteSession();
    expect(cookieStore.delete).toHaveBeenCalledWith(COOKIE_NAME);
  });
});

describe("verifySession", () => {
  test("returns null when the request has no auth cookie", async () => {
    expect(await verifySession(makeRequest(undefined))).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    expect(await verifySession(makeRequest("garbage.token.value"))).toBeNull();
  });

  test("returns the payload for a valid token", async () => {
    const token = await new SignJWT({
      userId: "req-user",
      email: "req@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(SECRET);

    const session = await verifySession(makeRequest(token));
    expect(session?.userId).toBe("req-user");
    expect(session?.email).toBe("req@example.com");
  });

  test("returns null for a token signed with a different secret", async () => {
    const token = await new SignJWT({
      userId: "req-user",
      email: "req@example.com",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(new TextEncoder().encode("not-the-real-secret"));

    expect(await verifySession(makeRequest(token))).toBeNull();
  });
});

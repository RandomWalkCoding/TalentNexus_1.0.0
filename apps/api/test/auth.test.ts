import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";
import { hashPassword, sessionActor } from "../src/modules/auth.js";

const user = {
  ...demoActor,
  email: "rachel@talentnexus.local",
  passwordHash: hashPassword("TalentNexus07!"),
  updatedAt: new Date("2026-10-05T08:00:00.000Z"),
  createdAt: new Date("2026-10-01T08:00:00.000Z"),
  preference: { theme: "dark", density: "comfortable", notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY" }
};

describe("authentication API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("logs Rachel in, reads the session and logs out", async () => {
    vi.spyOn(prisma.adminUser, "findUnique").mockResolvedValue(user as never);
    vi.spyOn(prisma.authSession, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma.authSession, "findFirst").mockResolvedValue({ user, expiresAt: new Date(Date.now() + 60_000) } as never);
    const deleteMany = vi.spyOn(prisma.authSession, "deleteMany").mockResolvedValue({ count: 1 });
    const app = buildApp({ identity: (request) => request ? sessionActor(request, prisma) : null });
    try {
      const login = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: user.email, password: "TalentNexus07!" } });
      expect(login.statusCode).toBe(200);
      expect(login.json().user.name).toBe("Rachel");
      const cookie = String(login.headers["set-cookie"]).split(";")[0];
      const me = await app.inject({ method: "GET", url: "/api/v1/me", headers: { cookie } });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.email).toBe(user.email);
      const logout = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers: { cookie } });
      expect(logout.statusCode).toBe(200);
      expect(deleteMany).toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects an incorrect password and protects private routes", async () => {
    vi.spyOn(prisma.adminUser, "findUnique").mockResolvedValue(user as never);
    const app = buildApp({ identity: () => null });
    try {
      const invalid = await app.inject({ method: "POST", url: "/api/v1/auth/login", payload: { email: user.email, password: "wrong-pass" } });
      expect(invalid.statusCode).toBe(401);
      expect((await app.inject("/api/v1/me")).statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});

import { describe, expect, test } from "bun:test";
import { assertSameOrigin, commitSession, getSession } from "./cookies";

describe("dashboard cookie sessions", () => {
  test("round-trips a signed HttpOnly session", async () => {
    const cookie = await commitSession({ accessToken: "access", refreshToken: "refresh" });
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const request = new Request("http://localhost/", {
      headers: { cookie: cookie.split(";", 1)[0]! },
    });
    expect(await getSession(request)).toEqual({ accessToken: "access", refreshToken: "refresh" });
  });

  test("accepts the proxy-forwarded public origin", () => {
    expect(() => assertSameOrigin(new Request("http://dashboard-service/api/reset", {
      method: "POST",
      headers: {
        origin: "https://app.example",
        "x-forwarded-host": "app.example",
        "x-forwarded-proto": "https",
      },
    }))).not.toThrow();
  });

  test("rejects cross-origin mutations", () => {
    expect(() => assertSameOrigin(new Request("https://app.example/api/reset", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }))).toThrow();
  });
});

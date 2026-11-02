// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { validateN8nLink } = await import("@/lib/n8n-request-policy");
const original = process.env.N8N_ALLOWED_LINK_HOSTS;

afterEach(() => {
  if (original === undefined) delete process.env.N8N_ALLOWED_LINK_HOSTS;
  else process.env.N8N_ALLOWED_LINK_HOSTS = original;
});

describe("n8n link policy", () => {
  it("accepts HTTPS links only from an exact configured host", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.example.com";
    expect(validateN8nLink("https://n8n.example.com/invite?id=1")).toBe("https://n8n.example.com/invite?id=1");
    expect(() => validateN8nLink("https://evil.example.com/invite")).toThrow(/configured n8n host/i);
    expect(() => validateN8nLink("https://n8n.example.com.evil.test/invite")).toThrow(/configured n8n host/i);
  });

  it("rejects insecure links and fails closed without an allowlist", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.example.com";
    expect(() => validateN8nLink("http://n8n.example.com/invite")).toThrow(/HTTPS/);
    delete process.env.N8N_ALLOWED_LINK_HOSTS;
    expect(() => validateN8nLink("https://n8n.example.com/invite")).toThrow(/configured n8n host/i);
  });
});

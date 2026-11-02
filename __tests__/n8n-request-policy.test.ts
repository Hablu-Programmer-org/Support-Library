// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { validateAccessLink, validateN8nLink } = await import("@/lib/n8n-request-policy");
const original = process.env.N8N_ALLOWED_LINK_HOSTS;
const originalOpenAi = process.env.OPENAI_ALLOWED_LINK_HOSTS;

afterEach(() => {
  if (original === undefined) delete process.env.N8N_ALLOWED_LINK_HOSTS;
  else process.env.N8N_ALLOWED_LINK_HOSTS = original;
  if (originalOpenAi === undefined) delete process.env.OPENAI_ALLOWED_LINK_HOSTS;
  else process.env.OPENAI_ALLOWED_LINK_HOSTS = originalOpenAi;
});

describe("n8n link policy", () => {
  it("accepts HTTPS links only from an exact configured host", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.example.com";
    expect(validateN8nLink("https://n8n.example.com/invite?id=1")).toBe("https://n8n.example.com/invite?id=1");
    expect(() => validateN8nLink("https://evil.example.com/invite")).toThrow(/configured n8n host/i);
    expect(() => validateN8nLink("https://n8n.example.com.evil.test/invite")).toThrow(/configured n8n host/i);
  });

  it("accepts the production n8n signup URL without weakening exact-host checks", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.hablu-programmer.com";
    expect(validateN8nLink("https://n8n.hablu-programmer.com/signup?token=redacted"))
      .toBe("https://n8n.hablu-programmer.com/signup?token=redacted");
    expect(() => validateN8nLink("https://n8n.hablu-programmer.com.evil.test/signup?token=x"))
      .toThrow(/configured n8n host/i);
  });

  it("rejects oversized links", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.hablu-programmer.com";
    expect(() => validateN8nLink(`https://n8n.hablu-programmer.com/signup?token=${"x".repeat(2100)}`))
      .toThrow(/too long/i);
  });

  it("rejects insecure links and fails closed without an allowlist", () => {
    process.env.N8N_ALLOWED_LINK_HOSTS = "n8n.example.com";
    expect(() => validateN8nLink("http://n8n.example.com/invite")).toThrow(/HTTPS/);
    delete process.env.N8N_ALLOWED_LINK_HOSTS;
    expect(() => validateN8nLink("https://n8n.example.com/invite")).toThrow(/configured n8n host/i);
  });

  it("accepts only the configured OpenAI invitation host", () => {
    process.env.OPENAI_ALLOWED_LINK_HOSTS = "platform.openai.com";
    expect(validateAccessLink("https://platform.openai.com/settings/organization", "openai"))
      .toBe("https://platform.openai.com/settings/organization");
    expect(() => validateAccessLink("https://chatgpt.com/", "openai")).toThrow(/configured OpenAI host/i);
    delete process.env.OPENAI_ALLOWED_LINK_HOSTS;
  });
});

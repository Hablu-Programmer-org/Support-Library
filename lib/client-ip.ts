import { isIP } from "node:net";

function trustedProxyHops() {
  const value = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function validIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}

export function getClientIp(headers: Headers): string | undefined {
  const hops = trustedProxyHops();
  if (hops === 0) return undefined;

  const chain = headers.get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (chain && chain.length >= hops) {
    return validIp(chain[chain.length - hops]);
  }

  return validIp(headers.get("x-real-ip"));
}

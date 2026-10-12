export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { validateProductionEnv } = await import("@/lib/env");
  validateProductionEnv();
}

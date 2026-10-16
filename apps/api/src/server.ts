import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

const app = buildApp();

app.addHook("onClose", async () => { await prisma.$disconnect(); });
let closing = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    if (closing) return;
    closing = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    deadline.unref();
    void app.close().then(() => { clearTimeout(deadline); }).catch(() => { process.exitCode = 1; });
  });
}

await app.listen({
  host: env.HOST,
  port: env.PORT
});

import { cpSync } from "node:fs";

cpSync("src/generated/client", "dist/generated/client", { recursive: true, force: true });

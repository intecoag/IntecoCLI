import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");

const assetPaths = [
  ["ressources", "cmds.json"],
  ["ressources", "wegas_p.ico"],
  ["utils", "config", "default.json"]
];

for (const parts of assetPaths) {
  const source = path.join(src, ...parts);
  const destination = path.join(dist, ...parts);

  if (!existsSync(source)) {
    continue;
  }

  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, { recursive: false });
}

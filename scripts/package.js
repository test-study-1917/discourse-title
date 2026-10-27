import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
execFileSync("tar", [
  "-czf",
  "dist/discourse-reply-titles-plugin.tar.gz",
  "--transform=s,^,discourse-title/,",
  "plugin.rb",
  "assets",
  "config",
  "README.md",
  "package.json",
  "package-lock.json",
  "scripts",
  "tests",
  "test",
  "docs",
]);
process.stdout.write("dist/discourse-reply-titles-plugin.tar.gz\n");

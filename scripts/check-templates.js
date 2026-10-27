import { preprocess } from "@glimmer/syntax";
import { parse } from "@babel/parser";
import { Preprocessor } from "content-tag";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const compiler = new Preprocessor();
function check(directory) {
  for (const file of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, file.name);
    if (file.isDirectory()) {
      check(path);
    } else if (path.endsWith(".gjs")) {
      const { code } = compiler.process(readFileSync(path, "utf8"), {
        filename: path,
      });
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["decorators-legacy"],
      });
      const templateImports = new Set(
        ast.program.body
          .filter(
            (node) =>
              node.type === "ImportDeclaration" &&
              node.source.value === "@ember/template-compiler"
          )
          .flatMap((node) =>
            node.specifiers.map((specifier) => specifier.local.name)
          )
      );
      function visit(node) {
        if (!node || typeof node !== "object") {
          return;
        }
        if (
          node.type === "CallExpression" &&
          templateImports.has(node.callee.name)
        ) {
          preprocess(node.arguments[0].quasis[0].value.cooked, {
            mode: "codemod",
          });
        }
        Object.values(node).forEach((value) => {
          if (Array.isArray(value)) {
            value.forEach(visit);
          } else if (value && typeof value === "object") {
            visit(value);
          }
        });
      }
      visit(ast);
      process.stdout.write(`JavaScript and template parsed: ${path}\n`);
    }
  }
}
check("assets/javascripts");

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { parse } from "yaml";

const directory = new URL("../config/locales/", import.meta.url);
const files = readdirSync(directory);
const pluralForms = new Set(["zero", "one", "two", "few", "many", "other"]);

function load(kind, locale) {
  const name = `${kind}.${locale}.yml`;
  const content = parse(readFileSync(new URL(name, directory), "utf8"));
  assert.deepEqual(Object.keys(content), [locale], `${name}: locale root`);
  return content[locale];
}

function leaves(value, prefix = "") {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof child === "object" && child !== null
        ? Object.entries(leaves(child, path))
        : [[path, child]];
    })
  );
}

function placeholders(value) {
  return [...value.matchAll(/%\{([^}]+)\}/g)].map((match) => match[1]).sort();
}

const locales = files
  .filter((name) => /^client\..+\.yml$/.test(name))
  .map((name) => name.slice(7, -4))
  .sort();
const english = {
  client: leaves(load("client", "en")),
  server: leaves(load("server", "en")),
};
const countPrefix = "js.reply_titles.count.";

for (const locale of locales) {
  test(`locale ${locale}: complete text, placeholders and plural forms`, () => {
    for (const kind of ["client", "server"]) {
      const content = load(kind, locale);
      const strings = leaves(content);
      const expectedKeys = Object.keys(english[kind]).filter(
        (key) => !key.startsWith(countPrefix)
      );
      const actualKeys = Object.keys(strings).filter(
        (key) => !key.startsWith(countPrefix)
      );
      assert.deepEqual(
        actualKeys.sort(),
        expectedKeys.sort(),
        `${kind}.${locale}: translation keys`
      );

      for (const [key, value] of Object.entries(strings)) {
        assert.equal(
          typeof value,
          "string",
          `${kind}.${locale}.${key}: string`
        );
        assert.ok(value.trim(), `${kind}.${locale}.${key}: not empty`);
        const reference = key.startsWith(countPrefix)
          ? english.client[`${countPrefix}other`]
          : english[kind][key];
        assert.deepEqual(
          placeholders(value),
          placeholders(reference),
          `${kind}.${locale}.${key}: placeholders`
        );
      }

      if (kind === "client") {
        const { count, title, empty } = content.js.reply_titles;
        const categories = new Intl.PluralRules(
          locale.replaceAll("_", "-")
        ).resolvedOptions().pluralCategories;
        for (const category of categories) {
          assert.ok(count[category], `${locale}: missing ${category} plural`);
        }
        for (const category of Object.keys(count)) {
          assert.ok(
            pluralForms.has(category),
            `${locale}: unknown plural ${category}`
          );
        }
        assert.equal(
          content.admin_js.admin.site_settings.categories.reply_titles,
          title
        );
        assert.ok(empty.includes("#"), `${locale}: heading marker`);
      } else {
        assert.ok(
          content.site_settings.reply_titles_enabled.includes("#"),
          `${locale}: heading marker`
        );
      }
    }
  });
}

test("every server translation has a matching client translation", () => {
  const serverLocales = files
    .filter((name) => /^server\..+\.yml$/.test(name))
    .map((name) => name.slice(7, -4))
    .sort();
  assert.deepEqual(serverLocales, locales);
});

const discourseRoot = process.env.DISCOURSE_ROOT;
test("translations cover the target Discourse installation", (context) => {
  if (!discourseRoot) {
    context.skip("Set DISCOURSE_ROOT to check a target installation.");
    return;
  }

  const coreLocales = readdirSync(resolve(discourseRoot, "config/locales"))
    .filter((name) => /^client\..+\.yml$/.test(name))
    .map((name) => name.slice(7, -4));
  const missing = coreLocales.filter((locale) => !locales.includes(locale));
  assert.deepEqual(missing, [], `Missing translations: ${missing.join(", ")}`);
});

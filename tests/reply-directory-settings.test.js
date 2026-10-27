import assert from "node:assert/strict";
import { test } from "node:test";
import { replyDirectoryEnabled } from "../assets/javascripts/discourse/lib/reply-directory-settings.js";

const settings = {
  reply_titles_enabled: true,
  reply_titles_categories: "2|12",
};

test("总开关关闭时，已选择的类别也不显示目录", () => {
  assert.equal(
    replyDirectoryEnabled(
      { category_id: 2 },
      { ...settings, reply_titles_enabled: false }
    ),
    false
  );
});

test("类别留空时保留现有的全站显示行为", () => {
  for (const category_id of [2, 12, null]) {
    assert.equal(
      replyDirectoryEnabled(
        { category_id },
        { ...settings, reply_titles_categories: "" }
      ),
      true
    );
  }
  assert.equal(
    replyDirectoryEnabled({ category_id: 2 }, { reply_titles_enabled: true }),
    true
  );
});

test("仅匹配已选类别的完整 ID，不把 2 和 12 混淆", () => {
  for (const category_id of [2, 12, "2", "12"]) {
    assert.equal(replyDirectoryEnabled({ category_id }, settings), true);
  }
  assert.equal(replyDirectoryEnabled({ category_id: 1 }, settings), false);
  assert.equal(
    replyDirectoryEnabled(
      { category_id: 2 },
      { ...settings, reply_titles_categories: "12" }
    ),
    false
  );
});

test("指定类别后，私信、无类别主题和未单独选择的子类别不显示", () => {
  assert.equal(replyDirectoryEnabled({ category_id: null }, settings), false);
  assert.equal(replyDirectoryEnabled({}, settings), false);
  assert.equal(replyDirectoryEnabled(undefined, settings), false);
  assert.equal(replyDirectoryEnabled({ category_id: 3 }, settings), false);
});

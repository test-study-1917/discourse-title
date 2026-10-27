import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  firstLine,
  loadReplyTitles,
  titleEntry,
} from "../assets/javascripts/discourse/lib/reply-titles.js";

globalThis.DOMParser = new JSDOM("").window.DOMParser;
const post = (number, cooked = `<h1>标题 ${number}</h1><p>正文</p>`) => ({
  id: 1000 + number,
  post_number: number,
  post_type: 1,
  cooked,
});
const load = (request, options = {}) =>
  loadReplyTitles({
    topicId: 42,
    request,
    signal: new AbortController().signal,
    onUpdate() {},
    ...options,
  });

test("只收录首行的单个 # 标题，兼容有无空格并保留行内文字", () => {
  for (const [html, expected] of [
    ["<h1>第一章：阅读的意义</h1><p>正文</p>", "第一章：阅读的意义"],
    ["<p>#第一章</p><p>正文</p>", "第一章"],
    ["<p># 第一章</p><p>正文</p>", "第一章"],
    ["<p>#第一行<br>第二行</p>", "第一行"],
    ["<p>#第一行\n第二行</p>", "第一行"],
    [
      "<h1><strong>我的</strong> <a href='/'>读书笔记</a> &amp; 思考</h1>",
      "我的 读书笔记 & 思考",
    ],
    ["\n<h1> 标题&nbsp;内容 </h1>", "标题 内容"],
    ["<p>#<img class='emoji' alt=':book:'> 阅读</p>", ":book: 阅读"],
    ["<p>普通首行</p><h1>后面的标题</h1>", ""],
    ["<p>普通首行<br>#后面的标题</p>", ""],
    ["<p>普通首行\n#后面的标题</p>", ""],
    ["<h2>二级标题</h2>", ""],
    ["<p>##二级标题</p>", ""],
    ["<p>###三级标题</p>", ""],
    ["<p>#</p>", ""],
    ["<h1> </h1><p>正文</p>", ""],
    ["<blockquote><h1>引用标题</h1></blockquote>", ""],
    ["<ul><li>#列表首行</li></ul>", ""],
    ["<pre><code>#代码</code></pre>", ""],
    ["<p><img src='/photo.jpg' alt='filename.jpg'></p>", ""],
    [
      "<script>bad()</script><style>bad</style><p>#&lt;script&gt; 不会执行</p>",
      "<script> 不会执行",
    ],
    ["", ""],
  ]) {
    assert.equal(firstLine(html), expected);
  }
});

test("排除首帖、系统动作、删除、隐藏和没有首行标题的回帖", () => {
  for (const p of [
    post(1),
    { ...post(2), post_type: 2 },
    { ...post(2), deleted_at: "2026-01-01" },
    { ...post(2), user_deleted: true },
    { ...post(2), hidden: true },
    post(2, "<p>普通文字</p>"),
    post(2, "<p><img src='/photo'></p>"),
  ]) {
    assert.equal(titleEntry(p), null);
  }
  assert.deepEqual(titleEntry(post(2, "<p>#标题</p>")), {
    id: 1002,
    number: 2,
    title: "标题",
  });
});

test("跨批次加载整个主题，去重、按楼层排序且不请求已取得的正文", async () => {
  const posts = Array.from({ length: 65 }, (_, i) => post(i + 1));
  const calls = [];
  const updates = [];
  const result = await load(
    async (url, options) => {
      calls.push({ url, options });
      if (url === "/t/42.json") {
        return {
          post_stream: {
            stream: posts.map((p) => p.id),
            posts: posts.slice(0, 20),
          },
        };
      }
      assert.ok(options.data.post_ids.length <= 20);
      return {
        post_stream: {
          posts: posts
            .filter((p) => options.data.post_ids.includes(p.id))
            .reverse(),
        },
      };
    },
    { onUpdate: (entries) => updates.push(entries.length) }
  );
  assert.equal(calls.length, 4);
  assert.equal(result.length, 64);
  assert.deepEqual(
    result.map((entry) => entry.number),
    posts.slice(1).map((p) => p.post_number)
  );
  assert.deepEqual(updates, [19, 39, 59, 64]);
  assert.equal(calls[1].options.data.post_ids[0], 1021);
});

test("API 失败不会把部分目录当作完整结果", async () => {
  const updates = [];
  await assert.rejects(
    load(
      async (url) => {
        if (url === "/t/42.json") {
          return {
            post_stream: {
              stream: [1001, 1002, 1003],
              posts: [post(1), post(2)],
            },
          };
        }
        throw new Error("429");
      },
      { onUpdate: (entries) => updates.push(entries) }
    ),
    /429/
  );
  assert.equal(updates[0].length, 1);
});

test("首批没有标题时仍读取后续回帖，仅收录首行标题并保留实际楼层", async () => {
  const posts = [
    post(1),
    post(2, "<p>普通回复</p>"),
    post(4, "<p>#第四楼标题</p>"),
    post(5, "<p>普通首行</p><h1>后续标题</h1>"),
  ];
  const entries = await load(async (url, options) => {
    if (url === "/t/42.json") {
      return {
        post_stream: {
          stream: posts.map((p) => p.id),
          posts: posts.slice(0, 2),
        },
      };
    }
    assert.deepEqual(options.data.post_ids, [1004, 1005]);
    return { post_stream: { posts: posts.slice(2) } };
  });
  assert.deepEqual(entries, [{ id: 1004, number: 4, title: "第四楼标题" }]);
});

test("切换主题时停止后续批次并丢弃过期响应", async () => {
  const controller = new AbortController();
  let calls = 0;
  let updates = 0;
  await assert.rejects(
    load(
      async () => {
        calls++;
        controller.abort();
        return { post_stream: { stream: [1001, 1002], posts: [post(1)] } };
      },
      { signal: controller.signal, onUpdate: () => updates++ }
    ),
    { name: "AbortError" }
  );
  assert.equal(calls, 1);
  assert.equal(updates, 0);
});

test("超大主题没有 ID 流时按楼层游标向后读取", async () => {
  const calls = [];
  const result = await load(async (url, options) => {
    calls.push(options?.data);
    if (url === "/t/42.json") {
      return {
        highest_post_number: 6,
        post_stream: { posts: [post(1), post(2)] },
      };
    }
    const cursor = options.data.post_number;
    return {
      post_stream: { posts: cursor === 2 ? [post(3), post(4)] : [post(6)] },
    };
  });
  assert.deepEqual(
    result.map((entry) => entry.number),
    [2, 3, 4, 6]
  );
  assert.deepEqual(calls.slice(1), [
    { post_number: 2, asc: true },
    { post_number: 4, asc: true },
  ]);
});

test("剩余楼层已删除时游标不前进也能终止", async () => {
  let calls = 0;
  await load(async () => {
    calls++;
    return {
      highest_post_number: 5,
      post_stream: { posts: [post(1), post(2)] },
    };
  });
  assert.equal(calls, 2);
});

test("超大主题返回空 ID 流时也按楼层游标读取", async () => {
  let calls = 0;
  const entries = await load(async () => {
    calls++;
    return calls === 1
      ? {
          highest_post_number: 3,
          post_stream: { stream: [], posts: [post(1), post(2)] },
        }
      : { post_stream: { posts: [post(3)] } };
  });
  assert.deepEqual(
    entries.map((entry) => entry.number),
    [2, 3]
  );
});

test("刷新重新提取编辑后的第一行，不保留已删除回复", async () => {
  let posts = [post(1), post(2), post(3)];
  const request = async () => ({
    post_stream: { posts, stream: posts.map((p) => p.id) },
  });
  assert.equal((await load(request))[0].title, "标题 2");
  posts = [post(1), post(2, "<p>#修改后的标题</p>")];
  const entries = await load(request);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, "修改后的标题");
  posts = [post(1), post(2, "<p>取消标题标记</p>")];
  assert.deepEqual(await load(request), []);
});

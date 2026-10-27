# 本地验证记录

## Issue #1：后台控制面板与语言 · 2026-10-27

对应 [GitHub Issue #1](https://github.com/test-study-1917/discourse-title/issues/1)。实现已完成，等待用户手动验收，尚未关闭 Issue。

### 修改结果

- 将插件标识统一为实际安装目录 `discourse-title`，修复 Discourse 将设置归属记为目录名、插件声明却使用另一名称时无法关联设置的问题。原有 `reply_titles_enabled` 键名及其值保持不变。
- 使用原生插件设置页 `/admin/plugins/discourse-title/settings`，提供总开关与类别多选 `reply_titles_categories`。类别留空保持全站生效；选择后只匹配所选类别，子类别需单独加入，私信不显示。
- 桌面和手机在挂载目录前判断类别与总开关；未命中时不请求目录数据，不替换原生时间轴。跨主题导航或禁用会销毁目录组件并清理布局状态。
- 沿用 Discourse 原生多语言和英文回退机制。根据用户追加要求，将目录界面与后台设置文案扩充到本地 Discourse 当前的 49 个语言／地区代码，并按语言提供复数形式；未来语言通过新增翻译文件扩展，不修改业务代码。尚未提供翻译的语言回退英文，回帖标题保留作者原文。维护方法见 `docs/localization.md`。
- 打包文件名仍为 `dist/discourse-reply-titles-plugin.tar.gz`，压缩包根目录改为与插件标识一致的 `discourse-title/`。

### 验证证据

- `DISCOURSE_ROOT=../discourse npm test`：65 项通过，包含 51 项语言完整性、前后台配对、占位符、复数及目标论坛语言覆盖检查，以及原有的 14 项提取、分页和类别开关检查。不指定 `DISCOURSE_ROOT` 时，目标论坛覆盖检查会明确跳过，其他检查仍独立运行。
- `npm run check:templates`：两个 GJS 文件的 JavaScript 与模板语法检查通过。
- `http://localhost:3000/tests?target=discourse-title&filter=Reply%20directory`：6 项浏览器验收通过，包含桌面/手机跨类别导航、不请求未命中类别的目录、关闭总开关、英文回退与原有交互。
- 通过本地 Discourse 自带工具执行 Ruby、ESLint、Prettier、YAML 和翻译文案检查。`bin/lint --fix` 的外部插件模式找不到插件自身的 Prettier/ESLint，因此 JavaScript 等检查改用 `/src` 根目录现有工具完成，未额外引入插件依赖。
- Rails 序列化检查确认：`id/name` 均为 `discourse-title`，`has_settings: true`、`has_only_enabled_setting: false`，自动后台路由和两个设置均已关联。扩充后，49 个语言的后台设置说明均通过原生 I18n 加载检查。
- 使用 Discourse 原生前端翻译引擎，在关闭回退的条件下检查 49 个语言的所有目录文案及 539 个数量用例（含零、单数、复数、小数和百万），无缺键或错误回退。
- 实际主题 `/t/test1-dushuhuiceshi/7`：1440 × 1000 桌面显示 8 条目录；390 × 844 手机展开后显示 8 条，无横向溢出，点击楼层后收起。初版验证了中英文与英文回退；多语言扩充后，使用服务器实际语言资源确认法语、日语、俄语、阿拉伯语、繁体中文显示对应翻译，另检查了阿拉伯语手机展开状态无横向溢出。回退测试改用没有翻译的 `zz`，避免将已经支持的法语误当作未支持语言。浏览器会话内修改类别和总开关验证移除/恢复目录，未改站点持久设置。

### 同步与手动验收

源码及验证文档同步到 `/home/zhuji/code/dis_dev/discourse/plugins/discourse-title/`。本地运行页面已读取新增的类别设置；当前仍为总开关开启、类别留空，未替用户选择生效类别。

1. 以管理员身份打开 `/admin/plugins/discourse-title/settings`，选择需要生效的类别，保存并刷新主题页。
2. 对比所选与未选类别；关闭总开关后确认恢复原生布局。
3. 在个人偏好的界面语言中切换简体中文、英文及其他语言，保存并刷新，检查目录标题、数量与按钮。

同步前备份：`/tmp/discourse-title-issue-1-before-pBSyk4/plugin.tar.gz`。若需要回退，先关闭插件，使用该备份恢复插件文件并重载开发服务；不覆盖论坛数据。

## 插件迁移验证 · 2026-10-26（历史记录）

### 结果

已将主题组件转换为 Discourse 服务器插件，并安装到本机 `/home/v/projects/discourse/plugins/discourse-/`。不再使用 `themePrefix`、主题翻译结构或主题资源目录。

- 标题提取与分页的 10 项 Node 测试通过；GJS 和模板语法检查通过。
- Ruby 语法、RuboCop、Syntax Tree、ESLint 和 Stylelint 检查通过。
- Discourse `/tests?target=discourse-&filter=Reply%20directory` 中的 3 项浏览器验收测试通过，覆盖筛选、楼层链接、刷新、时间轴切换、手机展开与跳转后关闭、禁用开关。
- 实际开发论坛的桌面 1440 × 1000、窄屏 390 × 844 显示正常。用浏览器拦截目录读取请求提供示例回帖，确认只显示 #2 和 #4；没有新增或编辑论坛帖子。窄屏没有横向溢出。
- 开发容器没有 Chrome，`bin/qunit` 命令行入口无法启动浏览器；以上 3 项测试通过现有 Playwright 浏览器访问同一个 Discourse 测试入口完成。

### 当时的本地状态与回退

新插件已默认开启。旧主题组件 `回帖标题目录 · Reply Titles`（ID 1）已停用，保留原内容和与 Foundation、Horizon 的关联，避免两套目录同时挂载。

本机目前只有一篇首帖、没有回帖的公开主题，因此正常页面会显示“还没有首行以 # 标记标题的回帖”；添加符合规则的回复后才会出现目录项。

迁移前目录备份：`/tmp/discourse-reply-titles-before-plugin-20261026/`。若需回退，应停止或关闭新插件，再从备份恢复原目录，并重新启用旧主题组件。开发服务使用现有 `bin/pitchfork` 的 `USR2` 重载机制；重载前应确认进程身份。

正式部署时按 README 的插件安装方式操作；私有仓库仍需构建环境的读取权限。

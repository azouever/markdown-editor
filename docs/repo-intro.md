# markdown-editor 仓库介绍

## 元信息

- 仓库名称：markdown-editor
- 原始项目来源：https://github.com/jbt/markdown-editor （本仓库为本地副本/改造基础）
- 技术栈：纯前端（HTML + CSS + 原生 JavaScript）
- 核心依赖：CodeMirror、markdown-it、highlight.js、emojify、SweetAlert、浏览器 LocalStorage

## 整体功能概览

- 提供一个浏览器端的 Markdown 编辑器，左侧编辑、右侧预览。
- 支持 GitHub 风格的 Markdown 渲染（包括脚注、任务列表等）。
- 支持语法高亮（通过 highlight.js）。
- 支持 Emoji 语法渲染（通过 emojify + 本地 emoji 资源）。
- 支持拼写检查（CodeMirror Spell Checker 插件）。
- 支持夜间模式、阅读模式切换。
- 支持从本地打开 .md/.markdown/.txt 文件并加载到编辑器中。
- 支持将内容保存为 Markdown 文件或导出为 HTML 文件。
- 支持通过 URL Hash 生成可分享链接（内容被压缩并编码到 URL 中）。
- 支持将当前内容保存到浏览器 LocalStorage，进行简单的本地持久化。

## 目录结构说明

- `index.html`：
  - 应用的入口 HTML 文件，定义布局结构（编辑区、预览区、导航栏、菜单等）。
  - 通过 `<script>` 标签引入所有第三方库和 `index.js` 主脚本。
  - 负责把样式和脚本组织在一起，是整体页面的骨架。

- `index.js`：
  - 前端主逻辑脚本，是二次开发的主要改造点。
  - 负责：
    - 初始化 `markdown-it`，配置 Markdown 渲染规则（包括脚注、任务列表、代码高亮、LaTeX 方程转图片等）。
    - 初始化 CodeMirror 编辑器，包括：
      - 模式：`gfm`（GitHub Flavored Markdown）+ 拼写检查 overlay。
      - 行内快捷键：Ctrl-B 粗体、Ctrl-I 斜体、Ctrl-K 行内代码、Ctrl-L `<kbd>` 标签等。
      - 自动列表续行（`newlineAndIndentContinueMarkdownList`）。
    - 同步编辑器内容到预览区：在 `editor.on('change', ...)` 中调用 `update()`，使用 `setOutput()` 渲染 HTML。
    - 渲染逻辑：
      - 使用 markdown-it 把 Markdown 转为 HTML。
      - 用 emojify 将 `:emoji:` 语法转换为图片。
      - 对 `<equation>...</equation>` 片段转成 LaTeX 图片。
      - 将 `[ ]` / `[x]` 形式的任务列表转换为带复选框的 HTML 列表项。
    - 菜单和交互功能：
      - “Save As Markdown” / “Save As HTML” 的下载逻辑（Blob + a 标签触发下载，或 `window.saveAs` / `navigator.saveBlob`）。
      - “Browser Save” 按钮：存储内容到 LocalStorage，使用 SweetAlert 做提示和覆写确认。
      - “Night Mode / Reading Mode / Spell Check” 按钮：切换对应 CSS class，改变展示效果。
      - 通过键盘事件监听 `Ctrl+S`：
        - 默认保存到 LocalStorage。
        - `Shift+Ctrl+S` 弹出菜单选择导出方式。
      - “Open from Disk”：通过隐藏的 `<input type="file">`，使用 FileReader 读取本地文件内容到编辑器。
    - URL 相关逻辑：
      - `updateHash()` 将当前内容压缩 + base64 编码，然后写入 `window.location.hash`，便于分享。
      - `start()` 中根据 query/hash 决定：
        - 是否默认进入阅读模式。
        - 是否启用夜间模式。
        - 从 hash 中解压出内容（编辑模式）或直接渲染只读视图（view 模式）。
      - 在页面关闭前（`beforeunload`）检测是否有未保存内容，有则弹出浏览器原生提示。

- `index.css`：
  - 项目的主样式文件，对编辑区、预览区、导航栏、夜间模式、阅读模式等进行布局与视觉控制。
  - 与 `github-markdown.css`（lib 中）配合，保证渲染后的 Markdown 具有 GitHub 风格。

- `codemirror/`：
  - CodeMirror 的核心库和相关模式文件：
    - `lib/`：核心 CodeMirror 脚本和样式。
    - `markdown/`、`gfm/`、`javascript/`、`css/`、`htmlmixed/`、`xml/`：语言和 Markdown 模式支持。
    - `overlay.js`：overlay 模式的支持文件，用于叠加拼写检查等功能。

- `lib/`：第三方库与样式资源目录：
  - `markdown-it.js`：Markdown 渲染引擎。
  - `markdown-it-footnote.js`：脚注插件。
  - `highlight.pack.js`：代码高亮库。
  - `emojify.js`：Emoji 渲染库，对应 `emoji/` 目录中的图片资源。
  - `rawinflate.js` / `rawdeflate.js`：压缩与解压工具，用于把内容塞进 URL Hash。
  - `spell-checker.min.js` / `spell-checker.min.css`：CodeMirror 拼写检查插件及样式。
  - `sweetalert.min.js` / `sweetalert.css`：弹窗提示库。
  - `github-markdown.css`：GitHub 风格 Markdown 渲染样式。
  - `base16-light.css`、`default.css`、`material-icons.css` 等：编辑器主题和图标样式。

- `emoji/`：
  - 存放大量 PNG 格式的 Emoji 图片，配合 `emojify.js` 来渲染 `:emoji_name:` 语法。
  - 二次开发时如果想支持更多 Emoji 集合，可以考虑替换或扩展此目录。

- `favicon.png`：
  - 浏览器标签页图标。

- `README.md`：
  - 原始项目的说明文档，包含基础使用介绍和快捷键说明。

- `AGENTS.md`：
  - 针对本地开发环境的说明和自动代理（你现在看到的这份）——对实际运行功能没有影响，但约束本地协作规范。

## 运行与开发方式（当前形态）

- 这是一个纯前端项目，不依赖后端服务：
  - 直接用浏览器打开 `index.html` 即可使用（生产环境可以直接挂在任意静态资源服务器上）。
- 依赖的第三方库和资源都在仓库中，方便离线使用和二次开发。
- 没有打包/构建脚本，当前形态更像是“单页静态应用 + 纯原生 JS”。

## 典型用户交互流程

1. 打开 `index.html`，页面加载后自动初始化编辑器和预览区。
2. 在左侧 CodeMirror 中编写或粘贴 Markdown 文本。
3. 右侧预览区实时渲染 Markdown（包括高亮、Emoji 等）。
4. 需要保存：
   - 直接按 `Ctrl+S`：保存到浏览器 LocalStorage。
   - 按 `Shift+Ctrl+S`：弹出菜单，选择导出 Markdown 或导出 HTML。
5. 需要分享：点击导航栏中的 “Share” 按钮，生成带有内容 hash 的 URL。
6. 下次访问页面时，如果 URL 带有 hash 或浏览器中已存在 LocalStorage 数据，会自动加载对应内容。

## 二次开发建议与改造方向

从当前结构来看，适合二次开发的方向包括（仅列举思路，具体设计可在后续文档中展开）：

- 功能扩展：
  - 增加更多 Markdown 插件（如 TOC、表格增强、任务列表扩展、自定义容器等）。
  - 增强公式支持（从当前的 `<equation>` + 图片，升级为 KaTeX/MathJax 等客户端渲染）。
  - 支持图片粘贴上传的占位符逻辑（后续可接入后端存储）。
- 编辑体验优化：
  - 增加常用格式按钮（工具栏式），方便非快捷键用户。
  - 增加多标签/多文档管理能力。
  - 增加草稿版本管理（基于 LocalStorage 或后端）。
- 工程化改造：
  - 引入模块化构建工具（如 Vite / Webpack / Rollup），将零散的脚本和样式拆分为模块。
  - 用现代框架（如 React/Vue/Svelte）封装 UI，保留现有渲染内核（CodeMirror + markdown-it）。
- 本地化和配置化：
  - 对 UI 文案进行中文本地化。
  - 将一些配置（是否自动保存、默认夜间模式等）抽成可配置项。

## 后续文档规划建议

为了更好地支持你对仓库进行二次开发，建议后续增加：

- `docs/design-YYYY-MM-DD.md`：
  - 按你平时习惯，在 `doc` 或 `docs` 目录中用日期命名的设计文档，记录每一阶段的改造方案和思路。
- `docs/feature-roadmap.md`：
  - 规划要做的功能列表与优先级，结合你的实际使用场景来排期。
- `docs/architecture-notes.md`：
  - 随着项目演化，记录架构上的决策点和演进过程，方便以后自己或其他同事接手时快速上手。

> 这份文档的目标是：让二次开发时可以快速知道“代码长啥样、玩啥库、从哪儿下手改”，后续有新的理解和设计，可以继续在 `docs/` 目录下补充更细致的模块设计文档。

# LinkDict

[![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22link-dict%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugins-stats.json)](https://obsidian.md/plugins?id=link-dict)
[![GitHub release](https://img.shields.io/github/v/release/Ongiei/obsidian-link-dict?include_prereleases)](https://github.com/Ongiei/obsidian-link-dict/releases)
[![License](https://img.shields.io/github/license/Ongiei/obsidian-link-dict)](LICENSE)

基于有道词典 API 的 Obsidian 词汇学习插件，支持词形还原（Lemma）自动识别。

## 功能特性

- **在线查词** - 使用有道词典 API 查询单词，获取音标、释义、变形、例句等完整信息
- **词形还原** - 自动识别变形词（如 `running` → `run`），查询原形释义
- **双链生成** - 查词后自动将选中词替换为指向原形的双向链接 `[[run|running]]`
- **悬浮查词** - 选中文本后右键菜单快速查看释义，无需创建笔记
- **侧边栏词典** - 独立的词典侧边栏视图，方便持续查词学习
- **Markdown 笔记** - 生成的词汇笔记包含 YAML frontmatter，支持标签和别名

## 安装

### 方法一：社区插件市场（推荐）

1. 打开 Obsidian 设置 → 第三方插件
2. 关闭"安全模式"
3. 点击"浏览"搜索 "LinkDict"
4. 安装并启用

### 方法二：BRAT

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 在 BRAT 设置中添加仓库：`Ongiei/obsidian-link-dict`
3. 启用插件

### 方法三：手动安装

1. 从 [Releases](https://github.com/Ongiei/obsidian-link-dict/releases) 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `.obsidian/plugins/link-dict/` 目录

## 使用方法

### 快速查词

1. 在编辑器中选中单词
2. 右键菜单选择 **Look up selection** 或使用命令面板执行 **Look up selection**
3. 在弹出的悬浮窗口中查看释义、音标、变形等信息

### 创建词汇笔记

1. 选中单词
2. 右键菜单选择 **Create lemma note** 或使用命令面板执行 **Create lemma note**
3. 插件将自动：
   - 查询单词原形
   - 生成 Markdown 笔记
   - 将选中词替换为双链 `[[lemma|original]]`

### 侧边栏词典

点击左侧功能栏的书籍图标，或在命令面板执行 **Open dictionary view** 打开侧边栏词典视图。

### 生成的笔记示例

```markdown
---
tags:
  - vocabulary
  - exam/CET4
  - exam/CET6
  - pos/v
aliases:
  - running
  - ran
  - runs
---

# run

## 发音

- 英: `/rʌn/`
- 美: `/rʌn/`

## 释义

- ***vi.*** 跑，奔跑；运转
- ***vt.*** 管理，经营；运行
- ***n.*** 跑步；运行

## 例句

- He runs every morning.
  - 他每天早上跑步。

## 变形

- 过去式: ran
- 过去分词: run
- 现在分词: running
- 第三人称单数: runs
```

## 配置选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| Word storage folder | 词汇笔记存储目录 | `LinkDict` |
| Save exam tags | 保存考试标签到 frontmatter | 开启 |
| Show web translations | 显示网络释义 | 开启 |
| Show bilingual examples | 显示双语例句 | 开启 |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（监听文件变化）
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint
```

## 版本说明

| 版本 | 说明 |
|------|------|
| v2.0.0+ | 使用有道在线 API，数据全面及时，需网络连接 |
| v1.0.x | 基于 ECDICT 本地数据，完全离线使用 |

## 致谢

- [有道词典](https://dict.youdao.com/) - 词典数据来源
- [wink-lemmatizer](https://github.com/winkjs/wink-lemmatizer) - 词形还原
- [Obsidian](https://obsidian.md/) - 知识管理平台

## License

[0-BSD](LICENSE)
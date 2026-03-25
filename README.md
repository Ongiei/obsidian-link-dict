# LinkDict

[![GitHub release](https://img.shields.io/github/v/release/Ongiei/obsidian-link-dict)](https://github.com/Ongiei/obsidian-link-dict/releases)
[![License](https://img.shields.io/github/license/Ongiei/obsidian-link-dict)](LICENSE)

基于有道词典 API 的 Obsidian 词汇学习插件，支持词形还原、欧路词典同步。

## 功能

- **欧路生词本同步** - 本地与云端双向同步，支持多生词本
- **Lemma 双链** - `running` → `[[run|running]]`，自动还原词形
- **在线查词** - 有道词典 API，含音标、释义、例句
- **批量更新** - 更新欧路同步的简略释义

## 安装

### BRAT（推荐）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. 添加仓库：`Ongiei/obsidian-link-dict`
3. 启用插件

### 手动

1. 从 [Releases](https://github.com/Ongiei/obsidian-link-dict/releases/latest) 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `.obsidian/plugins/link-dict/`
3. 重启 Obsidian 并启用插件

## 使用

### 查词

选中单词 → 右键菜单 **Look up selection**

### 创建笔记

选中单词 → 右键菜单 **Create lemma note**

### 欧路同步

1. 获取 API Token（欧路账户 → 个人设置 → API）
2. 插件设置中配置 Token
3. 选择生词本，启用同步

### 自动双链

命令面板 → **Auto-link words in current document**

## 命令

| 命令 | 功能 |
|------|------|
| Open dictionary view | 打开词典侧边栏 |
| Create lemma note | 创建词元笔记 |
| Look up selection | 查询选中词 |
| Auto-link words in current document | 自动双链 |
| Sync with eudic now | 欧路同步 |
| Batch update missing definitions | 批量更新释义 |

## 笔记示例

```markdown
---
tags: [vocabulary, exam/CET4, pos/v]
aliases: [running, ran, runs]
dict_source: youdao
---

# run

## Pronunciation

- UK: `/rʌn/`
- US: `/rʌn/`

## Definitions

- ***vi.*** 跑，奔跑；运转
- ***vt.*** 管理，经营；运行
- ***n.*** 跑步；运行

## Examples

- He runs every morning.
  - 他每天早上跑步。

## Word forms

- 过去式: ran
- 过去分词: run
- 现在分词: running
```

## 开发

```bash
npm install
npm run dev      # 开发
npm run build    # 构建
npm run lint     # 检查
```

## 致谢

- [有道词典](https://dict.youdao.com/)
- [欧路词典](https://my.eudic.net/)
- [wink-lemmatizer](https://github.com/winkjs/wink-lemmatizer)

## License

[0-BSD](LICENSE)
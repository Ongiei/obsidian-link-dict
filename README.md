# LinkDict

[![GitHub release](https://img.shields.io/github/v/release/Ongiei/obsidian-link-dict?include_prereleases)](https://github.com/Ongiei/obsidian-link-dict/releases)
[![License](https://img.shields.io/github/license/Ongiei/obsidian-link-dict)](LICENSE)
[![Vibecoding](https://img.shields.io/badge/Vibecoding-100%25-blueviolet)](https://github.com/Ongiei/obsidian-link-dict)

基于有道词典 API 的 Obsidian 词汇学习插件，支持词形还原（Lemma）自动识别，欧路词典双向同步。

> **⚡ 此项目 100% 由 Vibecoding 完成**

## 核心功能

### 🔄 欧路生词本双向同步
- **双向同步** - Obsidian 本地词库与欧路云端生词本实时同步
- **多生词本支持** - 支持选择多个欧路生词本分类进行同步
- **智能冲突处理** - 自动检测本地新增、云端新增、双方删除等情况
- **同步状态追踪** - 持久化同步状态，避免重复同步

### 🔗 Lemma 本地双链
- **词形还原** - 自动识别变形词（`running` → `run`，`children` → `child`）
- **智能双链** - 自动将文档中的单词转为指向原形的双链 `[[run|running]]`
- **首次出现优先** - 可选仅链接每个单词的首次出现，保持文档整洁
- **本地词库匹配** - 基于本地已创建的词汇笔记自动匹配

### 📖 在线词典查询
- **有道词典 API** - 获取音标、释义、变形、例句等完整信息
- **悬浮查词** - 选中文本后右键菜单快速查看释义
- **侧边栏词典** - 独立的词典侧边栏视图
- **Markdown 笔记** - 生成的笔记包含 YAML frontmatter、标签和别名

### 📦 批量更新
- **一键更新** - 批量更新所有从欧路同步的简略释义
- **API 节流** - 分批处理，防止接口封禁
- **Protocol URI** - 点击笔记中的链接即可更新单词详情

## 安装

> ⚠️ **注意**：此插件尚未上架 Obsidian 官方应用市场。

### 方法一：BRAT（推荐）

1. 安装 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件
2. 在 BRAT 设置中点击 "Add Beta plugin"
3. 输入仓库地址：`Ongiei/obsidian-link-dict`
4. 启用 LinkDict 插件

### 方法二：手动安装

1. 从 [Releases](https://github.com/Ongiei/obsidian-link-dict/releases/latest) 下载最新版本的 `main.js`、`manifest.json`、`styles.css`
2. 在 Obsidian 库中创建目录：`.obsidian/plugins/link-dict/`
3. 将下载的文件放入该目录
4. 重启 Obsidian，在设置中启用 LinkDict 插件

## 使用方法

### 快速查词

1. 在编辑器中选中单词
2. 右键菜单选择 **Look up selection** 或使用命令面板执行
3. 在弹出的悬浮窗口中查看释义、音标、变形等信息

### 创建词汇笔记

1. 选中单词
2. 右键菜单选择 **Create lemma note**
3. 插件将自动：
   - 查询单词原形
   - 生成 Markdown 笔记
   - 将选中词替换为双链 `[[lemma|original]]`

### 欧路词典同步

1. 获取欧路词典 API Token（登录欧路账户 → 个人设置 → API）
2. 在插件设置中配置 Token
3. 选择要同步的生词本分类
4. 启用同步功能，点击同步图标开始

### 自动双链

1. 打开任意 Markdown 文档
2. 执行命令 **Auto-link words in current document**
3. 文档中所有本地词库存在的单词将自动转为双链

## 生成的笔记示例

```markdown
---
tags:
  - vocabulary
  - exam/CET4
  - pos/v
aliases:
  - running
  - ran
  - runs
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

## Web translations

- **run**: 1. 跑 2. 运行 3. 运转

## Examples

- He runs every morning.
  - 他每天早上跑步。

## Word forms

- 过去式: ran
- 过去分词: run
- 现在分词: running
- 第三人称单数: runs
```

## 命令列表

| 命令 | 说明 |
|------|------|
| Open dictionary view | 打开词典侧边栏 |
| Create lemma note | 创建词元笔记 |
| Look up selection | 查询选中内容 |
| Auto-link words in current document | 自动链接当前文档 |
| Sync with eudic now | 立即与欧路同步 |
| Batch update missing definitions | 批量更新缺失释义 |

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
| v3.0.x | 欧路词典双向同步、Lemma 智能双链、批量更新、多生词本支持 |
| v2.0.x | 使用有道在线 API，数据全面及时，需网络连接 |
| v1.0.x | 基于 ECDICT 本地数据，完全离线使用 |

## 致谢

- [有道词典](https://dict.youdao.com/) - 词典数据来源
- [欧路词典](https://my.eudic.net/) - 云端生词本同步
- [wink-lemmatizer](https://github.com/winkjs/wink-lemmatizer) - 词形还原
- [Obsidian](https://obsidian.md/) - 知识管理平台

## License

[0-BSD](LICENSE)
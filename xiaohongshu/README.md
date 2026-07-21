# xiaohongshu — 小红书

读类命令（`search` / `feed` / `note` 等）跑在 `www.xiaohongshu.com`。  
**长文草稿**命令跑在创作者平台 `creator.xiaohongshu.com`。

## draft-create

将本地 Markdown **渲染为富文本** 写入创作者 **长文草稿**（浏览器本地 IndexedDB），并上传文中图片；视频尽量上传（长文编辑器可能无内嵌视频节点，需在 UI 手动插入）。

```bash
# 在 bb-browser 控制的 Chrome 登录创作者平台
bb-browser open "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article"

bb-browser site xiaohongshu/draft-create ./draft.md --json
```

### 重要限制

| 项 | 说明 |
|----|------|
| 存储 | 草稿在**当前浏览器本地**，清除站点数据会删除 |
| Markdown | 平台不支持 md 源码，adapter 会先渲染再写入编辑器 |
| 标题 | 最多 **64** 字 |
| 不自动发布 | 只写草稿，请在编辑器人工检查后发布 |
| 视频 | 可上传到平台；长文 TipTap 可能不支持正文内嵌，见 `warnings` |

### 参数

| 参数 | 说明 |
|------|------|
| `markdown` | 正文或 `.md` 路径 |
| `--title` | 默认取 md 一级标题 |

### 返回

| 字段 | 说明 |
|------|------|
| `editUrl` | 写长文页 |
| `draftId` | IndexedDB 草稿 id（若可读） |
| `manageHint` | 草稿箱入口说明 |
| `uploadedImages` / `uploadedVideos` | 上传统计 |

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 主命令 |
| `_helper.js` | 登录、webpack 上传、md→doc、TipTap 写入 |

# tiktok — TikTok Studio

## draft-create

上传**本地视频**到 [TikTok Studio](https://www.tiktok.com/tiktokstudio/upload) 并填写元数据。

### 无独立草稿 URL

TikTok Studio **没有**类似抖音「未发布草稿箱」的可分享地址。本 adapter：

1. 上传视频
2. 填写「视频描述」（title + desc + `#tags` 合成 caption）
3. **停留在当前编辑页**，**绝不**自动点「发布」

请在返回的 `editUrl`（通常就是上传编辑页 URL）上人工检查后再发布。关闭标签页可能导致未发布内容丢失。

```bash
bb-browser open "https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video"

bb-browser site tiktok/draft-create \
  --video "./distribution.mp4" \
  --config '{"title":"标题","tags":["算法","教程"],"desc":"简介"}' \
  --json
```

### 参数

| 参数 | 说明 |
|------|------|
| `--video` | 本地视频路径（必填） |
| `--config` | JSON `{title,tags,desc}` |
| `--configFile` | JSON 文件路径 |

零散 `--title` / `--tags` / `--desc` 已移除（config-first）。

### 字段映射

| config | 页面 |
|--------|------|
| `title` + `desc` + `tags` | 合并写入「视频描述」caption（Draft.js，上限约 4000 字） |
| `tags` | 以 `#tag` 形式追加到 caption 末尾 |

### 注意

- 需登录 **www.tiktok.com** 的 TikTok Studio
- 大视频由 daemon 注入 Blob
- 若页面已有未完成投稿，adapter 会尝试「放弃」后再上传
- **绝不**自动点「发布」

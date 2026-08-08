# youtube — YouTube / YouTube Studio

读类命令使用 `www.youtube.com`。  
**视频草稿** `youtube/draft-create` 使用 `studio.youtube.com`。

## draft-create

上传**本地视频**到 YouTube Studio 并 **保存为草稿**（不自动公开发布）。

**多语言建议**：上传 **无硬字幕（unsub）** 视频，再附带 **软字幕文件**（`.srt` 优先）。YouTube 支持观众在客户端切换字幕轨。

```bash
bb-browser open "https://studio.youtube.com/channel/<CHANNEL_ID>/videos/upload"

# 英文：无硬字幕视频 + 英文字幕
bb-browser site youtube/draft-create \
  --video "./distribution.unsub.en.mp4" \
  --subtitle "./distribution.en.srt" \
  --captionLanguage en \
  --configFile "./draft-publish.config.json" \
  --json

# 中文
bb-browser site youtube/draft-create \
  --video "./distribution.unsub.zh.mp4" \
  --subtitle "./distribution.zh.srt" \
  --captionLanguage zh \
  --config '{"title":"标题","tags":["教程"],"desc":"简介"}' \
  --json
```

投稿 / 草稿入口（示例频道）：

`https://studio.youtube.com/channel/UCa3kfc7uhu-A9RmqHGMfrKQ/videos/upload`

### 参数

| 参数 | 说明 |
|------|------|
| `--video` | 本地视频路径（必填；建议 unsub 无硬字幕） |
| `--config` / `--configFile` | JSON `{title,tags,desc[,captions,subtitle,captionLanguage]}` |
| `--subtitle` | 本地字幕路径（`.srt` / `.vtt` / `.sbv` 等） |
| `--captionLanguage` | 字幕语言：`en` / `zh` / `zh-Hans`（默认 `en`） |

也可在 config 中写：

```json
{
  "title": "Title",
  "tags": ["tag"],
  "desc": "Description",
  "subtitle": "../distribution.en.srt",
  "captionLanguage": "en"
}
```

或：

```json
{
  "captions": [
    { "language": "en", "path": "../distribution.en.srt" }
  ]
}
```

### 固定表单项

| 字段 | 值 |
|------|-----|
| 观众 | 内容不是面向儿童的 |
| 视频语言 | 有字幕时按字幕语言设置；无字幕时不强制 |

### 流程

1. 打开频道「内容 / 上传」页  
2. 创建 → 上传视频（Blob 注入）  
3. 填写标题 / 简介 / 标签  
4. 尝试在 DETAILS 上传软字幕；保存草稿  
5. 若 DETAILS 未成功且有 `videoId`，再尝试 SPA 进入字幕页补传  

### 注意

- 需登录 **YouTube Studio**（Google 账号）  
- 大视频由 daemon 注入 Blob；字幕文件较小，由 daemon 以 base64 注入 `args.captions`（保存后跳转不丢）  
- 只点「保存」，不点「公开发布」  
- Polymer shadow DOM 结构变化时可能需更新选择器  
- 自动字幕上传失败时，结果里会有 `translationsUrl` / `warnings`，可手动补传  

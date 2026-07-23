# youtube — YouTube / YouTube Studio

读类命令使用 `www.youtube.com`。  
**视频草稿** `youtube/draft-create` 使用 `studio.youtube.com`。

## draft-create

上传**本地视频**到 YouTube Studio 并 **保存为草稿**（不自动公开发布）。

```bash
bb-browser open "https://studio.youtube.com/channel/<CHANNEL_ID>/videos/upload"

bb-browser site youtube/draft-create \
  --video "./distribution.mp4" \
  --config '{"title":"标题","tags":["教程","算法"],"desc":"简介"}' \
  --json
```

### 参数

| 参数 | 说明 |
|------|------|
| `--video` | 本地视频路径（必填） |
| `--config` | JSON 内容 `{title,tags,desc}` |
| `--configFile` | 本地 JSON 路径 |
| `--title` / `--tags` / `--desc` | 覆盖 config |

### 固定表单项

| 字段 | 值 |
|------|-----|
| 观众 | 内容不是面向儿童的 |
| 字幕 / 语言 | 英语 |

### 流程

1. 打开频道「内容 / 上传」页  
2. 创建 → 上传视频  
3. 挂载本地文件 → 填写详情 → 保存草稿  

### 注意

- 需登录 **YouTube Studio**（Google 账号）  
- 大视频由 daemon 注入 Blob，adapter 写入 `Filedata`  
- 只点「保存」，不点「发布」  
- Polymer shadow DOM 结构变化时可能需更新选择器  

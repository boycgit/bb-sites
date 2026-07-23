# douyin — 抖音创作者中心

## draft-create

上传**本地视频**到 [抖音创作者中心](https://creator.douyin.com) 并保存为**未发布草稿**（不自动发布）。

### 单草稿模型

平台仅保留 **一条** 未发布草稿。再次进入上传页会提示：

> 你还有上次未发布的视频，是否继续编辑？

本 adapter **默认点「放弃」** 后上传新视频，以保证本次 config 生效。

```bash
bb-browser open "https://creator.douyin.com/creator-micro/content/upload"

bb-browser site douyin/draft-create \
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
| `--title` / `--tags` / `--desc` | 覆盖 config |

### 固定表单项

| 字段 | 值 |
|------|-----|
| 自主声明 | 内容为个人观点或见解 |

### 注意

- 需登录 **creator.douyin.com**（与手机抖音 App 登录态可能需扫码同步）
- 大视频由 daemon 注入 Blob
- **绝不**自动点「发布」
- 标题/描述常合并为一个作品描述框；标签以 `#话题` 形式写入

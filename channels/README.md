# channels — 微信视频号助手

## draft-create

上传**本地视频**到 [视频号助手](https://channels.weixin.qq.com) 并保存为**草稿**（不自动发表）。

> 与公众号素材 `weixin/video-draft-create`（mp.weixin type=15）**不是同一产品**。

```bash
bb-browser open "https://channels.weixin.qq.com/platform/post/create"

bb-browser site channels/draft-create \
  --video "./distribution.mp4" \
  --config '{"title":"短标题","tags":["算法","可视化"],"desc":"简介"}' \
  --json
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--video` | 是 | 本地视频路径 |
| `--config` | 否 | JSON 内容：`title` / `tags` / `desc` |
| `--configFile` | 否 | JSON 文件路径 |
| `--title` / `--tags` / `--desc` | 否 | 覆盖 config |

### 字段映射

| config | 页面 |
|--------|------|
| `title` | 短标题（约 16 字内） |
| `desc` | 视频描述 |
| `tags` | 拼入描述的 `#话题` |

### 固定表单项

| 项 | 值 |
|----|-----|
| 位置 | 杭州 / 杭州市 |
| 添加到合集 | 算法可视化 |
| 链接 | 公众号文章 |
| 视频标注 | 个人观点，仅供参考 |

### 入口

| 用途 | URL |
|------|-----|
| 投稿 | https://channels.weixin.qq.com/platform/post/create |
| 草稿箱 | https://channels.weixin.qq.com/platform/post/draftListManager |

### 注意

- 需登录**视频号助手**（与公众号 mp 后台登录态可能不同）
- 页面为 wujie 微前端；大视频由 daemon 注入 Blob 再挂到 iframe
- 只点「保存草稿」，不点「发表」
- 上传+处理可能接近 2 分钟

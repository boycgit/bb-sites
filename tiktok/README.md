# tiktok — TikTok Studio

## draft-create

上传**本地视频**到 [TikTok Studio](https://www.tiktok.com/tiktokstudio/upload) 并填写元数据。

### 未发布编辑页链接

TikTok Studio **没有**类似抖音「未发布草稿箱」的可分享地址。本 adapter：

1. 上传视频
2. 填写「视频描述」（title + desc + `#tags` 合成 caption）
3. **停留在当前编辑页**，**绝不**自动点「发布」

成功结果会同时返回 `draftUrl` 和 `editUrl`（当前未发布编辑页的定位别名），请回到并保留该标签页人工检查、二次编辑后再发布；链接不保证关闭标签页后仍能恢复内容。还会返回 `manageUrl`，但该页面只展示已发布/预约内容，不是草稿箱。

成功判定要求页面出现真实「已上传」，并且视频描述已写入。分片上传接口返回成功但页面显示「出错了，请重试」时，adapter 会返回失败，不会生成假草稿结果。

```bash
bb-browser open "https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video"

bb-browser site tiktok/draft-create \
  --config '{"video":"./distribution.mp4","title":"标题","tags":["算法","教程"],"desc":"简介"}' \
  --json
```

### 参数

| 参数 | 说明 |
|------|------|
| `--config` | JSON `{video,title,tags,desc}`，与 `--configFile` 二选一 |
| `--configFile` | JSON 文件路径 |

零散 `--video` / `--title` / `--tags` / `--desc` 已移除（config-only）。

### 字段映射

| config | 页面 |
|--------|------|
| `video` | 本地视频路径；CLI 解析后注入页面文件控件 |
| `title` + `desc` + `tags` | 合并写入「视频描述」caption（Draft.js，上限约 4000 字） |
| `tags` | 以 `#tag` 形式追加到 caption 末尾 |

### 注意

- 需登录 **www.tiktok.com** 的 TikTok Studio
- 大视频由 CLI 解析 config.video，daemon 优先通过 CDP `setFileInputFiles` 注入（Blob 仅作回退）
- 若页面已有未完成投稿，adapter 会尝试「放弃」后再上传
- **绝不**自动点「发布」

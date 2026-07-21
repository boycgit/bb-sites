# zhihu — 知乎

## draft-create

将本地 Markdown **整篇**写入知乎专栏草稿（`zhuanlan.zhihu.com`），并上传文中图片。

```bash
# 需在 bb-browser 控制的 Chrome 登录知乎
bb-browser site zhihu/draft-create ./draft.md --json
```

打开返回的 `editUrl` 预览后，在知乎后台人工发布。

### 参数

| 参数 | 说明 |
|------|------|
| `markdown` | 正文或 `.md` 路径 |
| `--title` | 默认 md 一级标题 |
| `--draftId` | 更新已有草稿 |

### 媒体

- 图片：`![说明](./a.png)` 自动上传
- 本地视频：当前写入占位说明，需在编辑器手动插视频（见 `warnings`）

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 主命令 |
| `_helper.js` | 登录、传图、建/改草稿、MD→HTML |

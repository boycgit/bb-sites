# twitter / X

## draft-create

将本地 Markdown **浓缩为一条未发送草稿**（标题 + 摘要 + 链接），并把图片/视频上传到 X。  
**不立刻发帖**；在 https://x.com/compose/post → Drafts 预览后手动发布。

```bash
# 需在 bb-browser 控制的 Chrome 登录 x.com
bb-browser site twitter/draft-create ./draft.md \
  --title "标题" \
  --digest "摘要" \
  --link "https://example.com/full-article" \
  --json
```

### 参数

| 参数 | 说明 |
|------|------|
| `markdown` | 正文或本地 `.md` 路径（CLI 可展开） |
| `--title` | 默认取 md 首个 `# 标题` |
| `--digest` | 默认取 md 首段 |
| `--link` | 全文链接（强烈建议） |
| `--images` | 本地图/URL，逗号分隔；或写在 md `![alt](path)` |
| `--videos` | 本地视频（≤3MB）或 https |
| `--prefer` | `image`（默认）或 `video`（不与图混用） |
| `--maxLength` | 默认 280 |

### 图片 alt-text

Markdown 写法：

```markdown
![格子高亮社交圈并排除冲突数字的约束检查过程](./steps/5/screenshot.png)
```

`![]()` 中的说明文字会写入 X 图片的 **alt-text**（无障碍，最长 1000 字）。结果 JSON 中有 `mediaAlts`。

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 主命令 |
| `_helper.js` | 登录头、媒体上传、alt-text、CreateDraftTweet |

### 注意

- 最多 4 图 **或** 1 视频
- 需 `ct0` Cookie + transaction-id（页面内自动处理）
- 与 `weixin/draft-create` 可共用同一篇 md，X 侧用短文 + 链回全文

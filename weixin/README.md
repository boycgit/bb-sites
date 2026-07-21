# weixin — 微信公众号

## draft-create（图文草稿）

将本地 Markdown（可含本地/远程图片）上传到 **已登录** 的微信公众平台**图文**草稿箱。

```bash
# 浏览器需已登录 https://mp.weixin.qq.com（bb-browser 控制的 Chrome）
bb-browser site weixin/draft-create ./article.md \
  --title "文章标题" \
  --author "作者" \
  --digest "摘要" \
  --cover ./cover.jpg \
  --json
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| markdown | 是 | Markdown 正文；也可传本地 `.md` 路径（需较新 CLI 自动展开） |
| title | 是 | 标题 |
| author | 否 | 作者 |
| digest | 否 | 摘要 |
| cover | 否 | 封面本地路径（CLI 预处理为 coverBase64）或 URL |
| images / coverBase64 | 否 | 一般由 CLI 自动填充 |

## video-draft-create（视频素材草稿 type=15）

上传**本地视频**到公众号后台「素材库 → 视频」（`videomsg_edit` / `list_video`，type=15），并**保存**（不点「保存并发表」）。

> 这是公众号后台的**视频素材**，不是独立站点 `channels.weixin.qq.com` 视频号助手。审核通过后素材可再导入视频号。

```bash
bb-browser open "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&lang=zh_CN"

bb-browser site weixin/video-draft-create \
  --video "./distribution.mp4" \
  --config '{"title":"标题","tags":["教程","算法"],"desc":"简介"}' \
  --json

# 或配置文件
bb-browser site weixin/video-draft-create \
  --video "./distribution.mp4" \
  --configFile ./config.json \
  --json
```

### 参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `--video` | 是 | 本地视频路径（daemon 用 CDP `setFileInputFiles` 挂载，支持约数十 MB） |
| `--config` | 否 | JSON **内容**字符串：`title` / `tags` / `desc` |
| `--configFile` | 否 | 本地 JSON 配置文件路径 |
| `--title` / `--tags` / `--desc` | 否 | 覆盖 config 字段 |

### 固定字段

| 项 | 值 |
|----|-----|
| 声明原创 | 始终勾选（`applyori=1`） |
| 我已阅读服务规则 | 始终勾选（`agree=1`，否则无法保存） |
| 发表 | **不**自动「保存并发表」 |

### 配置 JSON

```json
{
  "title": "用K3Studio可视化拆解数独回溯",
  "tags": ["教程", "编程", "算法"],
  "desc": "可选简介，约 300 字内"
}
```

- `title` 最长 64 字（保存后素材标题不可改）
- `tags` 最多 5 个
- `description` 可作为 `desc` 别名

### 入口 URL

| 用途 | URL |
|------|-----|
| 新建 | `.../appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&token=...` |
| 列表 | `.../appmsg?begin=0&count=10&action=list_video&type=15&token=...` |

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 图文草稿 adapter |
| `video-draft-create.js` | 视频素材草稿 adapter |
| `_helper.js` | session / 图文 / 视频上传与保存（`_` 前缀不参与 list） |
| `form-data.json` | 图文表单字段默认值（接口变更时可对照更新） |
| `fixture.md` | 图文联调样例 |

### 注意

- 图文 / 视频 两个 adapter **互不替代**
- 视频只写**素材库视频**，不自动发表/群发
- 大视频禁止整包 base64；由 daemon 挂本地文件到页面上传组件（FtnUploader）
- 上传+保存可能接近 2 分钟；转码审核完成后列表状态才变「已通过」
- 需使用同一 bb-browser 控制的 Chrome 登录态

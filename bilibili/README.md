# bilibili — 哔哩哔哩

读类命令使用 `www.bilibili.com`。  
**视频草稿** `bilibili/draft-create` 使用创作中心 `member.bilibili.com`。

## draft-create

上传**本地视频**到 B 站创作中心并 **保存为草稿**（不自动「立即投稿」）。

```bash
# 登录创作中心
bb-browser open "https://member.bilibili.com/platform/upload/video/frame"

# config 为 JSON 内容；或用 --configFile 指向本地文件
bb-browser site bilibili/draft-create \
  --video "./distribution.mp4" \
  --config '{"title":"标题","tags":["教程","编程"],"desc":"简介"}' \
  --json

bb-browser site bilibili/draft-create \
  --video "./distribution.mp4" \
  --configFile "./bili-config.json" \
  --json
```

### 参数

| 参数 | 说明 |
|------|------|
| `--video` | 本地视频路径（必填；由 daemon 分块注入页面，支持 ~数十 MB） |
| `--config` | **JSON 内容**字符串 `{title,tags,desc}` |
| `--configFile` | 本地 JSON 文件路径（未传 `config` 时使用） |
| `--title` / `--tags` / `--desc` | 覆盖 config 字段 |

### 固定表单项

| 字段 | 值 |
|------|-----|
| 创作声明 | 内容为自制 + 内容无需标注 |
| 分区 | 知识 |
| 其它 | 默认（封面可用平台智能封面，可稍后在草稿里改） |

### 返回

| 字段 | 说明 |
|------|------|
| `draftId` | 草稿 id |
| `draftUrl` | 编辑页 |
| `manageUrl` | 草稿列表 |
| `filename` | 上传后的 upos 文件名 |

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 主命令 |
| `_helper.js` | 登录、UPOS 上传、draft/add |

# weixin — 微信公众号

## draft-create

将本地 Markdown（可含本地/远程图片）上传到 **已登录** 的微信公众平台草稿箱。

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

### 文件

| 文件 | 作用 |
|------|------|
| `draft-create.js` | 主 adapter |
| `_helper.js` | session / 图片上传 / 建草稿 / MD→HTML（`_` 前缀不参与 list） |
| `form-data.json` | 公众号网页表单字段默认值（接口变更时可对照更新） |
| `fixture.md` | 联调样例 |

### 注意

- 只写**草稿箱**，不自动发表/群发
- 依赖网页后台接口（`operate_appmsg` type=77 + `filetransfer` 传图），接口变更需重新抓包
- 远程图若跨域失败会跳过，结果中可能有 `warnings`
- 需使用同一 bb-browser 控制的 Chrome 登录态

# gemini — Gemini 图片

## image-create

在已登录的 [Gemini](https://gemini.google.com/app) 里，用左下角「上传和工具」中的「制作图片」进入图片模式，提交提示词，可选上传参考图，生成后把结果下载到本机。

JSON 配置与 `chatgpt/image-create` 相同。`size`（默认 `3:4`）和 `n`（默认 `1`）会追加进提示词：

```text
${prompt}; 图片尺寸 ${size}；生成 ${n} 张单独的照片供我选择
```

页面上的「宽高比」菜单会同步选中 `1:1`、`9:16`、`3:4`、`4:3`、`16:9`。其他合法比例只写进提示词。张数没有控件。

```bash
bb-browser open "https://gemini.google.com/app"

bb-browser site gemini/image-create \
  --configFile ./gemini-image.config.json \
  --json
```

配置示例：

```json
{
  "prompt": "一只白猫坐在窗边，自然光",
  "size": "3:4",
  "n": 1,
  "image_urls": ["./ref.png"],
  "downloadResult": true,
  "targetDir": "./out"
}
```

`prompt` 必填。`image_urls` 支持本地路径、`http(s)` 和 base64。参考图通过「上传和工具」里的「上传文件」加入；没有预览时改为 Ctrl+V 贴进输入框。`downloadResult` 默认 `true`。`targetDir` 可选，相对路径相对于 config 文件所在目录；目录不存在会新建。不填则下载到 `$BB_BROWSER_HOME/downloads/gemini/<时间戳>/`。

用法说明见 bb-browser 仓库 `docs/gemini-image-create.zh-CN.md`。

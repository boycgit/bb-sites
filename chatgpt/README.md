# chatgpt — ChatGPT 图片

## image-create

在已登录的 [ChatGPT 图片页](https://chatgpt.com/images) 提交提示词，可选上传参考图，生成后把结果下载到本机。

图片页没有比例和张数控件。`size`（默认 `3:4`）和 `n`（默认 `1`）会追加进提示词：

```text
${prompt}; 图片尺寸 ${size}；生成 ${n} 张单独的照片供我选择
```

```bash
bb-browser open "https://chatgpt.com/images"

bb-browser site chatgpt/image-create \
  --configFile ./chatgpt-image.config.json \
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

`prompt` 必填。`image_urls` 支持本地路径、`http(s)` 和 base64。`downloadResult` 默认 `true`。`targetDir` 可选，相对路径相对于 config 文件所在目录；目录不存在会新建。不填则下载到 `$BB_BROWSER_HOME/downloads/chatgpt/<时间戳>/`。

用法说明见 bb-browser 仓库 `docs/chatgpt-image-create.zh-CN.md`。

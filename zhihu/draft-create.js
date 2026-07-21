/* @meta
{
  "name": "zhihu/draft-create",
  "description": "将 Markdown 整篇上传为知乎专栏草稿（含图片；视频暂以链接/提示处理）",
  "domain": "zhuanlan.zhihu.com",
  "args": {
    "markdown": { "required": true, "description": "Markdown 正文或本地路径（CLI 展开）" },
    "title": { "required": false, "description": "标题，默认取 md 一级标题" },
    "draftId": { "required": false, "description": "已有草稿 id，传入则更新" },
    "images": { "required": false, "description": "JSON 本地图 [{id,name,mime,base64,alt,original}]" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site zhihu/draft-create ./draft.md --json"
}
*/
async function (args) {
  if (!args.markdown) {
    return { error: "Missing argument: markdown", hint: "Pass markdown text or a local .md file path" };
  }

  const login = await zhihuEnsureLogin();
  if (login.error) return login;

  let markdown = String(args.markdown).replace(/^\uFEFF/, "");
  const title = zhihuExtractTitle(markdown, args.title);
  const warnings = [];

  let images = [];
  try {
    images = args.images ? JSON.parse(args.images) : [];
  } catch {
    return { error: "Invalid images JSON" };
  }

  // Map placeholder id / original path → uploaded img HTML
  const urlMap = {};
  let uploadedImages = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const up = await zhihuUploadImage({
      base64: img.base64,
      mime: img.mime || "image/png",
      name: img.name || ("img" + i + ".png"),
      alt: img.alt || "",
    });
    if (up.error) {
      warnings.push((img.name || img.original || img.id || "image") + ": " + up.error);
      continue;
    }
    uploadedImages++;
    const html = zhihuImgHtml(up);
    if (img.id) urlMap[img.id] = html;
    if (img.original) urlMap[img.original] = html;
    // CLI rewrites md to ![alt](__IMG_n__) — also match bare placeholder
    if (img.id) {
      urlMap["__PLACEHOLDER_" + img.id] = html;
    }
  }

  // Remote images in markdown
  const remoteRe = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let rm;
  const remoteList = [];
  while ((rm = remoteRe.exec(markdown))) {
    remoteList.push({ alt: rm[1], url: rm[2], full: rm[0] });
  }
  for (let r = 0; r < remoteList.length; r++) {
    const item = remoteList[r];
    if (/zhimg\.com/i.test(item.url)) {
      // already on Zhihu CDN
      urlMap[item.full] = zhihuImgHtml({ src: item.url, alt: item.alt, width: 0, height: 0 });
      continue;
    }
    const up = await zhihuUploadImage({ url: item.url, alt: item.alt, name: "remote.png" });
    if (up.error) {
      warnings.push(item.url + ": " + up.error);
      continue;
    }
    uploadedImages++;
    urlMap[item.full] = zhihuImgHtml(up);
  }

  // Replace ![alt](src) with uploaded HTML (src may be __IMG_n__ or relative path)
  markdown = markdown.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (full, alt, src) {
    src = src.trim().replace(/^<|>$/g, "");
    if (urlMap[src]) return urlMap[src];
    for (const k of Object.keys(urlMap)) {
      if (!k) continue;
      if (src === k || src.endsWith(k) || k.endsWith(src)) return urlMap[k];
    }
    if (!/^https?:\/\//i.test(src)) {
      warnings.push("image not uploaded: " + src);
    }
    return full;
  });

  // Videos: local relative paths cannot play on Zhihu without upload API
  // Convert [text](./video.mp4) and bare ../xxx.mp4 to a note paragraph
  let uploadedVideos = 0;
  markdown = markdown.replace(/\[([^\]]*)\]\(([^)]+\.(mp4|mov|webm)[^)]*)\)/gi, function (full, text, src) {
    if (/^https?:\/\//i.test(src)) {
      return '<p><a href="' + src + '">' + (text || "视频链接") + "</a></p>";
    }
    warnings.push(
      "video not uploaded (local path): " +
        src +
        " — Zhihu video upload needs platform video API; left as text note"
    );
    return (
      "<p><b>【视频占位】</b>" +
      (text || "演示视频") +
      "（本地文件未自动上传：" +
      src +
      "，请在知乎编辑器中手动插入视频）</p>"
    );
  });
  markdown = markdown.replace(/<video[^>]+src=["']([^"']+)["'][^>]*>.*?<\/video>/gi, function (full, src) {
    if (/^https?:\/\//i.test(src)) {
      return '<p><a href="' + src + '">视频</a></p>';
    }
    warnings.push("video tag not uploaded: " + src);
    return (
      "<p><b>【视频占位】</b>请在知乎编辑器中手动插入视频（" + src + "）</p>"
    );
  });

  const content = zhihuMdToHtml(markdown);
  if (!content || content.length < 10) {
    return { error: "Empty content after convert" };
  }

  let result;
  if (args.draftId) {
    result = await zhihuUpdateDraft(args.draftId, title, content);
  } else {
    result = await zhihuCreateDraft(title, content);
  }
  if (result.error) return result;

  const out = {
    draftId: result.draftId,
    title: title,
    editUrl: result.editUrl,
    url: result.url,
    uploadedImages: uploadedImages,
    uploadedVideos: uploadedVideos,
    author: login.name,
  };
  if (warnings.length) out.warnings = warnings;
  return out;
}

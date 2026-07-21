/* @meta
{
  "name": "weixin/draft-create",
  "description": "将 Markdown 图文上传到微信公众号草稿箱（需已登录 mp.weixin.qq.com）",
  "domain": "mp.weixin.qq.com",
  "args": {
    "markdown": { "required": true, "description": "Markdown 正文；CLI 会自动展开本地 .md 文件路径" },
    "title": { "required": true, "description": "标题（建议不超过 32 字）" },
    "author": { "required": false, "description": "作者" },
    "digest": { "required": false, "description": "摘要；不填则可由平台自动抓取" },
    "images": { "required": false, "description": "JSON：本地图片 [{id,name,mime,base64,original}]（CLI 预处理）" },
    "coverBase64": { "required": false, "description": "封面图 base64（CLI 从 --cover 本地路径读入）" },
    "coverMime": { "required": false, "description": "封面 MIME，默认 image/jpeg" },
    "coverUrl": { "required": false, "description": "封面图 URL（微信 CDN 或可转存的远程图）" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site weixin/draft-create ./article.md --title \"标题\" --cover ./cover.jpg"
}
*/
async function (args) {
  if (!args.markdown) {
    return { error: "Missing argument: markdown", hint: "Pass markdown text or a local .md file path" };
  }
  if (!args.title) return { error: "Missing argument: title" };

  var session = await __wxEnsureSession();
  if (session.error) return session;

  var markdown = String(args.markdown);
  var images = [];
  try {
    images = args.images ? JSON.parse(args.images) : [];
  } catch (e) {
    return { error: "Invalid images JSON" };
  }

  var uploaded = 0;
  var coverUrl = args.coverUrl || "";
  var warnings = [];

  if (!coverUrl && args.coverBase64) {
    var cu = await __wxUploadBase64(session, args.coverBase64, args.coverMime || "image/jpeg", "cover.jpg");
    if (cu.error) return cu;
    coverUrl = cu.cdnUrl;
    uploaded++;
  }

  for (var i = 0; i < images.length; i++) {
    var img = images[i];
    var up = await __wxUploadBase64(
      session,
      img.base64,
      img.mime || "image/png",
      img.name || ("img" + i + ".png")
    );
    if (up.error) return Object.assign({ image: img.name || img.id }, up);
    uploaded++;
    var id = img.id || ("__IMG_" + i + "__");
    function escRe(s) {
      return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    markdown = markdown.replace(new RegExp("!\\[[^\\]]*\\]\\(" + escRe(id) + "\\)", "g"), "![](" + up.cdnUrl + ")");
    if (img.original) {
      markdown = markdown.replace(
        new RegExp("!\\[[^\\]]*\\]\\(" + escRe(img.original) + "\\)", "g"),
        "![](" + up.cdnUrl + ")"
      );
    }
    if (!coverUrl) coverUrl = up.cdnUrl;
  }

  var remoteRe = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
  var remotes = [];
  var mm;
  while ((mm = remoteRe.exec(markdown))) remotes.push(mm[1]);
  remotes = remotes.filter(function (u, idx, arr) { return arr.indexOf(u) === idx; });
  for (var r = 0; r < remotes.length; r++) {
    var url = remotes[r];
    if (/mmbiz\.qpic\.cn|qlogo\.cn/.test(url)) continue;
    var ru = await __wxUploadRemote(session, url);
    if (ru.error) {
      warnings.push("skip remote image: " + url + " (" + ru.error + ")");
      continue;
    }
    uploaded++;
    markdown = markdown.split(url).join(ru.cdnUrl);
    if (!coverUrl) coverUrl = ru.cdnUrl;
  }

  var contentHtml = __wxMdToHtml(markdown);
  if (!contentHtml || contentHtml.length < 20) {
    return { error: "Empty content after markdown convert" };
  }

  var created = await __wxCreateDraft(session, {
    title: String(args.title).slice(0, 64),
    author: args.author || session.nick || "",
    digest: args.digest || "",
    contentHtml: contentHtml,
    coverUrl: coverUrl,
    coverUrl11: coverUrl
  });
  if (created.error) return created;

  var out = {
    appmsgid: created.appmsgid,
    title: args.title,
    author: args.author || session.nick || "",
    draftUrl: created.draftUrl,
    coverUrl: coverUrl || null,
    uploadedImages: uploaded
  };
  if (warnings.length) out.warnings = warnings;
  return out;
}

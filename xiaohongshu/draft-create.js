/* @meta
{
  "name": "xiaohongshu/draft-create",
  "description": "将 Markdown 渲染为富文本写入小红书创作者长文草稿（本地 IndexedDB；含图片上传，视频尽量上传）",
  "domain": "creator.xiaohongshu.com",
  "args": {
    "markdown": { "required": true, "description": "Markdown 正文或本地路径（CLI 展开）" },
    "title": { "required": false, "description": "标题，默认 md 一级标题（最多 64 字）" },
    "images": { "required": false, "description": "JSON 本地图 [{id,name,mime,base64,alt,original}]" },
    "videos": { "required": false, "description": "JSON 本地/远程视频 [{id,name,mime,base64,original,skipped}]" },
    "videoSkipNotes": { "required": false, "description": "CLI 跳过视频说明 JSON 字符串数组" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site xiaohongshu/draft-create ./draft.md --json"
}
*/
async function (args) {
  if (!args.markdown) {
    return { error: "Missing argument: markdown", hint: "Pass markdown text or a local .md file path" };
  }

  const login = xhsDraftEnsureLogin();
  if (login.error) return login;

  const warnings = [];
  let skipNotes = [];
  try {
    skipNotes = args.videoSkipNotes ? JSON.parse(args.videoSkipNotes) : [];
  } catch {
    skipNotes = [];
  }
  for (let s = 0; s < skipNotes.length; s++) warnings.push(String(skipNotes[s]));

  let markdown = String(args.markdown).replace(/^\uFEFF/, "");
  let title = xhsDraftExtractTitle(markdown, args.title);
  if (title.length > XHS_TITLE_MAX) {
    warnings.push("title truncated to " + XHS_TITLE_MAX + " chars (platform limit)");
    title = title.slice(0, XHS_TITLE_MAX);
  }

  let images = [];
  let videos = [];
  try {
    images = args.images ? JSON.parse(args.images) : [];
  } catch {
    return { error: "Invalid images JSON" };
  }
  try {
    videos = args.videos ? JSON.parse(args.videos) : [];
  } catch {
    return { error: "Invalid videos JSON" };
  }

  // Ensure 写长文 editor
  const editor = await xhsDraftEnsureArticlePage();
  if (!editor) {
    return {
      error: "Long-article editor not ready",
      hint:
        "Open " +
        XHS_DRAFT_EDIT_URL +
        " and wait for the editor, then retry. Must be logged in.",
    };
  }

  // Upload images
  const imagesMap = {};
  let uploadedImages = 0;
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img.base64) {
      warnings.push((img.name || img.id || "image") + ": missing base64");
      continue;
    }
    const dataUrl = xhsDraftBase64ToDataUrl(img.base64, img.mime || "image/png");
    const up = await xhsDraftUploadImageDataUrl(dataUrl);
    if (up.error) {
      warnings.push((img.name || img.id || "image") + ": " + up.error + (up.hint ? " (" + up.hint + ")" : ""));
      continue;
    }
    // probe natural size
    let w = up.width || 0;
    let h = up.height || 0;
    if (!w || !h) {
      try {
        const dim = await new Promise(function (resolve) {
          const im = new Image();
          im.onload = function () {
            resolve({ w: im.naturalWidth || 800, h: im.naturalHeight || 600 });
          };
          im.onerror = function () {
            resolve({ w: 800, h: 600 });
          };
          im.src = up.previewUrl || up.url;
          setTimeout(function () {
            resolve({ w: 800, h: 600 });
          }, 3000);
        });
        w = dim.w;
        h = dim.h;
      } catch {
        w = 800;
        h = 600;
      }
    }
    // TipTap image node requires `src` (NOT `url`) — renderHTML uses e.src
    const entry = {
      src: up.previewUrl || up.url,
      url: up.previewUrl || up.url,
      previewUrl: up.previewUrl || up.url,
      fileId: up.fileId,
      width: w,
      height: h,
      percent: 100,
      alt: img.alt || "",
    };
    uploadedImages++;
    if (img.id) imagesMap[img.id] = entry;
    if (img.original) imagesMap[img.original] = entry;
  }

  // Remote images still in markdown
  const remoteRe = /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let rm;
  const remotes = [];
  while ((rm = remoteRe.exec(markdown))) {
    remotes.push({ alt: rm[1], url: rm[2], full: rm[0] });
  }
  for (let r = 0; r < remotes.length; r++) {
    const item = remotes[r];
    if (/xhscdn\.com|xiaohongshu\.com/i.test(item.url)) {
      imagesMap[item.full] = {
        src: item.url,
        url: item.url,
        fileId: "",
        width: 800,
        height: 600,
        percent: 100,
        alt: item.alt,
      };
      // rewrite to synthetic id for md parser
      const rid = "__RIMG_" + r + "__";
      markdown = markdown.split(item.full).join("![](" + rid + ")");
      imagesMap[rid] = imagesMap[item.full];
      continue;
    }
    try {
      const fr = await fetch(item.url, { credentials: "omit", mode: "cors" });
      if (!fr.ok) {
        warnings.push(item.url + ": HTTP " + fr.status);
        continue;
      }
      const blob = await fr.blob();
      const up = await xhsDraftUploadBlob(blob, "image");
      if (up.error) {
        warnings.push(item.url + ": " + up.error);
        continue;
      }
      uploadedImages++;
      const rid = "__RIMG_" + r + "__";
      markdown = markdown.split(item.full).join("![](" + rid + ")");
      const remoteSrc = up.previewUrl || up.url;
      imagesMap[rid] = {
        src: remoteSrc,
        url: remoteSrc,
        fileId: up.fileId,
        width: up.width || 800,
        height: up.height || 600,
        percent: 100,
        alt: item.alt,
      };
    } catch (e) {
      warnings.push(item.url + ": " + String(e));
    }
  }

  // Videos
  const videoNotes = {};
  let uploadedVideos = 0;
  for (let v = 0; v < videos.length; v++) {
    const vid = videos[v];
    const id = vid.id || "__VID_" + v + "__";
    if (vid.skipped) {
      videoNotes[id] =
        "【视频未上传：" +
        (vid.original || vid.name || id) +
        " — " +
        vid.skipped +
        "】请在编辑器中手动插入视频";
      warnings.push("video skipped: " + (vid.original || vid.name) + " (" + vid.skipped + ")");
      continue;
    }
    try {
      let blob = null;
      if (vid.base64) {
        blob = xhsDraftBase64ToBlob(vid.base64, vid.mime || "video/mp4");
      } else if (vid.original && /^https?:\/\//i.test(vid.original)) {
        const fr = await fetch(vid.original, { credentials: "omit", mode: "cors" });
        if (!fr.ok) throw new Error("HTTP " + fr.status);
        blob = await fr.blob();
      }
      if (!blob) {
        videoNotes[id] =
          "【视频占位】" + (vid.name || vid.original || "视频") + "（无可用数据，请手动插入）";
        warnings.push("video no data: " + (vid.original || vid.name || id));
        continue;
      }
      const up = await xhsDraftUploadBlob(blob, "video");
      if (up.error) {
        videoNotes[id] =
          "【视频上传失败】" +
          (vid.name || vid.original || "视频") +
          " — 请在编辑器中手动插入视频";
        warnings.push("video upload: " + up.error + (up.hint ? " " + up.hint : ""));
        continue;
      }
      uploadedVideos++;
      // 长文 TipTap 无 video 节点：写入 fileId 说明，便于用户在 UI 侧继续
      videoNotes[id] =
        "【视频已上传到平台 fileId=" +
        (up.fileId || "") +
        "】长文编辑器可能不支持正文内嵌视频，请点工具栏手动插入视频；预览：" +
        (up.previewUrl || up.url || "");
      warnings.push(
        "video uploaded (fileId=" +
          (up.fileId || "") +
          ") but long-article editor has no video node — insert manually in UI"
      );
    } catch (e) {
      videoNotes[id] =
        "【视频占位】" + (vid.name || "视频") + " — " + String(e);
      warnings.push("video error: " + String(e));
    }
  }

  // Also map leftover local image syntax with ids already rewritten by CLI
  // Build doc
  const doc = xhsDraftMdToDoc(markdown, imagesMap, videoNotes);

  // Apply title + content
  xhsDraftSetTitle(title);
  try {
    editor.commands.focus("start");
    const ok = editor.commands.setContent(doc);
    if (!ok) {
      // fallback: plain paragraphs HTML without custom image nodes
      let html = "<p>" + title + "</p>";
      const plain = markdown
        .replace(/^#\s+.+\n+/, "")
        .split("\n")
        .filter(Boolean)
        .map(function (l) {
          return "<p>" + l.replace(/</g, "&lt;").replace(/>/g, "&gt;") + "</p>";
        })
        .join("");
      editor.commands.setContent(html + plain);
      warnings.push("setContent(doc) returned false; used plain HTML fallback");
    }
  } catch (e) {
    return {
      error: "Failed to set editor content",
      hint: String(e && e.message ? e.message : e),
    };
  }

  // Trigger autosave
  xhsDraftSetTitle(title);
  await xhsDraftSleep(2500);

  const draftMeta = await xhsDraftFindLatestDraft(title);
  const out = {
    draftId: (draftMeta && draftMeta.draftId) || null,
    title: title,
    editUrl: XHS_DRAFT_EDIT_URL,
    manageHint: "写长文页右上角「草稿箱」→「长文笔记」tab（草稿仅存本机浏览器，清数据会丢）",
    uploadedImages: uploadedImages,
    uploadedVideos: uploadedVideos,
    author: login.userName || login.userId,
    state: "local_draft",
    hint:
      "草稿保存在当前 bb-browser Chrome 的本地 IndexedDB，不会自动发布。" +
      "请打开 editUrl，必要时从草稿箱进入；图片应已嵌入正文。",
  };
  if (warnings.length) out.warnings = warnings;
  if (!out.draftId) {
    out.warnings = (out.warnings || []).concat([
      "Could not read draftId from IndexedDB yet; open editUrl / 草稿箱 to confirm autosave",
    ]);
  }
  return out;
}

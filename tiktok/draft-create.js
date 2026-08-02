/* @meta
{
  "name": "tiktok/draft-create",
  "description": "上传本地视频到 TikTok Studio 并填写元数据（停留编辑页，不自动发布；无独立草稿 URL）",
  "domain": "www.tiktok.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob）" },
    "config": { "required": false, "description": "JSON 内容：{title,tags,desc}（config-first，已取代零散参数）" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site tiktok/draft-create --video ./a.mp4 --configFile ./draft-publish.config.json --json"
}
*/
async function (args) {
  var session = __ttEnsureSession();
  if (session.error) return session;

  if (!args.config) {
    return {
      error: "Missing config",
      hint: "Pass --config '{\"title\":...}' or --configFile <path> (config-first)",
    };
  }
  var cfg = { title: "", tags: [], desc: "" };
  try {
    var parsed = JSON.parse(args.config);
    if (parsed && typeof parsed === "object") {
      cfg.title = parsed.title || "";
      cfg.desc = parsed.desc || parsed.description || "";
      if (Array.isArray(parsed.tags)) cfg.tags = parsed.tags.map(String);
      else if (typeof parsed.tags === "string") {
        cfg.tags = parsed.tags.split(/[,，]/).map(function (s) {
          return s.trim();
        }).filter(Boolean);
      } else if (typeof parsed.tag === "string") {
        cfg.tags = parsed.tag.split(/[,，]/).map(function (s) {
          return s.trim();
        }).filter(Boolean);
      }
    }
  } catch (e) {
    return { error: "Invalid config JSON", hint: String(e) };
  }

  var title = String(cfg.title || (args.video || "untitled").replace(/\.[^.]+$/, "")).slice(0, 100);
  var tags = (cfg.tags || []).slice(0, 20);
  var desc = String(cfg.desc || "").slice(0, 4000);
  cfg.title = title;
  cfg.tags = tags;
  cfg.desc = desc;

  // Do not full-page navigate after Blob inject
  if (!/tiktok\.com/i.test(location.host)) {
    return {
      error: "Not on tiktok.com",
      hint: 'bb-browser open "' + __TT_UPLOAD_URL + '"',
    };
  }

  var mount = await __ttMountVideo(args);
  if (mount.error) return mount;

  var wait = await __ttWaitEditForm(180000);
  if (wait.error) {
    return {
      error: wait.error,
      hint: wait.hint,
      mount: mount,
    };
  }

  var filled = await __ttFillMetadata(cfg);
  await __ttSleep(400);
  filled = await __ttFillMetadata(cfg);
  await __ttSleep(300);

  // Intentionally do NOT click 发布 / Post / Schedule
  // Verify video really uploaded (not empty form trap)
  var real = __ttIsRealUploadReady();
  var upEl = document.querySelector('[data-e2e="upload_status_container"]');
  var upText = (upEl && (upEl.innerText || upEl.textContent)) || "";

  var out = {
    title: title,
    tags: tags,
    desc: desc,
    caption: filled.caption || null,
    state: "edit",
    editUrl: location.href,
    uploadUrl: __TT_UPLOAD_URL,
    via: "ui",
    uploadElapsedMs: wait.elapsedMs,
    uploaded: !!real.ok,
    uploadStatus: upText.slice(0, 200),
    filled: {
      titleOk: !!filled.titleOk,
      descOk: !!filled.descOk,
      captionOk: !!filled.captionOk,
      editorText: filled.editorText || "",
    },
    mount: { name: mount.name, size: mount.size },
    hint:
      "已上传并填写 TikTok Studio 编辑页；未点发布。平台无独立草稿 URL，请保留当前页人工检查后发布。",
  };

  var warnings = [];
  if (!real.ok) {
    warnings.push(
      "video may not be fully uploaded (missing 已上传 in upload status) — do not publish until status shows 已上传",
    );
  }
  if (!filled.captionOk && !filled.descOk) {
    warnings.push("caption editor may not have been filled — open editUrl and confirm 视频描述");
  }
  if (filled.editorText && title && filled.editorText.indexOf(title.slice(0, 6)) < 0) {
    warnings.push("editor text may not match title; verify caption on edit page");
  }
  if (warnings.length) out.warnings = warnings;

  return out;
}

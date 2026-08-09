/* @meta
{
  "name": "tiktok/draft-create",
  "description": "按 JSON config 上传本地硬字幕视频到 TikTok Studio 未发布编辑页（不自动发布；平台无软字幕轨）",
  "domain": "www.tiktok.com",
  "args": {
    "config": { "required": false, "description": "JSON：{video,title,tags,desc}；video 建议为硬字幕成片（与 configFile 二选一）" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径，内容为 {video,title,tags,desc}" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site tiktok/draft-create --configFile ./draft-publish.config.json --json"
}
*/
async function (args) {
  var session = __ttEnsureSession();
  if (session.error) return session;

  if (!args.config) {
    return {
      error: "Missing config",
      hint: "Pass --config '{\"video\":\"./a.mp4\",\"title\":...}' or --configFile <path>",
    };
  }
  var cfg = { video: "", title: "", tags: [], desc: "" };
  try {
    var parsed = JSON.parse(args.config);
    if (parsed && typeof parsed === "object") {
      cfg.video = parsed.video || "";
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

  // CLI 会把 config.video 解析为注入参数后从 config 中移除，只保留 title/tags/desc；
  // 运行时以 args.video / __localVideoName / CDP 挂载标志为准。
  if (
    !cfg.video &&
    !args.video &&
    !args.__localVideoName &&
    args.__localVideoCdpMounted !== "1" &&
    args.__localVideoReady !== "1"
  ) {
    return {
      error: "Missing config field: video",
      hint:
        'Set "video" to a local hardsub mp4 path in --config / --configFile JSON (e.g. ../distribution.en.mp4)',
    };
  }

  var videoName = String(args.__localVideoName || args.video || cfg.video || "untitled");
  var title = String(cfg.title || videoName.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "")).slice(0, 100);
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

  if (!real.ok) {
    var pe = __ttGetUploadError();
    return {
      error: pe
        ? "TikTok Studio 上传失败：" + pe
        : "TikTok Studio 未达到「已上传」状态",
      hint: pe
        ? __ttUploadErrorHint(pe)
        : "页面未出现 已上传 / Upload complete。请确认在 upload 页、已登录，并使用硬字幕 mp4。",
      uploaded: false,
      uploadStatus: upText.slice(0, 200),
      mount: { name: mount.name, size: mount.size },
    };
  }
  if (!filled.captionOk && !filled.descOk) {
    var pe2 = __ttGetUploadError();
    return {
      error: "TikTok Studio 视频描述未写入",
      hint: pe2
        ? __ttUploadErrorHint(pe2)
        : "视频可能已上传，但描述编辑器未就绪或仍停留在「出错了，请重试」页。",
      uploaded: true,
      uploadStatus: upText.slice(0, 200),
      mount: { name: mount.name, size: mount.size },
    };
  }

  var finalEditUrl = location.href || __TT_UPLOAD_URL;
  var out = {
    title: title,
    tags: tags,
    desc: desc,
    caption: filled.caption || null,
    state: "edit",
    draftUrl: finalEditUrl,
    editUrl: finalEditUrl,
    manageUrl: __TT_MANAGE_URL,
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
      "已上传并填写 TikTok Studio 未发布编辑页；未点发布。draftUrl/editUrl 仅用于定位当前编辑标签页，请保留该页继续二次编辑，关闭后内容可能丢失。manageUrl 仅展示已发布/预约内容，不是草稿箱。",
  };

  var warnings = [];
  if (filled.editorText && title && filled.editorText.indexOf(title.slice(0, 6)) < 0) {
    warnings.push("editor text may not match title; verify caption on edit page");
  }
  if (warnings.length) out.warnings = warnings;

  return out;
}

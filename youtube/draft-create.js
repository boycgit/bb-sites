/* @meta
{
  "name": "youtube/draft-create",
  "description": "上传本地无硬字幕视频到 YouTube Studio 并保存为草稿；可选同步上传软字幕（SRT 等）",
  "domain": "studio.youtube.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob；建议无硬字幕 unsub）" },
    "config": { "required": false, "description": "JSON：{title,tags,desc,captions?}；captions 由 CLI/daemon 注入 base64" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径" },
    "subtitle": { "required": false, "description": "本地字幕路径（.srt/.vtt 等，CLI 解析后经 daemon 注入）" },
    "captionLanguage": { "required": false, "description": "单条字幕语言：en / zh / zh-Hans（默认 en）" },
    "captions": { "required": false, "description": "daemon 注入的字幕 JSON（含 base64），一般无需手写" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site youtube/draft-create --video ./distribution.unsub.en.mp4 --subtitle ./distribution.en.srt --captionLanguage en --configFile ./draft-publish.config.json --json"
}
*/
async function (args) {
  var session = __ytEnsureSession();
  if (session.error) return session;

  // config-first：CLI 已拒绝零散 title/tags/desc 并归一化 config JSON
  var cfg = { title: "", tags: [], desc: "" };
  if (!args.config) {
    return {
      error: "Missing config",
      hint: "Pass --config '{\"title\":...}' or --configFile <path> (config-first)",
    };
  }
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
      }
    }
  } catch (e) {
    return { error: "Invalid config JSON", hint: String(e) };
  }

  var title = String(cfg.title || (args.video || "untitled").replace(/\.[^.]+$/, "")).slice(0, 100);
  var tags = (cfg.tags || []).slice(0, 30);
  var desc = String(cfg.desc || "").slice(0, 5000);
  cfg.title = title;
  cfg.tags = tags;
  cfg.desc = desc;

  var captions = __ytParseCaptionsArg(args);

  var channelId = session.channelId || __ytGetChannelId();
  var uploadListUrl = channelId
    ? "https://studio.youtube.com/channel/" + channelId + "/videos/upload"
    : location.href;

  // Do NOT full-page navigate after Blob inject
  if (!/studio\.youtube\.com/i.test(location.host)) {
    return {
      error: "Not on YouTube Studio",
      hint: 'bb-browser open "' + (uploadListUrl || __YT_DEFAULT_UPLOAD) + '"',
    };
  }

  var mount = await __ytMountVideo(args);
  if (mount.error) return mount;

  var wait = await __ytWaitDetails(100000);
  if (wait.error) {
    return {
      error: wait.error,
      hint: wait.hint,
      mount: mount,
    };
  }

  var filled = await __ytFillMetadata(cfg);
  await __ytSleep(500);
  // re-apply title after any UI settle
  await __ytFillMetadata(cfg);

  // 按首条字幕语言设置视频语言（无字幕时不强行英语）
  var langLabels =
    captions.length > 0 ? __ytCaptionLanguageLabels(captions[0].language) : null;
  var fixed = await __ytApplyFixedFields(langLabels);
  await __ytSleep(400);

  // 多语言：在 DETAILS 阶段尽量上传软字幕（保存后跳转会中断当前脚本）
  var captionUpload = { skipped: true };
  if (captions.length) {
    captionUpload = await __ytTryUploadCaptionsInDialog(captions);
    await __ytSleep(600);
  }

  // Advance through checks → visibility
  var wizard = await __ytClickNextUntilVisibilityOrSave(5);
  await __ytSleep(800);

  var saved = await __ytSaveDraft();
  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      filled: filled,
      fixed: fixed,
      wizard: wizard,
      captionUpload: captionUpload,
      uploaded: true,
    };
  }

  await __ytSleep(2000);
  var videoId = __ytGetVideoIdFromUrl();
  // After save, dialog may close — videoId often appears in list row links
  if (!videoId) {
    var anchors = document.querySelectorAll("a[href*='/video/'], a[href*='udvid='], a[href*='videos/']");
    for (var ai = 0; ai < anchors.length; ai++) {
      var h = anchors[ai].href || "";
      var um = h.match(/[?&]udvid=([\w-]+)/) || h.match(/\/video\/([\w-]{6,})/);
      var rowText = (anchors[ai].innerText || anchors[ai].closest("ytcp-video-row") && anchors[ai].closest("ytcp-video-row").innerText) || "";
      if (um && rowText.indexOf(title.slice(0, 12)) >= 0) {
        videoId = um[1];
        break;
      }
    }
  }
  if (!videoId) {
    // any new draft link in page
    var m2 = (document.body.innerHTML || "").match(/udvid=([\w-]{6,})/);
    if (m2) videoId = m2[1];
  }
  var listed = __ytListMentionsTitle(title);

  // 草稿编辑链接：拿到 videoId 时直接给出 Studio 编辑页，否则只能去内容列表找
  var editUrl = videoId
    ? "https://studio.youtube.com/video/" + videoId + "/edit"
    : "";
  var translationsUrl = videoId
    ? "https://studio.youtube.com/video/" + videoId + "/translations"
    : "";
  var manageUrl = channelId
    ? "https://studio.youtube.com/channel/" + channelId + "/videos/upload?filter=%5B%7B%22name%22%3A%22VISIBILITY%22%2C%22value%22%3A%5B%22HAS_DRAFT%22%5D%7D%5D"
    : "https://studio.youtube.com/";

  // 若 DETAILS 内字幕未成功且已有 videoId，尝试 SPA 进入 translations 补传（不整页硬跳）
  if (captions.length && videoId && (!captionUpload || captionUpload.skipped || !captionUpload.ok)) {
    var retry = await __ytUploadCaptionsAfterSave(videoId, captions);
    if (retry && !retry.skipped) {
      captionUpload = retry;
    }
  }

  var out = {
    videoId: videoId,
    title: title,
    tags: tags,
    desc: desc,
    channelId: channelId || null,
    privacy: "draft",
    state: "draft",
    editUrl: editUrl || undefined,
    translationsUrl: translationsUrl || undefined,
    manageUrl: manageUrl,
    studioUrl: location.href,
    uploadListUrl: uploadListUrl,
    via: "ui",
    uploadElapsedMs: wait.elapsedMs,
    filled: filled,
    fixed: {
      audience: fixed.audience && fixed.audience.ok,
      captions: fixed.captions && fixed.captions.ok,
    },
    captionUpload: captionUpload,
    captionsRequested: captions.map(function (c) {
      return { language: c.language, name: c.name };
    }),
    listMentionsTitle: listed,
    wizardSteps: wizard.length,
    hint:
      "已保存为 YouTube Studio 草稿，未公开发布。推荐使用无硬字幕视频 + 软字幕（SRT）。" +
      "打开 editUrl 继续编辑；字幕页 translationsUrl；或 manageUrl 筛选草稿。" +
      "固定项：观众「内容不是面向儿童的」。",
  };

  var warnings = [];
  if (!filled.titleOk) warnings.push("title field may not have been filled");
  if (!filled.descOk) warnings.push("description field may not have been filled");
  if (tags.length && !filled.tagsOk) warnings.push("tags field may not have been filled");
  if (!fixed.audience || !fixed.audience.ok) warnings.push("audience not for kids may need manual check");
  if (!videoId && !listed) warnings.push("could not confirm videoId or list title yet — refresh Studio content");
  if (captions.length) {
    if (!captionUpload || captionUpload.skipped) {
      warnings.push(
        "captions were provided but not uploaded automatically; open translationsUrl to upload SRT manually",
      );
    } else if (!captionUpload.ok) {
      warnings.push(
        "caption upload may be incomplete; check translationsUrl and upload remaining SRT files",
      );
    }
  }
  if (warnings.length) out.warnings = warnings;

  return out;
}

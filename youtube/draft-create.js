/* @meta
{
  "name": "youtube/draft-create",
  "description": "上传本地视频到 YouTube Studio 并保存为草稿（不自动公开发布）",
  "domain": "studio.youtube.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob）" },
    "config": { "required": false, "description": "JSON 内容：{title,tags,desc}" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径" },
    "title": { "required": false, "description": "覆盖 config.title" },
    "tags": { "required": false, "description": "覆盖 config.tags" },
    "desc": { "required": false, "description": "覆盖 config.desc" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site youtube/draft-create --video ./a.mp4 --config '{\"title\":\"标题\",\"tags\":[\"教程\"],\"desc\":\"简介\"}' --json"
}
*/
async function (args) {
  var session = __ytEnsureSession();
  if (session.error) return session;

  var cfg = { title: "", tags: [], desc: "" };
  if (args.config) {
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
  }
  if (args.title) cfg.title = args.title;
  if (args.desc) cfg.desc = args.desc;
  if (args.tags) {
    var t = String(args.tags).trim();
    if (t.startsWith("[")) {
      try {
        cfg.tags = JSON.parse(t);
      } catch (e) {
        cfg.tags = t.split(/[,，]/).map(function (s) {
          return s.trim();
        }).filter(Boolean);
      }
    } else {
      cfg.tags = t.split(/[,，]/).map(function (s) {
        return s.trim();
      }).filter(Boolean);
    }
  }

  var title = String(cfg.title || (args.video || "untitled").replace(/\.[^.]+$/, "")).slice(0, 100);
  var tags = (cfg.tags || []).slice(0, 30);
  var desc = String(cfg.desc || "").slice(0, 5000);
  cfg.title = title;
  cfg.tags = tags;
  cfg.desc = desc;

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

  var fixed = await __ytApplyFixedFields();
  await __ytSleep(400);

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

  var out = {
    videoId: videoId,
    title: title,
    tags: tags,
    desc: desc,
    channelId: channelId || null,
    privacy: "draft",
    state: "draft",
    studioUrl: location.href,
    uploadListUrl: uploadListUrl,
    via: "ui",
    uploadElapsedMs: wait.elapsedMs,
    filled: filled,
    fixed: {
      audience: fixed.audience && fixed.audience.ok,
      captions: fixed.captions && fixed.captions.ok,
    },
    listMentionsTitle: listed,
    wizardSteps: wizard.length,
    hint:
      "已保存为 YouTube Studio 草稿，未公开发布。在「内容」列表筛选草稿查看。固定项：观众「内容不是面向儿童的」、字幕/语言「英语」。",
  };

  var warnings = [];
  if (!filled.titleOk) warnings.push("title field may not have been filled");
  if (!filled.descOk) warnings.push("description field may not have been filled");
  if (tags.length && !filled.tagsOk) warnings.push("tags field may not have been filled");
  if (!fixed.audience || !fixed.audience.ok) warnings.push("audience not for kids may need manual check");
  if (!fixed.captions || !fixed.captions.ok) warnings.push("captions/language English may need manual check");
  if (!videoId && !listed) warnings.push("could not confirm videoId or list title yet — refresh Studio content");
  if (warnings.length) out.warnings = warnings;

  return out;
}

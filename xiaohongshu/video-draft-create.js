/* @meta
{
  "name": "xiaohongshu/video-draft-create",
  "description": "上传本地视频到小红书创作者中心并保存为视频笔记草稿（不自动发布）",
  "domain": "creator.xiaohongshu.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob / CDP file input）" },
    "config": { "required": false, "description": "JSON 内容：{title,tags,desc}（config-first）" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site xiaohongshu/video-draft-create --video ./a.mp4 --configFile ./draft-publish.config.json --json"
}
*/
async function (args) {
  var login = xhsVideoEnsureLogin();
  if (login.error) return login;

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
        cfg.tags = parsed.tags
          .split(/[,，]/)
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
      } else if (typeof parsed.tag === "string") {
        cfg.tags = parsed.tag
          .split(/[,，]/)
          .map(function (s) {
            return s.trim();
          })
          .filter(Boolean);
      }
    }
  } catch (e) {
    return { error: "Invalid config JSON", hint: String(e) };
  }

  var fallbackName = String(args.video || args.__localVideoName || "未命名").replace(/\.[^.]+$/, "");
  var title = String(cfg.title || fallbackName).slice(0, XHS_VIDEO_TITLE_MAX);
  var tags = (cfg.tags || []).slice(0, 10);
  var desc = String(cfg.desc || "").slice(0, XHS_VIDEO_DESC_MAX);
  cfg.title = title;
  cfg.tags = tags;
  cfg.desc = desc;

  if (!/creator\.xiaohongshu\.com/i.test(location.host)) {
    return {
      error: "Not on creator.xiaohongshu.com",
      hint: 'bb-browser open "' + XHS_VIDEO_PUBLISH_URL + '"',
    };
  }

  var page = await xhsVideoEnsurePublishPage();
  if (page && page.error) return page;

  var mount = await xhsVideoMountFromBlob(args);
  if (mount.error) return mount;

  var wait = await xhsVideoWaitUpload(180000);
  if (wait.error) {
    return {
      error: wait.error,
      hint: wait.hint,
      mount: mount,
    };
  }

  var filled = await xhsVideoFillMetadata(cfg);
  await xhsVideoSleep(400);
  // 上传完成后 UI 可能重绘，再填一次更稳
  filled = await xhsVideoFillMetadata(cfg);
  await xhsVideoSleep(300);

  var saved = await xhsVideoSaveDraft();
  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      filled: filled,
      uploaded: true,
      mount: mount,
    };
  }

  await xhsVideoSleep(1200);

  var warnings = [];
  if (!filled.titleOk) warnings.push("title editor may not have been filled");
  if (!filled.descOk) warnings.push("desc editor may not have been filled");
  if (saved.via === "stay-edit") {
    warnings.push(saved.hint || "未点到存草稿，已停留编辑页，请人工确认");
  }

  var out = {
    title: title,
    tags: tags,
    desc: filled.desc || desc,
    state: "draft",
    draftUrl: XHS_VIDEO_PUBLISH_URL,
    editUrl: /publish\/publish/i.test(location.href) ? location.href : XHS_VIDEO_PUBLISH_URL,
    manageUrl: "https://creator.xiaohongshu.com/publish/publish?source=official",
    via: saved.via || "ui",
    uploadElapsedMs: wait.elapsedMs,
    filled: {
      titleOk: filled.titleOk,
      descOk: filled.descOk,
    },
    mount: {
      name: mount.name,
      size: mount.size,
      via: mount.via,
    },
    hint:
      "已尽量写入小红书视频笔记草稿（不自动发布）。请在创作者中心核对标题/描述/话题后手动发布。",
  };
  if (warnings.length) out.warnings = warnings;
  return out;
}

/* @meta
{
  "name": "douyin/draft-create",
  "description": "上传本地视频到抖音创作者中心并保存为未发布草稿（不自动发布；单草稿）",
  "domain": "creator.douyin.com",
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
  "example": "bb-browser site douyin/draft-create --video ./a.mp4 --config '{\"title\":\"标题\",\"tags\":[\"算法\"],\"desc\":\"简介\"}' --json"
}
*/
async function (args) {
  var session = await __dyEnsureSession();
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

  var title = String(cfg.title || (args.video || "未命名").replace(/\.[^.]+$/, "")).slice(0, 55);
  var tags = (cfg.tags || []).slice(0, 10);
  var desc = String(cfg.desc || "").slice(0, 500);
  cfg.title = title;
  cfg.tags = tags;
  cfg.desc = desc;

  // Do not full-page navigate after Blob inject
  if (!/creator\.douyin\.com/i.test(location.host)) {
    return {
      error: "Not on creator.douyin.com",
      hint: 'bb-browser open "' + __DY_UPLOAD_URL + '"',
    };
  }

  var mount = await __dyMountVideo(args);
  if (mount.error) return mount;

  var wait = await __dyWaitEditForm(100000);
  if (wait.error) {
    return {
      error: wait.error,
      hint: wait.hint,
      mount: mount,
    };
  }

  var filled = await __dyFillMetadata(cfg);
  await __dySleep(400);
  // re-fill after UI settle
  filled = await __dyFillMetadata(cfg);
  await __dySleep(300);

  var declare = await __dyApplyDeclaration();
  await __dySleep(400);

  var saved = await __dySaveDraft();
  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      filled: filled,
      declare: declare,
      uploaded: true,
    };
  }

  await __dySleep(1500);
  var verify = await __dyVerifyUnpublishedDraft(title);

  var out = {
    title: title,
    tags: tags,
    desc: desc,
    caption: filled.caption || null,
    state: "draft",
    draftUrl: __DY_UPLOAD_URL,
    editUrl: /post\/video/i.test(location.href) ? location.href : __DY_POST_URL,
    via: saved.via || "ui",
    uploadElapsedMs: wait.elapsedMs,
    filled: {
      titleOk: filled.titleOk,
      descOk: filled.descOk,
      editorCount: filled.editorCount,
    },
    fixed: {
      declaration: !!(declare && declare.ok),
      declarationText: __DY_DECLARE,
    },
    verify: verify,
    mount: { name: mount.name, size: mount.size, reused: !!mount.reused },
    hint:
      "已保存为抖音未发布草稿（单草稿模型）。未点发布。再次打开上传页可选「继续编辑」。自主声明：内容为个人观点或见解。注意：默认会「放弃」上一条未发布草稿再上传。",
  };

  var warnings = [];
  if (!filled.titleOk && !filled.descOk) warnings.push("title/desc editor may not have been filled");
  if (!declare || !declare.ok) warnings.push("自主声明 may need manual check: " + __DY_DECLARE);
  if (saved.warning) warnings.push(saved.warning);
  if (warnings.length) out.warnings = warnings;

  return out;
}

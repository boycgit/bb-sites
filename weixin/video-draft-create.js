/* @meta
{
  "name": "weixin/video-draft-create",
  "description": "上传本地视频到微信公众号素材库（type=15）并保存为视频草稿（不自动发表）",
  "domain": "mp.weixin.qq.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后由 daemon 挂到页面 file input）" },
    "config": { "required": false, "description": "JSON 内容字符串：{title,tags,desc}" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径（CLI 读取，与 config 二选一）" },
    "title": { "required": false, "description": "覆盖 config.title" },
    "tags": { "required": false, "description": "覆盖 config.tags（逗号分隔或 JSON 数组）" },
    "desc": { "required": false, "description": "覆盖 config.desc" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site weixin/video-draft-create --video ./a.mp4 --config '{\"title\":\"标题\",\"tags\":[\"教程\"],\"desc\":\"简介\"}' --json"
}
*/
async function (args) {
  var session = await __wxEnsureSession();
  if (session.error) return session;

  // Parse config
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

  var title = String(cfg.title || args.video || "未命名视频").slice(0, 64);
  var tags = (cfg.tags || []).slice(0, 5);
  var desc = String(cfg.desc || "").slice(0, 300);

  var pageOk = await __wxEnsureVideoEditPage(session);
  if (pageOk && pageOk.error) return pageOk;

  // Ensure file is mounted / upload started
  var mount = await __wxEnsureVideoFileMounted(args);
  if (mount.error) return mount;

  // Wait for FtnUploader to finish (26MB can take ~30–90s)
  var up = await __wxWaitVideoUpload(100000);
  if (up.error) {
    return {
      error: up.error,
      hint: up.hint,
      mount: mount,
      last: up.last,
    };
  }

  var vm = __wxFindVideoEditForm();
  if (!vm) {
    return {
      error: "Video edit form not found",
      hint: "Stay on videomsg_edit page after upload",
      vid: up.vid,
    };
  }

  await __wxFillVideoForm(vm, { title: title, desc: desc, tags: tags });

  // Double-check prerequisites for save button
  vm.form.agree = 1;
  vm.form.applyori = 1;
  vm.form.title = title;
  __wxCloseOriginDialogIfAny(vm);

  var saved = await __wxSaveVideoDraft(vm, session, {
    title: title,
    desc: desc,
    tags: tags,
    vid: up.vid,
  });
  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      vid: up.vid,
      uploaded: true,
      mount: mount,
    };
  }

  var appmsgid = saved.appmsgid;
  var listUrl =
    "https://mp.weixin.qq.com/cgi-bin/appmsg?begin=0&count=10&action=list_video&type=15&token=" +
    encodeURIComponent(session.token) +
    "&lang=zh_CN";
  var editUrl = appmsgid
    ? "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&appmsgid=" +
      appmsgid +
      "&token=" +
      encodeURIComponent(session.token) +
      "&lang=zh_CN"
    : listUrl;

  var out = {
    appmsgid: appmsgid || null,
    vid: saved.vid || up.vid,
    title: title,
    tags: tags,
    desc: desc,
    applyori: 1,
    agree: 1,
    draftUrl: listUrl,
    editUrl: editUrl,
    author: session.nick || session.userName || "",
    state: "saved",
    via: saved.via || "unknown",
    uploadElapsedMs: up.elapsedMs,
    mountMode: mount.mode || args.__localVideoMountMode || null,
    hint:
      "已保存为公众号视频素材（type=15），未群发/发表。可在 素材库→视频 查看；转码审核可能需数分钟。可通过 can_import_to_finder 导入视频号。",
  };
  if (saved.warning) out.warning = saved.warning;
  if (saved.apiError) out.apiError = saved.apiError;
  return out;
}

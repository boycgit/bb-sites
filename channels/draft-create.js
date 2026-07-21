/* @meta
{
  "name": "channels/draft-create",
  "description": "上传本地视频到视频号助手并保存为草稿（不自动发表）",
  "domain": "channels.weixin.qq.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob）" },
    "config": { "required": false, "description": "JSON 内容：{title,tags,desc}" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径" },
    "title": { "required": false, "description": "短标题，覆盖 config.title" },
    "tags": { "required": false, "description": "话题标签" },
    "desc": { "required": false, "description": "视频描述" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site channels/draft-create --video ./a.mp4 --config '{\"title\":\"短标题\",\"tags\":[\"算法\"],\"desc\":\"简介\"}' --json"
}
*/
async function (args) {
  var session = await __chEnsureSession();
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

  var title = String(cfg.title || (args.video || "未命名").replace(/\.[^.]+$/, "")).slice(0, 16);
  var tags = (cfg.tags || []).slice(0, 10);
  var description = __chBuildDescription(cfg.desc, tags);

  var page = await __chEnsureCreatePage();
  if (page.error) return page;

  var mount = await __chMountVideo(args);
  if (mount.error) return mount;

  var up = await __chWaitUpload(100000);
  if (up.error) {
    return {
      error: up.error,
      hint: up.hint,
      mount: mount,
    };
  }

  var ctx = __chGetCreateWin();
  if (!ctx || !ctx.doc) {
    return { error: "Create iframe lost after upload" };
  }

  // Fill text first, then fixed options (some panels steal focus)
  var filled = await __chFillTitleDesc(ctx.doc, title, description);
  await __chSleep(400);
  var fixed = await __chApplyFixedFields(ctx.doc, ctx.win);
  // Re-apply title/desc after option panels (may wipe editor)
  await __chSleep(400);
  filled = await __chFillTitleDesc(ctx.doc, title, description);
  await __chSleep(500);

  // List draft count before save
  var before = await __chApi(ctx.win, "/post/get_draft_list", { pageSize: 5, currentPage: 1 });
  var beforeCount = (before && before.list && before.list.length) || 0;

  // Verify description actually landed in editor
  var editor = ctx.doc.querySelector(".post-desc-box .input-editor");
  var editorText = editor ? (editor.innerText || editor.textContent || "").trim() : "";
  if (editor && editorText.length < 4) {
    // one more force write
    await __chFillTitleDesc(ctx.doc, title, description);
    await __chSleep(300);
    editorText = (editor.innerText || editor.textContent || "").trim();
  }

  var saved = await __chSaveDraftClick(ctx.doc);
  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      filled: filled,
      fixed: fixed,
      editorText: editorText,
      uploaded: true,
    };
  }

  await __chSleep(3000);
  var hit = await __chFindDraftByTitle(ctx.win, title, description);
  var after = await __chApi(ctx.win, "/post/get_draft_list", { pageSize: 10, currentPage: 1 });
  var afterCount = (after && after.list && after.list.length) || 0;

  // Strict: require title match on shortTitle (do not invent success from stale list head)
  if (!hit || hit.maybe || (hit.shortTitle && hit.shortTitle !== title && hit.shortTitle.indexOf(title.slice(0, 6)) < 0)) {
    // retry list once
    await __chSleep(2500);
    hit = await __chFindDraftByTitle(ctx.win, title, description);
  }
  if (!hit || (hit.shortTitle && hit.shortTitle !== title && !hit.maybe)) {
    // accept if shortTitle matches exactly only
  }
  if (!hit || hit.shortTitle !== title) {
    return {
      error: "Save not confirmed in draft list",
      hint:
        "Clicked 保存草稿 but no draft with shortTitle=" +
        title +
        ". before=" +
        beforeCount +
        " after=" +
        afterCount +
        " editorText=" +
        editorText.slice(0, 80),
      filled: filled,
      fixed: fixed,
      editorText: editorText,
      uploaded: true,
      beforeCount: beforeCount,
      afterCount: afterCount,
    };
  }

  var out = {
    objectId: hit.objectId,
    exportId: hit.exportId,
    title: title,
    tags: tags,
    desc: description,
    shortTitle: hit.shortTitle,
    savedDescription: hit.description || "",
    draftUrl: __CH_DRAFT_URL,
    createUrl: __CH_CREATE_URL,
    state: "draft",
    via: "click",
    uploadElapsedMs: up.elapsedMs,
    fixed: {
      location: fixed.location && fixed.location.ok,
      collection: fixed.collection && fixed.collection.ok,
      collectionId: fixed.collectionId || null,
      collectionName: fixed.collectionName || __CH_COLLECTION_NAME,
      link: fixed.link && fixed.link.ok,
      annotation: fixed.annotation && fixed.annotation.ok,
    },
    filled: filled,
    editorText: editorText,
    beforeCount: beforeCount,
    afterCount: afterCount,
    hint:
      "已保存到视频号助手草稿箱，未发表。打开 draftUrl 查看。固定项：位置杭州、合集「算法可视化」、链接公众号文章、标注「个人观点，仅供参考」。",
  };
  if (fixed.collection && !fixed.collection.ok) {
    out.warnings = (out.warnings || []).concat(["collection: " + (fixed.collection.reason || "fail")]);
  }
  if (fixed.annotation && !fixed.annotation.ok) {
    out.warnings = (out.warnings || []).concat(["annotation: " + (fixed.annotation.reason || "fail")]);
  }
  if (fixed.link && !fixed.link.ok) {
    out.warnings = (out.warnings || []).concat(["link: " + (fixed.link.reason || "fail")]);
  }
  if (!hit.description || hit.description.length < 4) {
    out.warnings = (out.warnings || []).concat(["description empty on saved draft — check editor binding"]);
  }
  return out;
}

/* @meta
{
  "name": "bilibili/draft-create",
  "description": "上传本地视频到 B 站创作中心并保存为视频草稿（不自动投稿）",
  "domain": "member.bilibili.com",
  "args": {
    "video": { "required": true, "description": "本地视频路径（CLI 解析后注入页面 Blob）" },
    "config": { "required": false, "description": "JSON 配置字符串或本地 JSON 文件路径：{title,tags,desc,cover}（config-first，已取代零散参数；cover 支持本地图/URL）" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一）" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site bilibili/draft-create --video ./a.mp4 --configFile ./draft-publish.config.json --json"
}
*/
async function (args) {
  const login = await biliEnsureLogin();
  if (login.error) return login;

  // config-first：CLI 已把 --config/--configFile 归一化为 {title,tags,desc,cover} JSON 内容
  let cfg = { title: "", tags: [], desc: "", cover: "" };
  if (args.config) {
    try {
      const parsed = JSON.parse(args.config);
      if (parsed && typeof parsed === "object") {
        cfg.title = parsed.title || "";
        cfg.desc = parsed.desc || parsed.description || "";
        cfg.cover = typeof parsed.cover === "string" ? parsed.cover : "";
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

  const local = biliGetLocalVideoBlob();
  if (local.error) return local;

  // Do NOT full-page navigate after Blob inject — that would wipe window.__bbLocalVideoBlob.
  // UPOS + draft APIs only need cookies on member.bilibili.com (any path is fine).

  const title = String(cfg.title || local.name.replace(/\.[^.]+$/, "")).slice(0, 80);
  const tags = (cfg.tags || []).slice(0, 10);
  const desc = String(cfg.desc || "").slice(0, 2000);

  // Upload via UPOS
  const up = await biliUposUpload(local.blob, local.name || args.video || "video.mp4");
  if (up.error) {
    return {
      error: up.error,
      hint: up.hint || "Retry on member.bilibili.com upload page while logged in",
    };
  }
  if (!up.filename || !(up.cid || up.biz_id)) {
    return {
      error: "Upload incomplete (missing filename/cid)",
      hint: JSON.stringify(up).slice(0, 400),
    };
  }

  // Cover: reuse a stable default if none (draft/add accepts archive cover URL)
  // Empty cover often fails; use a neutral placeholder from existing uploads when needed.
  const defaultCover =
    "https://i0.hdslb.com/bfs/archive/eaafd71ddf5e726a61534c19fcdf857f1062fb9e.jpg";

  // 自定义封面：本地图（CLI 已转 base64）走 cover/up 换 bfs URL；https URL 直接用；失败不阻断存草稿
  let cover = defaultCover;
  let coverSource = "default";
  let coverWarning = "";
  if (args.coverBase64) {
    const dataUrl =
      "data:" + (args.coverMime || "image/png") + ";base64," + args.coverBase64;
    const uploaded = await biliCoverUp(login.csrf, dataUrl);
    if (uploaded.url) {
      cover = uploaded.url;
      coverSource = "uploaded";
    } else {
      coverWarning =
        "封面上传失败，已回退默认封面：" + (uploaded.hint || uploaded.error || "");
    }
  } else if (/^https:\/\//i.test(cfg.cover)) {
    cover = cfg.cover;
    coverSource = "url";
  }

  // Save draft — fixed: 自制 + 无需标注 + 分区知识
  // cid must equal preupload biz_id
  const saved = await biliDraftAdd({
    csrf: login.csrf,
    title: title,
    tags: tags,
    desc: desc,
    tid: BILI_TID_KNOWLEDGE,
    videos: [
      {
        title: title,
        filename: up.filename,
        desc: "",
        cid: up.cid || up.biz_id || 0,
        is_4k: false,
        is_8k: false,
        is_hdr: false,
      },
    ],
    cover: cover,
  });

  if (saved.error) {
    return {
      error: saved.error,
      hint: saved.hint,
      filename: up.filename,
      cid: up.cid || up.biz_id || null,
      uploaded: true,
    };
  }

  // Resolve draft id from response or list
  let draftId = saved.draftId;
  if (!draftId) {
    await biliSleep(1500);
    const hit = await biliFindDraftByTitle(title);
    if (hit) draftId = hit.id;
  }

  const draftUrl = draftId
    ? "https://member.bilibili.com/platform/upload/video/frame?type=draft&draftId=" +
      draftId
    : BILI_DRAFT_MANAGE_URL;

  return {
    draftId: draftId,
    title: title,
    tags: tags,
    desc: desc,
    cover: cover,
    coverSource: coverSource,
    coverWarning: coverWarning || undefined,
    filename: up.filename,
    draftUrl: draftUrl,
    manageUrl: BILI_DRAFT_MANAGE_URL,
    author: login.name || login.mid,
    tid: BILI_TID_KNOWLEDGE,
    copyright: 1,
    creation_statement_id: -1,
    state: "draft",
    hint:
      "已保存为视频草稿，未投稿。打开 draftUrl 继续编辑，或到投稿管理 → 草稿查看。",
  };
}

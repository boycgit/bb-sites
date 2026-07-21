// Bilibili member helpers for draft-create (member.bilibili.com).
// Video upload: UPOS preupload + chunked PUT (biliup-compatible).
// Draft save: POST /x/vupre/web/draft/add (not 立即投稿).

const BILI_UPLOAD_URL = "https://member.bilibili.com/platform/upload/video/frame";
const BILI_DRAFT_MANAGE_URL =
  "https://member.bilibili.com/platform/upload-manager/article?group=draft";
/** Fixed partition: 知识 (legacy tid). type_mode=2 also uses human type2 id 1010. */
const BILI_TID_KNOWLEDGE = 36;
const BILI_HUMAN_TYPE2_KNOWLEDGE = 1010;

function biliSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function biliGetCsrf() {
  const m = document.cookie.match(/(?:^|; )bili_jct=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function biliEnsureLogin() {
  try {
    const resp = await fetch("https://api.bilibili.com/x/web-interface/nav", {
      credentials: "include",
    });
    const j = await resp.json();
    if (!j || j.code !== 0 || !j.data || !j.data.isLogin) {
      return {
        error: "Not logged in",
        hint:
          'Open and log in: bb-browser open "https://member.bilibili.com/platform/upload/video/frame"',
      };
    }
    const csrf = biliGetCsrf();
    if (!csrf) {
      return {
        error: "Missing bili_jct cookie",
        hint: "Refresh member.bilibili.com after login",
      };
    }
    return {
      mid: j.data.mid,
      name: j.data.uname || j.data.name || "",
      csrf: csrf,
    };
  } catch (e) {
    return { error: "Login check failed", hint: String(e) };
  }
}

function biliGetLocalVideoBlob() {
  const blob = window.__bbLocalVideoBlob;
  if (!blob || typeof blob.size !== "number" || blob.size <= 0) {
    return {
      error: "Local video not injected",
      hint: "CLI must pass --video <path>; daemon injects Blob as window.__bbLocalVideoBlob",
    };
  }
  return {
    blob: blob,
    name: window.__bbLocalVideoBlobName || "video.mp4",
    mime: window.__bbLocalVideoBlobMime || blob.type || "video/mp4",
    size: blob.size || window.__bbLocalVideoBlobSize || 0,
  };
}

/** Preupload metadata. Force bilivideo bda2 (matches successful manual E2E). */
async function biliPreupload(fileName, totalSize) {
  // Always use official upos-cs-upcdnbda2; probe-selected third-party CDNs
  // can return OK on merge but fail draft/add binding.
  const query = "probe_version=20221109&upcdn=bda2";
  const params = new URLSearchParams({
    r: "upos",
    profile: "ugcupos/bup",
    ssl: "0",
    version: "2.14.0",
    build: "2140000",
    name: fileName,
    size: String(totalSize),
  });
  const url =
    "https://member.bilibili.com/preupload?" + query + "&" + params.toString();
  const resp = await fetch(url, { credentials: "include" });
  const ret = await resp.json();
  if (!ret || !(ret.endpoint || ret.upos_uri) || !ret.biz_id) {
    return {
      error: "preupload failed",
      hint: JSON.stringify(ret).slice(0, 300),
    };
  }
  return ret;
}

/**
 * UPOS chunked upload of a Blob. Returns { filename, title }.
 */
async function biliUposUpload(blob, fileName, onProgress) {
  const totalSize = blob.size;
  const pre = await biliPreupload(fileName, totalSize);
  if (pre.error) return pre;

  const auth = pre.auth;
  const endpoint = pre.endpoint;
  const bizId = pre.biz_id;
  const uposUri = pre.upos_uri;
  const chunkSize = pre.chunk_size || 4 * 1024 * 1024;
  const path = String(uposUri || "").replace(/^upos:\/\//, "");
  const putUrl = "https:" + endpoint + "/" + path;
  const headers = { "X-Upos-Auth": auth };

  // init multipart
  const initResp = await fetch(putUrl + "?uploads&output=json", {
    method: "POST",
    credentials: "include",
    headers: headers,
  });
  const initJson = await initResp.json();
  const uploadId = initJson.upload_id;
  if (!uploadId) {
    return {
      error: "UPOS init failed",
      hint: JSON.stringify(initJson).slice(0, 300),
    };
  }

  const chunks = Math.ceil(totalSize / chunkSize);
  const parts = [];
  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, totalSize);
    const chunk = blob.slice(start, end);
    const q = new URLSearchParams({
      partNumber: String(i + 1),
      uploadId: uploadId,
      chunk: String(i),
      chunks: String(chunks),
      size: String(end - start),
      start: String(start),
      end: String(end),
      total: String(totalSize),
    });
    let ok = false;
    let lastErr = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(putUrl + "?" + q.toString(), {
          method: "PUT",
          credentials: "include",
          headers: headers,
          body: chunk,
        });
        if (!r.ok) {
          lastErr = "HTTP " + r.status;
          await biliSleep(500 * (attempt + 1));
          continue;
        }
        parts.push({ partNumber: i + 1, eTag: "etag" });
        ok = true;
        if (typeof onProgress === "function") {
          onProgress({ chunk: i + 1, chunks: chunks, ratio: (i + 1) / chunks });
        }
        break;
      } catch (e) {
        lastErr = String(e);
        await biliSleep(500 * (attempt + 1));
      }
    }
    if (!ok) {
      return { error: "UPOS chunk upload failed at " + (i + 1), hint: lastErr };
    }
  }

  // complete
  const completeParams = new URLSearchParams({
    name: fileName,
    uploadId: uploadId,
    biz_id: String(bizId),
    output: "json",
    profile: "ugcupos/bup",
  });
  let merged = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const r = await fetch(putUrl + "?" + completeParams.toString(), {
        method: "POST",
        credentials: "include",
        headers: Object.assign({ "Content-Type": "application/json" }, headers),
        body: JSON.stringify({ parts: parts }),
      });
      merged = await r.json();
      if (merged && merged.OK === 1) break;
    } catch (e) {
      merged = { err: String(e) };
    }
    await biliSleep(1000 * (attempt + 1));
  }
  if (!merged || merged.OK !== 1) {
    return {
      error: "UPOS merge failed",
      hint: JSON.stringify(merged).slice(0, 300),
    };
  }

  // filename for draft is basename of upos_uri without extension
  // cid MUST be preupload biz_id (official web: t.cid = e.hookSet.biz_id)
  const base = path.split("/").pop() || fileName;
  const filename = base.replace(/\.[^.]+$/, "");
  const title = fileName.replace(/\.[^.]+$/, "").slice(0, 80);
  return {
    filename: filename,
    title: title,
    biz_id: bizId,
    cid: bizId,
    upos_uri: uposUri,
  };
}

/**
 * Save draft (not publish).
 * videos: [{ title, filename, desc? }]
 */
async function biliDraftAdd(opts) {
  const csrf = opts.csrf || biliGetCsrf();
  const title = String(opts.title || "").slice(0, 80);
  const desc = String(opts.desc || "").slice(0, 2000);
  let tags = opts.tags || [];
  if (typeof tags === "string") {
    tags = tags.split(/[,，]/).map(function (s) {
      return s.trim();
    }).filter(Boolean);
  }
  const tag = tags.slice(0, 10).join(",");
  const videos = (opts.videos || []).map(function (v) {
    return {
      title: String(v.title || title).slice(0, 80),
      filename: v.filename,
      desc: v.desc || "",
      // cid MUST be preupload biz_id (do not drop this field)
      cid: Number(v.cid || v.biz_id || 0),
      is_4k: !!v.is_4k,
      is_8k: !!v.is_8k,
      is_hdr: !!v.is_hdr,
    };
  });
  if (!videos.length || !videos[0].filename) {
    return { error: "Missing uploaded video filename" };
  }
  if (!videos[0].cid) {
    return {
      error: "Missing video cid (biz_id)",
      hint: "preupload biz_id must be passed as videos[].cid",
    };
  }

  // Payload shape from videoup getBasicDraftParams + saveSetting("draft")
  const body = {
    videos: videos,
    cover: opts.cover || "",
    cover43: opts.cover43 || "",
    ai_cover: opts.ai_cover != null ? opts.ai_cover : 0,
    is_ab_cover: 0,
    ab_cover_info: null,
    title: title,
    copyright: 1, // 自制
    creation_statement_id: -1, // 内容无需标注
    tid: opts.tid != null ? opts.tid : BILI_TID_KNOWLEDGE,
    tag: tag,
    desc: desc,
    recreate: 0,
    dynamic: "",
    no_reprint: 1,
    is_only_self: 0,
    space_hidden: 2,
    watermark: { state: 0 },
    subtitle: { open: 0, lan: "" },
    dolby: 0,
    lossless_music: 0,
    up_selection_reply: false,
    up_close_reply: false,
    up_close_danmu: false,
  };

  const url =
    "https://member.bilibili.com/x/vupre/web/draft/add?csrf=" +
    encodeURIComponent(csrf);
  const resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: "draft/add parse error", hint: text.slice(0, 300) };
  }
  if (!data || data.code !== 0) {
    return {
      error: (data && data.message) || "draft/add failed",
      hint: JSON.stringify(data).slice(0, 400),
      payload: body,
      requestUrl: url,
    };
  }
  // data may be empty on success — resolve id via list
  const d = data.data || {};
  let draftId = d.aid || d.id || d.draft_id || null;
  if (!draftId) {
    await biliSleep(800);
    const hit = await biliFindDraftByTitle(title);
    if (hit) draftId = hit.id;
  }
  return {
    draftId: draftId,
    raw: d,
  };
}

async function biliDraftList() {
  const resp = await fetch(
    "https://member.bilibili.com/x/vupre/web/draft/list?pn=1&ps=20",
    { credentials: "include" },
  );
  const j = await resp.json();
  if (!j || j.code !== 0) return [];
  return Array.isArray(j.data) ? j.data : [];
}

async function biliFindDraftByTitle(title) {
  const list = await biliDraftList();
  const t = String(title || "");
  let hit = list.find(function (d) {
    return d.title === t;
  });
  if (!hit && list.length) {
    // newest first often
    hit = list[0];
  }
  return hit || null;
}

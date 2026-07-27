// Shared Zhihu adapter helpers.
// Auto-loaded by bb-browser site runtime before each zhihu/* adapter under this dir.
//
// Draft reverse notes (2026-07, zhuanlan.zhihu.com):
// - GET  /api/articles/{id}/draft
// - POST /api/articles/drafts  body: { title, content }  → create draft, returns { id, title, content, ... }
// - PATCH /api/articles/{id}/draft  body: { title, content, comment_permission, ... }
// - POST /api/uploaded_images  FormData: picture=<file>, source=article  → { src, hash, data-rawwidth, data-rawheight }
// - Auth: Cookie + _xsrf as X-Xsrftoken / x-xsrf-token
//
// URL pitfalls (verified 2026-07):
// - API `url` is https://zhuanlan.zhihu.com/p/{id} WITHOUT /edit.
// - For unpublished drafts, that public URL always shows 「你似乎来到了没有知识存在的荒原」
//   even for the author while logged in. Only /p/{id}/edit opens the editor.
// - my_drafts list returns numeric `id` (not string) → JSON.parse can lose precision
//   above Number.MAX_SAFE_INTEGER. Always extract id as string from raw JSON / url.

function zhihuGetXsrf() {
  const m = document.cookie.match(/(?:^|; )_xsrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function zhihuAuthHeaders(json) {
  const xsrf = zhihuGetXsrf();
  const h = {
    "X-Requested-With": "fetch",
  };
  if (xsrf) {
    h["X-Xsrftoken"] = xsrf;
    h["x-xsrf-token"] = xsrf;
  }
  if (json) h["Content-Type"] = "application/json";
  return h;
}

async function zhihuEnsureLogin() {
  try {
    const resp = await fetch("https://www.zhihu.com/api/v4/me", {
      credentials: "include",
      headers: zhihuAuthHeaders(false),
    });
    if (resp.status === 401 || resp.status === 403) {
      return {
        error: "Not logged in",
        hint: "Please log in to https://www.zhihu.com in the bb-browser Chrome, then open https://zhuanlan.zhihu.com/write once.",
      };
    }
    if (!resp.ok) {
      return { error: "HTTP " + resp.status + " on /api/v4/me", hint: "Check Zhihu login state" };
    }
    const me = await resp.json();
    if (!me || !me.id) {
      return {
        error: "Not logged in",
        hint: "Please log in to Zhihu in the bb-browser Chrome first.",
      };
    }
    return {
      id: me.id,
      name: me.name,
      urlToken: me.url_token,
    };
  } catch (e) {
    return { error: "Login check failed", hint: String(e) };
  }
}

function _base64ToBlob(base64, mime) {
  const pure = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  const bin = atob(pure);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "image/png" });
}

/**
 * Upload image. Returns { src, hash, width, height }
 */
async function zhihuUploadImage(opts) {
  let blob;
  if (opts.base64) {
    blob = _base64ToBlob(opts.base64, opts.mime || "image/png");
  } else if (opts.blob) {
    blob = opts.blob;
  } else if (opts.url) {
    try {
      const r = await fetch(opts.url, { credentials: "omit", mode: "cors" });
      if (!r.ok) return { error: "HTTP " + r.status + " fetching image", hint: opts.url };
      blob = await r.blob();
    } catch (e) {
      return { error: "Failed to fetch remote image", hint: opts.url + " " + String(e) };
    }
  } else {
    return { error: "No image data" };
  }

  const fd = new FormData();
  fd.append("source", "article");
  fd.append("picture", blob, opts.name || "image.png");
  const headers = zhihuAuthHeaders(false);
  // do not set Content-Type for FormData
  const resp = await fetch("https://zhuanlan.zhihu.com/api/uploaded_images", {
    method: "POST",
    credentials: "include",
    headers: headers,
    body: fd,
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Upload parse error HTTP " + resp.status, hint: text.slice(0, 200) };
  }
  if (!resp.ok || !data.src) {
    return {
      error: (data.error && data.error.message) || ("Upload failed HTTP " + resp.status),
      hint: text.slice(0, 200),
    };
  }
  return {
    src: data.src,
    originalSrc: data.original_src || data.src,
    hash: data.hash,
    width: data["data-rawwidth"] || data.data_rawwidth || 0,
    height: data["data-rawheight"] || data.data_rawheight || 0,
    alt: opts.alt || "",
  };
}

function zhihuImgHtml(img) {
  const w = img.width || "";
  const h = img.height || "";
  const alt = (img.alt || "").replace(/"/g, "&quot;");
  const caption = alt;
  // Zhihu editor typically accepts simple img with data-attrs
  return (
    '<p><img src="' +
    img.src +
    '"' +
    (w ? ' data-rawwidth="' + w + '"' : "") +
    (h ? ' data-rawheight="' + h + '"' : "") +
    ' data-size="normal" data-caption="' +
    caption.replace(/"/g, "&quot;") +
    '" alt="' +
    alt +
    '"/></p>'
  );
}

/**
 * Extract article/draft id as a decimal string from API JSON text or a /p/{id} url.
 * Never trust JSON.parse Number for Zhihu snowflake ids (often > MAX_SAFE_INTEGER).
 */
function zhihuExtractId(rawOrUrl, parsed) {
  const s = String(rawOrUrl || "");
  // Prefer quoted id string in JSON (create API returns this)
  let m = s.match(/"id"\s*:\s*"(\d{10,})"/);
  if (m) return m[1];
  // Unquoted numeric id in JSON (my_drafts list) — still capture full digit run from raw text
  m = s.match(/"id"\s*:\s*(\d{10,})/);
  if (m) return m[1];
  // From article url field
  m = s.match(/zhuanlan\.zhihu\.com\/p\/(\d{10,})/);
  if (m) return m[1];
  m = s.match(/\/p\/(\d{10,})/);
  if (m) return m[1];
  if (parsed && parsed.id != null) {
    // Last resort; may already be precision-damaged if it was a Number
    const as = String(parsed.id);
    if (/^\d{10,}$/.test(as)) return as;
  }
  return null;
}

function zhihuDraftUrls(draftId) {
  const id = String(draftId || "").replace(/\D/g, "");
  const editUrl = "https://zhuanlan.zhihu.com/p/" + id + "/edit";
  return {
    draftId: id,
    editUrl: editUrl,
    // Alias (weixin-style). Public /p/{id} is NOT openable before publish.
    draftUrl: editUrl,
    manageUrl: "https://www.zhihu.com/creator/manage/creation/draft",
  };
}

/** Verify draft is readable; returns {ok, title?, state?} or {error, hint} */
async function zhihuVerifyDraft(draftId) {
  const id = String(draftId || "").replace(/\D/g, "");
  if (!id) return { error: "Missing draft id" };
  const resp = await fetch("https://zhuanlan.zhihu.com/api/articles/" + id + "/draft", {
    credentials: "include",
    headers: zhihuAuthHeaders(false),
  });
  const text = await resp.text();
  if (!resp.ok) {
    return {
      error: "Draft verify failed HTTP " + resp.status,
      hint:
        text.slice(0, 200) +
        " — open manageUrl or re-login; do not open public /p/{id} (shows 荒原 until published)",
    };
  }
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return {
    ok: true,
    title: data.title,
    state: data.state,
    type: data.type,
  };
}

// ---------------------------------------------------------------------------
// 视频上传（专栏正文内嵌视频）
//
// 逆向自 zhuanlan.zhihu.com 编辑器（2026-07，heifetz column bundle）：
//   ① POST  https://lens.zhihu.com/api/v5/videos
//      headers: Content-Type/json, X-Upload-Content-Type, X-Upload-Content-Length
//      body:    { file_md5: <hex>, source: "article" }
//      resp:    { upload_vendor: { upload_token: {access_id, access_key, access_token},
//                                  endpoint, vendor_code },
//                 upload_file:   { video_id, object_key, state } }
//      state 语义：1=instant(秒传，服务端已有该 md5) / 2=checkpoint / 3=unprocessed(需上传)
//   ② 阿里云 OSS 分片上传：endpoint=upload-oss.vzuu.com，bucket=zhihu-video-input，cname=true
//      直接复用页面里的 ali-oss SDK（编辑器同款 6.8.0），避免自行实现 STS 签名
//   ③ PUT   /api/v4/videos/{id}/uploading_status
//      body:  { object_key, upload_id, video_source:"origin", upload_event }
//   ④ GET   /api/v4/videos/{id}/default_cover 轮询首帧封面，拿到后 PUT 回写
//   ⑤ 正文节点：<a class="video-link" href="https://www.zhihu.com/video/{id}"
//                 data-poster="..." data-lens-id="{id}" data-video-playable="true"></a>
//
// 注意：lens.zhihu.com 的 CORS 预检只放行固定请求头白名单，
// 不要给这些请求加 X-Xsrftoken 之类的自定义头，否则预检直接失败。
const ZHIHU_LENS_API = "https://lens.zhihu.com";
const ZHIHU_OSS_SDK = "https://unpkg.zhimg.com/ali-oss@6.8.0/dist/aliyun-oss-sdk.min.js";
const ZHIHU_OSS_ENDPOINT = "https://upload-oss.vzuu.com";
const ZHIHU_OSS_BUCKET = "zhihu-video-input";
const ZHIHU_OSS_PART_SIZE = 10 * 1024 * 1024;
const ZHIHU_COVER_TIMEOUT_MS = 25000;

/** 按需加载 ali-oss SDK（编辑器本身也是懒加载，纯浏览页面上没有 window.OSS）。 */
function zhihuEnsureOssSdk() {
  if (typeof window.OSS === "function") return Promise.resolve(true);
  if (window.__bbZhihuOssSdkPromise) return window.__bbZhihuOssSdkPromise;
  window.__bbZhihuOssSdkPromise = new Promise(function (resolve, reject) {
    const script = document.createElement("script");
    script.crossOrigin = "";
    script.src = ZHIHU_OSS_SDK;
    script.onload = function () {
      typeof window.OSS === "function"
        ? resolve(true)
        : reject(new Error("ali-oss SDK loaded but window.OSS missing"));
    };
    script.onerror = function () {
      reject(new Error("Failed to load ali-oss SDK: " + ZHIHU_OSS_SDK));
    };
    (document.body || document.head).appendChild(script);
  });
  return window.__bbZhihuOssSdkPromise;
}

async function zhihuLensJson(path, init) {
  const resp = await fetch(ZHIHU_LENS_API + path,
    Object.assign({ credentials: "include" }, init || {}));
  const text = await resp.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = null;
  }
  return { ok: resp.ok, status: resp.status, data: data, text: text };
}

/** 上报上传进度事件；纯埋点/状态机，失败不影响主流程。 */
async function zhihuReportUploadStatus(videoId, objectKey, uploadId, event) {
  try {
    await zhihuLensJson("/api/v4/videos/" + videoId + "/uploading_status", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        object_key: objectKey,
        upload_id: uploadId || "",
        video_source: "origin",
        upload_event: event,
      }),
    });
  } catch {
    /* ignore */
  }
}

/** 轮询首帧封面；转码未完成时返回空，超时后放弃（正文可无 poster）。 */
async function zhihuWaitVideoCover(videoId) {
  const deadline = Date.now() + ZHIHU_COVER_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await zhihuLensJson("/api/v4/videos/" + videoId + "/default_cover", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    // GET 返回 default_cover_url；PUT 回写时字段才叫 cover_url
    const url =
      res.data && (res.data.default_cover_url || res.data.cover_url || res.data.url);
    if (url) return String(url);
    await new Promise(function (r) {
      setTimeout(r, 1500);
    });
  }
  return "";
}

/**
 * 上传单个视频到知乎视频库。
 * opts: { blob, mime, md5, name }
 * 成功返回 { videoId, poster, name, size, instant }，失败返回 { error, hint }。
 */
async function zhihuUploadVideo(opts) {
  const blob = opts && opts.blob;
  if (!blob || typeof blob.size !== "number" || blob.size <= 0) {
    return { error: "No video data", hint: "daemon 未成功注入本地视频 Blob" };
  }
  if (!opts.md5) {
    return { error: "Missing video md5", hint: "daemon 应随 Blob 一起提供 md5" };
  }
  const mime = opts.mime || blob.type || "video/mp4";
  const name = opts.name || "video.mp4";

  const created = await zhihuLensJson("/api/v5/videos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Upload-Content-Type": mime,
      "X-Upload-Content-Length": String(blob.size),
    },
    body: JSON.stringify({ file_md5: String(opts.md5).toLowerCase(), source: "article" }),
  });
  const uploadFile = created.data && created.data.upload_file;
  if (!created.ok || !uploadFile || !uploadFile.video_id) {
    return {
      error: "Create video failed HTTP " + created.status,
      hint: (created.text || "").slice(0, 200) + " — 确认已登录知乎且账号可发视频",
    };
  }
  const videoId = String(uploadFile.video_id);
  const objectKey = String(uploadFile.object_key || "");
  const instant = Number(uploadFile.state) === 1;

  if (!instant) {
    const token =
      (created.data.upload_vendor && created.data.upload_vendor.upload_token) || null;
    if (!token || !token.access_id) {
      return { error: "Missing OSS upload token", hint: (created.text || "").slice(0, 200) };
    }
    try {
      await zhihuEnsureOssSdk();
    } catch (e) {
      return { error: "ali-oss SDK unavailable", hint: String(e) };
    }

    const endpoint =
      (created.data.upload_vendor && created.data.upload_vendor.endpoint) || ZHIHU_OSS_ENDPOINT;
    const client = new window.OSS({
      endpoint: /^https?:\/\//i.test(endpoint) ? endpoint : "https://" + endpoint,
      bucket: ZHIHU_OSS_BUCKET,
      cname: true,
      secure: true,
      accessKeyId: token.access_id,
      accessKeySecret: token.access_key,
      stsToken: token.access_token,
    });

    let uploadId = "";
    let started = false;
    const file = new File([blob], name, { type: mime });
    try {
      await client.multipartUpload(objectKey, file, {
        mime: mime,
        parallel: 3,
        partSize: ZHIHU_OSS_PART_SIZE,
        progress: function (_percent, checkpoint) {
          if (checkpoint && checkpoint.uploadId) {
            uploadId = checkpoint.uploadId;
            if (!started) {
              started = true;
              zhihuReportUploadStatus(videoId, objectKey, uploadId, "UPLOADING_START");
            }
          }
        },
      });
    } catch (e) {
      const msg = (e && (e.message || e.code)) || String(e);
      return { error: "OSS upload failed: " + msg, hint: "视频过大或 STS 令牌过期，可重试" };
    }
    await zhihuReportUploadStatus(videoId, objectKey, uploadId, "UPLOADING_SUCCESS");
  }

  let poster = await zhihuWaitVideoCover(videoId);
  if (poster) {
    // 与编辑器一致：把首帧回写为视频封面，正文缩略图才不会空白
    await zhihuLensJson("/api/v4/videos/" + videoId + "/default_cover", {
      method: "PUT",
      body: JSON.stringify({ cover_url: poster }),
    }).catch(function () {
      /* ignore */
    });
  }

  return {
    videoId: videoId,
    poster: poster,
    name: name,
    size: blob.size,
    instant: instant,
  };
}

/** 生成专栏正文的视频节点（与编辑器插入的 DOM 结构一致）。 */
function zhihuVideoHtml(video) {
  const id = String((video && video.videoId) || "");
  const poster = String((video && video.poster) || "").replace(/"/g, "&quot;");
  const name = String((video && video.title) || "").replace(/"/g, "&quot;");
  return (
    '<a class="video-link" href="https://www.zhihu.com/video/' +
    id +
    '" data-src="" data-name="' +
    name +
    '" data-poster="' +
    poster +
    '" data-video-id="" data-lens-id="' +
    id +
    '" data-video-playable="true"></a>'
  );
}

/** Lightweight Markdown → Zhihu-friendly HTML */
function zhihuMdToHtml(md) {
  if (!md) return "";
  let text = String(md).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  // strip title line if present (title sent separately)
  text = text.replace(/^#\s+.+\n+/, "");

  const codes = [];
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, function (_, code) {
    codes.push(code);
    return "@@CODE" + (codes.length - 1) + "@@";
  });

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function inline(s) {
    s = esc(s);
    // images already replaced to HTML placeholders like @@IMG0@@
    s = s.replace(/@@IMG(\d+)@@/g, function (_, i) {
      return "@@IMG" + i + "@@";
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function (_, alt, src) {
      return '<img src="' + src + '" alt="' + esc(alt) + '"/>';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/\*([^*]+)\*/g, "<i>$1</i>");
    return s;
  }

  const lines = text.split("\n");
  const html = [];
  let inUl = false;
  let inOl = false;
  function closeLists() {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if ((m = line.match(/^###\s+(.+)/))) {
      closeLists();
      html.push("<h3>" + inline(m[1]) + "</h3>");
      continue;
    }
    if ((m = line.match(/^##\s+(.+)/))) {
      closeLists();
      html.push("<h2>" + inline(m[1]) + "</h2>");
      continue;
    }
    if ((m = line.match(/^#\s+(.+)/))) {
      closeLists();
      html.push("<h2>" + inline(m[1]) + "</h2>");
      continue;
    }
    if ((m = line.match(/^>\s?(.*)/))) {
      closeLists();
      html.push("<blockquote><p>" + inline(m[1]) + "</p></blockquote>");
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.+)/))) {
      if (!inUl) {
        closeLists();
        html.push("<ul>");
        inUl = true;
      }
      html.push("<li>" + inline(m[1]) + "</li>");
      continue;
    }
    if ((m = line.match(/^\d+\.\s+(.+)/))) {
      if (!inOl) {
        closeLists();
        html.push("<ol>");
        inOl = true;
      }
      html.push("<li>" + inline(m[1]) + "</li>");
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeLists();
      html.push("<hr/>");
      continue;
    }
    if (!line.trim()) {
      closeLists();
      continue;
    }
    closeLists();
    if (/^@@CODE\d+@@$/.test(line.trim())) {
      const idx = parseInt(line.replace(/\D/g, ""), 10);
      html.push("<pre><code>" + esc(codes[idx] || "") + "</code></pre>");
      continue;
    }
    // Pass through already-built HTML blocks (img / video notes / etc.)
    // Must not run through esc()/inline() or tags become visible text.
    if (/^\s*</.test(line) && /<\/[a-zA-Z][^>]*>\s*$/.test(line)) {
      html.push(line);
      continue;
    }
    if (line.indexOf("@@IMG") >= 0) {
      html.push("<p>" + line + "</p>");
      continue;
    }
    html.push("<p>" + inline(line) + "</p>");
  }
  closeLists();
  return html.join("");
}

async function zhihuCreateDraft(title, content) {
  const resp = await fetch("https://zhuanlan.zhihu.com/api/articles/drafts", {
    method: "POST",
    credentials: "include",
    headers: zhihuAuthHeaders(true),
    body: JSON.stringify({
      title: title || "",
      content: content || "<p></p>",
    }),
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Create draft parse error HTTP " + resp.status, hint: text.slice(0, 200) };
  }
  const draftId = zhihuExtractId(text, data);
  if (!resp.ok || !draftId) {
    return {
      error: (data && data.error && data.error.message) || ("Create failed HTTP " + resp.status),
      hint: text.slice(0, 300),
    };
  }
  const urls = zhihuDraftUrls(draftId);
  const verify = await zhihuVerifyDraft(draftId);
  if (verify.error) {
    return {
      error: "Draft created but not readable: " + verify.error,
      hint: verify.hint,
      draftId: urls.draftId,
      editUrl: urls.editUrl,
      manageUrl: urls.manageUrl,
    };
  }
  return {
    draftId: urls.draftId,
    title: (data && data.title) || title,
    editUrl: urls.editUrl,
    draftUrl: urls.draftUrl,
    manageUrl: urls.manageUrl,
    state: verify.state || "draft",
    // Intentionally NO public `url`: /p/{id} is 荒原 until published.
  };
}

async function zhihuUpdateDraft(draftId, title, content) {
  const id = zhihuExtractId(String(draftId), { id: draftId }) || String(draftId).replace(/\D/g, "");
  if (!id) return { error: "Invalid draftId", hint: String(draftId) };
  const resp = await fetch("https://zhuanlan.zhihu.com/api/articles/" + id + "/draft", {
    method: "PATCH",
    credentials: "include",
    headers: zhihuAuthHeaders(true),
    body: JSON.stringify({
      title: title || "",
      content: content || "<p></p>",
      comment_permission: "all",
      disclaimer_status: "close",
      disclaimer_type: "none",
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    return { error: "Update draft HTTP " + resp.status, hint: text.slice(0, 300) };
  }
  const urls = zhihuDraftUrls(id);
  return {
    draftId: urls.draftId,
    title: title,
    editUrl: urls.editUrl,
    draftUrl: urls.draftUrl,
    manageUrl: urls.manageUrl,
    state: "draft",
  };
}

function zhihuExtractTitle(md, fallback) {
  const m = String(md || "")
    .replace(/^\uFEFF/, "")
    .match(/^#\s+(.+)$/m);
  return (fallback || (m && m[1].trim()) || "未命名文章").slice(0, 100);
}

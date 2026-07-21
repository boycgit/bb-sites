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

// Shared Twitter adapter helpers.
// Auto-loaded by bb-browser site runtime before each twitter/* adapter.
//
// Draft reverse notes (2026-07, x.com web):
// - FetchDraftTweets: GET /i/api/graphql/{qid}/FetchDraftTweets?variables={"ascending":false}
// - CreateDraftTweet: POST variables.post_tweet_request = {status, media_ids[], exclude_reply_user_ids[], auto_populate_reply_metadata}
//   returns data.tweet.rest_id
// - Media: https://upload.x.com/i/media/upload.json command=INIT|APPEND|FINALIZE (+STATUS for video)
// - Headers: Bearer (public) + X-Csrf-Token=ct0 + x-client-transaction-id (required after first calls)

function _twitterGetWebpackRequire() {
  let __webpack_require__;
  window.webpackChunk_twitter_responsive_web.push(
    [["__bb_h_" + Date.now()], {}, (req) => { __webpack_require__ = req; }]
  );
  return __webpack_require__;
}

function findGraphQLQueryId(operationName, fallbackQueryId) {
  try {
    const req = _twitterGetWebpackRequire();
    const op = operationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp('queryId:\\s*"([^"]+)"\\s*,\\s*operationName:\\s*"' + op + '"'),
      new RegExp('operationName:\\s*"' + op + '"\\s*,\\s*queryId:\\s*"([^"]+)"'),
    ];
    for (const id of Object.keys(req.m)) {
      try {
        const src = req.m[id].toString();
        if (!src.includes(operationName)) continue;
        for (const pattern of patterns) {
          const m = src.match(pattern);
          if (m) return m[1];
        }
      } catch {}
    }
  } catch {}
  return fallbackQueryId;
}

async function findTransactionIdGenerator() {
  try {
    const req = _twitterGetWebpackRequire();
    for (const id of Object.keys(req.m)) {
      try {
        const src = req.m[id].toString();
        if (!src.includes("x-client-transaction-id") || !src.includes("rweb_client_transaction_id_enabled")) continue;
        const mod = req(id);
        for (const fn of Object.values(mod)) {
          if (typeof fn !== "function") continue;
          try {
            const sample = await fn("x.com", "/i/api/graphql/test/Op", "GET");
            if (typeof sample !== "string" || sample.length < 40) continue;
            try { if (atob(sample).startsWith("e:")) continue; } catch {}
            return fn;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}

const TWITTER_BEARER = decodeURIComponent(
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
);

function twitterGetCt0() {
  const c = document.cookie.split(";").map((x) => x.trim()).find((x) => x.startsWith("ct0="));
  return c ? c.slice(4) : null;
}

async function twitterAuthHeaders(path, method) {
  const ct0 = twitterGetCt0();
  if (!ct0) {
    return {
      error: "No ct0 cookie",
      hint: "Please log in to https://x.com in the bb-browser Chrome first.",
    };
  }
  const headers = {
    Authorization: "Bearer " + TWITTER_BEARER,
    "X-Csrf-Token": ct0,
    "X-Twitter-Auth-Type": "OAuth2Session",
    "X-Twitter-Active-User": "yes",
  };
  try {
    if (!window.__bb_tx_gen) {
      window.__bb_tx_gen = await findTransactionIdGenerator();
    }
    if (window.__bb_tx_gen && path) {
      const tx = await window.__bb_tx_gen("x.com", path, method || "GET");
      if (typeof tx === "string" && tx.length > 20) {
        headers["x-client-transaction-id"] = tx;
      }
    }
  } catch {}
  return headers;
}

function twitterBuildShortPost(opts) {
  const maxLength = Math.min(Math.max(parseInt(opts.maxLength, 10) || 280, 50), 25000);
  let title = (opts.title || "").trim();
  let digest = (opts.digest || "").trim();
  let link = (opts.link || "").trim();

  if (opts.markdown) {
    // Strip BOM / normalize newlines so ^# heading matches
    const md = String(opts.markdown).replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    if (!title) {
      const m = md.match(/^#\s+(.+)$/m);
      if (m) title = m[1].trim();
    }
    if (!digest) {
      const lines = md.split("\n");
      for (const line of lines) {
        const t = line.trim();
        if (!t || /^#{1,6}\s/.test(t) || t.startsWith("!") || t.startsWith("<") || t.startsWith("---") || t.startsWith("```")) continue;
        if (t.startsWith(">")) {
          digest = t.replace(/^>\s?/, "").trim();
          break;
        }
        // skip bare URLs as digest
        if (/^https?:\/\//i.test(t)) continue;
        digest = t;
        break;
      }
    }
    if (!link) {
      const lm = md.match(/https?:\/\/[^\s)\]]+/);
      if (lm) link = lm[0];
    }
  }

  // If title accidentally looks like a bare URL and we have no link, treat as link
  if (title && !link && /^https?:\/\//i.test(title) && title.indexOf(" ") < 0) {
    link = title;
    title = "";
  }

  const parts = [];
  if (title) parts.push(title);
  if (digest) parts.push(digest);
  if (link) parts.push(link);
  let text = parts.join("\n\n").trim();
  if (!text) {
    return { error: "Empty post text", hint: "Provide --title/--digest/--link or markdown with a heading/paragraph" };
  }

  if (text.length > maxLength) {
    // Prefer keeping title + link; shrink digest
    const linkPart = link ? "\n\n" + link : "";
    const titlePart = title || "";
    const budget = maxLength - linkPart.length - (titlePart ? titlePart.length + 2 : 0);
    if (budget < 20) {
      text = text.slice(0, maxLength - 1) + "…";
    } else {
      let d = digest || "";
      if (d.length > budget) d = d.slice(0, Math.max(0, budget - 1)) + "…";
      text = [titlePart, d, link].filter(Boolean).join("\n\n");
      if (text.length > maxLength) text = text.slice(0, maxLength - 1) + "…";
    }
  }

  return { text, title, digest, link, maxLength };
}

function _base64ToUint8Array(base64) {
  const pure = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  const bin = atob(pure);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

/**
 * Upload image/video bytes to X media endpoint.
 * mediaCategory: tweet_image | tweet_gif | tweet_video
 */
async function twitterUploadMedia(opts) {
  const bytes = opts.bytes || (opts.base64 ? _base64ToUint8Array(opts.base64) : null);
  if (!bytes || !bytes.length) return { error: "Empty media bytes" };
  const mediaType = opts.mediaType || "image/jpeg";
  const mediaCategory = opts.mediaCategory ||
    (mediaType.startsWith("video/") ? "tweet_video" :
      mediaType === "image/gif" ? "tweet_gif" : "tweet_image");

  const initPath = "/i/media/upload.json";
  let h = await twitterAuthHeaders(initPath, "POST");
  if (h.error) return h;

  const initUrl = "https://upload.x.com/i/media/upload.json"
    + "?command=INIT"
    + "&total_bytes=" + bytes.length
    + "&media_type=" + encodeURIComponent(mediaType)
    + "&media_category=" + encodeURIComponent(mediaCategory);

  const initResp = await fetch(initUrl, { method: "POST", credentials: "include", headers: h });
  const initText = await initResp.text();
  let initJ;
  try { initJ = JSON.parse(initText); } catch {
    return { error: "INIT parse error", hint: initText.slice(0, 200) };
  }
  const mediaId = initJ.media_id_string || String(initJ.media_id || "");
  if (!mediaId) return { error: "INIT failed", hint: initText.slice(0, 200) };

  // APPEND in ~1MB chunks (required for larger videos)
  const chunkSize = 1024 * 1024;
  let segment = 0;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    const fd = new FormData();
    fd.append("media", new Blob([chunk], { type: mediaType }), opts.name || "media");
    h = await twitterAuthHeaders(initPath, "POST");
    if (h.error) return h;
    const appendUrl = "https://upload.x.com/i/media/upload.json"
      + "?command=APPEND&media_id=" + encodeURIComponent(mediaId)
      + "&segment_index=" + segment;
    const aResp = await fetch(appendUrl, { method: "POST", credentials: "include", headers: h, body: fd });
    if (!aResp.ok && aResp.status !== 204) {
      return { error: "APPEND failed HTTP " + aResp.status, hint: (await aResp.text()).slice(0, 200) };
    }
    segment++;
  }

  h = await twitterAuthHeaders(initPath, "POST");
  if (h.error) return h;
  const finUrl = "https://upload.x.com/i/media/upload.json?command=FINALIZE&media_id=" + encodeURIComponent(mediaId);
  const finResp = await fetch(finUrl, { method: "POST", credentials: "include", headers: h });
  const finText = await finResp.text();
  let finJ;
  try { finJ = JSON.parse(finText); } catch {
    return { error: "FINALIZE parse error", hint: finText.slice(0, 200) };
  }

  // Video processing poll
  if (finJ.processing_info) {
    let info = finJ.processing_info;
    let guard = 0;
    while (info && info.state !== "succeeded" && guard < 60) {
      if (info.state === "failed") {
        return { error: "Video processing failed", hint: JSON.stringify(info.error || info) };
      }
      const wait = Math.min((info.check_after_secs || 2) * 1000, 10000);
      await new Promise((r) => setTimeout(r, wait));
      h = await twitterAuthHeaders(initPath, "GET");
      if (h.error) return h;
      const stUrl = "https://upload.x.com/i/media/upload.json?command=STATUS&media_id=" + encodeURIComponent(mediaId);
      const stResp = await fetch(stUrl, { method: "GET", credentials: "include", headers: h });
      const stJ = await stResp.json();
      info = stJ.processing_info;
      guard++;
    }
  }

  return {
    mediaId,
    mediaKey: finJ.media_key,
    size: finJ.size || bytes.length,
    mediaCategory,
  };
}

async function twitterUploadBase64Image(base64, mime, name) {
  mime = mime || "image/jpeg";
  const bytes = _base64ToUint8Array(base64);
  return twitterUploadMedia({
    bytes,
    mediaType: mime,
    mediaCategory: mime === "image/gif" ? "tweet_gif" : "tweet_image",
    name: name || "image",
  });
}

async function twitterUploadRemoteUrl(url) {
  try {
    const resp = await fetch(url, { credentials: "omit", mode: "cors" });
    if (!resp.ok) return { error: "HTTP " + resp.status + " fetching media", hint: url };
    const buf = new Uint8Array(await resp.arrayBuffer());
    const ct = (resp.headers.get("content-type") || "").split(";")[0] || "application/octet-stream";
    let mediaType = ct;
    if (!mediaType.startsWith("image/") && !mediaType.startsWith("video/")) {
      if (/\.png(\?|$)/i.test(url)) mediaType = "image/png";
      else if (/\.gif(\?|$)/i.test(url)) mediaType = "image/gif";
      else if (/\.webp(\?|$)/i.test(url)) mediaType = "image/webp";
      else if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) mediaType = "video/mp4";
      else mediaType = "image/jpeg";
    }
    return twitterUploadMedia({
      bytes: buf,
      mediaType,
      name: (url.split("?")[0].split("/").pop() || "remote").slice(0, 80),
    });
  } catch (e) {
    return { error: "Failed to fetch remote media (CORS?)", hint: url + " " + String(e) };
  }
}

async function twitterCreateDraftTweet(status, mediaIds) {
  const qid = findGraphQLQueryId("CreateDraftTweet", "cH9HZWz_EW9gnswvA4ZRiQ");
  const path = "/i/api/graphql/" + qid + "/CreateDraftTweet";
  const h = await twitterAuthHeaders(path, "POST");
  if (h.error) return h;
  h["Content-Type"] = "application/json";
  const body = {
    variables: {
      post_tweet_request: {
        auto_populate_reply_metadata: false,
        exclude_reply_user_ids: [],
        media_ids: (mediaIds || []).map(String),
        status: String(status || ""),
      },
    },
    queryId: qid,
    operationName: "CreateDraftTweet",
  };
  const resp = await fetch("https://x.com" + path, {
    method: "POST",
    credentials: "include",
    headers: h,
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch {
    return { error: "CreateDraft parse error", hint: text.slice(0, 200) };
  }
  if (data.errors && data.errors.length) {
    const msg = data.errors.map((e) => e.message || e.code).join("; ");
    return {
      error: "CreateDraft failed: " + msg,
      hint: "Ensure you are logged in and not rate-limited. Open Drafts on x.com/compose/post to verify.",
      raw: text.slice(0, 300),
    };
  }
  const draftId = data.data?.tweet?.rest_id;
  if (!draftId) {
    return { error: "CreateDraft returned no rest_id", hint: text.slice(0, 300) };
  }
  return {
    draftId,
    draftUrl: "https://x.com/compose/post",
    hint: "Open compose → Drafts to review and post",
  };
}

async function twitterFetchDrafts() {
  const qid = findGraphQLQueryId("FetchDraftTweets", "L9RqKWmAWxK6vGtR3Qdsxw");
  const path = "/i/api/graphql/" + qid + "/FetchDraftTweets";
  const h = await twitterAuthHeaders(path + "?variables=", "GET");
  if (h.error) return h;
  const url = "https://x.com" + path + "?variables=" + encodeURIComponent(JSON.stringify({ ascending: false }));
  const resp = await fetch(url, { credentials: "include", headers: h });
  const data = await resp.json();
  const items = data?.data?.viewer?.draft_list?.response_data || [];
  return {
    count: items.length,
    drafts: items.map((d) => ({
      id: d.rest_id,
      text: d.tweet_create_request?.status,
      media_ids: d.tweet_create_request?.media_ids || [],
    })),
  };
}

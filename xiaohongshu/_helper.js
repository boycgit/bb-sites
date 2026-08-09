// Shared Xiaohongshu helpers for draft-create (creator.xiaohongshu.com).
// Auto-loaded before each xiaohongshu/* adapter in this directory.
// Draft reverse notes (2026-07):
// - Long-article editor: TipTap on .ProseMirror.editor
// - Image node attrs: { imgs: [{ src, fileId, width, height, percent, desc }] }
//   IMPORTANT: TipTap renderHTML uses e.src (NOT e.url). url field renders blank <img>.
// - Upload via webpack Uploader: scene=image|video, bizName=spectrum
// - Drafts: IndexedDB draft-database-v1 / article-draft (local only)
// - Title max 64 chars; no markdown — render then setContent

const XHS_DRAFT_EDIT_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=article";
const XHS_TITLE_MAX = 64;

function xhsDraftSleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function xhsDraftGetUser() {
  try {
    const biz = localStorage.getItem("USER_INFO_FOR_BIZ");
    if (biz) {
      const j = JSON.parse(biz);
      if (j && j.userId) {
        return {
          userId: j.userId,
          userName: j.userName || j.nickname || "",
          avatar: j.userAvatar || "",
        };
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem("USER_INFO");
    if (raw) {
      const j = JSON.parse(raw);
      const u = j && j.user && j.user.value;
      if (u && u.userId) return { userId: u.userId, userName: "", avatar: "" };
    }
  } catch {}
  return null;
}

function xhsDraftEnsureLogin() {
  const u = xhsDraftGetUser();
  if (!u || !u.userId) {
    return {
      error: "Not logged in",
      hint:
        "Open and log in: bb-browser open \"" +
        XHS_DRAFT_EDIT_URL +
        "\"",
    };
  }
  return u;
}

function xhsDraftGetWebpackRequire() {
  if (!window.webpackChunkugc) return null;
  let req = null;
  try {
    window.webpackChunkugc.push([
      ["__bb_xhs_draft_" + Date.now()],
      {},
      function (r) {
        req = r;
      },
    ]);
  } catch {}
  return req && req.m ? req : null;
}

/** Find webpack export that uploads dataURL image via spectrum uploader. */
function xhsDraftFindImageUploader(req) {
  if (!req) return null;
  for (const id of Object.keys(req.m)) {
    let src;
    try {
      src = String(req.m[id]);
    } catch {
      continue;
    }
    if (
      src.includes('scene:"image"') &&
      src.includes('bizName:"spectrum"') &&
      src.includes("atob") &&
      src.includes("Body")
    ) {
      try {
        const mod = req(id);
        if (mod && typeof mod.ku === "function") return mod.ku;
        if (typeof mod === "function") return mod;
        if (mod) {
          for (const k of Object.keys(mod)) {
            if (typeof mod[k] === "function") return mod[k];
          }
        }
      } catch {}
    }
  }
  return null;
}

/** Find Uploader class + getToken for blob uploads (video). */
async function xhsDraftFindUploaderFactory(req) {
  if (!req) return null;
  let Uploader = null;
  let getToken = null;

  // Uploader class: has prototype.post + getPermit
  for (const id of Object.keys(req.m)) {
    try {
      const mod = req(id);
      if (
        mod &&
        typeof mod.A === "function" &&
        mod.A.prototype &&
        typeof mod.A.prototype.post === "function" &&
        typeof mod.A.prototype.getPermit === "function"
      ) {
        const src = String(req.m[id]);
        // Prefer ROS spectrum uploader (mentions uploadAddr / TmpSecret)
        if (src.includes("uploadAddr") || src.includes("TmpSecret") || src.includes("getPermit")) {
          if (!Uploader || src.length < 25000) Uploader = mod.A;
        }
      }
    } catch {}
  }

  // getToken: small modules exporting g(), verify by live call
  const tokenCandidates = [];
  for (const id of Object.keys(req.m)) {
    try {
      const src = String(req.m[id]);
      if (src.length > 40000) continue;
      const mod = req(id);
      if (!mod || typeof mod !== "object") continue;
      if (typeof mod.g === "function") tokenCandidates.push(mod.g);
    } catch {}
  }
  for (let i = 0; i < tokenCandidates.length; i++) {
    try {
      const p = await tokenCandidates[i]({
        bizName: "spectrum",
        scene: "image",
        fileCount: 1,
      });
      if (p && (p.uploadTempPermits || (p.data && p.data.uploadTempPermits))) {
        getToken = tokenCandidates[i];
        break;
      }
    } catch {}
  }

  if (!Uploader || !getToken) return null;
  return { Uploader, getToken };
}

function xhsDraftBase64ToDataUrl(base64, mime) {
  const pure = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  return "data:" + (mime || "image/png") + ";base64," + pure;
}

function xhsDraftBase64ToBlob(base64, mime) {
  const pure = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  const bin = atob(pure);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "application/octet-stream" });
}

async function xhsDraftUploadImageDataUrl(dataUrl) {
  const req = xhsDraftGetWebpackRequire();
  const upload = xhsDraftFindImageUploader(req);
  if (!upload) {
    return {
      error: "Image uploader not found",
      hint: "Refresh the 写长文 page and retry; webpack modules may have changed",
    };
  }
  try {
    const data = await upload(dataUrl);
    if (!data || !(data.previewUrl || data.fileId)) {
      return { error: "Upload returned empty", hint: JSON.stringify(data).slice(0, 200) };
    }
      const src = data.previewUrl || data.url || "";
    return {
      fileId: data.fileId,
      src: src,
      url: src,
      previewUrl: src,
      width: data.width || 0,
      height: data.height || 0,
    };
  } catch (e) {
    return { error: "Image upload failed", hint: String(e && e.message ? e.message : e) };
  }
}

async function xhsDraftUploadBlob(blob, scene) {
  const req = xhsDraftGetWebpackRequire();
  const fac = await xhsDraftFindUploaderFactory(req);
  if (!fac) {
    return {
      error: "Uploader factory not found",
      hint: "Refresh the 写长文 page and retry",
    };
  }
  try {
    const getToken = function (params) {
      try {
        const ret = fac.getToken(params);
        return Promise.resolve(ret).then(function (p) {
          // normalize nested data shapes
          if (p && p.data && p.data.uploadTempPermits && !p.uploadTempPermits) return p.data;
          return p;
        });
      } catch (e) {
        return Promise.reject(e);
      }
    };
    const u = new fac.Uploader({
      scene: scene || "image",
      bizName: "spectrum",
      getToken: getToken,
      enableResume: scene === "video",
    });
    const res = await u.post({ Body: blob });
    const data = res && res.data ? res.data : res;
    if (!data || !(data.fileId || data.previewUrl)) {
      return {
        error: "Upload empty result",
        hint: JSON.stringify(res).slice(0, 300),
      };
    }
    const src = data.previewUrl || data.url || "";
    return {
      fileId: data.fileId,
      src: src,
      url: src,
      previewUrl: src,
      width: data.width || 0,
      height: data.height || 0,
    };
  } catch (e) {
    return { error: "Blob upload failed", hint: String(e && e.message ? e.message : e) };
  }
}

function xhsDraftGetEditor() {
  const pm = document.querySelector(".ProseMirror");
  if (pm && pm.editor) return pm.editor;
  const all = document.querySelectorAll(".ProseMirror");
  for (const el of all) {
    if (el.editor) return el.editor;
  }
  return null;
}

async function xhsDraftWaitForEditor(timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 20000);
  while (Date.now() < deadline) {
    const ed = xhsDraftGetEditor();
    if (ed && ed.commands && typeof ed.commands.setContent === "function") return ed;
    await xhsDraftSleep(300);
  }
  return null;
}

function xhsDraftSetTitle(title) {
  const t = String(title || "").slice(0, XHS_TITLE_MAX);
  const candidates = Array.from(document.querySelectorAll("textarea")).filter(
    (el) =>
      (el.placeholder && el.placeholder.indexOf("标题") >= 0) ||
      (el.className && String(el.className).indexOf("d-text") >= 0)
  );
  const ta = candidates[0] || document.querySelector('textarea[placeholder="输入标题"]');
  if (!ta) return { ok: false, title: t };
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  if (proto && proto.set) proto.set.call(ta, t);
  else ta.value = t;
  ta.dispatchEvent(new Event("input", { bubbles: true }));
  ta.dispatchEvent(new Event("change", { bubbles: true }));
  return { ok: true, title: t };
}

function xhsDraftExtractTitle(md, fallback) {
  const m = String(md || "")
    .replace(/^\uFEFF/, "")
    .match(/^#\s+(.+)$/m);
  let t = (fallback || (m && m[1].trim()) || "未命名长文").trim();
  return t;
}

/**
 * Markdown → TipTap/ProseMirror JSON doc.
 * imagesMap: placeholder id | original path → { src, fileId, width, height, alt }
 * videoNotes: placeholder id → note text
 */
function xhsDraftMdToDoc(md, imagesMap, videoNotes) {
  imagesMap = imagesMap || {};
  videoNotes = videoNotes || {};
  let text = String(md || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  // strip first H1 (used as title)
  text = text.replace(/^#\s+.+\n+/, "");

  const lines = text.split("\n");
  const content = [];
  let i = 0;

  function pushParagraph(parts) {
    if (!parts || !parts.length) {
      content.push({ type: "paragraph" });
      return;
    }
    content.push({ type: "paragraph", content: parts });
  }

  // Prefer plain text nodes (bold/italic marks may be unavailable depending on schema)
  function toInline(s) {
    const cleaned = s
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    const withLinks = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, a, href) {
      if (imagesMap[href] || videoNotes[href]) return a;
      if (/^https?:\/\//i.test(href)) return a + " " + href;
      return a;
    });
    return withLinks ? [{ type: "text", text: withLinks }] : [];
  }

  /** Build TipTap image node — must use `src` (renderHTML reads e.src, not e.url). */
  function pushImage(info) {
    const src = info.src || info.url || info.previewUrl || "";
    if (!src) return false;
    content.push({
      type: "image",
      attrs: {
        imgs: [
          {
            src: src,
            fileId: info.fileId || "",
            width: info.width || 800,
            height: info.height || 600,
            percent: info.percent != null ? info.percent : 100,
            desc: info.alt || info.desc || "",
          },
        ],
      },
    });
    return true;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // image only line: ![alt](id) or bare placeholder
    let im = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (im) {
      const key = im[2].trim();
      const info = imagesMap[key] || imagesMap[im[0]];
      if (info && pushImage(Object.assign({}, info, { alt: info.alt || im[1] || "" }))) {
        // ok
      } else {
        pushParagraph(toInline(im[1] || "图片"));
      }
      i++;
      continue;
    }

    // video placeholder id alone or in link form already rewritten
    if (videoNotes[trimmed] || /^__VID_\d+__$/.test(trimmed)) {
      const note = videoNotes[trimmed] || "【视频占位】";
      pushParagraph(toInline(note));
      i++;
      continue;
    }

    // link line that is video placeholder
    let vm = trimmed.match(/^\[([^\]]*)\]\((__VID_\d+__)\)$/);
    if (vm && videoNotes[vm[2]]) {
      pushParagraph(toInline(videoNotes[vm[2]]));
      i++;
      continue;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      // no horizontalRule guaranteed — use empty paragraph
      pushParagraph([]);
      i++;
      continue;
    }

    let hm = line.match(/^(#{1,3})\s+(.+)$/);
    if (hm) {
      const level = Math.min(hm[1].length, 3);
      content.push({
        type: "heading",
        attrs: { level: level === 1 ? 2 : level },
        content: toInline(hm[2]),
      });
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const q = line.replace(/^>\s?/, "");
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: toInline(q) }],
      });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: toInline(lines[i].replace(/^[-*]\s+/, "")),
            },
          ],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: toInline(lines[i].replace(/^\d+\.\s+/, "")),
            },
          ],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // fenced code — plain paragraph
    if (/^```/.test(trimmed)) {
      i++;
      const codeLines = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      pushParagraph(toInline(codeLines.join(" ")));
      continue;
    }

    // accumulate paragraph lines
    const para = [trimmed];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^```/.test(lines[i].trim()) &&
      !/^!\[/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    pushParagraph(toInline(para.join(" ")));
  }

  if (!content.length) {
    content.push({ type: "paragraph", content: [{ type: "text", text: " " }] });
  }

  return { type: "doc", content: content };
}

async function xhsDraftReadIdbArticles() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("draft-database-v1");
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("article-draft")) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction("article-draft", "readonly");
      const r = tx.objectStore("article-draft").getAll();
      r.onsuccess = () => {
        db.close();
        resolve(r.result || []);
      };
      r.onerror = () => {
        db.close();
        reject(r.error);
      };
    };
  });
}

async function xhsDraftFindLatestDraft(titleHint) {
  try {
    const items = await xhsDraftReadIdbArticles();
    if (!items.length) return null;
    let best = items[0];
    for (const it of items) {
      const t1 = (it.timeStamp || 0);
      const t0 = (best.timeStamp || 0);
      if (t1 >= t0) best = it;
    }
    if (titleHint) {
      const match = items.find(
        (it) =>
          it.content &&
          it.content.articleStore &&
          it.content.articleStore.articleTitle === titleHint
      );
      if (match) best = match;
    }
    return {
      draftId: best.draftId,
      title:
        (best.content &&
          best.content.articleStore &&
          best.content.articleStore.articleTitle) ||
        "",
      timeStamp: best.timeStamp,
    };
  } catch {
    return null;
  }
}

async function xhsDraftEnsureArticlePage() {
  const href = location.href || "";
  const onCreator = /creator\.xiaohongshu\.com/i.test(href);
  const wantArticle = /target=article/i.test(href) || /publish\/publish/i.test(href);
  if (!onCreator || !wantArticle) {
    location.href = XHS_DRAFT_EDIT_URL;
    await xhsDraftSleep(4000);
  }
  // If draft drawer open without editor, click 新的创作 / 写长文 / 编辑
  let ed = await xhsDraftWaitForEditor(4000);
  if (!ed) {
    const clickLabel = async (label) => {
      const nodes = Array.from(document.querySelectorAll("button, [role=button], div, span"));
      const el = nodes.find((b) => (b.innerText || "").replace(/\s/g, "") === label);
      if (el) {
        el.click();
        await xhsDraftSleep(2000);
        return true;
      }
      return false;
    };
    await clickLabel("新的创作");
    ed = xhsDraftGetEditor();
    if (!ed) {
      await clickLabel("写长文");
      ed = await xhsDraftWaitForEditor(8000);
    }
    if (!ed) {
      // Open latest 长文草稿
      await clickLabel("编辑");
      ed = await xhsDraftWaitForEditor(10000);
    }
    if (!ed) ed = await xhsDraftWaitForEditor(10000);
  }
  return ed;
}
// ---------------------------------------------------------------------------
// 小红书「视频笔记」草稿 helpers（target=video）
// ---------------------------------------------------------------------------

const XHS_VIDEO_PUBLISH_URL =
  "https://creator.xiaohongshu.com/publish/publish?source=official&from=tab_switch&target=video";
const XHS_VIDEO_TITLE_MAX = 20;
const XHS_VIDEO_DESC_MAX = 1000;

function xhsVideoSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function xhsVideoClickByText(labels, root) {
  root = root || document;
  if (typeof labels === "string") labels = [labels];
  var nodes = root.querySelectorAll(
    "button, a, span, div, label, li, [role=button], [role=menuitem], [role=option]",
  );
  for (var L = 0; L < labels.length; L++) {
    var label = labels[L];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = ((el.innerText || el.textContent || "") + "").replace(/\s+/g, " ").trim();
      if (!t || t.length > label.length + 48) continue;
      if (t === label || t.indexOf(label) === 0 || (label.length >= 2 && t.indexOf(label) >= 0)) {
        try {
          el.click();
          return { ok: true, text: t, label: label };
        } catch (e) {
          try {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
            return { ok: true, text: t, label: label, via: "dispatch" };
          } catch (e2) {}
        }
      }
    }
  }
  return { ok: false, labels: labels };
}

function xhsVideoEnsureLogin() {
  var u = xhsDraftGetUser();
  if (!u || !u.userId) {
    return {
      error: "Not logged in",
      hint: 'Open and log in: bb-browser open "' + XHS_VIDEO_PUBLISH_URL + '"',
    };
  }
  return u;
}

async function xhsVideoEnsurePublishPage() {
  var href = location.href || "";
  var onCreator = /creator\.xiaohongshu\.com/i.test(href);
  var onVideo =
    /target=video/i.test(href) ||
    (/publish\/publish/i.test(href) && /视频|上传视频|添加视频/i.test(document.body.innerText || ""));
  if (!onCreator || !onVideo) {
    location.href = XHS_VIDEO_PUBLISH_URL;
    await xhsVideoSleep(3500);
  }
  // 若仍在图文/长文 tab，尝试点「上传视频」
  var body = document.body.innerText || "";
  if (!/上传视频|添加视频|选择视频|拖拽视频/i.test(body)) {
    xhsVideoClickByText(["上传视频", "发视频", "视频", "Video"]);
    await xhsVideoSleep(1500);
  }
  return { ok: true, href: location.href };
}

function xhsVideoFindFileInput() {
  var inputs = document.querySelectorAll('input[type=file]');
  for (var i = 0; i < inputs.length; i++) {
    var acc = (inputs[i].getAttribute("accept") || "").toLowerCase();
    if (acc.indexOf("video") >= 0 || acc.indexOf("mp4") >= 0 || acc.indexOf("mov") >= 0) {
      return inputs[i];
    }
  }
  // 回退：页面上唯一/可见的 file input
  return document.querySelector('input[type=file]');
}

async function xhsVideoMountFromBlob(args) {
  var blob = window.__bbLocalVideoBlob;
  if (!blob && !(args && (args.__localVideoCdpMounted === "1" || args.__localVideoMountMode === "fileInput"))) {
    return {
      error: "Local video not injected",
      hint: "CLI/daemon must inject video via CDP setFileInputFiles or Blob",
    };
  }

  // CDP 已挂文件：等待上传进度即可
  if (args && (args.__localVideoCdpMounted === "1" || args.__localVideoMountMode === "fileInput")) {
    return {
      ok: true,
      via: "cdp-fileInput",
      name: (args && args.__localVideoName) || "video.mp4",
      size: Number((args && args.__localVideoSize) || 0) || undefined,
    };
  }

  var input = xhsVideoFindFileInput();
  if (!input) {
    for (var w = 0; w < 20; w++) {
      await xhsVideoSleep(400);
      input = xhsVideoFindFileInput();
      if (input) break;
      xhsVideoClickByText(["上传视频", "添加视频", "选择视频", "上传"]);
    }
  }
  if (!input) {
    return {
      error: "Video file input not found",
      hint: "Stay on creator video publish page: " + XHS_VIDEO_PUBLISH_URL,
      href: location.href,
    };
  }

  var name = window.__bbLocalVideoBlobName || (args && args.__localVideoName) || "video.mp4";
  var mime = window.__bbLocalVideoBlobMime || (args && args.__localVideoMime) || blob.type || "video/mp4";
  var file;
  try {
    file = new File([blob], name, { type: mime, lastModified: Date.now() });
  } catch (e) {
    file = blob;
  }
  try {
    var dt = new DataTransfer();
    dt.items.add(file);
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      if (desc && desc.set) desc.set.call(input, dt.files);
      else input.files = dt.files;
    } catch (e2) {
      input.files = dt.files;
    }
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  } catch (e) {
    return { error: "Failed to assign File to input", hint: String(e) };
  }
  return { ok: true, via: "blob", name: name, size: blob.size };
}

async function xhsVideoWaitUpload(timeoutMs) {
  timeoutMs = timeoutMs || 180000;
  var start = Date.now();
  var last = "";
  while (Date.now() - start < timeoutMs) {
    var text = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ");
    last = text.slice(0, 240);
    if (/上传失败|格式不支持|文件过大|出错了|Something went wrong/i.test(text) && !/上传中|处理中|%/.test(text)) {
      return { error: "Xiaohongshu video upload failed", hint: last };
    }
    // 上传完成：出现标题/正文编辑区，且不再是纯上传 dropzone
    var hasTitle =
      !!document.querySelector('input[placeholder*="标题"]') ||
      !!document.querySelector('textarea[placeholder*="标题"]') ||
      !!document.querySelector('[contenteditable="true"][data-placeholder*="标题"]') ||
      !!document.querySelector('input[placeholder*="填写标题"]');
    var hasDesc =
      !!document.querySelector('[contenteditable="true"]') ||
      !!document.querySelector('textarea[placeholder*="添加"]') ||
      !!document.querySelector('div[data-placeholder*="正文"]');
    var uploading = /上传中|处理中|合成中|\d+\s*%|正在上传/i.test(text);
    if ((hasTitle || hasDesc) && !uploading) {
      await xhsVideoSleep(800);
      return { ok: true, elapsedMs: Date.now() - start };
    }
    if (/上传成功|上传完成|处理完成/i.test(text) && (hasTitle || hasDesc)) {
      return { ok: true, elapsedMs: Date.now() - start };
    }
    await xhsVideoSleep(800);
  }
  return {
    error: "Timeout waiting for Xiaohongshu video upload / edit form",
    hint: "last=" + last + " href=" + location.href,
  };
}

function xhsVideoSetInputValue(el, value) {
  if (!el) return false;
  var text = String(value || "");
  try {
    el.focus();
    if (el.isContentEditable || el.getAttribute("contenteditable") === "true") {
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      var ok = false;
      try {
        ok = document.execCommand("insertText", false, text);
      } catch (e) {
        ok = false;
      }
      if (!ok) {
        el.textContent = text;
        el.innerText = text;
      }
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true, data: text, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      return true;
    }
    var proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value");
    if (setter && setter.set) setter.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  } catch (e) {
    return false;
  }
}

async function xhsVideoFillMetadata(cfg) {
  var title = String(cfg.title || "").slice(0, XHS_VIDEO_TITLE_MAX);
  var desc = String(cfg.desc || "").slice(0, XHS_VIDEO_DESC_MAX);
  var tags = Array.isArray(cfg.tags) ? cfg.tags.map(String) : [];

  var titleEl =
    document.querySelector('input[placeholder*="标题"]') ||
    document.querySelector('textarea[placeholder*="标题"]') ||
    document.querySelector('input[placeholder*="填写标题"]') ||
    document.querySelector('[contenteditable="true"][data-placeholder*="标题"]');
  var titleOk = xhsVideoSetInputValue(titleEl, title);
  await xhsVideoSleep(300);

  // 正文/描述：优先带「添加正文/描述」占位的 contenteditable
  var descEl = null;
  var editables = document.querySelectorAll('[contenteditable="true"], textarea');
  for (var i = 0; i < editables.length; i++) {
    var el = editables[i];
    if (el === titleEl) continue;
    var ph =
      (el.getAttribute("data-placeholder") || "") +
      (el.getAttribute("placeholder") || "") +
      (el.getAttribute("aria-label") || "");
    if (/正文|描述|添加|说说|写点|caption|desc/i.test(ph)) {
      descEl = el;
      break;
    }
  }
  if (!descEl) {
    for (var j = 0; j < editables.length; j++) {
      if (editables[j] !== titleEl) {
        descEl = editables[j];
        break;
      }
    }
  }

  // 话题写入描述末尾
  var body = desc;
  if (tags.length) {
    var tagStr = tags
      .map(function (t) {
        t = String(t).replace(/^#/, "").trim();
        return t ? "#" + t : "";
      })
      .filter(Boolean)
      .join(" ");
    if (tagStr) body = (body ? body + "\n" : "") + tagStr;
  }
  body = body.slice(0, XHS_VIDEO_DESC_MAX);
  var descOk = xhsVideoSetInputValue(descEl, body);
  await xhsVideoSleep(300);

  return {
    titleOk: titleOk,
    descOk: descOk,
    title: title,
    desc: body,
    tags: tags,
  };
}

/**
 * 尽量点「存草稿 / 暂存」；没有则停留编辑页（不点发布）。
 */
async function xhsVideoSaveDraft() {
  var labels = ["存草稿", "保存草稿", "暂存", "保存", "Draft"];
  var r = xhsVideoClickByText(labels);
  if (r.ok) {
    await xhsVideoSleep(2000);
    return { ok: true, via: "button", text: r.text };
  }
  // 平台可能自动保存到「草稿箱」；未找到按钮不算失败
  return {
    ok: true,
    via: "stay-edit",
    hint: "未找到存草稿按钮，已停留在编辑页，请人工确认后发布",
  };
}

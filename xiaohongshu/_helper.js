// Shared Xiaohongshu helpers for draft-create (creator.xiaohongshu.com).
// Auto-loaded before each xiaohongshu/* adapter in this directory.
// Draft reverse notes (2026-07):
// - Long-article editor: TipTap on .ProseMirror.editor
// - Image node attrs: { imgs: [{ url, fileId, width, height }] }
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
    return {
      fileId: data.fileId,
      url: data.previewUrl || data.url || "",
      previewUrl: data.previewUrl || data.url || "",
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
    return {
      fileId: data.fileId,
      url: data.previewUrl || data.url || "",
      previewUrl: data.previewUrl || data.url || "",
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
 * imagesMap: placeholder id | original path → { url, fileId, width, height, alt }
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

  function inlineTokens(s) {
    // very light inline: **bold**, *italic*, `code`, [text](url)
    const parts = [];
    let rest = s;
    const re =
      /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    let last = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) {
        parts.push({ type: "text", text: s.slice(last, m.index) });
      }
      const tok = m[0];
      if (tok.startsWith("**")) {
        parts.push({
          type: "text",
          marks: [{ type: "bold" }],
          text: tok.slice(2, -2),
        });
      } else if (tok.startsWith("*")) {
        parts.push({
          type: "text",
          marks: [{ type: "italic" }],
          text: tok.slice(1, -1),
        });
      } else if (tok.startsWith("`")) {
        parts.push({
          type: "text",
          marks: [{ type: "code" }],
          text: tok.slice(1, -1),
        });
      } else if (tok.startsWith("[")) {
        const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (lm) {
          parts.push({
            type: "text",
            marks: [{ type: "link", attrs: { href: lm[2], target: "_blank" } }],
            text: lm[1],
          });
        } else {
          parts.push({ type: "text", text: tok });
        }
      }
      last = m.index + tok.length;
    }
    if (last < s.length) parts.push({ type: "text", text: s.slice(last) });
    // TipTap may not have link/code marks — strip marks on failure later via plain text
    return parts.length ? parts : [{ type: "text", text: s }];
  }

  function plainInline(s) {
    // Safer: only bold/italic as text decoration by unicode/emphasis in plain text if marks fail
    // Use simple text nodes only for maximum compatibility
    return s ? [{ type: "text", text: s }] : [];
  }

  // Prefer plain text nodes (bold/italic marks may be unavailable depending on schema)
  function toInline(s) {
    // Expand simple ** ** by keeping asterisks removed as visual emphasis via text only
    const cleaned = s
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    // Keep markdown links as "text (url)" if not image/video placeholders
    const withLinks = cleaned.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, a, href) {
      if (imagesMap[href] || videoNotes[href]) return a;
      if (/^https?:\/\//i.test(href)) return a + " " + href;
      return a;
    });
    return withLinks ? [{ type: "text", text: withLinks }] : [];
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // image only line: ![alt](id) or bare placeholder
    let im = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (im) {
      const src = im[2].trim();
      const info = imagesMap[src] || imagesMap[im[0]];
      if (info && info.url) {
        content.push({
          type: "image",
          attrs: {
            imgs: [
              {
                url: info.url,
                fileId: info.fileId || "",
                width: info.width || 800,
                height: info.height || 600,
              },
            ],
          },
        });
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

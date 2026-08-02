/**
 * TikTok Studio (www.tiktok.com/tiktokstudio) helpers — upload video + fill caption.
 * Platform has no independent draft URL; stay on edit page and never click 发布/Post.
 *
 * DOM notes (Studio 2025/2026, zh-CN):
 * - Empty upload: [data-e2e=select_video_container], input[type=file][accept*=video], button 选择视频
 * - After upload: [data-e2e=upload_status_container] "已上传", [data-e2e=caption_container]
 * - Caption: Draft.js .public-DraftEditor-content inside .caption-editor (limit 4000)
 * - Hashtag toolbar: #web-creation-caption-hashtag-button
 * - Post: [data-e2e=post_video_button] 发布 — NEVER click
 * - Discard: [data-e2e=discard_post_button] 放弃 (+ confirm dialog 放弃此次发布)
 */

var __TT_UPLOAD_URL =
  "https://www.tiktok.com/tiktokstudio/upload?from=creator_center&tab=video";
var __TT_MANAGE_URL = "https://www.tiktok.com/tiktokstudio/content";
var __TT_CAPTION_LIMIT = 4000;

function __ttSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function __ttClickByText(labels, root) {
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
      if (!t || t.length > label.length + 40) continue;
      if (t === label || t.indexOf(label) === 0 || (label.length >= 4 && t.indexOf(label) >= 0)) {
        try {
          el.click();
          return { ok: true, text: t, label: label };
        } catch (e) {
          try {
            el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
            return { ok: true, text: t, label: label, via: "dispatch" };
          } catch (e2) {
            /* continue */
          }
        }
      }
    }
  }
  return { ok: false, labels: labels };
}

function __ttEnsureSession() {
  if (!/tiktok\.com/i.test(location.host)) {
    return {
      error: "Not on tiktok.com",
      hint: 'Open: bb-browser open "' + __TT_UPLOAD_URL + '" and log in',
    };
  }
  if (
    /login|signup|passport|sso/i.test(location.href) ||
    /Log in|Sign up|扫码登录|手机号登录|登录以继续/i.test(document.body.innerText || "")
  ) {
    // Soft: only fail when body clearly looks like auth wall without studio chrome
    var body = document.body.innerText || "";
    if (!/tiktokstudio|选择视频|视频描述|上传/i.test(body) && /登录|Log in|Sign up/i.test(body)) {
      return {
        error: "Not logged in",
        hint: "Log in to TikTok Studio in the bb-browser Chrome, then open " + __TT_UPLOAD_URL,
      };
    }
  }
  if (!/tiktokstudio/i.test(location.href) && !/tiktokstudio|选择视频|视频描述|已上传/i.test(document.body.innerText || "")) {
    return {
      error: "Not on TikTok Studio upload page",
      hint: 'Open: bb-browser open "' + __TT_UPLOAD_URL + '"',
      href: location.href,
    };
  }
  return { ok: true };
}

/**
 * Dismiss resume / unsaved dialogs so upload can start clean.
 * Dialogs seen in Studio (zh-CN):
 * - 「过往编辑的视频未保存。继续编辑？」 → 放弃 / 继续
 * - 「放弃此次发布？」→ 暂时不要 / 放弃（永久放弃）
 * - 「放弃此次发布？」→ 继续编辑 / 放弃
 */
async function __ttDismissResumeDialogs() {
  var actions = [];
  for (var round = 0; round < 6; round++) {
    var text = document.body.innerText || "";
    var hasDialog =
      /过往编辑的视频未保存|放弃此次发布|将被永久放弃|所有编辑内容都将被|Continue editing\?|Discard this post|will be permanently discarded|unsaved/i.test(
        text,
      );
    if (!hasDialog) break;

    // Prefer explicit 放弃 inside dialog-ish containers; avoid navbar noise
    var clicked = false;
    var btns = document.querySelectorAll("button");
    var candidates = [];
    for (var i = 0; i < btns.length; i++) {
      var t = ((btns[i].innerText || "") + "").replace(/\s+/g, " ").trim();
      if (t !== "放弃" && t !== "Discard" && t !== "Discard now" && t !== "Don't save") continue;
      var rect = btns[i].getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      var parent = btns[i].parentElement;
      var ptext = "";
      for (var up = 0; up < 6 && parent; up++) {
        ptext = (parent.innerText || "").slice(0, 400);
        if (/过往编辑|放弃此次|永久放弃|暂时不要|继续编辑|Discard|unsaved|Continue editing/i.test(ptext)) {
          break;
        }
        parent = parent.parentElement;
      }
      candidates.push({ el: btns[i], t: t, ptext: ptext, y: rect.y });
    }
    // Prefer buttons whose ancestor mentions discard/resume dialog copy
    candidates.sort(function (a, b) {
      var as = /过往编辑|放弃此次|永久放弃|Discard this|unsaved/i.test(a.ptext) ? 0 : 1;
      var bs = /过往编辑|放弃此次|永久放弃|Discard this|unsaved/i.test(b.ptext) ? 0 : 1;
      if (as !== bs) return as - bs;
      return b.y - a.y; // lower on screen often = confirm
    });
    if (candidates.length) {
      try {
        candidates[0].el.click();
        clicked = true;
        actions.push({ round: round, text: candidates[0].t, via: "dialog-btn" });
      } catch (e) {
        /* ignore */
      }
    }
    if (!clicked) {
      var r = __ttClickByText(["放弃", "Discard", "Don't save"]);
      if (r.ok) {
        clicked = true;
        actions.push({ round: round, text: r.text, via: "fallback" });
      }
    }
    if (!clicked) break;
    await __ttSleep(1000);
  }
  return { actions: actions };
}

/**
 * If previous unfinished post is still open, discard so a clean upload can start.
 */
async function __ttDiscardPreviousIfAny() {
  var dialog = await __ttDismissResumeDialogs();
  await __ttSleep(400);

  var text = document.body.innerText || "";
  var hasEdit =
    !!document.querySelector('[data-e2e="caption_container"]') ||
    !!document.querySelector('[data-e2e="upload_status_container"]') ||
    (!!document.querySelector('[data-e2e="post_video_button"]') &&
      /已上传|视频描述|Post video|发布/.test(text));

  var hasEmpty =
    !!document.querySelector('[data-e2e="select_video_container"]') ||
    !!document.querySelector('input[type=file][accept*="video"]') ||
    /选择要上传的视频|选择视频|Select video|or drag/i.test(text);

  if (!hasEdit || (hasEmpty && !document.querySelector('[data-e2e="caption_container"]'))) {
    return { skipped: !dialog.actions.length, dialog: dialog };
  }

  var discard = document.querySelector('[data-e2e="discard_post_button"]') || null;
  if (discard) {
    try {
      discard.click();
    } catch (e) {
      __ttClickByText(["放弃", "Discard"]);
    }
  } else {
    __ttClickByText(["放弃", "Discard"]);
  }
  await __ttSleep(700);
  var confirm = await __ttDismissResumeDialogs();
  await __ttSleep(1000);
  return { discarded: true, dialog: dialog, confirm: confirm };
}

function __ttFindFileInput() {
  return (
    document.querySelector('input[type=file][accept*="video"]') ||
    document.querySelector('input[type=file][accept*="mp4"]') ||
    document.querySelector("input[type=file]")
  );
}

async function __ttMountVideo(args) {
  if (!/tiktok\.com/i.test(location.host)) {
    return {
      error: "Not on tiktok.com",
      hint: 'Open: bb-browser open "' + __TT_UPLOAD_URL + '"',
      href: location.href,
    };
  }

  var cdpMounted =
    args &&
    (args.__localVideoCdpMounted === "1" || args.__localVideoMountMode === "fileInput");

  // IMPORTANT: when daemon already set files via CDP, do NOT click 放弃 — that cancels the in-flight upload.
  if (cdpMounted) {
    var realNow = __ttIsRealUploadReady();
    if (realNow.ok || realNow.uploading) {
      return {
        ok: true,
        via: "cdp-fileInput",
        name: (args && args.__localVideoName) || "video.mp4",
        size: Number((args && args.__localVideoSize) || 0) || undefined,
        reused: !!realNow.ok,
        uploading: !!realNow.uploading,
      };
    }
    // Soft wait for real progress / 已上传 (do not discard; do not trust caption alone)
    for (var wi = 0; wi < 40; wi++) {
      await __ttSleep(500);
      realNow = __ttIsRealUploadReady();
      if (realNow.ok || realNow.uploading) {
        return {
          ok: true,
          via: "cdp-fileInput",
          name: (args && args.__localVideoName) || "video.mp4",
          size: Number((args && args.__localVideoSize) || 0) || undefined,
        };
      }
    }
    // Fall through to Blob mount retry only if CDP mount never started
  } else {
    // Always clear resume/unsaved dialogs first (they block file assignment)
    await __ttDismissResumeDialogs();
    await __ttDiscardPreviousIfAny();
    await __ttDismissResumeDialogs();
    await __ttSleep(500);
  }

  var text0 = (document.body && document.body.innerText) || "";

  var blob = window.__bbLocalVideoBlob;
  if (!blob) {
    // If CDP mount is in flight, still allow waiting without blob
    if (args && args.__localVideoCdpMounted === "1") {
      return {
        ok: true,
        via: "cdp-fileInput-pending",
        name: (args && args.__localVideoName) || "video.mp4",
        size: Number((args && args.__localVideoSize) || 0) || undefined,
      };
    }
    return {
      error: "Local video not injected",
      hint: "Put the local path in config.video; CLI/daemon must inject it via setFileInputFiles or Blob fallback",
    };
  }

  var input = __ttFindFileInput();
  if (!input) {
    for (var w = 0; w < 25; w++) {
      await __ttSleep(400);
      await __ttDismissResumeDialogs();
      input = __ttFindFileInput();
      if (input) break;
      // Already on edit form after CDP mount
      if (
        document.querySelector('[data-e2e="caption_container"]') ||
        document.querySelector('[data-e2e="upload_status_container"]')
      ) {
        return {
          ok: true,
          via: "already-editing",
          name: (args && args.__localVideoName) || "video.mp4",
          reused: true,
        };
      }
    }
  }

  // Still on edit form without file input — try 替换 to re-open picker
  if (!input) {
    var replaceBtn = null;
    var allBtn = document.querySelectorAll("button, [role=button], span, div");
    for (var ri = 0; ri < allBtn.length; ri++) {
      var rt = ((allBtn[ri].innerText || "") + "").replace(/\s+/g, " ").trim();
      if (rt === "替换" || rt === "Replace" || rt === "Replace video") {
        replaceBtn = allBtn[ri];
        break;
      }
    }
    if (replaceBtn) {
      try {
        replaceBtn.click();
      } catch (e) {
        /* ignore */
      }
      await __ttSleep(800);
      await __ttDismissResumeDialogs();
      input = __ttFindFileInput();
      for (var w2 = 0; w2 < 15 && !input; w2++) {
        await __ttSleep(300);
        input = __ttFindFileInput();
      }
    }
  }

  if (!input) {
    return {
      error: "Video file input not found",
      hint: "Stay on TikTok Studio upload dropzone (选择视频). Discard previous post if edit form is open.",
      href: location.href,
      bodyHint: ((document.body && document.body.innerText) || "").slice(0, 200),
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
  return {
    ok: true,
    via: "blob",
    name: name,
    size: blob.size,
    fileCount: input.files ? input.files.length : 0,
  };
}

/**
 * True when Studio shows a real completed (or nearly completed) video upload.
 * Do NOT treat bare caption form as success — onBeforeUpload can open empty form.
 */
function __ttIsRealUploadReady() {
  var up = document.querySelector('[data-e2e="upload_status_container"]');
  var upText = (up && (up.innerText || up.textContent)) || "";
  var text = (document.body && document.body.innerText) || "";
  if (/已上传|Upload complete|Uploaded\s*\(/i.test(upText)) return { ok: true, via: "status-uploaded" };
  if (/已上传\s*[（(]/.test(text) && /\.mp4|\.mov|\.webm/i.test(text)) {
    return { ok: true, via: "body-uploaded" };
  }
  // Still transferring: MB/MB progress or countdown — keep waiting (not ready)
  if (/\d+(\.\d+)?\s*MB\s*\/\s*\d+(\.\d+)?\s*MB/.test(upText || text)) {
    return { ok: false, uploading: true, via: "mb-progress" };
  }
  if (/还剩|取消/.test(upText || text) && /\d+\s*%/.test(upText || text)) {
    return { ok: false, uploading: true, via: "pct-progress" };
  }
  return { ok: false };
}

/**
 * Return the upload-page error shown by TikTok Studio, if any.
 * The post-upload editor can collapse into a generic retry screen even after
 * the media storage API accepted every chunk, so HTTP success is not enough.
 */
function __ttGetUploadError() {
  var text = ((document.body && document.body.innerText) || "").replace(/\s+/g, " ").trim();
  var patterns = [
    /上传失败[^。！!\n]*/i,
    /格式不支持[^。！!\n]*/i,
    /文件过大[^。！!\n]*/i,
    /出错了\s*请重试/i,
    /Upload failed[^.！!\n]*/i,
    /Something went wrong\s*(?:Please try again)?/i,
    /not supported[^.！!\n]*/i,
    /too large[^.！!\n]*/i,
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) return match[0].trim();
  }
  return "";
}

/**
 * Wait until video is truly uploaded (已上传) and caption editor is ready.
 */
async function __ttWaitEditForm(timeoutMs) {
  timeoutMs = timeoutMs || 180000;
  var start = Date.now();
  var last = "";
  while (Date.now() - start < timeoutMs) {
    var text = (document.body && document.body.innerText) || "";
    last = text.slice(0, 280);
    var uploadError = __ttGetUploadError();
    if (uploadError) {
      return { error: "TikTok Studio upload failed: " + uploadError, hint: last };
    }

    var real = __ttIsRealUploadReady();
    if (real.uploading) {
      await __ttSleep(1000);
      continue;
    }

    var captionEl =
      document.querySelector('[data-e2e="caption_container"] .public-DraftEditor-content') ||
      document.querySelector(".caption-editor .public-DraftEditor-content") ||
      document.querySelector('[data-e2e="caption_container"] [contenteditable="true"]') ||
      document.querySelector(".public-DraftEditor-content");

    // Require real 已上传 — caption alone is NOT enough (empty form trap)
    if (real.ok && captionEl) {
      await __ttSleep(1200);
      return {
        ok: true,
        elapsedMs: Date.now() - start,
        href: location.href,
        hasCaption: true,
        uploaded: true,
        uploadVia: real.via,
      };
    }
    // Uploaded but caption editor not yet mounted
    if (real.ok && !captionEl) {
      await __ttSleep(800);
      continue;
    }
    await __ttSleep(1000);
  }
  return {
    error: "Timeout waiting for video upload (已上传) + edit form",
    hint:
      "Need upload_status 已上传, not just 视频描述 form. last=" +
      last +
      " href=" +
      location.href,
  };
}

function __ttSetDraftEditor(el, value) {
  if (!el) return false;
  var text = String(value || "");
  try {
    el.focus();
    // Select all content then insertText so Draft.js listeners fire
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
      try {
        document.execCommand("selectAll", false, null);
        ok = document.execCommand("insertText", false, text);
      } catch (e2) {
        ok = false;
      }
    }
    if (!ok) {
      el.textContent = text;
      el.innerText = text;
    }
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: text,
        inputType: "insertText",
      }),
    );
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    return true;
  } catch (e3) {
    try {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      return true;
    } catch (e4) {
      return false;
    }
  }
}

function __ttBuildCaption(title, desc, tags) {
  var parts = [];
  var t = String(title || "").trim();
  var d = String(desc || "").trim();
  if (t) parts.push(t);
  if (d && d !== t) parts.push(d);
  var tagsArr = Array.isArray(tags) ? tags : [];
  var hash = tagsArr
    .map(function (x) {
      return String(x).replace(/^#/, "").trim();
    })
    .filter(Boolean)
    .map(function (x) {
      return "#" + x;
    })
    .join(" ");
  var body = parts.join("\n");
  if (!hash) return body.slice(0, __TT_CAPTION_LIMIT);
  var suffix = "\n" + hash;
  if (suffix.length >= __TT_CAPTION_LIMIT) return suffix.slice(0, __TT_CAPTION_LIMIT);
  return body.slice(0, __TT_CAPTION_LIMIT - suffix.length) + suffix;
}

async function __ttFillMetadata(cfg) {
  var title = String(cfg.title || "").slice(0, 100);
  var tags = Array.isArray(cfg.tags) ? cfg.tags.map(String) : [];
  var desc = String(cfg.desc || "");
  var caption = __ttBuildCaption(title, desc, tags);

  var editor =
    document.querySelector('[data-e2e="caption_container"] .public-DraftEditor-content') ||
    document.querySelector(".caption-editor .public-DraftEditor-content") ||
    document.querySelector('[data-e2e="caption_container"] [contenteditable="true"]') ||
    document.querySelector(".public-DraftEditor-content");

  var captionOk = false;
  if (editor) {
    captionOk = __ttSetDraftEditor(editor, caption);
    await __ttSleep(300);
    // re-apply once (Draft.js sometimes eats first write)
    captionOk = __ttSetDraftEditor(editor, caption) || captionOk;
  }

  var shown = "";
  if (editor) {
    shown = ((editor.innerText || editor.textContent || "") + "").trim();
  }
  var titleOk = !!(title && shown.indexOf(title.slice(0, Math.min(8, title.length))) >= 0);
  var descOk = captionOk && shown.length >= Math.min(4, caption.length);

  return {
    titleOk: titleOk || captionOk,
    descOk: descOk,
    captionOk: captionOk,
    caption: caption,
    title: title,
    desc: desc,
    tags: tags,
    editorText: shown.slice(0, 200),
  };
}

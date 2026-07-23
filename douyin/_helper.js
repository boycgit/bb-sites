/**
 * 抖音创作者中心 (creator.douyin.com) helpers — video upload as unpublished draft.
 */

var __DY_UPLOAD_URL = "https://creator.douyin.com/creator-micro/content/upload";
var __DY_POST_URL = "https://creator.douyin.com/creator-micro/content/post/video";
var __DY_DECLARE = "内容为个人观点或见解";

function __dySleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function __dyClickByText(labels, root) {
  root = root || document;
  if (typeof labels === "string") labels = [labels];
  var nodes = root.querySelectorAll(
    "button, a, span, div, label, li, [role=button], [role=menuitem], [role=option], [role=radio]",
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
          } catch (e2) { /* continue */ }
        }
      }
    }
  }
  return { ok: false, labels: labels };
}

async function __dyEnsureSession() {
  if (!/creator\.douyin\.com/i.test(location.host)) {
    return {
      error: "Not on creator.douyin.com",
      hint: 'Open: bb-browser open "' + __DY_UPLOAD_URL + '" and log in',
    };
  }
  if (/login|passport|sso|scan/i.test(location.href) || /扫码登录|手机号登录/.test(document.body.innerText || "")) {
    return {
      error: "Not logged in",
      hint: "Log in to 抖音创作者中心 in the bb-browser Chrome",
    };
  }
  // Soft API check
  try {
    var r = await fetch("https://creator.douyin.com/web/api/media/user/info/", {
      credentials: "include",
    });
    var t = await r.text();
    if (/login|未登录|status_code\":\s*8/.test(t) && r.status !== 200) {
      return {
        error: "Not logged in",
        hint: "Log in to 抖音创作者中心, then retry",
      };
    }
  } catch (e) { /* page UI may still work */ }
  return { ok: true };
}

/**
 * Default: discard previous unpublished draft so this run starts clean.
 */
async function __dyDismissResumeDialog(preferDiscard) {
  preferDiscard = preferDiscard !== false;
  var text = document.body.innerText || "";
  if (!/继续编辑|未发布的视频|上次未发布/.test(text)) {
    return { skipped: true };
  }
  if (preferDiscard) {
    var g = __dyClickByText(["放弃"]);
    if (g.ok) {
      await __dySleep(800);
      return { discarded: true };
    }
  }
  var c = __dyClickByText(["继续编辑"]);
  if (c.ok) {
    await __dySleep(1500);
    return { resumed: true };
  }
  return { found: true, action: "none" };
}

async function __dyMountVideo(args) {
  var blob = window.__bbLocalVideoBlob;
  if (!blob) {
    return {
      error: "Local video not injected",
      hint: "CLI must pass --video; daemon injects window.__bbLocalVideoBlob",
    };
  }

  // Ensure on upload page (do not full navigate if already post/video mid-flow)
  if (!/content\/upload|content\/post\/video/i.test(location.href)) {
    return {
      error: "Not on Douyin upload/post page",
      hint: 'Open: bb-browser open "' + __DY_UPLOAD_URL + '"',
      href: location.href,
    };
  }

  await __dyDismissResumeDialog(true);
  await __dySleep(500);

  // If still on post/video with form, user may need fresh upload — go upload URL via history? skip full nav
  // Prefer file input on current page
  var input =
    document.querySelector('input[type=file][accept*="video"]') ||
    document.querySelector('input[type=file][accept*="mp4"]') ||
    document.querySelector("input[type=file]");

  if (!input && /post\/video/i.test(location.href)) {
    // On edit page without re-upload — try go back to upload only if no video preview
    var hasVideo = !!document.querySelector("video") || /重新上传|更换视频/.test(document.body.innerText || "");
    if (!hasVideo) {
      return {
        error: "No file input on post page",
        hint: "Open upload page and discard previous draft first",
      };
    }
    // reuse existing video, only fill meta later
    return { ok: true, reused: true, name: "existing" };
  }

  if (!input) {
    // Wait for input
    for (var w = 0; w < 20; w++) {
      await __dySleep(400);
      input =
        document.querySelector('input[type=file][accept*="video"]') ||
        document.querySelector("input[type=file]");
      if (input) break;
    }
  }
  if (!input) {
    return { error: "Video file input not found", hint: "Stay on 发布视频 upload dropzone" };
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
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  } catch (e) {
    return { error: "Failed to assign File to input", hint: String(e) };
  }
  return { ok: true, name: name, size: blob.size };
}

/**
 * Wait until edit form is ready (title box / post video page).
 */
async function __dyWaitEditForm(timeoutMs) {
  timeoutMs = timeoutMs || 100000;
  var start = Date.now();
  var last = "";
  while (Date.now() - start < timeoutMs) {
    var text = (document.body && document.body.innerText) || "";
    last = text.slice(0, 200);
    if (/上传失败|格式不支持|文件过大/.test(text)) {
      return { error: "Upload failed", hint: last };
    }
    // Edit form signals
    var titleEl =
      document.querySelector('input[placeholder*="标题"]') ||
      document.querySelector('textarea[placeholder*="标题"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector('[class*="title"] input') ||
      document.querySelector('[class*="title"] textarea') ||
      document.querySelector(".public-DraftEditor-content") ||
      document.querySelector('[data-placeholder*="标题"]') ||
      document.querySelector('[data-placeholder*="作品"]');

    var onPost = /post\/video/i.test(location.href);
    var hasMeta =
      /自主声明|作品描述|添加作品描述|话题|封面|发布|定时发布|暂存/.test(text) ||
      !!titleEl;

    var uploading = /上传中|处理中|转码|上传进度|\d+%/.test(text);

    if ((onPost || hasMeta) && !uploading && (titleEl || /自主声明|发布/.test(text))) {
      // settle
      if (Date.now() - start > 2500 || !uploading) {
        await __dySleep(1000);
        return {
          ok: true,
          elapsedMs: Date.now() - start,
          href: location.href,
          hasTitleEl: !!titleEl,
        };
      }
    }
    await __dySleep(1000);
  }
  return {
    error: "Timeout waiting for edit form after upload",
    hint: "last=" + last + " href=" + location.href,
  };
}

function __dySetInputValue(el, value) {
  if (!el) return false;
  var text = String(value || "");
  el.focus();
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
    var proto = el.tagName === "INPUT" ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  // contenteditable / draft-js
  try {
    el.focus();
    document.execCommand("selectAll", false, null);
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
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch (e2) {
    return false;
  }
}

function __dyBuildCaption(title, desc, tags) {
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
  if (hash) parts.push(hash);
  // Douyin title often one field ~1000 chars; keep reasonable
  return parts.join("\n").slice(0, 1000);
}

async function __dyFillMetadata(cfg) {
  var title = String(cfg.title || "").slice(0, 30);
  var tags = Array.isArray(cfg.tags) ? cfg.tags : [];
  var hash = tags
    .map(function (x) {
      return String(x).replace(/^#/, "").trim();
    })
    .filter(Boolean)
    .map(function (x) {
      return "#" + x;
    })
    .join(" ");
  var descBody = String(cfg.desc || "").trim();
  if (hash) descBody = (descBody ? descBody + " " : "") + hash;
  descBody = descBody.slice(0, 1000);

  var titleOk = false;
  var descOk = false;

  // Title: input.semi-input placeholder 填写作品标题…
  var titleInput =
    document.querySelector('input.semi-input[placeholder*="作品标题"]') ||
    document.querySelector('input[placeholder*="填写作品标题"]') ||
    document.querySelector('input[placeholder*="作品标题"]') ||
    document.querySelector('input.semi-input-default');
  if (titleInput) {
    titleOk = __dySetInputValue(titleInput, title);
  }

  // Description: zone with data-placeholder 添加作品简介
  var descEl =
    document.querySelector('[data-placeholder="添加作品简介"]') ||
    document.querySelector('[data-placeholder*="作品简介"]') ||
    document.querySelector(".zone-container.editor-kit-container") ||
    document.querySelector(".editor-kit-editor-container");
  if (descEl) {
    // Prefer contenteditable leaf inside
    var ce =
      descEl.querySelector("[contenteditable=true]") ||
      descEl.querySelector("[contenteditable]") ||
      descEl;
    descOk = __dySetInputValue(ce, descBody);
  }

  return {
    titleOk: titleOk,
    descOk: descOk,
    caption: title + (descBody ? "\n" + descBody : ""),
    title: title,
    descBody: descBody,
  };
}

async function __dyApplyDeclaration() {
  // Open select: 请选择自主声明 (.selectBox / .selectText)
  var open =
    document.querySelector(".selectBox-buZRzi") ||
    document.querySelector(".selectText-XSrMFZ") ||
    document.querySelector(".controlWrapper-Kt_9Xm");
  if (open) {
    open.click();
  } else {
    __dyClickByText(["请选择自主声明", "自主声明"]);
  }
  await __dySleep(900);

  // Modal: 请选择声明类型（单选）→ 内容为个人观点或见解 → 确定
  // Prefer leaf nodes with exact text (parent divs may swallow clicks)
  var r = { ok: false };
  var all = document.querySelectorAll("span, label, div, p");
  for (var i = 0; i < all.length; i++) {
    var t = (all[i].innerText || "").replace(/\s+/g, " ").trim();
    if (t === __DY_DECLARE || t === "内容为个人观点或见解") {
      if (all[i].children && all[i].children.length > 2) continue;
      all[i].click();
      r = { ok: true, text: t, via: "leaf" };
      break;
    }
  }
  if (!r.ok) {
    r = __dyClickByText([__DY_DECLARE, "内容为个人观点或见解"]);
  }
  await __dySleep(400);
  // Footer 确定 — prefer visible buttons at bottom of modal
  var oks = document.querySelectorAll("button");
  var conf = { ok: false };
  for (var j = oks.length - 1; j >= 0; j--) {
    if ((oks[j].innerText || "").trim() !== "确定") continue;
    var rect = oks[j].getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      oks[j].click();
      conf = { ok: true };
      break;
    }
  }
  if (!conf.ok) conf = __dyClickByText(["确定", "确认"]);
  await __dySleep(600);

  var verified = false;
  var shownEl = document.querySelector(".selectText-XSrMFZ");
  if (shownEl) {
    var shown = (shownEl.innerText || "").trim();
    if (shown.indexOf("个人观点") >= 0) verified = true;
  }
  return {
    ok: verified || !!(r && r.ok),
    text: (r && r.text) || __DY_DECLARE,
    confirmed: !!(conf && conf.ok),
    verified: verified,
  };
}

/**
 * Save as unpublished draft — never click 发布.
 */
async function __dySaveDraft() {
  // Footer: 「发布」+「暂存离开」— must use 暂存离开 only
  var save = __dyClickByText(["暂存离开"]);
  if (!save.ok) {
    // Prefer buttons whose exact text is 暂存离开
    var btns = document.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].innerText || "").replace(/\s+/g, "").trim();
      if (t === "暂存离开") {
        btns[i].click();
        save = { ok: true, text: "暂存离开", via: "exact-button" };
        break;
      }
    }
  }
  if (!save.ok) {
    save = __dyClickByText(["暂存", "存草稿", "保存草稿"]);
  }
  if (!save.ok) {
    return {
      ok: true,
      via: "auto-draft-hint",
      warning:
        "未找到「暂存离开」；请勿点发布。作品描述已填写时，离开页面通常保留未发布草稿。",
    };
  }

  await __dySleep(2000);
  __dyClickByText(["确定", "知道了", "我知道了"]);
  await __dySleep(800);
  return { ok: true, via: "click", label: save.label || save.text };
}

async function __dyVerifyUnpublishedDraft(titleHint) {
  // Soft verify: reopen not possible mid-evaluate; check body for title or 继续编辑 capability
  var text = document.body.innerText || "";
  var hasTitle = titleHint && text.indexOf(String(titleHint).slice(0, 10)) >= 0;
  return {
    hasTitle: !!hasTitle,
    onPost: /post\/video/i.test(location.href),
    onUpload: /content\/upload/i.test(location.href),
    hasPublishBtn: /发布/.test(text),
  };
}

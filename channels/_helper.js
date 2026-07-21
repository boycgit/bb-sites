/**
 * 视频号助手 (channels.weixin.qq.com) helpers.
 * Content lives in wujie same-origin iframe: /micro/content/post/create
 */

var __CH_CREATE_URL = "https://channels.weixin.qq.com/platform/post/create";
var __CH_DRAFT_URL = "https://channels.weixin.qq.com/platform/post/draftListManager";
var __CH_API = "/cgi-bin/mmfinderassistant-bin";
var __CH_COLLECTION_NAME = "算法可视化";
var __CH_LOCATION_CITY = "杭州市";
var __CH_ANNOTATION = "个人观点，仅供参考";

function __chSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

/** Walk document + shadow roots to find iframe whose content matches create/draft. */
function __chFindIframe(needle) {
  needle = needle || "post/create";
  function walk(root) {
    var list = root.querySelectorAll("iframe");
    for (var i = 0; i < list.length; i++) {
      try {
        var d = list[i].contentDocument;
        var href = (d && d.location && d.location.href) || "";
        if (href.indexOf(needle) >= 0) return list[i];
        if (d && d.querySelector && d.querySelector('input[type=file][accept*="video"]')) {
          if (needle.indexOf("create") >= 0) return list[i];
        }
      } catch (e) { /* cross-origin */ }
    }
    var all = root.querySelectorAll("*");
    for (var j = 0; j < all.length; j++) {
      if (all[j].shadowRoot) {
        var hit = walk(all[j].shadowRoot);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(document);
}

function __chGetCreateWin() {
  var f = __chFindIframe("post/create");
  if (!f) f = __chFindIframe("create");
  if (!f) return null;
  return {
    iframe: f,
    win: f.contentWindow,
    doc: f.contentDocument,
  };
}

async function __chApi(win, path, body) {
  win = win || window;
  var url = path.indexOf("http") === 0 ? path : __CH_API + path;
  // Prefer micro content origin when calling from host
  if (win === window && path.indexOf("http") !== 0) {
    // try iframe first
    var ctx = __chGetCreateWin();
    if (ctx && ctx.win) win = ctx.win;
  }
  var resp = await win.fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  var text = await resp.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: "API parse error", hint: text.slice(0, 200), status: resp.status, path: path };
  }
  if (data.errCode != null && data.errCode !== 0) {
    return {
      error: data.errMsg || ("errCode " + data.errCode),
      errCode: data.errCode,
      raw: data,
      path: path,
    };
  }
  return data.data != null ? data.data : data;
}

async function __chEnsureSession() {
  if (!/channels\.weixin\.qq\.com/i.test(location.host)) {
    return {
      error: "Not on channels.weixin.qq.com",
      hint: 'Open: bb-browser open "' + __CH_CREATE_URL + '" and log in to 视频号助手',
    };
  }
  // Soft check: draft list (works in iframe)
  var ctx = __chGetCreateWin();
  var win = (ctx && ctx.win) || window;
  try {
    var list = await __chApi(win, "/post/get_draft_list", { pageSize: 1, currentPage: 1 });
    if (list && list.error && /login|登录|auth/i.test(String(list.error))) {
      return {
        error: "Not logged in",
        hint: "Log in at https://channels.weixin.qq.com in bb-browser Chrome",
      };
    }
  } catch (e) {
    // continue — page may still work
  }
  return { ok: true };
}

async function __chEnsureCreatePage() {
  var href = location.href || "";
  if (!/post\/create/i.test(href)) {
    return {
      error: "Not on post create page",
      hint: 'Open: bb-browser open "' + __CH_CREATE_URL + '" (do not navigate during site run)',
      href: href,
    };
  }
  // dismiss host dialogs
  try {
    var btns = document.querySelectorAll("button");
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].innerText || "").trim();
      if (t === "我知道了" || t === "知道了") btns[i].click();
    }
  } catch (e) { /* ignore */ }

  for (var w = 0; w < 40; w++) {
    var ctx = __chGetCreateWin();
    if (ctx && ctx.doc && ctx.doc.querySelector('input[type=file][accept*="video"]')) {
      return { ok: true, ctx: ctx };
    }
    await __chSleep(400);
  }
  return {
    error: "Create iframe not ready",
    hint: "Wait for 视频号助手 create page to fully load, then retry",
  };
}

/**
 * Mount daemon-injected Blob onto iframe file input (triggers official uploader).
 */
async function __chMountVideo(args) {
  var blob = window.__bbLocalVideoBlob;
  if (!blob) {
    return {
      error: "Local video not injected",
      hint: "CLI must pass --video; daemon injects window.__bbLocalVideoBlob",
    };
  }
  var page = await __chEnsureCreatePage();
  if (page.error) return page;
  var doc = page.ctx.doc;
  var input = doc.querySelector('input[type=file][accept*="video"]') || doc.querySelector("input[type=file]");
  if (!input) {
    return { error: "Video file input not found in create iframe" };
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
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (e) {
    return { error: "Failed to assign File to iframe input", hint: String(e) };
  }
  return { ok: true, name: name, size: blob.size };
}

/**
 * Wait until video upload / processing finishes enough to save draft.
 * Heuristics: progress text gone, media preview present, 保存草稿 not disabled.
 */
async function __chWaitUpload(timeoutMs) {
  timeoutMs = timeoutMs || 100000;
  var start = Date.now();
  var lastText = "";
  var sawProgress = false;
  // Grace period: don't accept success in first 3s (avoids false positive from leftover UI)
  while (Date.now() - start < timeoutMs) {
    var ctx = __chGetCreateWin();
    if (!ctx || !ctx.doc) {
      await __chSleep(800);
      continue;
    }
    var text = (ctx.doc.body && ctx.doc.body.innerText) || "";
    lastText = text.slice(0, 240);
    if (/上传失败|处理失败|格式不支持/.test(text)) {
      return { error: "Upload failed", hint: lastText };
    }
    if (/上传中|处理中|转码|正在上传|%\s*$|上传进度/.test(text) || /\d+%/.test(text)) {
      sawProgress = true;
    }
    // Strong success: explicit re-upload control or finder media thumb after progress
    var reupload = /重新上传|更换视频/.test(text);
    var hasFinderImg =
      !!ctx.doc.querySelector("img[src*='finder']") ||
      !!ctx.doc.querySelector("img[src*='stodownload']") ||
      !!ctx.doc.querySelector("video");
    var coverReady = /封面预览|编辑封面|个人主页卡片/.test(text);
    var elapsed = Date.now() - start;
    if (elapsed > 3000 && (reupload || (sawProgress && (hasFinderImg || coverReady)))) {
      await __chSleep(2000);
      return { ok: true, elapsedMs: Date.now() - start, sawProgress: sawProgress };
    }
    // After long wait, cover preview alone can mean done
    if (elapsed > 15000 && coverReady && hasFinderImg) {
      await __chSleep(1500);
      return { ok: true, elapsedMs: Date.now() - start, sawProgress: sawProgress };
    }
    await __chSleep(1000);
  }
  return {
    error: "Video upload timeout",
    hint: "Waited " + timeoutMs + "ms. sawProgress=" + sawProgress + " last=" + lastText,
  };
}

function __chFindButton(doc, label) {
  var btns = doc.querySelectorAll("button, a, [role=button], .weui-desktop-btn");
  for (var i = 0; i < btns.length; i++) {
    var t = (btns[i].innerText || btns[i].textContent || "").trim();
    if (t === label || t.indexOf(label) === 0) return btns[i];
  }
  return null;
}

function __chFindClickableByText(doc, label) {
  var nodes = doc.querySelectorAll("div,span,button,a,li,p,label");
  for (var i = 0; i < nodes.length; i++) {
    var t = (nodes[i].innerText || "").trim();
    if (t === label || t.indexOf(label) === 0) {
      // prefer leaf-ish
      if (t.length <= label.length + 8) return nodes[i];
    }
  }
  // partial
  for (var j = 0; j < nodes.length; j++) {
    var t2 = (nodes[j].innerText || "").trim();
    if (t2.indexOf(label) >= 0 && t2.length < 40) return nodes[j];
  }
  return null;
}

async function __chFillTitleDesc(doc, title, description) {
  // 短标题
  var shortInput =
    doc.querySelector('input[placeholder*="短标题"]') ||
    doc.querySelector('input.weui-desktop-form__input[placeholder*="流量"]');
  if (shortInput) {
    shortInput.focus();
    shortInput.value = String(title || "").slice(0, 16);
    shortInput.dispatchEvent(new Event("input", { bubbles: true }));
    shortInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // 视频描述：.post-desc-box .input-editor[contenteditable][data-placeholder=添加描述]
  // (contenteditable may be "" not "true")
  var descBox =
    doc.querySelector(".post-desc-box .input-editor") ||
    doc.querySelector('.input-editor[data-placeholder*="描述"]') ||
    doc.querySelector('[data-placeholder="添加描述"]') ||
    doc.querySelector(".post-desc-box [contenteditable]");
  if (!descBox) {
    var editables = doc.querySelectorAll("[contenteditable]");
    for (var i = 0; i < editables.length; i++) {
      var ph = editables[i].getAttribute("data-placeholder") || "";
      var cls = (editables[i].className || "").toString();
      if (/描述|添加描述/.test(ph) || /input-editor/.test(cls)) {
        descBox = editables[i];
        break;
      }
    }
  }
  if (descBox) {
    descBox.focus();
    var text = String(description || "");
    if (descBox.tagName === "TEXTAREA" || descBox.tagName === "INPUT") {
      descBox.value = text;
      descBox.dispatchEvent(new Event("input", { bubbles: true }));
      descBox.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      try {
        // Clear then insert so Vue/input listeners fire
        descBox.innerHTML = "";
        descBox.focus();
        var ok = false;
        try {
          ok = doc.execCommand("insertText", false, text);
        } catch (e1) {
          ok = false;
        }
        if (!ok) {
          descBox.textContent = text;
        }
        descBox.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
        descBox.dispatchEvent(new Event("change", { bubbles: true }));
        descBox.dispatchEvent(new Event("blur", { bubbles: true }));
      } catch (e) {
        descBox.innerText = text;
        descBox.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  }
  return { shortFilled: !!shortInput, descFilled: !!descBox };
}

/**
 * Click open a form row (e.g. 选择合集) then pick option by text.
 */
async function __chSelectOption(doc, openLabel, optionLabel) {
  var openEl =
    __chFindClickableByText(doc, openLabel) ||
    __chFindClickableByText(doc, openLabel.replace("选择", ""));
  if (!openEl) return { ok: false, reason: "open not found: " + openLabel };
  openEl.click();
  await __chSleep(600);
  var opt = __chFindClickableByText(doc, optionLabel);
  if (!opt) {
    // search in dialogs
    var dialogs = doc.querySelectorAll(".weui-desktop-dialog, .ant-modal, [class*=dialog], [class*=modal], [class*=popover], [class*=dropdown]");
    for (var i = 0; i < dialogs.length; i++) {
      var nodes = dialogs[i].querySelectorAll("div,span,li,button,a");
      for (var j = 0; j < nodes.length; j++) {
        var t = (nodes[j].innerText || "").trim();
        if (t === optionLabel || t.indexOf(optionLabel) >= 0) {
          opt = nodes[j];
          break;
        }
      }
      if (opt) break;
    }
  }
  if (!opt) return { ok: false, reason: "option not found: " + optionLabel };
  opt.click();
  await __chSleep(400);
  // confirm if needed
  var confirm = __chFindButton(doc, "确定") || __chFindButton(doc, "确认") || __chFindButton(doc, "完成");
  if (confirm) {
    confirm.click();
    await __chSleep(300);
  }
  return { ok: true };
}

async function __chApplyFixedFields(doc, win) {
  var results = { location: null, collection: null, link: null, annotation: null };

  // Location: UI may already show 杭州市; ensure via click if needed
  var locText = (doc.body.innerText || "");
  if (!/杭州/.test(locText)) {
    results.location = await __chSelectOption(doc, "位置", "杭州");
    if (!results.location.ok) {
      // try search box
      var search = doc.querySelector('input[placeholder*="附近位置"]');
      if (search) {
        var openLoc = __chFindClickableByText(doc, "位置") || __chFindClickableByText(doc, "添加位置");
        if (openLoc) openLoc.click();
        await __chSleep(400);
        search = doc.querySelector('input[placeholder*="附近位置"]') || search;
        search.value = "杭州";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        await __chSleep(800);
        var hangzhou = __chFindClickableByText(doc, "杭州市") || __chFindClickableByText(doc, "杭州");
        if (hangzhou) {
          hangzhou.click();
          results.location = { ok: true, via: "search" };
        }
      }
    }
  } else {
    results.location = { ok: true, via: "already" };
  }

  // Collection 算法可视化 — open row then pick radio/card by name
  results.collection = { ok: false, reason: "not selected" };
  for (var attempt = 0; attempt < 2; attempt++) {
    var colOpen =
      __chFindClickableByText(doc, "选择合集") ||
      __chFindClickableByText(doc, "添加到合集");
    if (!colOpen) break;
    colOpen.click();
    await __chSleep(900);
    // Prefer exact-name leaf in visible dialog
    var colOpt = null;
    var candidates = doc.querySelectorAll(
      ".weui-desktop-dialog div, .weui-desktop-dialog span, .ant-modal div, .ant-modal span, [class*=dialog] div, [class*=popover] div, li, label",
    );
    for (var ci = 0; ci < candidates.length; ci++) {
      var ct = (candidates[ci].innerText || "").trim();
      if (ct === __CH_COLLECTION_NAME) {
        colOpt = candidates[ci];
        break;
      }
    }
    if (!colOpt) colOpt = __chFindClickableByText(doc, __CH_COLLECTION_NAME);
    if (colOpt) {
      colOpt.click();
      await __chSleep(400);
      // some UIs need a second click on the card
      try {
        colOpt.click();
      } catch (e2) { /* ignore */ }
      await __chSleep(300);
      var conf =
        __chFindButton(doc, "确定") ||
        __chFindButton(doc, "确认") ||
        __chFindButton(doc, "完成") ||
        __chFindButton(doc, "添加");
      if (conf) {
        conf.click();
        await __chSleep(500);
      }
    }
    // verify
    if ((doc.body.innerText || "").indexOf(__CH_COLLECTION_NAME) >= 0) {
      results.collection = { ok: true, via: "ui-verified" };
      break;
    }
  }
  if (!results.collection.ok) {
    results.collection = await __chSelectOption(doc, "选择合集", __CH_COLLECTION_NAME);
  }
  // API fallback: resolve id for later post_draft
  try {
    var cols = await __chApi(win, "/collection/get_collection_list", { pageSize: 50, currentPage: 1 });
    var list = (cols && cols.collectionList) || [];
    for (var c = 0; c < list.length; c++) {
      if (list[c].name === __CH_COLLECTION_NAME) {
        results.collectionId = list[c].id;
        results.collectionName = list[c].name;
        if (!results.collection.ok) results.collection = { ok: true, via: "api-id-only" };
        break;
      }
    }
  } catch (e) { /* ignore */ }

  // Link: 公众号文章
  results.link = await __chSelectOption(doc, "选择链接", "公众号文章");
  if (!results.link.ok) {
    results.link = await __chSelectOption(doc, "链接", "公众号文章");
  }

  // Annotation: 个人观点，仅供参考
  results.annotation = await __chSelectOption(doc, "选择视频标注", __CH_ANNOTATION);
  if (!results.annotation.ok) {
    results.annotation = await __chSelectOption(doc, "视频标注", __CH_ANNOTATION);
  }

  return results;
}

async function __chSaveDraftClick(doc) {
  var btn = __chFindButton(doc, "保存草稿");
  if (!btn) return { error: "保存草稿 button not found" };
  if (btn.disabled || /disabled/.test(btn.className || "")) {
    return { error: "保存草稿 is disabled", hint: "Video may still be uploading or form incomplete" };
  }
  btn.click();
  await __chSleep(2500);
  // dismiss success dialogs
  try {
    var ok = __chFindButton(doc, "我知道了") || __chFindButton(doc, "确定");
    if (ok) ok.click();
  } catch (e) { /* ignore */ }
  return { ok: true, via: "click" };
}

/**
 * Build description with #tags
 */
function __chBuildDescription(desc, tags) {
  var d = String(desc || "").trim();
  var tagsArr = Array.isArray(tags) ? tags : [];
  var hash = tagsArr
    .map(function (t) {
      return String(t).replace(/^#/, "").trim();
    })
    .filter(Boolean)
    .map(function (t) {
      return "#" + t;
    })
    .join(" ");
  if (hash) {
    if (d) d = d + " " + hash;
    else d = hash;
  }
  return d.slice(0, 1000);
}

async function __chFindDraftByTitle(win, title, description) {
  var data = await __chApi(win, "/post/get_draft_list", { pageSize: 20, currentPage: 1 });
  if (data && data.error) return null;
  var list = (data && data.list) || [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i];
    var desc = (it.desc && it.desc.description) || "";
    var st = "";
    if (it.desc && Array.isArray(it.desc.shortTitle) && it.desc.shortTitle[0]) {
      st = it.desc.shortTitle[0].shortTitle || "";
    }
    if (title && st === title) {
      return {
        objectId: it.objectId || it.exportId,
        exportId: it.exportId || it.objectId,
        description: desc,
        shortTitle: st,
        createTime: it.createTime,
        collection: it.desc && it.desc.topic && it.desc.topic.collectionName,
        city: it.desc && it.desc.location && it.desc.location.city,
      };
    }
  }
  // secondary: description prefix match
  if (description && description.length >= 8) {
    var prefix = description.slice(0, 16);
    for (var j = 0; j < list.length; j++) {
      var it2 = list[j];
      var desc2 = (it2.desc && it2.desc.description) || "";
      if (desc2.indexOf(prefix) >= 0) {
        var st2 = "";
        if (it2.desc && Array.isArray(it2.desc.shortTitle) && it2.desc.shortTitle[0]) {
          st2 = it2.desc.shortTitle[0].shortTitle || "";
        }
        return {
          objectId: it2.objectId || it2.exportId,
          exportId: it2.exportId || it2.objectId,
          description: desc2,
          shortTitle: st2,
          createTime: it2.createTime,
          collection: it2.desc && it2.desc.topic && it2.desc.topic.collectionName,
          city: it2.desc && it2.desc.location && it2.desc.location.city,
        };
      }
    }
  }
  return null;
}

/**
 * API save fallback: post_draft with partial fields when UI click is unreliable.
 * Requires clip/media already on server-side form store — often only works after UI upload.
 * We primarily use click path; this posts best-effort body from known draft shape.
 */
async function __chPostDraftApi(win, opts) {
  opts = opts || {};
  // Minimal: many fields filled by server session after UI upload if we only click save.
  // Direct API without media usually fails — return error to force click path.
  var body = {
    // Intentionally incomplete — callers should prefer click.
    description: opts.description || "",
    shortTitle: opts.title || "",
  };
  return __chApi(win, "/post/post_draft", body);
}

/**
 * YouTube Studio (studio.youtube.com) helpers — upload video as draft.
 * Heavy use of Polymer shadow DOM (ytcp-*).
 */

var __YT_DEFAULT_UPLOAD =
  "https://studio.youtube.com/channel/UCa3kfc7uhu-A9RmqHGMfrKQ/videos/upload";

function __ytSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

/** Depth-first walk of light + shadow roots. */
function __ytWalk(root, fn, depth) {
  depth = depth || 0;
  if (!root || depth > 14) return;
  try {
    fn(root, depth);
  } catch (e) { /* ignore */ }
  if (root.shadowRoot) __ytWalk(root.shadowRoot, fn, depth + 1);
  var kids = root.children || root.childNodes || [];
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].nodeType === 1) __ytWalk(kids[i], fn, depth + 1);
  }
}

function __ytDeepQuery(selector, root) {
  root = root || document;
  var found = null;
  __ytWalk(root, function (node) {
    if (found || !node.querySelector) return;
    try {
      var el = node.querySelector(selector);
      if (el) found = el;
    } catch (e) { /* ignore */ }
  });
  return found;
}

function __ytDeepQueryAll(selector, root) {
  root = root || document;
  var out = [];
  var seen = new Set();
  __ytWalk(root, function (node) {
    if (!node.querySelectorAll) return;
    try {
      var list = node.querySelectorAll(selector);
      for (var i = 0; i < list.length; i++) {
        if (!seen.has(list[i])) {
          seen.add(list[i]);
          out.push(list[i]);
        }
      }
    } catch (e) { /* ignore */ }
  });
  return out;
}

function __ytClickByText(labels, root) {
  if (typeof labels === "string") labels = [labels];
  var nodes = __ytDeepQueryAll(
    "button, ytcp-button, tp-yt-paper-item, a, [role=button], [role=menuitem], [role=radio], tp-yt-paper-radio-button, yt-formatted-string, span, div",
    root || document,
  );
  for (var L = 0; L < labels.length; L++) {
    var label = labels[L];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var t = ((el.innerText || el.textContent || el.getAttribute("aria-label") || "") + "")
        .replace(/\s+/g, " ")
        .trim();
      if (!t) continue;
      if (t === label || t.indexOf(label) === 0 || t.indexOf(label) >= 0) {
        // Prefer shorter matches
        if (t.length > label.length + 40) continue;
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

function __ytGetChannelId() {
  var m = (location.href || "").match(/\/channel\/(UC[\w-]+)/);
  if (m) return m[1];
  try {
    if (window.ytcfg && typeof window.ytcfg.get === "function") {
      return (
        window.ytcfg.get("CHANNEL_ID") ||
        window.ytcfg.get("DELEGATED_SESSION_ID") ||
        ""
      );
    }
  } catch (e) { /* ignore */ }
  return "";
}

function __ytEnsureSession() {
  if (!/studio\.youtube\.com/i.test(location.host)) {
    return {
      error: "Not on studio.youtube.com",
      hint:
        'Open: bb-browser open "https://studio.youtube.com/" and log in, then open channel videos/upload',
    };
  }
  if (/accounts\.google|ServiceLogin|signin/i.test(location.href)) {
    return {
      error: "Not logged in",
      hint: "Log in to Google / YouTube Studio in the bb-browser Chrome",
    };
  }
  var channelId = __ytGetChannelId();
  return { ok: true, channelId: channelId };
}

function __ytGetUploadsDialog() {
  return (
    document.querySelector("ytcp-uploads-dialog") ||
    __ytDeepQuery("ytcp-uploads-dialog") ||
    null
  );
}

async function __ytOpenUploadDialog() {
  // Close existing error dialogs
  __ytClickByText(["关闭", "Close", "取消", "Cancel"]);
  await __ytSleep(400);

  var dialog = __ytGetUploadsDialog();
  if (dialog) {
    var step = dialog.getAttribute("workflow-step") || "";
    var dtext = (dialog.innerText || "") + __ytShadowText(dialog);
    if (/糟糕|出错|Something went wrong|出了点问题/.test(dtext)) {
      __ytClickByText(["关闭", "Close"], dialog);
      await __ytSleep(500);
      dialog = null;
    } else if (step && step !== "SELECT_FILES") {
      return { ok: true, dialog: dialog, step: step, reopened: false };
    } else if (step === "SELECT_FILES" && !/糟糕|出了点问题/.test(dtext)) {
      return { ok: true, dialog: dialog, step: step, reopened: false };
    }
  }

  // Prefer header create button (aria-label or class)
  var createBtn = null;
  var buttons = __ytDeepQueryAll("ytcp-button, button, ytcp-button-shape button");
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var aria = (b.getAttribute("aria-label") || "").trim();
    var cls = (b.className || "").toString();
    var tx = (b.innerText || "").trim();
    if (aria === "创建" || aria === "Create" || /ytcpAppHeaderCreateIcon|create-icon/i.test(cls)) {
      createBtn = b;
      break;
    }
    if ((tx === "创建" || tx === "Create") && /header|Header|create/i.test(cls + (b.parentElement && b.parentElement.className || ""))) {
      createBtn = b;
      break;
    }
  }
  if (!createBtn) {
    // fallback exact text on ytcp-button only
    for (var j = 0; j < buttons.length; j++) {
      if ((buttons[j].innerText || "").trim() === "创建" || (buttons[j].getAttribute("aria-label") || "") === "创建") {
        createBtn = buttons[j];
        break;
      }
    }
  }
  if (!createBtn) {
    return { error: "Create button not found", hint: "Stay on Studio channel content page" };
  }
  createBtn.click();
  await __ytSleep(900);

  // Menu items: tp-yt-paper-item 上传视频
  var upItem = null;
  var items = __ytDeepQueryAll("tp-yt-paper-item, [role=menuitem], ytcp-text-menu-item, a");
  for (var k = 0; k < items.length; k++) {
    var it = (items[k].innerText || "").replace(/\s+/g, " ").trim();
    if (it === "上传视频" || it === "Upload videos" || it === "Upload video" || /^上传视频/.test(it)) {
      upItem = items[k];
      break;
    }
  }
  if (!upItem) {
    // second try after delay
    await __ytSleep(800);
    items = __ytDeepQueryAll("tp-yt-paper-item, [role=menuitem]");
    for (var k2 = 0; k2 < items.length; k2++) {
      var it2 = (items[k2].innerText || "").replace(/\s+/g, " ").trim();
      if (/上传视频|Upload video/i.test(it2) && it2.length < 20) {
        upItem = items[k2];
        break;
      }
    }
  }
  if (!upItem) {
    return {
      error: "Upload video menu item not found",
      hint: "Click 创建 in Studio header, ensure 上传视频 appears",
      menuCount: items.length,
    };
  }
  upItem.click();
  await __ytSleep(1800);
  dialog = __ytGetUploadsDialog();
  if (!dialog) {
    return { error: "Upload dialog did not open" };
  }
  return {
    ok: true,
    dialog: dialog,
    step: dialog.getAttribute("workflow-step") || "",
    reopened: true,
  };
}

function __ytShadowText(root) {
  var parts = [];
  __ytWalk(root, function (node) {
    if (node.nodeType === 3 && node.textContent) {
      var t = node.textContent.trim();
      if (t) parts.push(t);
    }
  });
  return parts.join(" ").replace(/\s+/g, " ");
}

async function __ytMountVideo(args) {
  var blob = window.__bbLocalVideoBlob;
  if (!blob) {
    return {
      error: "Local video not injected",
      hint: "CLI must pass --video; daemon injects window.__bbLocalVideoBlob",
    };
  }
  var open = await __ytOpenUploadDialog();
  if (open.error) return open;

  var dialog = open.dialog || __ytGetUploadsDialog();
  var input =
    __ytDeepQuery('input[type=file][name=Filedata]', dialog) ||
    __ytDeepQuery("input[type=file]", dialog) ||
    __ytDeepQuery('input[type=file][name=Filedata]') ||
    __ytDeepQuery("input[type=file]");

  if (!input) {
    return { error: "File input not found in upload dialog" };
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
 * Wait until details editor is ready (title box) or timeout.
 */
async function __ytWaitDetails(timeoutMs) {
  timeoutMs = timeoutMs || 100000;
  var start = Date.now();
  var lastStep = "";
  while (Date.now() - start < timeoutMs) {
    var dialog = __ytGetUploadsDialog();
    var step = dialog ? dialog.getAttribute("workflow-step") || "" : "";
    lastStep = step;
    var text = dialog ? __ytShadowText(dialog) : "";
    if (/糟糕|出了点问题|Something went wrong|上传失败/.test(text) && !/重试/.test(text) === false) {
      // still allow retry button
    }
    if (/糟糕，出了点问题|Something went wrong/.test(text) && Date.now() - start > 8000) {
      return { error: "Upload dialog error", hint: text.slice(0, 200), step: step };
    }
    // Title textbox in metadata editor
    var titleBox =
      __ytDeepQuery("#textbox", dialog) ||
      __ytDeepQuery('#title-textarea #textbox', dialog) ||
      __ytDeepQuery('div[aria-label*="标题"]', dialog) ||
      __ytDeepQuery('div[aria-label*="Title"]', dialog) ||
      __ytDeepQuery('div[contenteditable="true"]', dialog);

    var hasTitle = !!titleBox;
    var detailsStep =
      /DETAILS|METADATA|EDIT|details/i.test(step) ||
      /标题|Title|说明|Description|观众|Audience/.test(text);

    if (hasTitle && (detailsStep || step === "" || step.indexOf("SELECT") < 0)) {
      await __ytSleep(1000);
      return {
        ok: true,
        elapsedMs: Date.now() - start,
        step: step,
        titleEl: titleBox,
      };
    }
    // Progress
    if (/上传中|Uploading|处理中|Processing|\d+%/.test(text)) {
      // keep waiting
    }
    await __ytSleep(1000);
  }
  return {
    error: "Timeout waiting for details step",
    hint: "lastStep=" + lastStep,
  };
}

function __ytSetContentEditable(el, value) {
  if (!el) return false;
  el.focus();
  var text = String(value || "");
  try {
    // select all + insertText for Polymer listeners
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
    el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    return true;
  } catch (e) {
    try {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      return true;
    } catch (e2) {
      return false;
    }
  }
}

async function __ytFillMetadata(cfg) {
  var dialog = __ytGetUploadsDialog();
  var title = String(cfg.title || "").slice(0, 100);
  var desc = String(cfg.desc || "").slice(0, 5000);
  var tags = Array.isArray(cfg.tags) ? cfg.tags.map(String) : [];

  // Title: first #textbox is usually title
  var textboxes = __ytDeepQueryAll("#textbox", dialog);
  var titleEl = textboxes[0] || __ytDeepQuery('div[aria-label*="标题"]', dialog) || __ytDeepQuery('div[aria-label*="Add a title"]', dialog);
  var descEl =
    textboxes[1] ||
    __ytDeepQuery('div[aria-label*="说明"]', dialog) ||
    __ytDeepQuery('div[aria-label*="Tell viewers"]', dialog) ||
    __ytDeepQuery('div[aria-label*="description"]', dialog);

  var titleOk = __ytSetContentEditable(titleEl, title);
  await __ytSleep(300);
  var descOk = __ytSetContentEditable(descEl, desc);
  await __ytSleep(300);

  // Tags
  var tagsOk = false;
  if (tags.length) {
    var tagInput =
      __ytDeepQuery("input#text-input", dialog) ||
      __ytDeepQuery('input[aria-label*="标签"]', dialog) ||
      __ytDeepQuery('input[aria-label*="Tags"]', dialog) ||
      __ytDeepQuery("ytcp-form-input-container input", dialog);
    // Prefer tags chip input near 标签
    var inputs = __ytDeepQueryAll("input", dialog);
    for (var i = 0; i < inputs.length; i++) {
      var aria = (inputs[i].getAttribute("aria-label") || "") + (inputs[i].placeholder || "");
      if (/标签|Tags|tag/i.test(aria)) {
        tagInput = inputs[i];
        break;
      }
    }
    if (tagInput) {
      tagInput.focus();
      var tagStr = tags.join(",");
      tagInput.value = tagStr;
      tagInput.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      // Enter to commit chips
      tagInput.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, composed: true }),
      );
      tagInput.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, composed: true }),
      );
      tagsOk = true;
    }
  }

  return {
    titleOk: titleOk,
    descOk: descOk,
    tagsOk: tagsOk,
    title: title,
    desc: desc,
    tags: tags,
  };
}

/**
 * Fixed: audience not for kids.
 * 视频语言可选（默认不强制英语，便于中英多语言适配）；传入 languageLabels 时尝试点选。
 */
async function __ytApplyFixedFields(languageLabels) {
  var dialog = __ytGetUploadsDialog();
  var out = { audience: null, captions: null };

  // Expand "显示更多" if needed for tags/language
  __ytClickByText(["显示更多", "Show more"], dialog);
  await __ytSleep(400);

  // Audience — scroll to 观众
  out.audience = __ytClickByText(
    [
      "内容不是面向儿童的",
      "No, it's not made for kids",
      "不是面向儿童",
      "Not made for kids",
    ],
    dialog,
  );
  if (!out.audience.ok) {
    // try radio group
    var radios = __ytDeepQueryAll(
      "tp-yt-paper-radio-button, [role=radio], ytcp-radio-button",
      dialog,
    );
    for (var i = 0; i < radios.length; i++) {
      var t = ((radios[i].innerText || radios[i].getAttribute("aria-label") || "") + "").trim();
      if (/不是面向儿童|not made for kids|NOT_MADE_FOR_KIDS/i.test(t)) {
        radios[i].click();
        out.audience = { ok: true, text: t, via: "radio" };
        break;
      }
    }
  }
  await __ytSleep(400);

  // 视频语言（可选）：按字幕轨语言设置，避免强制英语覆盖中文投稿
  if (languageLabels && languageLabels.length) {
    __ytClickByText(["视频语言", "Video language", "语言", "Language"], dialog);
    await __ytSleep(400);
    var lang = __ytClickByText(languageLabels, dialog);
    out.captions = lang.ok
      ? { ok: true, text: lang.text, via: "video-language" }
      : { ok: false, labels: languageLabels };
  } else {
    out.captions = { ok: true, skipped: true, via: "no-language-forced" };
  }

  return out;
}

async function __ytClickNextUntilVisibilityOrSave(maxSteps) {
  maxSteps = maxSteps || 6;
  var steps = [];
  for (var i = 0; i < maxSteps; i++) {
    var dialog = __ytGetUploadsDialog();
    var text = dialog ? __ytShadowText(dialog) : "";
    // If save available on this step (some locales), stop
    if (/保存|Save/.test(text) && !/保存更改/.test(text)) {
      // check for 发布 vs 保存
    }
    // Done with details: click 继续 to advance checks/visibility
    var next = __ytClickByText(["继续", "Next", "下一步"], dialog);
    if (!next.ok) {
      steps.push({ i: i, next: false, text: text.slice(0, 80) });
      break;
    }
    steps.push({ i: i, next: true });
    await __ytSleep(1200);
  }
  return steps;
}

/**
 * Save without public publish.
 * Prefer Polymer API saveAndCloseDialog / maybeSaveVideo on DETAILS (→ 草稿 or 私享).
 * Fallback: #done-button / 保存并关闭 / 继续到公开范围 + 私享 + 保存.
 */
async function __ytSaveDraft() {
  var dialog = __ytGetUploadsDialog();
  if (!dialog) {
    return { error: "Upload dialog not found for save" };
  }

  // Best path: component API (works when button.click is swallowed by Polymer)
  // Fire-and-wait briefly — these promises may never settle on some Studio builds
  if (typeof dialog.saveAndCloseDialog === "function") {
    try {
      dialog.saveAndCloseDialog();
    } catch (e) { /* ignore */ }
    await __ytSleep(4000);
    // If dialog closed or list shows progress, treat as success
    if (!__ytGetUploadsDialog() || /已保存|Saved|成功/.test(document.body.innerText || "")) {
      return { ok: true, via: "saveAndCloseDialog" };
    }
  }
  if (typeof dialog.maybeSaveVideo === "function") {
    try {
      dialog.maybeSaveVideo();
    } catch (e2) { /* ignore */ }
    await __ytSleep(3000);
  }

  // 保存并关闭 (header on DETAILS)
  var saveClose = __ytClickByText(["保存并关闭", "Save and close"], dialog);
  if (saveClose.ok) {
    await __ytSleep(3000);
    return { ok: true, via: "save-and-close", label: saveClose.text };
  }

  // Footer #done-button → 保存
  var done = __ytDeepQuery("#done-button", dialog) || __ytDeepQuery("#done-button");
  if (done) {
    var clicked = false;
    __ytWalk(done, function (n) {
      if (n.tagName === "BUTTON" && /保存|Save/.test(n.innerText || "")) {
        n.click();
        clicked = true;
      }
    });
    if (!clicked) {
      try {
        done.click();
      } catch (e3) { /* ignore */ }
    }
    await __ytSleep(3000);
    __ytClickByText(["关闭", "Close", "完成", "Done"], dialog);
    await __ytSleep(1000);
    return { ok: true, via: "done-button" };
  }

  // Visibility path: private then save
  for (var n = 0; n < 5; n++) {
    dialog = __ytGetUploadsDialog();
    var nextBtn = __ytDeepQuery("#next-button", dialog) || __ytDeepQuery("#next-button");
    if (nextBtn) {
      __ytWalk(nextBtn, function (el) {
        if (el.tagName === "BUTTON") el.click();
      });
      try {
        nextBtn.click();
      } catch (e4) { /* ignore */ }
    } else break;
    await __ytSleep(1500);
    var step = dialog && dialog.getAttribute("workflow-step");
    if (step === "REVIEW" || /公开范围|Visibility/.test(__ytShadowText(dialog || document))) break;
  }
  dialog = __ytGetUploadsDialog();
  __ytClickByText(["私享", "Private"], dialog);
  await __ytSleep(400);
  done = __ytDeepQuery("#done-button", dialog);
  if (done) {
    __ytWalk(done, function (el) {
      if (el.tagName === "BUTTON") el.click();
    });
  } else {
    __ytClickByText(["保存", "Save"], dialog);
  }
  await __ytSleep(3000);
  return { ok: true, via: "wizard-private-save" };
}

function __ytGetVideoIdFromUrl() {
  var m = (location.href || "").match(/[?&]udvid=([\w-]+)/);
  if (m) return m[1];
  // dialog often shows 视频链接 https://youtu.be/VIDEO_ID
  var dialog = __ytGetUploadsDialog();
  var text = (dialog ? __ytShadowText(dialog) : "") + " " + ((document.body && document.body.innerText) || "");
  var ym = text.match(/youtu\.be\/([\w-]{6,})/);
  if (ym) return ym[1];
  var ym2 = text.match(/youtube\.com\/watch\?v=([\w-]{6,})/);
  if (ym2) return ym2[1];
  return null;
}

/**
 * Check list page text for draft title (after close dialog).
 */
function __ytListMentionsTitle(title) {
  var body = (document.body && document.body.innerText) || "";
  return body.indexOf(title) >= 0;
}

/**
 * Parse captions payload from adapter args.
 * Daemon 注入: [{language,name,mime,size,base64}]
 * 或 CLI config 元数据（无 base64 时无法上传）。
 */
function __ytParseCaptionsArg(args) {
  var raw = (args && (args.captions || args.__captions)) || "";
  if (!raw) return [];
  try {
    var list = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(list)) return [];
    return list
      .filter(function (item) {
        return item && (item.base64 || item.globalName);
      })
      .map(function (item) {
        return {
          language: String(item.language || "en"),
          name: String(item.name || "captions.srt"),
          mime: String(item.mime || "application/x-subrip"),
          base64: item.base64 ? String(item.base64) : "",
          globalName: item.globalName ? String(item.globalName) : "",
        };
      });
  } catch (e) {
    return [];
  }
}

function __ytBase64ToFile(base64, name, mime) {
  var bin = atob(base64);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  try {
    return new File([arr], name, { type: mime || "application/x-subrip", lastModified: Date.now() });
  } catch (e) {
    return new Blob([arr], { type: mime || "application/x-subrip" });
  }
}

function __ytCaptionLanguageLabels(lang) {
  var code = String(lang || "en").toLowerCase();
  if (code === "zh" || code.indexOf("zh-hans") === 0 || code === "zh-cn" || code === "chinese") {
    return [
      "中文（简体）",
      "中文(简体)",
      "Chinese (Simplified)",
      "Chinese",
      "简体中文",
      "zh-Hans",
      "zh-CN",
    ];
  }
  if (code.indexOf("zh-hant") === 0 || code === "zh-tw" || code === "zh-hk") {
    return ["中文（繁体）", "中文(繁體)", "Chinese (Traditional)", "zh-Hant", "zh-TW"];
  }
  if (code === "en" || code.indexOf("en-") === 0 || code === "english") {
    return ["英语", "English", "英文", "en"];
  }
  return [String(lang), code];
}

/**
 * 将字幕文件挂到页面上任意可见的 file input。
 */
function __ytAssignFileToInput(input, file) {
  if (!input || !file) return false;
  try {
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 在 Studio 字幕/translations 页上传一条字幕轨道。
 * 典型路径：video/<id>/translations → 添加语言 → 添加字幕 → 上传文件
 */
async function __ytUploadCaptionTrack(caption) {
  var result = {
    language: caption.language,
    name: caption.name,
    ok: false,
    steps: [],
  };
  var file = null;
  if (caption.base64) {
    file = __ytBase64ToFile(caption.base64, caption.name, caption.mime);
  } else if (caption.globalName && window[caption.globalName]) {
    var blob = window[caption.globalName];
    try {
      file = new File([blob], caption.name, {
        type: caption.mime || blob.type || "application/x-subrip",
        lastModified: Date.now(),
      });
    } catch (e) {
      file = blob;
    }
  }
  if (!file) {
    result.error = "Caption payload missing base64/blob";
    return result;
  }

  // 1) 添加语言
  var addLang = __ytClickByText([
    "添加语言",
    "ADD LANGUAGE",
    "Add language",
    "添加",
  ]);
  result.steps.push({ addLanguage: addLang.ok, text: addLang.text || null });
  await __ytSleep(700);

  // 2) 选择语言
  var labels = __ytCaptionLanguageLabels(caption.language);
  var langPick = __ytClickByText(labels);
  if (!langPick.ok) {
    // 语言搜索框
    var search =
      __ytDeepQuery('input[placeholder*="搜索"]') ||
      __ytDeepQuery('input[placeholder*="Search"]') ||
      __ytDeepQuery("tp-yt-paper-dialog input") ||
      __ytDeepQuery("ytcp-language-search input");
    if (search) {
      search.focus();
      search.value = labels[0];
      search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      await __ytSleep(500);
      langPick = __ytClickByText(labels);
    }
  }
  result.steps.push({ pickLanguage: langPick.ok, text: langPick.text || null });
  await __ytSleep(900);

  // 3) 添加字幕 / 上传文件
  var addSub = __ytClickByText([
    "添加",
    "ADD",
    "上传文件",
    "Upload file",
    "Upload",
    "With timing",
    "带时间戳",
  ]);
  result.steps.push({ addSubtitles: addSub.ok, text: addSub.text || null });
  await __ytSleep(800);

  // 优先选「上传文件」
  var uploadOpt = __ytClickByText([
    "上传文件",
    "Upload file",
    "Upload a file",
    "上传",
  ]);
  result.steps.push({ uploadOption: uploadOpt.ok, text: uploadOpt.text || null });
  await __ytSleep(600);

  // 4) file input
  var input =
    __ytDeepQuery('input[type=file][accept*="srt"]') ||
    __ytDeepQuery('input[type=file][accept*=".srt"]') ||
    __ytDeepQuery('input[type=file][accept*="vtt"]') ||
    __ytDeepQuery('input[type=file]');
  if (!input) {
    // 再点一次可能弹出的「选择文件」
    __ytClickByText(["选择文件", "Choose file", "Browse"]);
    await __ytSleep(500);
    input =
      __ytDeepQuery('input[type=file][accept*="srt"]') ||
      __ytDeepQuery("input[type=file]");
  }
  if (!input) {
    result.error = "Caption file input not found on translations page";
    return result;
  }
  if (!__ytAssignFileToInput(input, file)) {
    result.error = "Failed to assign caption File to input";
    return result;
  }
  result.steps.push({ fileAssigned: true, name: caption.name });
  await __ytSleep(1500);

  // 5) 确认保存字幕
  var done = __ytClickByText([
    "完成",
    "Done",
    "保存",
    "Save",
    "发布",
    "Publish",
  ]);
  // 避免误点视频「公开发布」：仅在对话框上下文中优先 Done/完成
  result.steps.push({ confirm: done.ok, text: done.text || null });
  await __ytSleep(1500);

  result.ok = true;
  return result;
}

/**
 * 保存草稿拿到 videoId 后，打开 translations 页并逐条上传字幕。
 */
async function __ytUploadCaptionsAfterSave(videoId, captions) {
  if (!videoId || !captions || !captions.length) {
    return { skipped: true, reason: !videoId ? "no videoId" : "no captions" };
  }
  var translationsUrl =
    "https://studio.youtube.com/video/" + videoId + "/translations";
  // 关闭可能仍开着的上传对话框
  __ytClickByText(["关闭", "Close", "取消", "Cancel"]);
  await __ytSleep(500);

  if (location.href.indexOf("/video/" + videoId + "/translations") < 0) {
    location.href = translationsUrl;
    // 等待页面加载（adapter 在同页执行时导航会卸载脚本——由 draft-create 在导航前返回部分结果不现实）
    // 因此：仅当已在 translations 页，或短等后仍在 studio 同文档时继续。
    // 实际导航会中断当前 JS；caller 应在保存后用同一 tab 二次运行不现实。
    // 改：不使用 location.href 整页跳转，优先点左侧「字幕」菜单（SPA）。
  }

  // SPA：优先点「字幕 / Subtitles / 翻译」
  var nav = __ytClickByText([
    "字幕",
    "Subtitles",
    "翻译",
    "Translations",
    "字幕与翻译",
  ]);
  await __ytSleep(1500);
  if (!nav.ok && location.pathname.indexOf("/translations") < 0) {
    // 最后手段：SPA 路由 pushState + 自定义，或完整导航
    try {
      history.pushState({}, "", translationsUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
      await __ytSleep(2000);
    } catch (e) { /* ignore */ }
    if (location.pathname.indexOf("/translations") < 0) {
      // 硬导航会丢掉当前执行上下文；返回提示让调用方用 manage/edit 手工补
      return {
        ok: false,
        error: "Could not open translations SPA without full navigation",
        hint:
          "Open " +
          translationsUrl +
          " and upload caption files manually, or re-run with Studio already on translations (rare).",
        translationsUrl: translationsUrl,
        captions: captions.map(function (c) {
          return { language: c.language, name: c.name };
        }),
      };
    }
  }

  var results = [];
  for (var i = 0; i < captions.length; i++) {
    var one = await __ytUploadCaptionTrack(captions[i]);
    results.push(one);
    await __ytSleep(800);
  }
  var allOk = results.every(function (r) {
    return r.ok;
  });
  return {
    ok: allOk,
    translationsUrl: translationsUrl,
    results: results,
  };
}

/**
 * 在上传对话框 DETAILS 阶段尝试上传字幕（避免保存后跳转丢上下文）。
 * Studio 不同版本可能没有此入口；失败时由调用方回退到 translations 流程。
 */
async function __ytTryUploadCaptionsInDialog(captions) {
  if (!captions || !captions.length) return { skipped: true };
  var dialog = __ytGetUploadsDialog();
  if (!dialog) return { ok: false, error: "no dialog" };

  var out = { ok: false, results: [], via: "details-dialog" };
  // 展开更多 / 字幕区
  __ytClickByText(["显示更多", "Show more", "字幕", "Subtitles", "Captions"], dialog);
  await __ytSleep(500);

  for (var i = 0; i < captions.length; i++) {
    var cap = captions[i];
    var file = cap.base64
      ? __ytBase64ToFile(cap.base64, cap.name, cap.mime)
      : null;
    if (!file) {
      out.results.push({ language: cap.language, ok: false, error: "no file" });
      continue;
    }
    var uploadBtn = __ytClickByText(
      ["上传文件", "Upload file", "上传字幕", "Upload subtitles", "添加字幕"],
      dialog,
    );
    await __ytSleep(600);
    var input =
      __ytDeepQuery('input[type=file]', dialog) ||
      __ytDeepQuery("input[type=file]");
    if (!input || !__ytAssignFileToInput(input, file)) {
      out.results.push({
        language: cap.language,
        ok: false,
        error: "file input not found in details",
        uploadBtn: uploadBtn.ok,
      });
      continue;
    }
    // 选语言（若弹出）
    await __ytSleep(500);
    __ytClickByText(__ytCaptionLanguageLabels(cap.language), dialog);
    await __ytSleep(400);
    out.results.push({ language: cap.language, name: cap.name, ok: true });
  }
  out.ok = out.results.length > 0 && out.results.every(function (r) {
    return r.ok;
  });
  return out;
}

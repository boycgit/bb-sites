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
 * Fixed: audience not for kids + captions/language English
 */
async function __ytApplyFixedFields() {
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

  // Captions / language English
  // May be under 字幕 or 视频语言
  out.captions = __ytClickByText(["字幕", "Captions", "语言", "Language"], dialog);
  await __ytSleep(500);
  var eng = __ytClickByText(["英语", "English", "英文"], dialog);
  if (eng.ok) {
    out.captions = { ok: true, text: eng.text, via: "menu" };
  } else {
    // Try dropdowns with English
    out.captions = eng;
    // Soft: mark as warning only later
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

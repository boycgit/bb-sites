/* @meta
{
  "name": "chatgpt/image-create",
  "description": "在 chatgpt.com/images 用提示词生成图片，可选参考图，并把结果下载到本地",
  "domain": "chatgpt.com",
  "args": {
    "config": { "required": false, "description": "JSON 配置：{prompt,size,n,image_urls,downloadResult,targetDir}。prompt 必填" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一）" },
    "prompt": { "required": false, "description": "CLI 写入的最终提示词（含尺寸与张数），不要手传" },
    "size": { "required": false, "description": "图片比例，默认 3:4" },
    "n": { "required": false, "description": "生成张数，默认 1，最大 8" },
    "downloadResult": { "required": false, "description": "是否把结果下载到本地，默认 true" },
    "targetDir": { "required": false, "description": "结果图片目录。相对路径相对 config 文件所在目录；不存在则新建。缺省写到 BB_BROWSER_HOME/downloads/chatgpt" }
  },
  "capabilities": ["write"],
  "readOnly": false,
  "example": "bb-browser site chatgpt/image-create --configFile ./chatgpt-image.config.json --json"
}
*/
async function (args) {
  // 2026-09 图片页（中文 UI）稳定入口是无障碍名，不是 class：
  // 编辑器 aria「描述新图像」、照片框 aria「添加照片」、有文字后出现 aria「发送」。
  const prompt = String(args.prompt || "").trim();
  if (!prompt) {
    return {
      error: "请提供提示词（config.prompt）",
      hint: "把 prompt 放进 --config / --configFile JSON，例如 {\"prompt\":\"一只白猫\"}",
    };
  }

  const expected = Math.max(1, Number(args.n) || 1);
  const size = String(args.size || "3:4");
  const downloadResult = String(args.downloadResult || "true") !== "false";
  const wantRefs = Number(args.__chatgptImagesMounted || 0);
  const warnings = [];

  if (/auth\.openai\.com|accounts\.openai\.com/i.test(location.hostname) || /\/auth(\/|$)/i.test(location.pathname)) {
    return {
      error: "Not logged in",
      hint: '请先执行 bb-browser open "https://chatgpt.com/images" 并登录',
    };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const findComposer = () => {
    const boxes = [...document.querySelectorAll("[contenteditable='true'][role='textbox']")];
    return (
      boxes.find((el) => /描述|describe|图像|image|message|prompt/i.test(el.getAttribute("aria-label") || "")) ||
      boxes[0] ||
      null
    );
  };

  const composer = findComposer();
  if (!composer) {
    return {
      error: "ChatGPT 图片编辑器未就绪",
      hint: '请先执行 bb-browser open "https://chatgpt.com/images" 并登录，确认地址是 /images',
    };
  }

  if (wantRefs > 0) {
    let attached = 0;
    for (let i = 0; i < 20; i++) {
      attached = document.querySelectorAll("[data-composer-attachments] img").length;
      if (attached >= wantRefs) break;
      await sleep(400);
    }
    if (attached < wantRefs) {
      return {
        error: "参考图未出现在输入框",
        hint: "ChatGPT「添加照片」控件可能已变化。打开 https://chatgpt.com/images 确认能手动添加照片后再试",
        attached,
        expected: wantRefs,
      };
    }
  }

  const generatingNow = () =>
    [...document.querySelectorAll("button")].some((button) => {
      const label = (button.getAttribute("aria-label") || "").trim();
      return /^(停止|停止生成|停止响应|stop|stop generating|stop streaming|stop response)$/i.test(label);
    });

  if (generatingNow()) {
    return {
      error: "当前已有图片生成任务",
      hint: "等当前生成结束，或打开新的 https://chatgpt.com/images 后再试",
    };
  }

  composer.focus();
  document.execCommand("selectAll", false, null);
  document.execCommand("delete", false, null);
  const inserted = document.execCommand("insertText", false, prompt);
  const visible = (composer.innerText || "").replace(/\s+/g, " ").trim();
  if (!inserted || !visible.includes(prompt.slice(0, Math.min(12, prompt.length)))) {
    return {
      error: "提示词没有写进输入框",
      hint: "图片页编辑器可能已改版。当前应是 contenteditable，无障碍名类似「描述新图像」",
    };
  }

  let send = null;
  for (let i = 0; i < 15; i++) {
    const form = composer.closest("form") || document;
    send = [...form.querySelectorAll("button")].find((button) => {
      const label = button.getAttribute("aria-label") || "";
      if (button.disabled) return false;
      if (!/发送|send/i.test(label)) return false;
      return !/语音|voice|听写|dictat/i.test(label);
    }) || null;
    if (send) break;
    await sleep(200);
  }
  if (!send) {
    return {
      error: "找不到发送按钮",
      hint: "提示词已在输入框中。发送按钮应在有文字后出现，无障碍名是「发送」或 Send",
    };
  }

  const beforeSrcs = new Set(
    [...document.querySelectorAll("img")].map((img) => img.currentSrc || img.src || "").filter(Boolean),
  );

  send.click();

  // 参考图回显的 alt 是「用户附件」，生成结果是「已生成图像 N」。停止按钮的 aria 就是「停止」。
  const isUserAttachment = (img) => {
    const alt = img.alt || "";
    if (/已生成|generated image/i.test(alt)) return false;
    return /用户附件|user attachment|uploaded image|your attachment/i.test(alt);
  };

  const collectNewImages = () => {
    const seen = new Set();
    const found = [];
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.src || "";
      if (!src || beforeSrcs.has(src) || seen.has(src)) continue;
      if (isUserAttachment(img)) continue;
      if (/oaistatic\.com|cdn\.auth0\.com/i.test(src)) continue;
      const form = img.closest("form[data-chatgpt-composer], form");
      if (form && form.contains(img)) continue;
      const alt = img.alt || "";
      const markedGenerated = /已生成|generated image/i.test(alt);
      const w = img.naturalWidth || 0;
      const generatedSrc = /blob:|oaiusercontent|estuary|backend-api/i.test(src);
      if (!markedGenerated && !generatedSrc) continue;
      if (!markedGenerated && w > 0 && w < 256) continue;
      seen.add(src);
      found.push(img);
    }
    return found;
  };

  const maxMs = Math.min(8 * 60 * 1000, Math.max(180000, expected * 120000));
  const started = Date.now();
  let stable = 0;
  let lastCount = -1;
  let images = [];
  while (Date.now() - started < maxMs) {
    images = collectNewImages();
    const busy = generatingNow();
    if (images.length === lastCount && images.length > 0 && !busy) stable += 1;
    else stable = 0;
    lastCount = images.length;
    if (stable >= 2 && images.length >= expected) break;
    if (stable >= 3 && images.length > 0 && !busy) break;
    await sleep(2000);
  }

  if (images.length === 0) {
    return {
      error: "等待图片生成超时，页面上没有新图片",
      hint: "打开 https://chatgpt.com/images 查看是否仍在生成、是否触发验证或额度用尽",
      pageUrl: location.href,
      prompt,
      size,
      n: expected,
    };
  }
  if (images.length < expected) {
    warnings.push(`期望 ${expected} 张，页面上稳定出现 ${images.length} 张`);
  }

  const blobs = [];
  const imageResults = [];
  for (let i = 0; i < images.length; i++) {
    const src = images[i].currentSrc || images[i].src || "";
    let blob = null;
    if (downloadResult) {
      try {
        const resp = await fetch(src, { credentials: "include" });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        blob = await resp.blob();
      } catch (e) {
        warnings.push(`第 ${i + 1} 张下载失败: ${e && e.message ? e.message : e}`);
      }
    }
    blobs.push(blob);
    imageResults.push({
      index: i,
      url: src.slice(0, 800),
      mime: (blob && blob.type) || "",
    });
  }

  if (downloadResult) {
    window.__bbChatgptResultBlobs = blobs;
  }

  return {
    prompt,
    size,
    n: expected,
    pageUrl: location.href,
    images: imageResults,
    downloadReady: downloadResult && blobs.some(Boolean),
    warnings,
  };
}

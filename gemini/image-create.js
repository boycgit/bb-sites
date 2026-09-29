/* @meta
{
  "name": "gemini/image-create",
  "description": "在 gemini.google.com/app 切换到图片模式，用提示词生成图片，可选参考图，并把结果下载到本地",
  "domain": "gemini.google.com",
  "args": {
    "config": { "required": false, "description": "JSON 配置：{prompt,size,n,image_urls,downloadResult,targetDir}。prompt 必填" },
    "configFile": { "required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一）" },
    "prompt": { "required": false, "description": "CLI 写入的最终提示词（含尺寸与张数），不要手传" },
    "size": { "required": false, "description": "图片比例，默认 3:4。页面菜单支持 1:1、9:16、3:4、4:3、16:9" },
    "n": { "required": false, "description": "生成张数，默认 1，最大 8" },
    "downloadResult": { "required": false, "description": "是否把结果下载到本地，默认 true" },
    "targetDir": { "required": false, "description": "结果图片目录。相对路径相对 config 文件所在目录；不存在则新建。缺省写到 BB_BROWSER_HOME/downloads/gemini" }
  },
  "capabilities": ["write"],
  "readOnly": false,
  "example": "bb-browser site gemini/image-create --configFile ./gemini-image.config.json --json"
}
*/
async function (args) {
  // 2026-09 中文 Gemini：左下角「上传和工具」里的「制作图片」进入图片模式。
  // 输入框 aria「为 Gemini 输入提示」，placeholder「描述你的图片」。
  // 宽高比是 menuitemradio：1:1、9:16、3:4、4:3、16:9。没有张数控件。
  // 生成图在 generated-image / single-image img 上，地址带 =s1024 这类尺寸后缀。
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
  const wantRefs = Number(args.__geminiImagesMounted || 0);
  const warnings = [];
  if (String(args.__geminiUploadVia || "").includes("paste")) {
    warnings.push("参考图通过 Ctrl+V 贴进了输入框");
  }
  const pageRatios = ["1:1", "9:16", "3:4", "4:3", "16:9"];

  if (/accounts\.google\.com$/i.test(location.hostname)) {
    return {
      error: "Not logged in",
      hint: '请先执行 bb-browser open "https://gemini.google.com/app" 并登录',
    };
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const clickEl = (el) => {
    if (!el) return false;
    el.click();
    return true;
  };

  const findComposer = () => {
    const boxes = [...document.querySelectorAll("[contenteditable='true'][role='textbox']")];
    return (
      boxes.find((el) => /Gemini|提示|prompt|image/i.test(
        `${el.getAttribute("aria-label") || ""} ${el.getAttribute("data-placeholder") || ""}`,
      )) || boxes[0] || null
    );
  };

  const inImageMode = () => {
    const editor = findComposer();
    const ph = editor
      ? (editor.getAttribute("data-placeholder") || editor.getAttribute("aria-placeholder") || "")
      : "";
    if (/图片|image/i.test(ph)) return true;
    return [...document.querySelectorAll("button")].some((button) => {
      const aria = button.getAttribute("aria-label") || "";
      const text = (button.innerText || "").replace(/\s+/g, " ").trim();
      return aria.includes("取消选择") && text === "图片";
    });
  };

  if (!inImageMode()) {
    const plus = [...document.querySelectorAll("button")].find((button) => {
      const label = button.getAttribute("aria-label") || "";
      return label === "上传和工具" || /upload and tools/i.test(label);
    });
    if (!plus) {
      return {
        error: "找不到「上传和工具」按钮",
        hint: '打开 https://gemini.google.com/app ，确认左下角有加号按钮',
      };
    }
    const findCreateImage = () =>
      [...document.querySelectorAll("[role='menuitemcheckbox'], [role='menuitem'], .gem-menu-item-label")].map((entry) => {
        const text = (entry.innerText || entry.textContent || "").replace(/\s+/g, " ").trim();
        if (text === "制作图片" || /^(create image|make an image|make image|generate image)$/i.test(text)) {
          return entry.closest("button") || entry;
        }
        return null;
      }).find(Boolean) || null;
    let item = findCreateImage();
    if (!item) {
      clickEl(plus);
      for (let i = 0; i < 25; i++) {
        item = findCreateImage();
        if (item) break;
        await sleep(300);
      }
    }
    if (!item) {
      return {
        error: "找不到「制作图片」",
        hint: "左下角「上传和工具」菜单里应有「制作图片」。菜单若已改版，先手动点一次确认文案",
      };
    }
    clickEl(item);
    for (let i = 0; i < 20; i++) {
      if (inImageMode()) break;
      await sleep(200);
    }
  }

  const composer = findComposer();
  if (!composer || !inImageMode()) {
    return {
      error: "Gemini 图片模式未就绪",
      hint: '请先执行 bb-browser open "https://gemini.google.com/app" 并登录，再用「制作图片」确认能进入图片模式',
    };
  }

  const controlText = (el) => ((el.innerText || el.textContent || "").replace(/\s+/g, " ")).trim();

  if (pageRatios.includes(size)) {
    let ratioButton = null;
    for (let i = 0; i < 15; i++) {
      ratioButton = [...document.querySelectorAll("button")].find((button) => {
        if (button.getAttribute("role") === "menuitemradio") return false;
        const text = controlText(button);
        const aria = button.getAttribute("aria-label") || "";
        return text === "宽高比"
          || pageRatios.includes(text)
          || /宽高比|aspect ratio/i.test(aria);
      }) || null;
      if (ratioButton) break;
      await sleep(200);
    }
    const currentRatio = ratioButton ? controlText(ratioButton) : "";
    if (!ratioButton) {
      warnings.push(`找不到宽高比按钮，只把 ${size} 写进了提示词`);
    } else if (currentRatio !== size) {
      clickEl(ratioButton);
      let choice = null;
      for (let i = 0; i < 12; i++) {
        choice = [...document.querySelectorAll("[role='menuitemradio']")].find((entry) => {
          const text = (entry.getAttribute("aria-label") || controlText(entry)).trim();
          return text === size;
        }) || null;
        if (choice) break;
        await sleep(150);
      }
      if (!choice) {
        warnings.push(`宽高比菜单里没有 ${size}，只把比例写进了提示词`);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } else if (choice.getAttribute("aria-checked") !== "true") {
        clickEl(choice);
        await sleep(300);
      } else {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    }
  } else {
    warnings.push(`页面宽高比菜单没有 ${size}，只把比例写进了提示词`);
  }

  const composerRoot = () => {
    let node = composer;
    for (let depth = 0; depth < 8 && node.parentElement; depth++) {
      node = node.parentElement;
      const hasUpload = [...node.querySelectorAll("button")].some((button) => {
        const aria = button.getAttribute("aria-label") || "";
        return aria === "上传和工具" || /upload and tools/i.test(aria);
      });
      if (hasUpload && node.getBoundingClientRect().height < 420) return node;
    }
    return composer.parentElement || composer;
  };

  if (wantRefs > 0) {
    let attached = 0;
    for (let i = 0; i < 20; i++) {
      attached = [...composerRoot().querySelectorAll("img")].filter((img) => {
        if (img.closest("generated-image, single-image")) return false;
        const src = img.currentSrc || img.src || "";
        if (/gstatic\.com|googleusercontent\.com\/a\//i.test(src)) return false;
        const rect = img.getBoundingClientRect();
        return rect.width >= 24 && rect.height >= 24;
      }).length;
      if (attached >= wantRefs) break;
      await sleep(400);
    }
    if (attached < wantRefs) {
      return {
        error: "参考图未出现在输入框",
        hint: "Gemini「上传文件」控件可能已变化。打开 https://gemini.google.com/app 确认能手动添加图片后再试",
        attached,
        expected: wantRefs,
        warnings,
      };
    }
  }

  const generatingNow = () =>
    [...document.querySelectorAll("button")].some((button) => {
      const label = (button.getAttribute("aria-label") || button.innerText || "").replace(/\s+/g, " ").trim();
      return /^(停止|停止生成|停止回答|停止响应|stop|stop generating|stop response|stop answering)$/i.test(label);
    });

  if (generatingNow()) {
    return {
      error: "当前已有生成任务",
      hint: "等当前回答结束，或打开新的 https://gemini.google.com/app 后再试",
      warnings,
    };
  }

  const promptMark = prompt.slice(0, Math.min(12, prompt.length));
  const promptStuck = () => (composer.innerText || "").replace(/\s+/g, " ").trim().includes(promptMark);
  const writePrompt = () => {
    composer.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(composer);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, prompt);
    return promptStuck();
  };
  if (!writePrompt()) {
    return {
      error: "提示词没有写进输入框",
      hint: "图片模式编辑器可能已改版。当前应是 contenteditable，无障碍名类似「为 Gemini 输入提示」",
      warnings,
    };
  }

  let send = null;
  for (let i = 0; i < 15; i++) {
    if (!promptStuck()) writePrompt();
    send = [...document.querySelectorAll("button")].find((button) => {
      const label = button.getAttribute("aria-label") || "";
      if (button.disabled) return false;
      if (!/^发送$|^send$/i.test(label.trim())) return false;
      return !/语音|voice|听写|dictat/i.test(label);
    }) || null;
    if (send && promptStuck()) break;
    await sleep(200);
  }
  // 附件还在时，立刻删掉再插入会让发送读到「只有文件」的旧状态。文字已在框里就不要重写。
  if (!promptStuck() && !writePrompt()) {
    return {
      error: "提示词被页面清掉了",
      hint: "参考图挂上后输入框被重绘。请重试；若仍失败，先手动在图片模式里上传一张图确认输入框还能打字",
      warnings,
    };
  }
  await sleep(800);
  if (!promptStuck() && !writePrompt()) {
    return {
      error: "提示词被页面清掉了",
      hint: "参考图挂上后输入框被重绘。请重试；若仍失败，先手动在图片模式里上传一张图确认输入框还能打字",
      warnings,
    };
  }
  send = [...document.querySelectorAll("button")].find((button) => {
    const label = button.getAttribute("aria-label") || "";
    if (button.disabled) return false;
    if (!/^发送$|^send$/i.test(label.trim())) return false;
    return !/语音|voice|听写|dictat/i.test(label);
  }) || null;
  if (!send || !promptStuck()) {
    return {
      error: send ? "提示词被页面清掉了" : "找不到发送按钮",
      hint: send
        ? "参考图挂上后输入框被重绘。请重试；若仍失败，先手动在图片模式里上传一张图确认输入框还能打字"
        : "提示词已在输入框中。发送按钮应在有文字后出现，无障碍名是「发送」或 Send",
      warnings,
    };
  }

  const beforeSrcs = new Set(
    [...document.querySelectorAll("generated-image img, single-image img, .generated-images img")]
      .map((img) => img.currentSrc || img.src || "")
      .filter(Boolean),
  );

  send.click();

  const fullSizeUrl = (url) => url.replace(/=s\d+[^&=?#]*/, "=s0");

  const collectNewImages = () => {
    const seen = new Set();
    const found = [];
    for (const img of document.querySelectorAll("generated-image img, single-image img, .generated-images img")) {
      const src = img.currentSrc || img.src || "";
      if (!src || beforeSrcs.has(src) || seen.has(src)) continue;
      if (/gstatic\.com|googleusercontent\.com\/a\//i.test(src)) continue;
      if (img.closest("[data-composer-attachments]")) continue;
      seen.add(src);
      found.push(img);
    }
    return found;
  };

  const refusalText = () => {
    const chunks = [...document.querySelectorAll("model-response, message-content")].map((node) =>
      (node.innerText || "").replace(/\s+/g, " ").trim(),
    ).filter(Boolean);
    return chunks.find((text) => /无权访问该内容|无法生成图片|无法生成此|couldn't generate|unable to generate|can't generate/i.test(text)) || "";
  };

  const maxMs = Math.min(12 * 60 * 1000, Math.max(180000, expected * 150000));
  const started = Date.now();
  let stable = 0;
  let lastKey = "";
  let lastProse = "";
  let proseStable = 0;
  let images = [];
  while (Date.now() - started < maxMs) {
    images = collectNewImages();
    const key = images.map((img) => img.currentSrc || img.src || "").join("|");
    const busy = generatingNow();
    if (key === lastKey && images.length > 0 && !busy) stable += 1;
    else stable = 0;
    lastKey = key;
    if (stable >= 2 && images.length >= expected) break;
    if (stable >= 3 && images.length > 0 && !busy) break;
    const refusal = !busy && images.length === 0 ? refusalText() : "";
    if (refusal && Date.now() - started > 4000) {
      return {
        error: refusal.slice(0, 300),
        hint: "Gemini 没有返回图片。换一个提示词，或在页面上点「重试」确认账号的图片模式可用",
        pageUrl: location.href,
        prompt,
        size,
        n: expected,
        warnings,
      };
    }
    const proseNode = document.querySelector("model-response");
    const prose = proseNode ? (proseNode.textContent || proseNode.innerText || "").replace(/\s+/g, " ").trim() : "";
    const userText = (document.querySelector("user-query")?.textContent || "").replace(/\s+/g, " ");
    const droppedPrompt = !!document.querySelector("user-query") && !userText.includes(promptMark);
    if (!busy && images.length === 0 && prose.length > 40 && prose === lastProse) proseStable += 1;
    else proseStable = 0;
    lastProse = prose;
    if ((proseStable >= 2 || droppedPrompt) && prose.length > 40 && Date.now() - started > 6000) {
      return {
        error: prose.slice(0, 300),
        hint: droppedPrompt
          ? "参考图发出去了，但提示词不在这条消息里。Gemini 因此只分析了图片"
          : "Gemini 返回了文字，没有生成图片。确认请求是在图片模式里发出的",
        pageUrl: location.href,
        prompt,
        size,
        n: expected,
        warnings,
      };
    }
    await sleep(2000);
  }

  if (images.length === 0) {
    return {
      error: "等待图片生成超时，页面上没有新图片",
      hint: "打开 https://gemini.google.com/app 查看是否仍在生成、是否触发验证或额度用尽",
      pageUrl: location.href,
      prompt,
      size,
      n: expected,
      warnings,
    };
  }
  if (images.length < expected) {
    warnings.push(`期望 ${expected} 张，页面上稳定出现 ${images.length} 张`);
  }

  const networkImageUrl = () => {
    const hits = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => /googleusercontent\.com\/gg-dl\//.test(url)
        && !/\/rd-gg-dl\//.test(url)
        && !/[?&]alr=/.test(url));
    return hits.length ? hits[hits.length - 1] : "";
  };
  window.__bbGeminiResultBlobs = [];
  const imageResults = [];
  for (let index = 0; index < images.length; index++) {
    const raw = images[index].currentSrc || images[index].src || "";
    let url = raw;
    let full = fullSizeUrl(raw);
    if (raw.startsWith("blob:")) {
      const remote = networkImageUrl();
      if (remote) {
        url = remote;
        full = fullSizeUrl(remote);
      }
      try {
        window.__bbGeminiResultBlobs[index] = await (await fetch(raw)).blob();
      } catch {
        /* 页面 blob 读不到时，仍用上面的网络地址下载 */
      }
    }
    imageResults.push({ index, url, fullUrl: full });
  }

  return {
    prompt,
    size,
    n: expected,
    pageUrl: location.href,
    images: imageResults,
    downloadReady: downloadResult && imageResults.length > 0,
    warnings,
  };
}

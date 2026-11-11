/**
 * Shared Fab marketplace search / download helpers.
 * Prepended by daemon before fab/*.js adapters.
 */

var __FAB_ORIGIN = "https://www.fab.com";
var __FAB_PREFERRED_FORMATS = ["gltf", "glb", "fbx"];
var __FAB_DEFAULT_COUNT = 20;
var __FAB_MAX_COUNT = 100;

var __FAB_LISTING_TYPES = [
  "audio",
  "game-template",
  "vfx",
  "tool-and-plugin",
  "decal",
  "sprites-and-flipbooks",
  "tutorials-examples",
  "3d-model",
  "brush",
  "ui",
  "game-system",
  "hdri",
  "material",
  "animation",
];

var __FAB_LISTING_ALIASES = {
  all: "",
  所有: "",
  所有产品: "",
  "3d": "3d-model",
  "3D": "3d-model",
  "3d-model": "3d-model",
  model: "3d-model",
  模型: "3d-model",
  material: "material",
  materials: "material",
  材质: "material",
  材质与纹理: "material",
  纹理: "material",
  brush: "brush",
  笔刷: "brush",
  animation: "animation",
  动画: "animation",
  audio: "audio",
  音频: "audio",
  vfx: "vfx",
  视觉效果: "vfx",
  ui: "ui",
  用户界面: "ui",
  hdri: "hdri",
  HDRI: "hdri",
  decal: "decal",
  贴花: "decal",
  "tool-and-plugin": "tool-and-plugin",
  plugin: "tool-and-plugin",
  工具与插件: "tool-and-plugin",
  "game-template": "game-template",
  游戏模板: "game-template",
  "game-system": "game-system",
  游戏系统: "game-system",
  "sprites-and-flipbooks": "sprites-and-flipbooks",
  "tutorials-examples": "tutorials-examples",
};

var __FAB_SORT_ALIASES = {
  relevance: "-relevance",
  relevant: "-relevance",
  相关度: "-relevance",
  相关: "-relevance",
  default: "-relevance",
  "-relevance": "-relevance",
  rating: "-ratings.averageRating",
  ratings: "-ratings.averageRating",
  评分: "-ratings.averageRating",
  "-ratings.averageRating": "-ratings.averageRating",
  newest: "-firstPublishedAt",
  latest: "-firstPublishedAt",
  new: "-firstPublishedAt",
  最新: "-firstPublishedAt",
  "-firstPublishedAt": "-firstPublishedAt",
  oldest: "firstPublishedAt",
  最旧: "firstPublishedAt",
  firstPublishedAt: "firstPublishedAt",
  title: "title",
  "title-az": "title",
  az: "title",
  标题: "title",
  "标题 a-z": "title",
  "-title": "-title",
  "title-za": "-title",
  za: "-title",
  "标题 z-a": "-title",
  "标题降序": "-title",
  price: "price",
  "price-asc": "price",
  价格: "price",
  "价格从低到高": "price",
  "-price": "-price",
  "price-desc": "-price",
  "价格从高到低": "-price",
  discount: "-discountPercentage",
  折扣: "-discountPercentage",
  "-discountPercentage": "-discountPercentage",
};

var __FAB_CONTENT_ALIASES = {
  all: "",
  所有: "",
  所有内容: "",
  ai: "ai",
  AI: "ai",
  "ai-generated": "ai",
  仅ai: "ai",
  仅AI: "ai",
  authentic: "human",
  human: "human",
  真实: "human",
  仅真实: "human",
  非ai: "human",
  非AI: "human",
};

var __FAB_CHANNEL_ALIASES = {
  unity: "unity",
  unreal: "unreal-engine",
  "unreal-engine": "unreal-engine",
  ue: "unreal-engine",
  虚幻: "unreal-engine",
  虚幻引擎: "unreal-engine",
  metahuman: "metahuman",
  uefn: "uefn",
};

var __FAB_FORMAT_ALIASES = {
  gltf: "gltf",
  GLTF: "gltf",
  glb: "glb",
  GLB: "glb",
  fbx: "fbx",
  FBX: "fbx",
  obj: "obj",
  usd: "usd",
  usdz: "usdz",
  blender: "blender",
  maya: "maya",
  "3ds-max": "3ds-max",
  "3dsmax": "3ds-max",
  "cinema-4d": "cinema-4d",
  c4d: "cinema-4d",
  unity: "unity",
  "unreal-engine": "unreal-engine",
  unreal: "unreal-engine",
};

function __fabFail(error, hint) {
  return {
    error: error,
    hint: hint,
    action: 'bb-browser open "' + __FAB_ORIGIN + '/search?ui_filter_price=1&is_free=1"',
  };
}

function __fabLooksLikePath(s) {
  return /[\\/]|\.json$/i.test(s) && s.charAt(0) !== "{";
}

function __fabParseConfig(rawArgs) {
  var a = rawArgs || {};
  if (a.config && a.configFile) {
    return { error: "Pass only one of --config or --configFile" };
  }
  var raw = a.config != null && a.config !== "" ? a.config : a.configFile;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw;
  raw = String(raw || "").trim();
  if (!raw) return {};
  if (__fabLooksLikePath(raw)) {
    return {
      error: "configFile was not expanded to JSON",
      hint: "Use --config '{\"query\":\"crate\"}' or --configFile ./file.json (CLI inlines .json)",
    };
  }
  if (raw.charAt(0) === "{") {
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { error: "config must be a JSON object" };
      }
      return parsed;
    } catch (e) {
      return { error: "Invalid config JSON", hint: e instanceof Error ? e.message : String(e) };
    }
  }
  return { query: raw };
}

function __fabAsList(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map(function (x) { return String(x).trim(); }).filter(Boolean);
  }
  var s = String(value).trim();
  if (!s) return [];
  if (s.charAt(0) === "[") {
    try {
      var parsed = JSON.parse(s);
      if (Array.isArray(parsed)) {
        return parsed.map(function (x) { return String(x).trim(); }).filter(Boolean);
      }
    } catch (e) { /* fall through */ }
  }
  return s.split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function __fabPick(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
  }
  return undefined;
}

function __fabBool(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  var s = String(value).trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes") return true;
  if (s === "false" || s === "0" || s === "no") return false;
  return fallback;
}

function __fabNormKey(s) {
  return String(s || "").trim();
}

function __fabMapAlias(raw, aliases) {
  var key = __fabNormKey(raw);
  if (!key) return "";
  if (Object.prototype.hasOwnProperty.call(aliases, key)) return aliases[key];
  var lower = key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(aliases, lower)) return aliases[lower];
  return null;
}

function __fabMapListingType(raw) {
  var mapped = __fabMapAlias(raw, __FAB_LISTING_ALIASES);
  if (mapped === "") return "";
  if (mapped) return mapped;
  var slug = __fabNormKey(raw).toLowerCase();
  if (__FAB_LISTING_TYPES.indexOf(slug) >= 0) return slug;
  return null;
}

function __fabMapSort(raw) {
  if (!raw) return "-relevance";
  var mapped = __fabMapAlias(raw, __FAB_SORT_ALIASES);
  if (mapped) return mapped;
  return null;
}

function __fabMapFormat(raw) {
  var mapped = __fabMapAlias(raw, __FAB_FORMAT_ALIASES);
  if (mapped) return mapped;
  var slug = __fabNormKey(raw).toLowerCase();
  if (/^[a-z0-9][a-z0-9-]*$/.test(slug)) return slug;
  return null;
}

function __fabNormalizeSearch(cfg) {
  if (cfg.page != null && cfg.page !== "") {
    return {
      error: "Fab search is infinite-scroll and has no page parameter",
      hint: "Use count (default 20) and cursor from the previous response.nextCursor",
    };
  }

  var query = String(__fabPick(cfg, ["query", "q", "keyword"]) || "").trim();

  var listingRaw = __fabPick(cfg, ["listingType", "listing_type", "listingTypes", "type"]);
  var listingType = "";
  if (listingRaw != null && listingRaw !== "") {
    var listingMapped = __fabMapListingType(Array.isArray(listingRaw) ? listingRaw[0] : listingRaw);
    if (listingMapped == null) {
      return {
        error: "Invalid listingType: " + listingRaw,
        hint: "Use all | 3d-model | material | brush | animation（所有产品 / 3D / 材质 / 笔刷 / 动画）",
      };
    }
    listingType = listingMapped;
  }

  var sortRaw = __fabNormKey(__fabPick(cfg, ["sort", "order", "sortBy", "sort_by"]));
  var sort = "-relevance";
  if (sortRaw) {
    var sortMapped = __fabMapSort(sortRaw);
    if (!sortMapped) {
      return {
        error: "Invalid sort: " + sortRaw,
        hint: "Use relevance | rating | newest | oldest | title | title-za（相关度 / 评分 / 最新 / 最旧 / 标题）",
      };
    }
    sort = sortMapped;
  }

  var contentRaw = __fabNormKey(__fabPick(cfg, ["contentType", "content_type"]));
  var contentType = "";
  if (contentRaw) {
    var contentMapped = __fabMapAlias(contentRaw, __FAB_CONTENT_ALIASES);
    if (contentMapped == null) {
      return {
        error: "Invalid contentType: " + contentRaw,
        hint: "Use all | authentic | ai（所有内容 / 仅真实内容 / 仅AI生成）",
      };
    }
    contentType = contentMapped || "";
  }

  var channelRaw = __fabNormKey(__fabPick(cfg, ["channel", "channels"]));
  var channel = "";
  if (channelRaw) {
    var channelMapped = __fabMapAlias(channelRaw, __FAB_CHANNEL_ALIASES);
    if (channelMapped == null && /^[a-z0-9][a-z0-9-]*$/i.test(channelRaw)) {
      channelMapped = channelRaw.toLowerCase();
    }
    if (!channelMapped) {
      return {
        error: "Invalid channel: " + channelRaw,
        hint: "Use unity | unreal-engine | metahuman | uefn",
      };
    }
    channel = channelMapped;
  }

  var countRaw = __fabPick(cfg, ["count", "limit", "pageSize"]);
  var count = __FAB_DEFAULT_COUNT;
  if (countRaw != null && countRaw !== "") {
    count = typeof countRaw === "number" ? countRaw : parseInt(String(countRaw).trim(), 10);
    if (!Number.isInteger(count) || count < 1 || count > __FAB_MAX_COUNT) {
      return { error: "Invalid count: " + countRaw, hint: "count 为 1–" + __FAB_MAX_COUNT + "，默认 20" };
    }
  }

  var minRatingRaw = __fabPick(cfg, ["minRating", "rating", "min_avg_rating"]);
  var minRating = null;
  if (minRatingRaw != null && minRatingRaw !== "") {
    minRating = typeof minRatingRaw === "number" ? minRatingRaw : parseFloat(String(minRatingRaw).trim());
    if (!(minRating >= 1 && minRating <= 5)) {
      return { error: "Invalid minRating: " + minRatingRaw, hint: "minRating 为 1–5" };
    }
  }

  var formats = __fabAsList(__fabPick(cfg, ["formats", "format", "assetFormats", "asset_formats"]));
  var mappedFormats = [];
  for (var i = 0; i < formats.length; i++) {
    var f = __fabMapFormat(formats[i]);
    if (!f) {
      return { error: "Invalid format: " + formats[i], hint: "Use gltf | glb | fbx | obj | blender | unity | unreal-engine 等官网格式 code" };
    }
    mappedFormats.push(f);
  }

  var publishedSince = String(__fabPick(cfg, ["publishedSince", "published_since", "publishDate"]) || "").trim();
  if (publishedSince && !/^\d{4}-\d{2}-\d{2}/.test(publishedSince)) {
    return { error: "Invalid publishedSince: " + publishedSince, hint: "Use YYYY-MM-DD，例如 2026-01-01" };
  }
  if (publishedSince) publishedSince = publishedSince.slice(0, 10);

  return {
    query: query,
    listingType: listingType,
    categories: __fabAsList(__fabPick(cfg, ["categories", "categorySlug", "subcategory"])),
    styles: __fabAsList(__fabPick(cfg, ["styles", "style"])),
    technical: __fabAsList(__fabPick(cfg, ["technical", "technicalSpecs", "technicalFeatures"])),
    formats: mappedFormats,
    tags: __fabAsList(__fabPick(cfg, ["tags", "tag"])),
    licenses: __fabAsList(__fabPick(cfg, ["licenses", "license"])),
    publisher: String(__fabPick(cfg, ["publisher", "seller"]) || "").trim(),
    publishedSince: publishedSince,
    minRating: minRating,
    contentType: contentType,
    channel: channel,
    sort: sort,
    count: count,
    cursor: String(__fabPick(cfg, ["cursor"]) || "").trim(),
    includeDownload: __fabBool(__fabPick(cfg, ["includeDownload", "download"]), false),
  };
}

function __fabAppendAll(qs, key, values) {
  for (var i = 0; i < values.length; i++) qs.append(key, values[i]);
}

function __fabBuildSearchParams(cfg, forPage) {
  var qs = new URLSearchParams();
  qs.set("is_free", "1");
  if (forPage) qs.set("ui_filter_price", "1");
  if (cfg.query) qs.set("q", cfg.query);
  if (cfg.listingType) qs.set("listing_types", cfg.listingType);
  __fabAppendAll(qs, "categories", cfg.categories);
  __fabAppendAll(qs, "styles", cfg.styles);
  var tags = cfg.tags.concat(cfg.technical);
  var seen = {};
  var uniqueTags = [];
  for (var i = 0; i < tags.length; i++) {
    var t = tags[i];
    if (seen[t]) continue;
    seen[t] = true;
    uniqueTags.push(t);
  }
  __fabAppendAll(qs, "tags", uniqueTags);
  __fabAppendAll(qs, "asset_formats", cfg.formats);
  __fabAppendAll(qs, "licenses", cfg.licenses);
  if (cfg.publisher) qs.set("seller", cfg.publisher);
  if (cfg.publishedSince) qs.set("published_since", cfg.publishedSince);
  if (cfg.minRating != null) qs.set("min_avg_rating", String(cfg.minRating));
  if (cfg.contentType === "ai") qs.set("is_ai_generated", "1");
  if (cfg.contentType === "human") qs.set("is_ai_generated", "0");
  if (cfg.channel) qs.set("channels", cfg.channel);
  if (cfg.sort && cfg.sort !== "-relevance") qs.set("sort_by", cfg.sort);
  if (!forPage) {
    qs.set("count", String(cfg.count));
    if (cfg.cursor) qs.set("cursor", cfg.cursor);
  }
  return qs;
}

function __fabCanonicalUrl(cfg) {
  var q = __fabBuildSearchParams(cfg, true).toString();
  return __FAB_ORIGIN + "/search" + (q ? "?" + q : "");
}

function __fabApiPath(cfg) {
  return "/i/listings/search?" + __fabBuildSearchParams(cfg, false).toString();
}

function __fabHeaders(extra) {
  var csrf = (document.cookie.match(/(?:^|; )fab_csrftoken=([^;]+)/) || [])[1] || "";
  var h = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (csrf) {
    h["X-CsrfToken"] = decodeURIComponent(csrf);
    h["X-CSRFToken"] = decodeURIComponent(csrf);
  }
  if (extra) {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    }
  }
  return h;
}

async function __fabFetchJson(path, opts) {
  var resp;
  try {
    resp = await fetch(path, {
      credentials: "include",
      method: (opts && opts.method) || "GET",
      headers: __fabHeaders(opts && opts.headers),
      body: opts && opts.body ? opts.body : undefined,
    });
  } catch (e) {
    return { error: "Fetch failed", hint: (e instanceof Error ? e.message : String(e)) + ". Open fab.com first." };
  }
  var text = await resp.text();
  var data = null;
  var looksJson = /^\s*[{[]/.test(text);
  if (looksJson) {
    try { data = JSON.parse(text); } catch (e) { data = null; }
  }
  if (!resp.ok) {
    var msg = data && (data.detail || data.error || data.message);
    if (typeof msg === "object") msg = JSON.stringify(msg);
    return {
      error: "HTTP " + resp.status,
      hint: msg || (resp.status === 401 ? "Not logged in. Open fab.com and sign in." : "Unexpected Fab response"),
      status: resp.status,
      data: data,
    };
  }
  if (!looksJson || data == null) {
    return { error: "Unexpected response (not JSON)", hint: "先打开 https://www.fab.com/search?is_free=1 再试" };
  }
  return { data: data, status: resp.status };
}

function __fabFormatCodes(listing) {
  var formats = listing && listing.assetFormats;
  if (!Array.isArray(formats)) return [];
  var out = [];
  for (var i = 0; i < formats.length; i++) {
    var t = formats[i] && formats[i].assetFormatType;
    var code = t && t.code;
    if (code) out.push(code);
  }
  return out;
}

function __fabPickPreferred(codes) {
  var set = {};
  for (var i = 0; i < codes.length; i++) set[String(codes[i]).toLowerCase()] = true;
  for (var j = 0; j < __FAB_PREFERRED_FORMATS.length; j++) {
    if (set[__FAB_PREFERRED_FORMATS[j]]) return __FAB_PREFERRED_FORMATS[j];
  }
  return null;
}

function __fabThumbUrl(listing) {
  var thumbs = listing && listing.thumbnails;
  if (!Array.isArray(thumbs) || !thumbs.length) return "";
  var first = thumbs[0] || {};
  var images = first.images;
  if (Array.isArray(images) && images.length) {
    var best = images[0];
    for (var i = 1; i < images.length; i++) {
      if ((images[i].width || 0) > (best.width || 0)) best = images[i];
    }
    return best.url || first.mediaUrl || "";
  }
  return first.mediaUrl || "";
}

function __fabStripHtml(s) {
  if (!s) return "";
  return String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function __fabMapFormats(listing) {
  var formats = listing && listing.assetFormats;
  if (!Array.isArray(formats)) return [];
  return formats.map(function (f) {
    var t = f.assetFormatType || {};
    var size = f.fileSizesRange || {};
    var specs = f.technicalSpecs || {};
    return {
      code: t.code || "",
      name: t.name || "",
      groupName: t.groupName || "",
      icon: t.icon || "",
      fileSize: size.lower != null ? size.lower : null,
      technicalDetails: __fabStripHtml(specs.technicalDetails || ""),
    };
  });
}

function __fabSellerUrl(user) {
  var name = user && (user.sellerName || user.sellerId);
  if (!name) return "";
  return __FAB_ORIGIN + "/sellers/" + encodeURIComponent(name);
}

function __fabMapItem(listing) {
  var codes = __fabFormatCodes(listing);
  var preferred = __fabPickPreferred(codes);
  var user = listing.user || {};
  var cat = listing.category || {};
  var ratings = listing.ratings || {};
  var price = listing.startingPrice || {};
  var tags = Array.isArray(listing.tags) ? listing.tags : [];
  var licenses = Array.isArray(listing.licenses) ? listing.licenses : [];
  var priceValue = price.price;
  return {
    uid: listing.uid,
    title: listing.title || "",
    pageUrl: __FAB_ORIGIN + "/listings/" + listing.uid,
    listingType: listing.listingType || "",
    productType: listing.productType || "",
    category: {
      uid: cat.uid || "",
      name: cat.name || "",
      slug: cat.slug || "",
      path: cat.path || "",
    },
    isFree: !!listing.isFree,
    isDiscounted: !!listing.isDiscounted,
    hasEffectiveDiscounts: !!listing.hasEffectiveDiscounts,
    effectivelyFree: !!listing.isFree || priceValue === 0,
    isMature: !!listing.isMature,
    availableInEurope: listing.availableInEurope,
    visibilityStatus: listing.visibilityStatus || "",
    publishedAt: listing.publishedAt || "",
    ratings: {
      averageRating: ratings.averageRating != null ? ratings.averageRating : null,
      total: ratings.total != null ? ratings.total : 0,
    },
    startingPrice: {
      offerId: price.offerId || listing.offerId || "",
      priceTierId: price.priceTierId || "",
      price: priceValue != null ? priceValue : null,
    },
    licenses: licenses.map(function (l) {
      return {
        uid: l.uid || "",
        name: l.name || "",
        isCc: !!l.isCc,
        priceTier: l.priceTier || "",
      };
    }),
    tags: tags.map(function (t) {
      return { uid: t.uid || "", name: t.name || "", slug: t.slug || "" };
    }),
    thumbnailUrl: __fabThumbUrl(listing),
    thumbnails: Array.isArray(listing.thumbnails)
      ? listing.thumbnails.map(function (th) {
          return { uid: th.uid || "", type: th.type || "", mediaUrl: th.mediaUrl || "", name: th.name || "" };
        })
      : [],
    assetFormats: __fabMapFormats(listing),
    formatCodes: codes,
    preferredFormat: preferred,
    user: {
      uid: user.uid || "",
      sellerName: user.sellerName || "",
      sellerId: user.sellerId || "",
      profileUrl: __fabSellerUrl(user),
      profileImageUrl: user.profileImageUrl || "",
      isSeller: !!user.isSeller,
    },
    catalogItemId: listing.catalogItemId || "",
    offerId: listing.offerId || price.offerId || "",
  };
}

function __fabQueryEnvelope(cfg) {
  return {
    query: cfg.query,
    listingType: cfg.listingType || null,
    categories: cfg.categories,
    styles: cfg.styles,
    technical: cfg.technical,
    formats: cfg.formats,
    tags: cfg.tags,
    licenses: cfg.licenses,
    publisher: cfg.publisher || null,
    publishedSince: cfg.publishedSince || null,
    minRating: cfg.minRating,
    contentType: cfg.contentType || null,
    channel: cfg.channel || null,
    sort: cfg.sort,
    count: cfg.count,
    cursor: cfg.cursor || null,
    includeDownload: cfg.includeDownload,
    isFree: true,
  };
}

async function __fabDownloadForFormat(uid, formatCode) {
  var fmt = await __fabFetchJson("/i/listings/" + uid + "/asset-formats/" + encodeURIComponent(formatCode));
  if (fmt.error) return fmt;
  var files = (fmt.data && fmt.data.files) || [];
  var file = null;
  for (var i = 0; i < files.length; i++) {
    if (files[i] && (files[i].status === "ready" || files[i].processingStatus === "succeeded")) {
      file = files[i];
      break;
    }
  }
  if (!file) file = files[0] || null;
  if (!file || !file.uid) {
    return { error: "No files for format " + formatCode, hint: "This listing has no ready " + formatCode + " file" };
  }
  var info = await __fabFetchJson(
    "/i/listings/" + uid + "/asset-formats/" + encodeURIComponent(formatCode) + "/files/" + file.uid + "/download-info"
  );
  if (info.error) return info;
  var di = info.data && info.data.downloadInfo && info.data.downloadInfo[0];
  if (!di || !di.downloadUrl) {
    return { error: "No download URL", hint: "Fab did not return a signed URL for this file" };
  }
  return {
    data: {
      format: formatCode,
      fileUid: file.uid,
      fileName: file.name || "",
      fileSize: file.size != null ? file.size : null,
      fileType: file.fileType || "",
      faceCount: file.faceCount != null ? file.faceCount : null,
      vertexCount: file.vertexCount != null ? file.vertexCount : null,
      downloadUrl: di.downloadUrl,
      expires: di.expires || "",
      type: di.type || "",
      techDetails: (fmt.data && fmt.data.techDetails) || null,
    },
  };
}

async function __fabAttachDownloads(items) {
  var warnings = [];
  var tasks = items.map(function (item) {
    return (async function () {
      if (!item.preferredFormat) {
        item.download = null;
        item.downloadError = "listing has no gltf/glb/fbx";
        warnings.push(item.uid + ": listing has no gltf/glb/fbx");
        return;
      }
      var got = await __fabDownloadForFormat(item.uid, item.preferredFormat);
      if (got.error) {
        item.download = null;
        item.downloadError = got.error;
        warnings.push(item.uid + ": " + got.error);
        return;
      }
      item.download = got.data;
    })();
  });
  await Promise.all(tasks);
  return warnings;
}

async function __fabEnsureCsrf() {
  await fetch("/i/csrf", { credentials: "include", headers: __fabHeaders() }).catch(function () {});
}

async function __fabClaimFree(uid, offerId) {
  if (!offerId) return { error: "Missing offerId", hint: "Listing has no free offer to claim" };
  await __fabEnsureCsrf();
  var body = new FormData();
  body.append("offer_id", offerId);
  var resp = await fetch("/i/listings/" + uid + "/add-to-library", {
    credentials: "include",
    method: "POST",
    headers: __fabHeaders(),
    body: body,
  });
  if (resp.ok || resp.status === 204) return { ok: true, status: resp.status };
  var text = await resp.text();
  var msg = text.slice(0, 200);
  try {
    var j = JSON.parse(text);
    msg = j.detail || j.error || j.message || msg;
    if (typeof msg === "object") msg = JSON.stringify(msg);
  } catch (e) { /* keep text */ }
  return {
    error: "HTTP " + resp.status,
    hint: resp.status === 401 ? "Not logged in. Open fab.com and sign in, then retry download." : String(msg),
    status: resp.status,
  };
}

function __fabExtractUid(raw) {
  var s = String(raw || "").trim();
  if (!s) return "";
  var m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  return m ? m[0].toLowerCase() : "";
}

async function __fabAssetSearch(args) {
  var parsed = __fabParseConfig(args);
  if (parsed.error) return __fabFail(parsed.error, parsed.hint);
  var cfg = __fabNormalizeSearch(parsed);
  if (cfg.error) return __fabFail(cfg.error, cfg.hint);

  var got = await __fabFetchJson(__fabApiPath(cfg));
  if (got.error) return __fabFail(got.error, got.hint);

  var results = (got.data && got.data.results) || [];
  var items = results.map(__fabMapItem);
  var warnings = [];
  if (cfg.includeDownload) {
    warnings = await __fabAttachDownloads(items);
  }

  var cursors = (got.data && got.data.cursors) || {};
  return {
    query: __fabQueryEnvelope(cfg),
    count: cfg.count,
    pageSize: items.length,
    total: got.data && got.data.count != null ? got.data.count : null,
    nextCursor: cursors.next || null,
    previousCursor: cursors.previous || null,
    hasMore: !!cursors.next,
    url: __fabCanonicalUrl(cfg),
    items: items,
    warnings: warnings,
  };
}

async function __fabAssetDownload(args) {
  var parsed = __fabParseConfig(args);
  if (parsed.error) return __fabFail(parsed.error, parsed.hint);
  var uid = __fabExtractUid(__fabPick(Object.assign({}, parsed, args), ["uid", "id", "listing", "url", "pageUrl"]));
  if (!uid) uid = __fabExtractUid(parsed.query);
  if (!uid) {
    return __fabFail("Missing listing uid", "Pass uid or a fab.com/listings/<uuid> URL");
  }

  var formatRaw = __fabNormKey(__fabPick(Object.assign({}, parsed, args), ["format", "assetFormat"]));
  var forcedFormat = "";
  if (formatRaw) {
    var mapped = __fabMapFormat(formatRaw);
    if (!mapped) {
      return __fabFail("Invalid format: " + formatRaw, "Use gltf | glb | fbx or another listing format code");
    }
    forcedFormat = mapped;
  }

  var listing = await __fabFetchJson("/i/listings/" + uid);
  if (listing.error) return __fabFail(listing.error, listing.hint);
  var data = listing.data || {};
  var formatsResp = await __fabFetchJson("/i/listings/" + uid + "/asset-formats");
  var formatList = [];
  if (!formatsResp.error && Array.isArray(formatsResp.data)) {
    formatList = formatsResp.data.map(function (f) {
      var t = f.assetFormatType || {};
      return t.code || "";
    }).filter(Boolean);
  } else {
    formatList = Array.isArray(data.assetFormats)
      ? data.assetFormats.map(function (f) {
          return (f.assetFormatType && f.assetFormatType.code) || f.code || "";
        }).filter(Boolean)
      : [];
  }

  var preferred = __fabPickPreferred(formatList);
  var chosen = forcedFormat || preferred;
  if (!chosen) {
    return __fabFail(
      "No gltf/glb/fbx format on this listing",
      "Available formats: " + (formatList.join(", ") || "(none)") + ". Pass config.format to pick one.",
    );
  }
  if (formatList.indexOf(chosen) < 0) {
    return __fabFail(
      "Format " + chosen + " is not on this listing",
      "Available formats: " + formatList.join(", "),
    );
  }

  var got = await __fabDownloadForFormat(uid, chosen);
  if (got.error && (got.status === 401 || got.status === 403)) {
    var offerId = (data.startingPrice && data.startingPrice.offerId) || "";
    var claimed = await __fabClaimFree(uid, offerId);
    if (claimed.error) return __fabFail(got.error, claimed.hint || got.hint);
    got = await __fabDownloadForFormat(uid, chosen);
  }
  if (got.error) return __fabFail(got.error, got.hint);

  return {
    uid: uid,
    title: data.title || "",
    description: __fabStripHtml(data.description || ""),
    pageUrl: __FAB_ORIGIN + "/listings/" + uid,
    listingType: data.listingType || "",
    preferredFormat: preferred,
    format: chosen,
    availableFormats: formatList,
    isAiGenerated: !!data.isAiGenerated,
    isAiForbidden: !!data.isAiForbidden,
    publishedAt: data.publishedAt || data.firstPublishedAt || "",
    seller: (data.user && data.user.sellerName) || "",
    download: got.data,
  };
}

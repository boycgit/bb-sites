/**
 * Shared Pixabay audio search (music + sound-effects).
 * Prepended by daemon before pixabay/*.js adapters.
 */

var __PB_ORIGIN = "https://pixabay.com";
var __PB_LICENSE_URL = __PB_ORIGIN + "/zh/service/license-summary/";
var __PB_ORDERS = ["most-relevant", "latest", "ec", "trending"];
var __PB_DURATIONS = ["0-30", "30-120", "120-240", "240-480", "480-"];
var __PB_CONTENT_TYPES = ["authentic", "ai"];

var __PB_ORDER_ALIASES = {
  "most-relevant": "most-relevant",
  relevant: "most-relevant",
  popular: "most-relevant",
  最相关: "most-relevant",
  latest: "latest",
  new: "latest",
  最新: "latest",
  最新的: "latest",
  ec: "ec",
  editors: "ec",
  "editors-choice": "ec",
  "editor's choice": "ec",
  editorschoice: "ec",
  编辑精选: "ec",
  trending: "trending",
  hot: "trending",
  upcoming: "trending",
  热门: "trending",
};

var __PB_DURATION_ALIASES = {
  "0-30": "0-30",
  "0-30秒": "0-30",
  "0–30秒": "0-30",
  "30秒": "0-30",
  "30-120": "30-120",
  "30秒-2分钟": "30-120",
  "30秒 - 2分钟": "30-120",
  "30秒–2分钟": "30-120",
  "120-240": "120-240",
  "2-4分钟": "120-240",
  "2分钟-4分钟": "120-240",
  "2分钟 - 4分钟": "120-240",
  "240-480": "240-480",
  "4-8分钟": "240-480",
  "4分钟-8分钟": "240-480",
  "4分钟 - 8分钟": "240-480",
  "480-": "480-",
  "8分钟以上": "480-",
  "8+": "480-",
  "8min+": "480-",
};

var __PB_CONTENT_ALIASES = {
  all: "",
  所有: "",
  所有内容: "",
  authentic: "authentic",
  human: "authentic",
  真实: "authentic",
  仅真实: "authentic",
  仅真实内容: "authentic",
  ai: "ai",
  AI: "ai",
  仅ai: "ai",
  仅AI: "ai",
  仅AI生成的内容: "ai",
};

function __pbFail(kind, error, hint) {
  var path = kind === "sound-effects" ? "/zh/sound-effects/search/" : "/zh/music/search/";
  return {
    error: error,
    hint: hint,
    action: 'bb-browser open "' + __PB_ORIGIN + path + '"',
  };
}

function __pbLooksLikePath(s) {
  return /[\\/]|\.json$/i.test(s) && s.charAt(0) !== "{";
}

function __pbParseConfig(rawArgs) {
  var a = rawArgs || {};
  if (a.config && a.configFile) {
    return { error: "Pass only one of --config or --configFile" };
  }
  var raw = String(a.config || a.configFile || "").trim();
  if (!raw) return {};
  if (__pbLooksLikePath(raw)) {
    return {
      error: "configFile was not expanded to JSON",
      hint: "Use --config '{\"query\":\"rain\"}' or --configFile ./file.json (CLI inlines .json)",
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

function __pbAsList(value) {
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

function __pbPick(obj, keys) {
  for (var i = 0; i < keys.length; i++) {
    if (obj[keys[i]] != null && obj[keys[i]] !== "") return obj[keys[i]];
  }
  return undefined;
}

function __pbNormKey(s) {
  return String(s || "").trim();
}

function __pbHasDisallowed(cfg, allow) {
  if (!allow.genre && __pbPick(cfg, ["genre", "type", "genres"]) != null) {
    return "genre/type is not a sound-effects filter. Use pixabay/music-search, or drop genre.";
  }
  if (!allow.mood && __pbPick(cfg, ["mood", "moods"]) != null) {
    return "mood is not a sound-effects filter. Use pixabay/music-search, or drop mood.";
  }
  if (!allow.movement && __pbPick(cfg, ["movement", "movements"]) != null) {
    return "movement is not a sound-effects filter. Use pixabay/music-search, or drop movement.";
  }
  return "";
}

function __pbNormalize(cfg, allow) {
  var blocked = __pbHasDisallowed(cfg, allow);
  if (blocked) return { error: blocked };

  var query = String(__pbPick(cfg, ["query", "q", "keyword"]) || "").trim();

  var orderRaw = __pbNormKey(__pbPick(cfg, ["order", "sort"]));
  var order = "most-relevant";
  if (orderRaw) {
    var orderMapped = __PB_ORDER_ALIASES[orderRaw] || __PB_ORDER_ALIASES[orderRaw.toLowerCase()];
    if (!orderMapped || __PB_ORDERS.indexOf(orderMapped) < 0) {
      return {
        error: "Invalid order: " + orderRaw,
        hint: "Use most-relevant | latest | ec | trending（最相关 / 最新的 / 编辑精选 / 热门）",
      };
    }
    order = orderMapped;
  }

  var durationRaw = __pbNormKey(__pbPick(cfg, ["duration"]));
  var duration = "";
  if (durationRaw) {
    var durationMapped = __PB_DURATION_ALIASES[durationRaw] || __PB_DURATION_ALIASES[durationRaw.replace(/\s+/g, "")];
    if (!durationMapped || __PB_DURATIONS.indexOf(durationMapped) < 0) {
      return {
        error: "Invalid duration: " + durationRaw,
        hint: "Use 0-30 | 30-120 | 120-240 | 240-480 | 480-（对应 0-30秒 / 30秒-2分钟 / 2-4分钟 / 4-8分钟 / 8分钟以上）",
      };
    }
    duration = durationMapped;
  }

  var contentRaw = __pbNormKey(__pbPick(cfg, ["contentType", "content_type"]));
  var contentType = "";
  if (contentRaw) {
    var contentMapped = __PB_CONTENT_ALIASES[contentRaw];
    var contentLower = contentMapped !== undefined ? contentMapped : __PB_CONTENT_ALIASES[contentRaw.toLowerCase()];
    if (contentLower === undefined || (contentLower && __PB_CONTENT_TYPES.indexOf(contentLower) < 0)) {
      return {
        error: "Invalid contentType: " + contentRaw,
        hint: "Use all | authentic | ai（所有内容 / 仅真实内容 / 仅AI生成的内容）",
      };
    }
    contentType = contentLower || "";
  }

  var pageRaw = __pbPick(cfg, ["page"]);
  var page = 1;
  if (pageRaw != null && pageRaw !== "") {
    page = typeof pageRaw === "number" ? pageRaw : parseInt(String(pageRaw).trim(), 10);
    if (!Number.isInteger(page) || page < 1) {
      return { error: "Invalid page: " + pageRaw, hint: "page 从 1 开始" };
    }
  }

  return {
    query: query,
    genres: allow.genre ? __pbAsList(__pbPick(cfg, ["genre", "type", "genres"])) : [],
    moods: allow.mood ? __pbAsList(__pbPick(cfg, ["mood", "moods"])) : [],
    movements: allow.movement ? __pbAsList(__pbPick(cfg, ["movement", "movements"])) : [],
    themes: allow.theme ? __pbAsList(__pbPick(cfg, ["theme", "themes"])) : [],
    duration: duration,
    contentType: contentType,
    order: order,
    page: page,
  };
}

function __pbBuildSearchPath(kind, cfg, allow) {
  var base = kind === "sound-effects" ? "/zh/sound-effects/search/" : "/zh/music/search/";
  var genres = cfg.genres.slice();
  var movements = cfg.movements.slice();
  var moods = cfg.moods.slice();
  var themes = cfg.themes.slice();
  var path = base;
  if (cfg.query) {
    path = base + encodeURIComponent(cfg.query) + "/";
  } else if (allow.genre && genres.length) {
    path = base + "genre/" + encodeURIComponent(genres.shift()) + "/";
  } else if (allow.movement && movements.length) {
    path = base + "movement/" + encodeURIComponent(movements.shift()) + "/";
  } else if (allow.mood && moods.length) {
    path = base + "mood/" + encodeURIComponent(moods.shift()) + "/";
  } else if (allow.theme && themes.length) {
    path = base + "theme/" + encodeURIComponent(themes.shift()) + "/";
  }

  var qs = new URLSearchParams();
  if (allow.genre) genres.forEach(function (g) { qs.append("genre", g); });
  if (allow.movement) movements.forEach(function (g) { qs.append("movement", g); });
  if (allow.mood) moods.forEach(function (g) { qs.append("mood", g); });
  if (allow.theme) themes.forEach(function (g) { qs.append("theme", g); });
  if (cfg.duration) qs.set("duration", cfg.duration);
  if (cfg.contentType) qs.set("content_type", cfg.contentType);
  if (cfg.order && cfg.order !== "most-relevant") qs.set("order", cfg.order);
  if (cfg.page > 1) qs.set("pagi", String(cfg.page));
  var q = qs.toString();
  return path + (q ? "?" + q : "");
}

function __pbAbs(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return __PB_ORIGIN + (path.charAt(0) === "/" ? path : "/" + path);
}

function __pbToDownloadCdn(src, filename) {
  if (!src) return "";
  var url = src.replace("://cdn.pixabay.com/audio/", "://cdn.pixabay.com/download/audio/");
  if (filename) {
    url += (url.indexOf("?") >= 0 ? "&" : "?") + "filename=" + encodeURIComponent(filename);
  }
  return url;
}

function __pbPad2(n) {
  return n < 10 ? "0" + n : String(n);
}

function __pbFormatDuration(sec) {
  var s = Math.max(0, Math.floor(Number(sec) || 0));
  return Math.floor(s / 60) + ":" + __pbPad2(s % 60);
}

function __pbTagPair(item) {
  if (!item) return null;
  if (Array.isArray(item)) {
    var label = String(item[0] || "").trim();
    if (!label) return null;
    return { label: label, url: __pbAbs(item[1] || "") };
  }
  if (typeof item === "object") {
    var objLabel = String(item.label || item.name || "").trim();
    if (!objLabel) return null;
    return { label: objLabel, url: __pbAbs(item.url || item.href || "") };
  }
  var s = String(item).trim();
  return s ? { label: s, url: "" } : null;
}

function __pbMapItem(row) {
  var sources = row.sources || {};
  var filename = sources.filename || "";
  var previewUrl = sources.src || "";
  var user = row.user || {};
  var first = String(user.firstName || "").trim();
  var last = String(user.lastName || "").trim();
  var displayName = [first, last].filter(Boolean).join(" ");
  var tags = Array.isArray(row.tagList) ? row.tagList.map(__pbTagPair).filter(Boolean) : [];
  return {
    id: row.id,
    name: row.name || "",
    description: row.description || row.alt || "",
    duration: Number(row.duration) || 0,
    durationText: __pbFormatDuration(row.duration),
    pageUrl: __pbAbs(row.href || ""),
    previewUrl: previewUrl,
    downloadUrl: __pbToDownloadCdn(previewUrl, filename),
    officialDownloadUrl: __pbAbs(sources.downloadUrl || ""),
    filename: filename,
    thumbnailUrl: sources.thumbnailUrl || "",
    waveformUrl: __pbAbs(sources.waveformUrl || ""),
    uploadDate: row.uploadDate || "",
    likeCount: Number(row.likeCount) || 0,
    playCount: Number(row.viewCount) || 0,
    downloadCount: Number(row.downloadCount) || 0,
    commentCount: Number(row.commentCount) || 0,
    isAiGenerated: !!row.isAiGenerated,
    hasYoutubeContentId: !!row.hasYoutubeContentId,
    isEditorsChoice: !!row.isEditorsChoice,
    mediaType: row.mediaType || "audio",
    mediaSubType: row.mediaSubType,
    primaryTag: __pbTagPair(row.primaryTag),
    tags: tags,
    user: {
      id: user.id,
      username: user.username || "",
      name: displayName || user.username || "",
      profileUrl: __pbAbs(user.profileUrl || ""),
      followerCount: Number(user.followerCount) || 0,
    },
    license: "Pixabay Content License",
    licenseUrl: __PB_LICENSE_URL,
  };
}

function __pbFilterEnvelope(page, allow) {
  var filters = {};
  if (allow.genre) filters.genre = Array.isArray(page.genres) ? page.genres : [];
  if (allow.mood) filters.mood = Array.isArray(page.moods) ? page.moods : [];
  if (allow.movement) filters.movement = Array.isArray(page.movements) ? page.movements : [];
  if (allow.theme) filters.theme = Array.isArray(page.themes) ? page.themes : [];
  filters.duration = page.duration || null;
  filters.contentType = page.contentType || null;
  return filters;
}

async function __pbAudioSearch(args, opts) {
  var kind = (opts && opts.kind) || "music";
  var allow = (opts && opts.allow) || { genre: true, mood: true, movement: true, theme: true };
  var label = kind === "sound-effects" ? "音效" : "音乐";

  var parsed = __pbParseConfig(args);
  if (parsed.error) return __pbFail(kind, parsed.error, parsed.hint);

  var cfg = __pbNormalize(parsed, allow);
  if (cfg.error) return __pbFail(kind, cfg.error, cfg.hint);

  var rel = __pbBuildSearchPath(kind, cfg, allow);
  var resp;
  try {
    resp = await fetch(rel, {
      credentials: "include",
      headers: {
        Accept: "application/json",
        "x-fetch-bootstrap": "1",
        "x-bootstrap-cache-miss": "1",
      },
    });
  } catch (e) {
    return __pbFail(
      kind,
      "Fetch failed",
      (e instanceof Error ? e.message : String(e)) + ". Open pixabay.com first.",
    );
  }

  var contentType = (resp.headers.get("content-type") || "").toLowerCase();
  var text = await resp.text();
  var looksJson = contentType.indexOf("json") >= 0 || /^\s*[{[]/.test(text);
  var looksChallenge = /cf-challenge|just a moment|recaptcha\/api\.js/i.test(text);
  if (!resp.ok || !looksJson || looksChallenge) {
    return __pbFail(
      kind,
      resp.ok ? "Unexpected response (not JSON)" : "HTTP " + resp.status,
      "Pixabay 可能在做验证。请先打开" + label + "搜索页后再试。",
    );
  }

  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return __pbFail(kind, "Invalid JSON from Pixabay", e instanceof Error ? e.message : String(e));
  }

  var page = data.page || {};
  var results = Array.isArray(page.results) ? page.results : [];
  var canonical = (data.request && data.request.location && data.request.location.href) || (__PB_ORIGIN + rel);

  return {
    page: Number(page.page) || cfg.page,
    pageSize: Number(page.perPage) || results.length || 20,
    total: Number(page.total) || 0,
    pages: Number(page.pages) || 0,
    url: canonical,
    query: page.query || cfg.query || "",
    order: page.order || cfg.order,
    filters: __pbFilterEnvelope(page, allow),
    items: results.map(__pbMapItem),
  };
}

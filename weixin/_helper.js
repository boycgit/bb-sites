/**
 * Weixin MP helpers — session, image upload, draft create.
 * Requires browser login at mp.weixin.qq.com.
 */
var __WEIXIN_FORM_ORDER = ["token","lang","f","ajax","fingerprint","random","AppMsgId","count","data_seq","operate_from","isnew","articlenum","pre_timesend_set","is_finder_video0","finder_draft_id0","applyori0","ad_video_transition0","can_reward0","pay_gifts_count0","reward_reply_id0","related_video0","is_video_recommend0","title0","is_user_title0","author0","writerid0","fileid0","digest0","auto_gen_digest0","content0","sourceurl0","last_choose_cover_from0","need_open_comment0","only_fans_can_comment0","only_fans_days_can_comment0","reply_flag0","not_pay_can_comment0","auto_elect_comment0","auto_elect_reply0","option_version0","open_fansmsg0","cdn_url0","cdn_235_1_url0","cdn_16_9_url0","cdn_3_4_url0","cdn_1_1_url0","cdn_finder_url0","cdn_video_url0","cdn_url_back0","crop_list0","app_cover_auto0","music_id0","video_id0","voteid0","voteismlt0","supervoteid0","super_vote_id0","vid_type0","show_cover_pic0","copyright_type0","is_cartoon_copyright0","copyright_img_list0","platform0","allow_fast_reprint0","allow_reprint0","allow_reprint_modify0","original_article_type0","ori_white_list0","video_ori_status0","hit_nickname0","free_content0","fee0","ad_id0","guide_words0","is_share_copyright0","share_copyright_url0","source_article_type0","reprint_recommend_title0","reprint_recommend_content0","share_page_type0","share_imageinfo0","share_video_id0","dot0","share_voice_id0","share_finder_audio_username0","share_finder_audio_exportid0","mmlistenitem_json_buf0","insert_ad_mode0","categories_list0","compose_info0","is_pay_subscribe0","pay_fee0","pay_preview_percent0","pay_desc0","pay_album_info0","appmsg_album_info0","can_insert_ad0","open_keyword_ad0","open_comment_ad0","audio_info0","danmu_pub_type0","mp_video_info0","is_set_sync_to_finder0","sync_to_finder_cover0","sync_to_finder_cover_source0","import_to_finder0","import_from_finder_export_id0","style_type0","sticker_info0","new_pic_process0","disable_recommend0","claim_source_type0","is_user_no_claim_source0","msg_index_id0","convert_to_image_share_page0","convert_from_image_share_page0","incontent_ad_count0","multi_picture_cover0","title_gen_type0","location_page_show0","req","remind_flag","is_auto_type_setting","save_type","isneedsave"];
var __WEIXIN_FORM_DEFAULTS = {"lang":"zh_CN","f":"json","ajax":"1","count":"1","operate_from":"Chrome","isnew":"0","articlenum":"1","pre_timesend_set":"0","is_finder_video0":"0","finder_draft_id0":"0","applyori0":"0","ad_video_transition0":"","can_reward0":"0","pay_gifts_count0":"0","reward_reply_id0":"","related_video0":"","is_video_recommend0":"0","is_user_title0":"","writerid0":"0","fileid0":"","auto_gen_digest0":"1","sourceurl0":"","last_choose_cover_from0":"0","need_open_comment0":"0","only_fans_can_comment0":"0","only_fans_days_can_comment0":"0","reply_flag0":"3","not_pay_can_comment0":"0","auto_elect_comment0":"1","auto_elect_reply0":"1","option_version0":"5","open_fansmsg0":"0","cdn_16_9_url0":"","cdn_3_4_url0":"","cdn_finder_url0":"","cdn_video_url0":"","app_cover_auto0":"0","music_id0":"","video_id0":"","voteid0":"","voteismlt0":"","supervoteid0":"","super_vote_id0":"","vid_type0":"","show_cover_pic0":"0","copyright_type0":"0","is_cartoon_copyright0":"0","platform0":"","allow_fast_reprint0":"1","allow_reprint0":"0","allow_reprint_modify0":"0","original_article_type0":"","ori_white_list0":"{\"white_list\":[]}","video_ori_status0":"","hit_nickname0":"","free_content0":"","fee0":"0","ad_id0":"","guide_words0":"","is_share_copyright0":"0","share_copyright_url0":"","source_article_type0":"","reprint_recommend_title0":"","reprint_recommend_content0":"","share_page_type0":"0","share_video_id0":"","dot0":"{}","share_voice_id0":"","share_finder_audio_username0":"","share_finder_audio_exportid0":"","mmlistenitem_json_buf0":"","insert_ad_mode0":"","categories_list0":"[]","is_pay_subscribe0":"0","pay_fee0":"","pay_preview_percent0":"","pay_desc0":"","pay_album_info0":"","appmsg_album_info0":"{\"appmsg_album_infos\":[]}","can_insert_ad0":"1","open_keyword_ad0":"0","open_comment_ad0":"1","audio_info0":"{\"audio_infos\":[]}","danmu_pub_type0":"0","mp_video_info0":"{\"list\":[]}","is_set_sync_to_finder0":"0","sync_to_finder_cover0":"","sync_to_finder_cover_source0":"","import_to_finder0":"0","import_from_finder_export_id0":"","style_type0":"3","sticker_info0":"{\"is_stickers\":0,\"common_stickers_num\":0,\"union_stickers_num\":0,\"sticker_id_list\":[],\"has_invalid_sticker\":0}","new_pic_process0":"0","disable_recommend0":"0","claim_source_type0":"","is_user_no_claim_source0":"0","convert_to_image_share_page0":"","convert_from_image_share_page0":"","incontent_ad_count0":"0","multi_picture_cover0":"0","title_gen_type0":"0","location_page_show0":"0","req":"{\"idx_infos\":[{\"save_old\":0,\"cps_info\":{\"cps_import\":0},\"red_packet_cover_list\":{\"list\":[]},\"podcast_task_info\":null,\"claim_source\":{},\"line_info\":{\"scene\":2},\"window_product\":{},\"link_info\":{},\"appmsg_link\":{},\"weapp_link\":{},\"yqj_info\":{},\"ai_pic_info\":{\"cover_source\":0,\"ai_pic_id\":[],\"cover_pic_id\":\"\"},\"single_video_snap_card\":{},\"product_activity\":{},\"footer_gift_activity\":{},\"footer_common_shops\":[],\"footer_product_card\":{},\"location\":{}}],\"appmsg_id\":0,\"is_use_flag\":0,\"template_version\":\"40287078\"}","remind_flag":"","is_auto_type_setting":"3","save_type":"0","isneedsave":"0"};

function __wxRandFp() {
  var a = new Uint8Array(16);
  if (crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (var i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

function __wxGetSession() {
  var data = (window.wx && window.wx.commonData && window.wx.commonData.data) || {};
  var token = data.t || ((location.href.match(/[?&]token=(\d+)/) || [])[1]);
  return {
    token: token,
    ticket: data.ticket || "",
    userName: data.user_name || data.uin || "",
    nick: data.nick_name || data.real_nick_name || ""
  };
}

async function __wxEnsureSession() {
  var s = __wxGetSession();
  if (s.token && window.wx && window.wx.commonData) return s;

  // Wait for wx.commonData on current page (do NOT navigate — kills CDP evaluate)
  if (/mp\.weixin\.qq\.com/.test(location.host)) {
    for (var i = 0; i < 20; i++) {
      await new Promise(function (r) { setTimeout(r, 250); });
      s = __wxGetSession();
      if (s.token && window.wx && window.wx.commonData) return s;
      if (s.token) return s; // token from URL is enough for many APIs
    }
  }

  s = __wxGetSession();
  if (!s.token) {
    return {
      error: "Not logged in",
      hint: "Please log in to https://mp.weixin.qq.com in the bb-browser Chrome, then retry. Avoid navigating during site run."
    };
  }
  return s;
}

function __wxEncodeBody(map, order) {
  return order.map(function (k) {
    var v = map[k];
    if (v == null) v = "";
    return encodeURIComponent(k) + "=" + encodeURIComponent(String(v)).replace(/%20/g, "+");
  }).join("&");
}

async function __wxUploadImage(session, blob, filename) {
  if (!session.ticket || !session.userName) {
    return {
      error: "Missing ticket/user for upload",
      hint: "Open https://mp.weixin.qq.com home once so session data loads."
    };
  }
  var fd = new FormData();
  fd.append("id", "WU_FILE_0");
  fd.append("name", filename || "image.png");
  fd.append("type", blob.type || "image/png");
  fd.append("lastModifiedDate", new Date().toString());
  fd.append("size", String(blob.size));
  fd.append("file", blob, filename || "image.png");
  var url = "https://mp.weixin.qq.com/cgi-bin/filetransfer?action=upload_material&f=json&scene=8&writetype=doublewrite&groupid=1"
    + "&ticket_id=" + encodeURIComponent(session.userName)
    + "&ticket=" + encodeURIComponent(session.ticket)
    + "&svr_time=" + Math.floor(Date.now() / 1000)
    + "&token=" + encodeURIComponent(session.token);
  var resp = await fetch(url, { method: "POST", credentials: "include", body: fd });
  var text = await resp.text();
  var data;
  try { data = JSON.parse(text); } catch (e) {
    return { error: "Upload parse error", hint: text.slice(0, 200) };
  }
  if (!data || !data.base_resp || data.base_resp.ret !== 0) {
    return {
      error: "Upload failed: " + ((data && data.base_resp && data.base_resp.err_msg) || text.slice(0, 120)),
      hint: "Check login state and image format"
    };
  }
  return {
    mediaId: String(data.content || ""),
    cdnUrl: String(data.cdn_url || "").replace(/\\\//g, "/")
  };
}

async function __wxUploadBase64(session, base64, mime, name) {
  mime = mime || "image/png";
  var pure = String(base64 || "").replace(/^data:[^;]+;base64,/, "");
  var bin = atob(pure);
  var arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  var blob = new Blob([arr], { type: mime });
  var ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  return __wxUploadImage(session, blob, name || ("img." + ext));
}

async function __wxUploadRemote(session, imageUrl) {
  if (/mmbiz\.qpic\.cn|qlogo\.cn|mmbiz\.qlogo\.cn/.test(imageUrl)) {
    return { mediaId: "", cdnUrl: imageUrl };
  }
  try {
    var resp = await fetch(imageUrl, { credentials: "omit", mode: "cors" });
    if (!resp.ok) return { error: "HTTP " + resp.status + " fetching image", hint: imageUrl };
    var blob = await resp.blob();
    var name = (imageUrl.split("?")[0].split("/").pop() || "remote.png").slice(0, 80);
    return __wxUploadImage(session, blob, name);
  } catch (e) {
    return { error: "Failed to fetch remote image (CORS?)", hint: imageUrl };
  }
}

function __wxMdToHtml(md) {
  if (!md) return "";
  var text = String(md).replace(/\r\n/g, "\n");
  var codes = [];
  text = text.replace(/```[\w]*\n([\s\S]*?)```/g, function (_, code) {
    codes.push(code);
    return "@@CODE" + (codes.length - 1) + "@@";
  });
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;display:block;margin:0.8em auto;"/>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#576b95;text-decoration:none;">$1</a>');
    s = s.replace(/`([^\`]+)`/g, '<code style="background:#f6f8fa;padding:2px 4px;border-radius:3px;font-size:0.9em;">$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    return s;
  }
  var lines = text.split("\n");
  var html = [];
  var inUl = false, inOl = false;
  function closeLists() {
    if (inUl) { html.push("</ul>"); inUl = false; }
    if (inOl) { html.push("</ol>"); inOl = false; }
  }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    var m;
    if ((m = line.match(/^###\s+(.+)/))) {
      closeLists();
      html.push('<h3 style="margin:1.2em 0 0.6em;font-size:18px;font-weight:bold;color:#333;">' + inline(m[1]) + "</h3>");
      continue;
    }
    if ((m = line.match(/^##\s+(.+)/))) {
      closeLists();
      html.push('<h2 style="margin:1.4em 0 0.7em;font-size:20px;font-weight:bold;color:#333;">' + inline(m[1]) + "</h2>");
      continue;
    }
    if ((m = line.match(/^#\s+(.+)/))) {
      closeLists();
      html.push('<h1 style="margin:1.5em 0 0.8em;font-size:22px;font-weight:bold;color:#333;">' + inline(m[1]) + "</h1>");
      continue;
    }
    if ((m = line.match(/^>\s?(.*)/))) {
      closeLists();
      html.push('<blockquote style="margin:1em 0;padding:0.6em 1em;border-left:4px solid #07c160;color:#666;background:#f7f7f7;">' + inline(m[1]) + "</blockquote>");
      continue;
    }
    if ((m = line.match(/^[-*]\s+(.+)/))) {
      if (!inUl) { closeLists(); html.push('<ul style="margin:0.8em 0;padding-left:1.4em;">'); inUl = true; }
      html.push('<li style="margin:0.3em 0;">' + inline(m[1]) + "</li>");
      continue;
    }
    if ((m = line.match(/^\d+\.\s+(.+)/))) {
      if (!inOl) { closeLists(); html.push('<ol style="margin:0.8em 0;padding-left:1.4em;">'); inOl = true; }
      html.push('<li style="margin:0.3em 0;">' + inline(m[1]) + "</li>");
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeLists();
      html.push('<hr style="border:none;border-top:1px solid #e5e5e5;margin:1.5em 0;"/>');
      continue;
    }
    if (!line.trim()) { closeLists(); continue; }
    closeLists();
    if (/^@@CODE\d+@@$/.test(line.trim())) {
      var idx = parseInt(line.replace(/\D/g, ""), 10);
      html.push('<pre style="margin:1em 0;padding:12px;background:#f6f8fa;border-radius:6px;overflow:auto;font-size:13px;line-height:1.5;"><code>' + esc(codes[idx] || "") + "</code></pre>");
      continue;
    }
    html.push('<p style="margin:1em 0;line-height:1.75;font-size:16px;color:#333;">' + inline(line) + "</p>");
  }
  closeLists();
  return '<section style="margin:0;padding:0 10px;font-family:Optima,\'Microsoft YaHei\',PingFangSC-regular,serif;font-size:16px;color:#333;line-height:1.75;word-break:break-word;">'
    + html.join("")
    + "</section>";
}

async function __wxCreateDraft(session, opts) {
  var map = {};
  for (var k in __WEIXIN_FORM_DEFAULTS) {
    if (Object.prototype.hasOwnProperty.call(__WEIXIN_FORM_DEFAULTS, k)) {
      map[k] = __WEIXIN_FORM_DEFAULTS[k];
    }
  }
  __WEIXIN_FORM_ORDER.forEach(function (key) {
    if (map[key] === undefined) map[key] = "";
  });
  map.token = session.token;
  map.lang = "zh_CN";
  map.f = "json";
  map.ajax = "1";
  map.fingerprint = __wxRandFp();
  map.random = String(Math.random());
  map.AppMsgId = "";
  map.data_seq = "0";
  map.msg_index_id0 = "";
  map.title0 = opts.title || "";
  map.author0 = opts.author || session.nick || "";
  map.digest0 = opts.digest || "";
  map.content0 = opts.contentHtml || "";
  map.auto_gen_digest0 = opts.digest ? "0" : "1";
  map.cdn_url0 = opts.coverUrl || "";
  map.cdn_235_1_url0 = opts.coverUrl || "";
  map.cdn_1_1_url0 = opts.coverUrl11 || opts.coverUrl || "";
  map.cdn_url_back0 = "";
  map.crop_list0 = "";
  map.share_imageinfo0 = JSON.stringify({ list: [] });
  map.copyright_img_list0 = "";
  map.compose_info0 = JSON.stringify({ list: [] });
  map.copyright_type0 = "0";
  map.need_open_comment0 = "0";
  map.only_fans_can_comment0 = "0";
  try {
    var reqObj = JSON.parse(map.req || "{}");
    reqObj.appmsg_id = 0;
    map.req = JSON.stringify(reqObj);
  } catch (e) { /* ignore */ }

  var body = __wxEncodeBody(map, __WEIXIN_FORM_ORDER);
  var url = "https://mp.weixin.qq.com/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=77&token="
    + encodeURIComponent(session.token) + "&lang=zh_CN";
  var resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: body
  });
  var text = await resp.text();
  var data;
  try { data = JSON.parse(text); } catch (e) {
    return { error: "Create parse error", hint: text.slice(0, 200) };
  }
  var ret = data.base_resp ? data.base_resp.ret : data.ret;
  if (String(ret) !== "0") {
    return {
      error: (data.base_resp && data.base_resp.err_msg) || ("ret " + ret),
      hint: "Ensure mp.weixin.qq.com is logged in. raw=" + text.slice(0, 160)
    };
  }
  var appmsgid = data.appMsgId || data.appmsgid;
  return {
    appmsgid: appmsgid,
    data_seq: data.data_seq,
    draftUrl: "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid="
      + appmsgid + "&token=" + session.token + "&lang=zh_CN"
  };
}

/* ── type=15 视频素材（videomsg_edit / list_video）── */

var __WX_VIDEO_EDIT_URL =
  "https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/videomsg_edit&action=video_edit&type=15&isNew=1&lang=zh_CN";
var __WX_VIDEO_LIST_PATH =
  "/cgi-bin/appmsg?begin=0&count=10&action=list_video&type=15&lang=zh_CN&f=json";

function __wxSleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function __wxFindVueRoot(el, depth) {
  depth = depth || 0;
  if (!el || depth > 10) return null;
  if (el.__vue__) return el.__vue__;
  var kids = el.children || [];
  for (var i = 0; i < kids.length; i++) {
    var v = __wxFindVueRoot(kids[i], depth + 1);
    if (v) return v;
  }
  return null;
}

/** Walk Vue tree for mp-video-edit-form (has form.applyori + cookPostData). */
function __wxFindVideoEditForm() {
  var root = __wxFindVueRoot(document.querySelector("#app") || document.body);
  if (!root) return null;
  var found = null;
  function walk(vm, depth) {
    if (!vm || depth > 14 || found) return;
    if (
      vm.form &&
      typeof vm.form === "object" &&
      Object.prototype.hasOwnProperty.call(vm.form, "applyori") &&
      typeof vm.cookPostData === "function"
    ) {
      found = vm;
      return;
    }
    var kids = vm.$children || [];
    for (var i = 0; i < kids.length; i++) walk(kids[i], depth + 1);
  }
  walk(root, 0);
  return found;
}

/**
 * Must already be on videomsg_edit — do NOT location.href navigate here
 * (full navigation aborts the CDP evaluate / adapter script).
 */
async function __wxEnsureVideoEditPage(session) {
  var href = location.href || "";
  var onEdit =
    /mp\.weixin\.qq\.com/i.test(location.host) &&
    (/videomsg_edit|action=video_edit/i.test(href) ||
      (/type=15/i.test(href) && /video/i.test(href)));
  if (!onEdit) {
    return {
      error: "Not on video edit page",
      hint:
        'Open: bb-browser open "' +
        __WX_VIDEO_EDIT_URL +
        (session && session.token ? "&token=" + session.token : "") +
        '" then retry. Daemon should navigate here before mount.',
      href: href,
    };
  }
  // dismiss common intro dialogs
  try {
    var btns = document.querySelectorAll("button, a, .weui-desktop-btn");
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].innerText || "").trim();
      if (t === "知道了" || t === "我知道了") {
        btns[i].click();
        await __wxSleep(300);
      }
    }
  } catch (e) { /* ignore */ }
  return { ok: true };
}

/**
 * If daemon mounted file via setFileInputFiles, upload should already be running.
 * If only Blob was injected, create File and assign to input to start FtnUploader.
 */
async function __wxEnsureVideoFileMounted(args) {
  // CDP setFileInputFiles may finish upload before adapter runs; input.files often empty after.
  var vm0 = __wxFindVideoEditForm();
  if (vm0 && vm0.form) {
    var existingVid = vm0.form.vid;
    if (typeof existingVid === "string" && /^wxv_/.test(existingVid)) {
      return {
        ok: true,
        mode: "already-uploaded",
        vid: existingVid,
        videoStatus: vm0.videoStatus,
      };
    }
    if (vm0.videoStatus === 1 || vm0.videoStatus === 2 || existingVid === "上传中") {
      return {
        ok: true,
        mode: "uploading",
        videoStatus: vm0.videoStatus,
        vid: existingVid,
      };
    }
  }

  var input =
    document.querySelector("input[type=file][name=vid]") ||
    document.querySelector("input.weui-desktop-upload-input[type=file]") ||
    document.querySelector('input[type=file][accept*="video"]');
  if (!input) {
    return { error: "Video file input not found", hint: "Open videomsg_edit type=15 page first" };
  }
  // Already has files from CDP setFileInputFiles?
  if (input.files && input.files.length > 0) {
    return { ok: true, mode: "fileInput", name: input.files[0].name, size: input.files[0].size };
  }

  // Daemon reported fileInput mount but files already consumed — wait for upload signals
  if (args && args.__localVideoMountMode === "fileInput") {
    for (var w = 0; w < 20; w++) {
      await __wxSleep(500);
      var vmW = __wxFindVideoEditForm();
      if (vmW && vmW.form) {
        if (typeof vmW.form.vid === "string" && /^wxv_/.test(vmW.form.vid)) {
          return { ok: true, mode: "fileInput-late", vid: vmW.form.vid, videoStatus: vmW.videoStatus };
        }
        if (vmW.videoStatus === 1 || vmW.videoStatus === 2 || vmW.form.vid === "上传中") {
          return { ok: true, mode: "fileInput-progress", videoStatus: vmW.videoStatus };
        }
      }
      if (input.files && input.files.length > 0) {
        return { ok: true, mode: "fileInput", name: input.files[0].name, size: input.files[0].size };
      }
    }
  }

  // Blob fallback
  var blob = window.__bbLocalVideoBlob;
  if (!blob) {
    if (args && args.__localVideoReady === "1") {
      return {
        error: "Video mount reported ready but upload did not start",
        hint:
          "mountMode=" +
          (args.__localVideoMountMode || "?") +
          " videoStatus=" +
          (vm0 ? vm0.videoStatus : "n/a") +
          " vid=" +
          (vm0 && vm0.form ? String(vm0.form.vid) : "n/a") +
          ". Re-open videomsg_edit isNew=1 and retry.",
      };
    }
    return {
      error: "No video file mounted",
      hint:
        "CLI must pass --video <path>; daemon mounts via setFileInputFiles or injects Blob. " +
        "mountMode=" +
        (args && args.__localVideoMountMode),
    };
  }
  var name = window.__bbLocalVideoBlobName || (args && args.__localVideoName) || "video.mp4";
  var mime = window.__bbLocalVideoBlobMime || (args && args.__localVideoMime) || blob.type || "video/mp4";
  var file;
  try {
    file = new File([blob], name, { type: mime, lastModified: Date.now() });
  } catch (e) {
    file = blob;
    try {
      file.name = name;
    } catch (e2) { /* ignore */ }
  }
  try {
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } catch (e) {
    return { error: "Failed to assign File to input", hint: String(e) };
  }
  return { ok: true, mode: "blob", name: name, size: blob.size };
}

/**
 * Poll Vue form until form.vid is wxv_* or timeout.
 * videoStatus: 0 idle, 1 uploading, 3 success (approx from page JS)
 */
async function __wxWaitVideoUpload(timeoutMs) {
  timeoutMs = timeoutMs || 100000;
  var start = Date.now();
  var last = { videoStatus: null, vid: null };
  while (Date.now() - start < timeoutMs) {
    var vm = __wxFindVideoEditForm();
    if (vm && vm.form) {
      var vid = vm.form.vid;
      last.vid = vid;
      last.videoStatus = vm.videoStatus;
      // videoStatus: 0 idle, 1 uploading, 2 processing?, 3 saved/ok — accept any wxv_*
      if (typeof vid === "string" && /^wxv_/.test(vid)) {
        return { ok: true, vid: vid, videoStatus: vm.videoStatus, elapsedMs: Date.now() - start };
      }
      if (vid === "上传失败" || vid === "上传取消") {
        return {
          error: "Video upload failed: " + vid,
          hint: vm.uploadErrorMsg || "Retry upload on videomsg_edit page",
          videoStatus: vm.videoStatus,
        };
      }
    }
    await __wxSleep(800);
  }
  return {
    error: "Video upload timeout",
    hint:
      "Waited " +
      timeoutMs +
      "ms. last vid=" +
      String(last.vid) +
      " status=" +
      String(last.videoStatus) +
      ". Network may be slow; retry or check FtnUploader.",
    last: last,
  };
}

function __wxCloseOriginDialogIfAny(vm) {
  try {
    if (vm.originDialog && vm.originDialog.isShow) {
      if (typeof vm.onClickOriginDialogOk === "function") vm.onClickOriginDialogOk();
      else vm.originDialog.isShow = false;
    }
    if (typeof vm.hasOriAccepted !== "undefined") vm.hasOriAccepted = true;
  } catch (e) { /* ignore */ }
  // click OK on any visible desktop dialog about 原创
  try {
    var dialogs = document.querySelectorAll(".weui-desktop-dialog");
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      var style = window.getComputedStyle(d);
      if (style.display === "none" || style.visibility === "hidden") continue;
      var text = d.innerText || "";
      if (/原创|声明/.test(text)) {
        var ok = d.querySelector(".weui-desktop-btn_primary");
        if (ok) ok.click();
      }
    }
  } catch (e2) { /* ignore */ }
}

/**
 * Fill form fields: title, digest, tags, applyori=1, agree=1.
 */
async function __wxFillVideoForm(vm, opts) {
  opts = opts || {};
  var title = String(opts.title || "").slice(0, 64);
  var desc = String(opts.desc || "").slice(0, 300);
  var tags = Array.isArray(opts.tags) ? opts.tags.map(String).slice(0, 5) : [];

  vm.form.title = title;
  vm.form.digest = desc;
  vm.form.agree = 1;
  vm.form.applyori = 1;
  if (tags.length) {
    vm.form.tags = tags.slice();
    vm.form.hasAddTag = true;
    try {
      if (vm.videoTagsDialog) {
        // Prefer objects with title if UI expects them
        vm.videoTagsDialog.tags = tags.map(function (t) {
          return typeof t === "string" ? { title: t, id: t } : t;
        });
      }
    } catch (e) { /* ignore */ }
  }

  // Reflect title into visible input
  try {
    var titleInput = document.querySelector('input[name="title"].weui-desktop-form__input');
    if (titleInput) {
      titleInput.value = title;
      titleInput.dispatchEvent(new Event("input", { bubbles: true }));
      titleInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  } catch (e) { /* ignore */ }

  // Check "我已阅读" checkbox if present
  try {
    var boxes = document.querySelectorAll('input.weui-desktop-form__checkbox[type=checkbox]');
    for (var i = 0; i < boxes.length; i++) {
      var lab = boxes[i].closest("label") || boxes[i].parentElement;
      var txt = (lab && lab.innerText) || "";
      if (/我已阅读|上传服务规则|服务规则/.test(txt) && !boxes[i].checked) {
        boxes[i].click();
      }
    }
  } catch (e2) { /* ignore */ }

  // 声明原创 switch/checkbox
  try {
    if (typeof vm.onClickOri === "function" && !vm.form.applyori) {
      vm.onClickOri();
      await __wxSleep(400);
    }
    vm.form.applyori = 1;
    __wxCloseOriginDialogIfAny(vm);
  } catch (e3) { /* ignore */ }

  await __wxSleep(300);
  __wxCloseOriginDialogIfAny(vm);
  return { title: title, desc: desc, tags: tags };
}

/**
 * Save draft via operate_mp_video API only.
 * Do NOT call Vue asyncPostVideo — it navigates to list_video and aborts CDP evaluate.
 */
async function __wxSaveVideoDraft(vm, session, opts) {
  opts = opts || {};
  var title = (opts.title || (vm && vm.form && vm.form.title) || "").toString().trim();
  var vid = (vm && vm.form && vm.form.vid) || opts.vid;
  if (!vid || !/^wxv_/.test(String(vid))) {
    return { error: "Missing vid after upload", hint: "vid=" + String(vid) };
  }

  try {
    if (vm) {
      __wxCloseOriginDialogIfAny(vm);
      vm.form.agree = 1;
      vm.form.applyori = 1;
      vm.form.title = title;
      if (opts.desc) vm.form.digest = opts.desc;
      if (typeof vm.cookPostData === "function") {
        try {
          vm.cookPostData();
        } catch (e) { /* ignore */ }
      }
      if (vm.postData) {
        vm.postData.title = title;
        vm.postData.vid = vid;
        vm.postData.applyori = 1;
        vm.postData.save = 1;
        vm.postData.remind_ori = 1;
        if (opts.desc) {
          vm.postData.digest = opts.desc;
          vm.postData.video_desc = opts.desc;
        }
      }
    }
  } catch (e) { /* ignore fill errors; API body is authoritative */ }

  var api = await __wxPostOperateMpVideo(session, vm, opts);
  if (!api.error) return api;

  // One retry after short wait (cover may still be generating)
  await __wxSleep(2000);
  api = await __wxPostOperateMpVideo(session, vm, opts);
  return api;
}

async function __wxPostOperateMpVideo(session, vm, opts) {
  opts = opts || {};
  var title = (opts.title || (vm && vm.form && vm.form.title) || "").toString().trim();
  var vid = (vm && vm.form && vm.form.vid) || opts.vid;
  var post = (vm && vm.postData) || {};
  var body = {
    type: 15,
    title: title,
    vid: vid,
    applyori: 1,
    save: 1,
    remind_ori: 1,
    video_is_new: 1,
    share_page: 1,
    send_time: 0,
    cardlimit: 1,
    recommend: "",
    can_reward: 0,
    need_open_comment: 0,
    only_fans_can_comment: 0,
    only_fans_days_can_comment: 0,
    reply_flag: 0,
    danmu_pub_type: post.danmu_pub_type != null ? post.danmu_pub_type : 1,
    cover_url: post.cover_url || "",
    cover_url_16_9: post.cover_url_16_9 || "",
    cover_url_1_1: post.cover_url_1_1 || "",
    cover_url_back: post.cover_url_back || "",
    crop_coordinate: post.crop_coordinate || "",
    text_coordinate: post.text_coordinate || "",
    appmsgid: post.appmsgid || "",
    digest: opts.desc || post.digest || "",
    video_desc: opts.desc || post.video_desc || post.digest || "",
  };
  if (opts.tags && opts.tags.length) {
    body.appmsg_album_info0 = JSON.stringify({
      appmsg_album_infos: opts.tags.map(function (t) {
        return { title: t, id: t };
      }),
    });
  }

  // wx ajax usually form-urlencoded; try both form and json-like form
  function encode(obj) {
    return Object.keys(obj)
      .map(function (k) {
        var v = obj[k];
        if (v == null) v = "";
        return encodeURIComponent(k) + "=" + encodeURIComponent(String(v));
      })
      .join("&");
  }

  var url =
    "https://mp.weixin.qq.com/cgi-bin/video?action=operate_mp_video&token=" +
    encodeURIComponent(session.token) +
    "&lang=zh_CN&f=json&ajax=1";
  var resp = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: encode(body),
  });
  var text = await resp.text();
  var data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { error: "operate_mp_video parse error", hint: text.slice(0, 200) };
  }
  var ret = data.base_resp ? data.base_resp.ret : data.ret;
  if (String(ret) !== "0") {
    return {
      error: (data.base_resp && data.base_resp.err_msg) || "ret " + ret,
      hint: text.slice(0, 200),
      raw: data,
    };
  }
  var appmsgid = data.appMsgId || data.appmsgid || data.app_msg_id;
  if (!appmsgid) {
    await __wxSleep(1500);
    var hit = await __wxFindVideoByTitleOrVid(session, title, vid);
    if (hit) appmsgid = hit.appmsgid || hit.app_id;
  }
  return {
    appmsgid: appmsgid,
    vid: vid,
    title: title,
    via: "api",
    data_seq: data.data_seq,
  };
}

async function __wxListVideos(session, begin, count) {
  begin = begin || 0;
  count = count || 10;
  var url =
    "https://mp.weixin.qq.com/cgi-bin/appmsg?action=list_video&begin=" +
    begin +
    "&count=" +
    count +
    "&type=15&token=" +
    encodeURIComponent(session.token) +
    "&lang=zh_CN&f=json&ajax=1";
  var resp = await fetch(url, { credentials: "include" });
  var data = await resp.json();
  if (!data || !data.base_resp || data.base_resp.ret !== 0) {
    return {
      error: "list_video failed",
      hint: JSON.stringify((data && data.base_resp) || data).slice(0, 160),
    };
  }
  var items = (data.app_msg_info && data.app_msg_info.item) || [];
  return { items: items, raw: data };
}

async function __wxFindVideoByTitleOrVid(session, title, vid) {
  var list = await __wxListVideos(session, 0, 10);
  if (list.error) return null;
  var items = list.items || [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var t = it.title || "";
    var content = it.content || "";
    var multi = (it.multi_item && it.multi_item[0]) || {};
    var mvid = multi.content || content;
    if ((title && t === title) || (vid && (mvid === vid || content === vid))) {
      return {
        appmsgid: it.app_id || it.app_msg_id,
        app_id: it.app_id,
        title: t,
        vid: mvid || vid,
        update_time: it.update_time,
      };
    }
  }
  return null;
}


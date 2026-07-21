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

  if (!/mp\.weixin\.qq\.com/.test(location.host) || !s.token) {
    location.href = "https://mp.weixin.qq.com/";
    await new Promise(function (r) { setTimeout(r, 4000); });
  }
  s = __wxGetSession();
  if (!s.token) {
    return {
      error: "Not logged in",
      hint: "Please log in to https://mp.weixin.qq.com in the bb-browser Chrome, then retry."
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

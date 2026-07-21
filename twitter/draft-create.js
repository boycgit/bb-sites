/* @meta
{
  "name": "twitter/draft-create",
  "description": "将 Markdown 浓缩为 X 未发送草稿（标题+摘要+链接），并上传图片/视频",
  "domain": "x.com",
  "args": {
    "markdown": { "required": false, "description": "Markdown 正文或本地路径（CLI 会展开）" },
    "title": { "required": false, "description": "标题；默认取 md 一级标题" },
    "digest": { "required": false, "description": "摘要；默认取 md 首段" },
    "link": { "required": false, "description": "全文链接（强烈建议）" },
    "images": { "required": false, "description": "JSON 本地图 [{id,name,mime,base64}]（CLI 预处理）" },
    "videos": { "required": false, "description": "JSON 视频 [{name,mime,base64}|{url}]" },
    "maxLength": { "required": false, "description": "文案最大长度，默认 280" },
    "prefer": { "required": false, "description": "媒体优先：image（默认）或 video" }
  },
  "capabilities": ["network", "write"],
  "readOnly": false,
  "example": "bb-browser site twitter/draft-create ./draft.md --link https://example.com/post --json"
}
*/
async function (args) {
  if (!twitterGetCt0()) {
    return {
      error: "No ct0 cookie",
      hint: "Please log in to https://x.com in the bb-browser Chrome first, then retry.",
    };
  }

  const built = twitterBuildShortPost({
    markdown: args.markdown,
    title: args.title,
    digest: args.digest,
    link: args.link,
    maxLength: args.maxLength,
  });
  if (built.error) return built;

  let images = [];
  let videos = [];
  try {
    images = args.images ? JSON.parse(args.images) : [];
  } catch {
    return { error: "Invalid images JSON" };
  }
  try {
    videos = args.videos ? JSON.parse(args.videos) : [];
  } catch {
    return { error: "Invalid videos JSON" };
  }

  // Collect remote images from markdown if not already packaged
  if (args.markdown) {
    const re = /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/g;
    let m;
    const seen = new Set(images.map((i) => i.url).filter(Boolean));
    while ((m = re.exec(args.markdown))) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      images.push({ url: m[1] });
    }
    const vre = /<video[^>]+src=["']([^"']+)["']/gi;
    while ((m = vre.exec(args.markdown))) {
      videos.push({ url: m[1] });
    }
  }

  const prefer = (args.prefer || "image").toLowerCase();
  const mediaIds = [];
  const warnings = [];
  let imageCount = 0;
  let videoCount = 0;

  async function uploadOneImage(img) {
    if (imageCount >= 4) {
      warnings.push("skipped image: max 4 images");
      return;
    }
    let up;
    if (img.base64) {
      up = await twitterUploadBase64Image(img.base64, img.mime || "image/jpeg", img.name);
    } else if (img.url) {
      up = await twitterUploadRemoteUrl(img.url);
    } else {
      return;
    }
    if (up.error) {
      warnings.push((img.name || img.url || "image") + ": " + up.error);
      return;
    }
    mediaIds.push(up.mediaId);
    imageCount++;
  }

  async function uploadOneVideo(v) {
    if (videoCount >= 1) {
      warnings.push("skipped video: max 1 video");
      return;
    }
    let up;
    if (v.base64) {
      const bytes = _base64ToUint8Array(v.base64);
      up = await twitterUploadMedia({
        bytes,
        mediaType: v.mime || "video/mp4",
        mediaCategory: "tweet_video",
        name: v.name || "video.mp4",
      });
    } else if (v.url) {
      up = await twitterUploadRemoteUrl(v.url);
    } else {
      return;
    }
    if (up.error) {
      warnings.push((v.name || v.url || "video") + ": " + up.error);
      return;
    }
    mediaIds.push(up.mediaId);
    videoCount++;
  }

  // X typically disallows mixing video with images in one post
  if (prefer === "video" && videos.length) {
    await uploadOneVideo(videos[0]);
  } else {
    for (let i = 0; i < images.length && imageCount < 4; i++) {
      await uploadOneImage(images[i]);
    }
    if (!imageCount && videos.length) {
      await uploadOneVideo(videos[0]);
    } else if (videos.length && imageCount) {
      warnings.push("video skipped: cannot mix with images on a single post; re-run with --prefer video");
    }
  }

  const created = await twitterCreateDraftTweet(built.text, mediaIds);
  if (created.error) return created;

  const out = {
    draftId: created.draftId,
    text: built.text,
    title: built.title,
    digest: built.digest,
    link: built.link || null,
    mediaIds,
    mediaCount: { images: imageCount, videos: videoCount },
    draftUrl: created.draftUrl,
    hint: created.hint,
  };
  if (warnings.length) out.warnings = warnings;
  return out;
}

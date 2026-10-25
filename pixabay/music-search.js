/* @meta
{
  "name": "pixabay/music-search",
  "description": "Pixabay 免版税音乐搜索 (royalty-free music search: title, duration, previewUrl, downloadUrl, page)",
  "domain": "pixabay.com",
  "args": {
    "config": {"required": false, "description": "JSON 配置：{query,genre,mood,movement,duration,theme,contentType,order,page}。全部可选"},
    "configFile": {"required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一；CLI 会把文件内容展开进来）"}
  },
  "capabilities": ["search"],
  "readOnly": true,
  "example": "bb-browser site pixabay/music-search --configFile ./pixabay-music.config.json --json"
}
*/

async function (args) {
  return __pbAudioSearch(args, {
    kind: "music",
    allow: { genre: true, mood: true, movement: true, theme: true },
  });
}

/* @meta
{
  "name": "fab/asset-download",
  "description": "按 Fab listing uid 获取免费资产签名下载地址，优先 gltf，其次 glb，再次 fbx",
  "domain": "www.fab.com",
  "args": {
    "uid": {"required": false, "description": "listing uid 或 https://www.fab.com/listings/<uid>"},
    "format": {"required": false, "description": "强制格式 code，默认按 gltf > glb > fbx 选择"},
    "config": {"required": false, "description": "JSON 配置：{uid,format}。与位置参数 uid 二选一"},
    "configFile": {"required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一）"}
  },
  "capabilities": ["search"],
  "readOnly": true,
  "example": "bb-browser site fab/asset-download e41364e1-c811-40db-85f5-84441192591d --json"
}
*/

async function (args) {
  return __fabAssetDownload(args);
}

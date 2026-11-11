/* @meta
{
  "name": "fab/asset-search",
  "description": "Fab 免费资产搜索（关键词、分类、样式、格式、标签、许可、排序；默认前 20 条；优先标记 gltf/glb/fbx）",
  "domain": "www.fab.com",
  "args": {
    "config": {"required": false, "description": "JSON 配置：{query,listingType,categories,styles,technical,formats,tags,licenses,publisher,publishedSince,minRating,contentType,channel,sort,count,cursor,includeDownload}。全部可选"},
    "configFile": {"required": false, "description": "本地 JSON 配置文件路径（与 --config 二选一；CLI 会把文件内容展开进来）"}
  },
  "capabilities": ["search"],
  "readOnly": true,
  "example": "bb-browser site fab/asset-search --configFile ./fab-asset.config.json --json"
}
*/

async function (args) {
  return __fabAssetSearch(args);
}

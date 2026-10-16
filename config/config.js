const host = "https://hdtv.neu6.edu.cn"
const version = "v2"
const apiVersion = "v1" // 后端 API 路径保持 v1, 与前端路由版本(v2)解耦
const versionDetail = "1.1.0"
module.exports = {
    host,
    channels: `${host}/${apiVersion}/channels`,
    details: `${host}/${apiVersion}/details`,
    sources: `${host}/${apiVersion}/sources`,
    version,
    list: `${host}/${apiVersion}/list`,
    versionDetail
}
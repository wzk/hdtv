const host = "https://hdtv.neu6.edu.cn"
const version = "v2"
const apiVersion = "v1" // 后端 API 路径保持 v1, 与前端路由版本(v2)解耦
const versionDetail = "1.1.0"
// 时移流服务: /review/{start}-{now}-{节目名}.m3u8, 从指定时刻开始的虚拟直播流
const timeshiftHost = "https://media2.neu6.edu.cn"
module.exports = {
    host,
    channels: `${host}/${apiVersion}/channels`,
    details: `${host}/${apiVersion}/details`,
    sources: `${host}/${apiVersion}/sources`,
    version,
    list: `${host}/${apiVersion}/list`,
    versionDetail,
    timeshiftHost
}
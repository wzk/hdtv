const host = "https://hdtv.neu6.edu.cn"
const version = "v2"
// v2 API: sources 结构化(quality/canCatchup/thumbnails/timeShift 模板), 其余端点与 v1 语义一致
const apiVersion = "v2"
module.exports = {
    host,
    channels: `${host}/${apiVersion}/channels`,
    details: `${host}/${apiVersion}/details`,
    sources: `${host}/${apiVersion}/sources`,
    version,
    list: `${host}/${apiVersion}/list`
}

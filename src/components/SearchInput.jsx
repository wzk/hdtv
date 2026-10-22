import React from 'react'
import Search from '@material-ui/icons/Search'
import grey from "@material-ui/core/colors/grey"
import blue from "@material-ui/core/colors/blue"
import red from "@material-ui/core/colors/red"
import { withStyles } from '@material-ui/core/styles'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import { Link } from 'react-router-dom'
import panelStyles from "./panelStyles.js"
import config from "../../config/config"

const pad2 = (n) => (n < 10 ? "0" + n : "" + n)

// 节目时间: 「10月18日 20:00」(与列表页日期风格一致)
const fmtTime = (ts) => {
    const d = new Date(ts * 1000)
    return (d.getMonth() + 1) + "月" + d.getDate() + "日 " +
        pad2(d.getHours()) + ":" + pad2(d.getMinutes())
}

const styles = (theme) => {
    const base = panelStyles(theme)
    return Object.assign({}, base, {
        root: {
            [theme.breakpoints.only("xs")]: {
                display: "none"
            },
            display: "flex",
            backgroundColor: blue[400],
            padding: "4px 8px",
            borderRadius: "5px"
        },
        input: {
            color: "#fff",
            border: "none",
            backgroundColor: blue[400],
            font: "inherit",
            padding: 0,
            outline: "none",
            transition: "width 0.5s",
            "&::placeholder": {
                color: "rgba(255,255,255,0.75)"
            }
        },
        // 结果面板: 复用共享面板样式(定位/圆角阴影/标题头), 仅加宽
        panel: Object.assign({}, base.panel, {
            width: "360px"
        }),
        panelBody: {
            maxHeight: "70vh",
            overflowY: "auto"
        },
        // 上部: 频道名匹配行(单行), 行样式与共享 item 一致
        chRow: Object.assign({}, base.item, {
            display: "block",
            textDecoration: "none",
            "&:last-child": {
                borderBottom: "none"
            }
        }),
        // 下部: 节目行(两行式: 节目名+标签 / 频道·时间)
        row: Object.assign({}, base.item, {
            display: "block",
            whiteSpace: "normal",
            textDecoration: "none",
            "&:last-child": {
                borderBottom: "none"
            }
        }),
        rowTop: {
            display: "flex",
            alignItems: "center",
            fontSize: "14px",
            whiteSpace: "nowrap",
            overflow: "hidden"
        },
        rowTitle: {
            flex: "0 1 auto",
            minWidth: "0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        },
        // 仍在播出(endTime=0)的节目: 红色「直播中」标签, 点击进时移
        liveTag: {
            flex: "0 0 auto",
            marginLeft: "8px",
            padding: "0 6px",
            fontSize: "12px",
            lineHeight: "18px",
            borderRadius: "3px",
            color: "#fff",
            backgroundColor: red[500]
        },
        rowSub: {
            marginTop: "2px",
            fontSize: "12px",
            color: grey[500],
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
        },
        empty: {
            padding: "8px 16px",
            fontSize: "13px",
            color: grey[500]
        }
    })
}

class SearchInput extends React.Component {
    render() {
        const { classes } = this.props
        const st = this.state
        // 频道名本地即时匹配(不区分大小写), 每次渲染按当前输入重算
        const kw = st.keyword.toLowerCase()
        const channels = kw === "" ? [] : this.props.channelList.filter((c) =>
            (c.name || "").toLowerCase().includes(kw))
        return (
            <ClickAwayListener onClickAway={this.closePanel}>
                <div className={classes.root}>
                    <Search />
                    <input ref={this.setInputRef}
                        onFocus={this.handleFocus} onBlur={this.smaller}
                        onKeyDown={this.handleKey}
                        className={classes.input} onChange={this.handleChange}
                        placeholder="搜索"
                        autoComplete="off" style={{ width: st.width }} />
                    {st.open && (
                        <div className={classes.list}>
                            <div className={classes.panel + " hdtv-search-pop"}>
                                <div className={classes.panelBody}>
                                    <div className={classes.panelHead}>频道</div>
                                    {channels.length ? (
                                        <div>
                                            {channels.map((c) => (
                                                <Link key={c.channelId}
                                                    className={classes.chRow + " hdtv-search-chrow"}
                                                    to={`/${config.version}/player/${c.channelId}`}
                                                    onClick={this.closePanel}>
                                                    {c.name}
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={classes.empty}>无匹配频道</div>
                                    )}
                                    <div className={classes.panelHead}>节目 (近7天)</div>
                                    {st.loading ? (
                                        <div className={classes.empty}>搜索中…</div>
                                    ) : st.programs.length ? (
                                        <div>
                                            {st.programs.map((p) => (
                                                <Link key={p.channelId + "-" + p.startTime}
                                                    className={classes.row + " hdtv-search-row"}
                                                    to={this.programTarget(p)}
                                                    onClick={this.closePanel}>
                                                    <div className={classes.rowTop}>
                                                        <span className={classes.rowTitle}>{p.title}</span>
                                                        {p.endTime === 0 && (
                                                            <span className={classes.liveTag}>直播中</span>
                                                        )}
                                                    </div>
                                                    <div className={classes.rowSub}>
                                                        {(p.channelName || p.channelId) + " · " +
                                                            fmtTime(p.startTime)}
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={classes.empty}>无匹配节目</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ClickAwayListener>
        )
    }

    constructor(props) {
        super(props)
        this.state = {
            width: "100px",
            open: false,
            keyword: "",
            programs: [],
            loading: false
        }
        // 竞态守卫: 每次新请求自增, 旧响应回来时序号对不上则丢弃
        this.searchSeq = 0
        this.debounceTimer = null
        this.inputRef = null
        this.smaller = this.smaller.bind(this)
        this.bigger = this.bigger.bind(this)
        this.handleChange = this.handleChange.bind(this)
        this.handleFocus = this.handleFocus.bind(this)
        this.handleKey = this.handleKey.bind(this)
        this.closePanel = this.closePanel.bind(this)
        this.doSearch = this.doSearch.bind(this)
        this.programTarget = this.programTarget.bind(this)
        this.setInputRef = this.setInputRef.bind(this)
    }

    setInputRef(el) {
        this.inputRef = el
    }

    smaller() {
        this.setState({ width: "100px" })
    }

    bigger() {
        this.setState({ width: "150px" })
    }

    // 输入: 频道即时匹配 + 节目单 API 防抖查询; 清空时关闭面板
    handleChange(event) {
        const keyword = event.currentTarget.value.trim()
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }
        if (keyword === "") {
            this.searchSeq++ // 作废在途请求
            this.setState({
                keyword, open: false,
                programs: [], loading: false
            })
            return
        }
        this.setState({ keyword, open: true })
        this.debounceTimer = setTimeout(() => {
            this.doSearch(keyword)
        }, 300)
    }

    // 近7天节目单搜索: /v2/search/{keyword}
    doSearch(keyword) {
        const seq = ++this.searchSeq
        this.setState({ loading: true })
        fetch(config.search + "/" + encodeURIComponent(keyword)).then((res) => {
            return res.json()
        }).then((data) => {
            if (seq !== this.searchSeq) return
            this.setState({
                programs: data.list || [],
                loading: false
            })
        }, () => {
            if (seq !== this.searchSeq) return
            this.setState({ programs: [], loading: false })
        })
    }

    // 节目跳转目标: 已结束 → 回看(起止区间); 仍在播(endTime=0) → 时移(该节目开播时刻起播)
    programTarget(p) {
        if (p.endTime === 0) {
            return `/${config.version}/player/${p.channelId}/ts-${p.startTime}-${Math.floor(Date.now() / 1000)}`
        }
        return `/${config.version}/player/${p.channelId}/${p.startTime}-${p.endTime}`
    }

    // 再聚焦时关键字还在则重新打开结果面板
    handleFocus() {
        this.bigger()
        if (this.state.keyword !== "") {
            this.setState({ open: true })
        }
    }

    handleKey(event) {
        if (event.key === "Escape") {
            this.closePanel()
            if (this.inputRef) this.inputRef.blur()
        }
    }

    closePanel() {
        this.setState({ open: false })
    }

    componentWillUnmount() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
            this.debounceTimer = null
        }
        this.searchSeq++
    }
}

export default withStyles(styles)(SearchInput)

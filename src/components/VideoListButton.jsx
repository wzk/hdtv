import React from 'react'
import Button from '@material-ui/core/Button'
import Collapse from '@material-ui/core/Collapse'
import List from '@material-ui/core/List'
import { withStyles } from '@material-ui/core/styles'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import VideoList from "./VideoList.jsx"
import panelStyles from "./panelStyles.js"
import blue from "@material-ui/core/colors/blue"
import grey from "@material-ui/core/colors/grey"

// 节目单面板: 顶部横向日期切换 + 当天节目平铺 (方案B, 2026-10-18 确认)
// 面板定位/圆角阴影/标题头使用共享 panelStyles, 与节目源/屏幕比例面板一致
const styles = (theme) => Object.assign({}, panelStyles(theme), {
    // 节目单比其他面板宽: 8 个日期 chips 需一行放下
    // (Object.assign 是浅覆盖, panel 需写全样式, 不能只写 width)
    panel: {
        width: "580px",
        maxWidth: "calc(100vw - 32px)",
        backgroundColor: theme.palette.background.paper,
        borderRadius: "8px",
        boxShadow: theme.shadows[8],
        overflow: "hidden"
    },
    chips: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        padding: "8px 12px",
        borderBottom: "1px solid " + theme.palette.divider
    },
    chip: {
        flex: "0 0 auto",
        padding: "2px 10px",
        margin: "0 6px 4px 0",
        fontSize: "12px",
        lineHeight: "18px",
        borderRadius: "999px",
        border: "1px solid " + theme.palette.divider,
        color: grey[700],
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none"
    },
    chipOn: {
        flex: "0 0 auto",
        padding: "2px 10px",
        margin: "0 6px 4px 0",
        fontSize: "12px",
        lineHeight: "18px",
        borderRadius: "999px",
        border: "1px solid " + blue[500],
        color: blue[500],
        backgroundColor: blue[50],
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none"
    },
    programs: {
        maxHeight: "60vh",
        overflowY: "auto"
    }
})

class VideoListButton extends React.Component {
    render() {
        const { classes, timeline, videoList, title } = this.props
        // 回看模式定位当前节目: timeline 为 "start-end"; 时移(ts-)与直播不定位
        const currentStartTime = this.currentStart()
        const day = videoList[this.state.activeIndex]
        return (
            <div>
                <Button color="inherit"
                    aria-haspopup="true"
                    onClick={this.toggleList}
                >
                    节目列表
                </Button>
                <Collapse in={this.state.isListShow} timeout="auto"
                    unmountOnExit onEntered={this.scrollToCurrent}>
                    <div className={classes.list}>
                        <ClickAwayListener onClickAway={this.closeList}>
                            <div className={classes.panel} id="hp-vl-panel">
                                <div className={classes.panelHead}>
                                    节目单{title ? " · " + title : ""}
                                </div>
                                <div className={classes.chips}>
                                    {videoList.map((item, index) => (
                                        <span key={item.date}
                                            className={index === this.state.activeIndex
                                                ? classes.chipOn : classes.chip}
                                            onClick={() => this.setActiveDay(index)}>
                                            {this.dayLabel(item.date, index)}
                                        </span>
                                    ))}
                                </div>
                                {day ? (
                                    <List disablePadding className={classes.programs}>
                                        <VideoList list={day.list}
                                            now={this.state.now}
                                            currentStartTime={currentStartTime}
                                            channel={this.props.channel}
                                            onVideoClick={this.closeList} />
                                    </List>
                                ) : null}
                            </div>
                        </ClickAwayListener>
                    </div>
                </Collapse>
            </div>
        )
    }

    constructor(props) {
        super(props)
        this.state = {
            isListShow: false,
            activeIndex: 0,
            videoList: [
            ],
            now: Math.floor(Date.now() / 1000)
        }
        this.openList = this.openList.bind(this)
        this.closeList = this.closeList.bind(this)
        this.toggleList = this.toggleList.bind(this)
        this.setActiveDay = this.setActiveDay.bind(this)
        this.scrollToCurrent = this.scrollToCurrent.bind(this)
    }

    // 回看模式返回当前节目开始时间, 其他模式返回 ""
    currentStart() {
        const { timeline } = this.props
        if (timeline && timeline.indexOf("ts-") !== 0 && timeline.includes("-")) {
            return timeline.split("-")[0]
        }
        return ""
    }

    // 日期 chip 文案: 今天 / 昨天 / 其余 "MM-dd 周几"
    // 后端 date 格式为 "10月16日[五]"
    dayLabel(date, index) {
        if (index === 0) {
            return "今天"
        }
        if (index === 1) {
            return "昨天"
        }
        const m = /^(\d{1,2})月(\d{1,2})日\[(.+?)\]/.exec(date || "")
        return m ? m[1] + "-" + m[2] + " " + m[3] : (date || "")
    }

    openList() {
        this.setState({ isListShow: true })
    }

    closeList() {
        this.setState({ isListShow: false })
    }
    toggleList() {
        // 每次打开默认定位到今天; 回看模式自动切到当前节目所在日期
        let activeIndex = 0
        const currentStartTime = this.currentStart()
        if (currentStartTime) {
            const idx = this.props.videoList.findIndex((day) =>
                day.list.some((v) => String(v.startTime) === String(currentStartTime)))
            if (idx > -1) {
                activeIndex = idx
            }
        }
        this.setState({
            isListShow: !this.state.isListShow,
            activeIndex,
            now: Math.floor(Date.now() / 1000)
        })
    }
    setActiveDay(index) {
        this.setState({ activeIndex: index }, this.scrollToCurrent)
    }

    // 面板展开/切换日期后, 滚动到正在播出(或回看定位)的节目行
    scrollToCurrent() {
        setTimeout(() => {
            const panel = document.querySelector("#hp-vl-panel")
            if (!panel) {
                return
            }
            const target = panel.querySelector(".hp-vl-current")
            if (target) {
                target.scrollIntoView({ block: "center" })
            }
        }, 80)
    }

    componentDidMount() {
        // 定时刷新 now, 保证"正在播出"高亮随时间更新
        this.timer = setInterval(() => {
            this.setState({
                now: Math.floor(Date.now() / 1000)
            })
        }, 1000 * 60)
    }

    componentWillUnmount() {
        clearInterval(this.timer)
    }
}

export default withStyles(styles)(VideoListButton)

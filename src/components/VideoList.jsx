import React from 'react'
import { withStyles } from '@material-ui/core/styles'
import ListItem from '@material-ui/core/ListItem'
import ListItemText from '@material-ui/core/ListItemText'
import { Link } from 'react-router-dom'
import config from "../../config/config"
import grey from "@material-ui/core/colors/grey"
import blue from "@material-ui/core/colors/blue"
import red from "@material-ui/core/colors/red"

// 单日节目: 按 12 点分上午/下午左右两列 (窄屏堆叠单列)
// 已结束 -> 链接可回看; 正在播出 -> 红点+徽标+浅蓝底; 未播出 -> 浅灰不可点
const styles = (theme) => ({
    columns: {
        display: "flex",
        alignItems: "flex-start",
        ["@media (max-width: 600px)"]: {
            flexDirection: "column"
        }
    },
    col: {
        flex: 1,
        minWidth: 0
    },
    colRight: {
        flex: 1,
        minWidth: 0,
        borderLeft: "1px solid " + theme.palette.divider,
        ["@media (max-width: 600px)"]: {
            borderLeft: "none",
            marginTop: "4px"
        }
    },
    colHead: {
        padding: "6px 12px 2px 16px",
        fontSize: "12px",
        color: grey[500]
    },
    row: {
        paddingTop: "5px",
        paddingBottom: "5px",
        borderBottom: "1px solid " + theme.palette.divider
    },
    rowLast: {
        paddingTop: "5px",
        paddingBottom: "5px",
        borderBottom: "none"
    },
    time: {
        flex: "0 0 auto",
        marginRight: "8px",
        fontFamily: "monospace",
        fontSize: "13px",
        color: grey[700]
    },
    dot: {
        flex: "0 0 auto",
        width: "6px",
        height: "6px",
        marginRight: "6px",
        borderRadius: "50%",
        backgroundColor: red[500]
    },
    dotCurrent: {
        flex: "0 0 auto",
        width: "6px",
        height: "6px",
        marginRight: "6px",
        borderRadius: "50%",
        backgroundColor: blue[500]
    },
    liveTag: {
        flex: "0 0 auto",
        marginLeft: "8px",
        fontSize: "12px",
        color: red[500]
    },
    currentTag: {
        flex: "0 0 auto",
        marginLeft: "8px",
        fontSize: "12px",
        color: blue[500]
    },
    name: {
        fontSize: "14px",
        color: grey[900]
    },
    namePlaying: {
        fontSize: "14px",
        color: blue[700],
        fontWeight: 500
    },
    nameWill: {
        fontSize: "14px",
        color: grey[400]
    },
    timePlaying: {
        flex: "0 0 auto",
        marginRight: "8px",
        fontFamily: "monospace",
        fontSize: "13px",
        color: blue[700]
    },
    timeWill: {
        flex: "0 0 auto",
        marginRight: "8px",
        fontFamily: "monospace",
        fontSize: "13px",
        color: grey[400]
    },
    rowPlaying: {
        paddingTop: "5px",
        paddingBottom: "5px",
        backgroundColor: blue[50],
        borderBottom: "1px solid " + theme.palette.divider
    }
})

const fmtTime = (unix) => {
    const d = new Date(unix * 1000)
    const pad = (n) => (n < 10 ? "0" + n : "" + n)
    return pad(d.getHours()) + ":" + pad(d.getMinutes())
}

const VideoList = (props) => {
    const { classes, list, now, currentStartTime } = props
    // 按 12 点分成上午/下午两组
    const morning = []
    const afternoon = []
    list.forEach((videoInfo) => {
        const d = new Date(videoInfo.startTime * 1000)
        if (d.getHours() < 12) {
            morning.push(videoInfo)
        } else {
            afternoon.push(videoInfo)
        }
    })

    // 渲染单行节目
    const renderRow = (videoInfo, group, index) => {
        const time = fmtTime(videoInfo.startTime)
        const isLast = index === group.length - 1
        const rowClass = isLast ? classes.rowLast : classes.row
        // 回看模式: 精确定位当前节目
        const isCurrent = currentStartTime &&
            String(currentStartTime) === String(videoInfo.startTime)
        // 正在播出: 按当前时间判断(回看模式下同样生效)
        const isLive = now >= videoInfo.startTime && now < videoInfo.endTime
        if (now > videoInfo.endTime) {
            // 已结束: 可点击回看; 回看定位节目用浅蓝底+蓝点+标签凸显
            return (
                <Link to={`/${config.version}/player/${props.channel}/${
                    videoInfo.startTime}-${videoInfo.endTime}`
                } key={`${props.channel}-${videoInfo.startTime}`}
                    onClick={props.onVideoClick}>
                    <ListItem divider={false} button
                        className={isCurrent
                            ? classes.rowPlaying + " hp-vl-current" : rowClass}>
                        <span className={isCurrent ? classes.timePlaying : classes.time}>
                            {time}
                        </span>
                        {isCurrent ? <span className={classes.dotCurrent} /> : null}
                        <ListItemText disableTypography
                            primary={videoInfo.title}
                            className={isCurrent ? classes.namePlaying : classes.name} />
                        {isCurrent ? <span className={classes.currentTag}>正在回看</span> : null}
                    </ListItem>
                </Link>
            )
        }
        if (isLive || isCurrent) {
            // 正在播出(红点+红标签) / 回看定位节目(蓝点+蓝标签), 浅蓝底凸显
            // hp-vl-current 供面板打开后自动滚动定位
            return (
                <ListItem key={`${props.channel}-${videoInfo.startTime}`}
                    divider={false}
                    className={classes.rowPlaying + " hp-vl-current"}>
                    <span className={classes.timePlaying}>{time}</span>
                    <span className={isLive ? classes.dot : classes.dotCurrent} />
                    <ListItemText disableTypography
                        primary={videoInfo.title}
                        className={classes.namePlaying} />
                    {isLive
                        ? <span className={classes.liveTag}>正在播出</span>
                        : <span className={classes.currentTag}>正在回看</span>}
                </ListItem>
            )
        }
        // 未播出: 浅灰不可点
        return (
            <ListItem key={`${props.channel}-${videoInfo.startTime}`}
                divider={false} className={rowClass}>
                <span className={classes.timeWill}>{time}</span>
                <ListItemText disableTypography
                    primary={videoInfo.title}
                    className={classes.nameWill} />
            </ListItem>
        )
    }

    const renderCol = (title, group, extraClass) => {
        if (!group.length) {
            return null
        }
        return (
            <div className={extraClass ? classes[extraClass] : classes.col}>
                <div className={classes.colHead}>{title}</div>
                {group.map((videoInfo, index) => renderRow(videoInfo, group, index))}
            </div>
        )
    }

    return (
        <div className={classes.columns}>
            {renderCol("上午", morning)}
            {renderCol("下午", afternoon, "colRight")}
        </div>
    )
}

export default withStyles(styles)(VideoList)

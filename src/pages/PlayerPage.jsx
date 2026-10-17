import React from 'react'
import { withStyles, createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import { Link } from "react-router-dom"
import Tooltip from '@material-ui/core/Tooltip'
import IconButton from '@material-ui/core/IconButton'
import blue from "@material-ui/core/colors/blue"
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Slide from '@material-ui/core/Slide'
import HomeIcon from "@material-ui/icons/Home"
import Player from "../components/Player.jsx"
import VideoListButton from "../components/VideoListButton.jsx"
import FavoriteButton from "../components/FavoriteButton.jsx"
import SourceButton from "../components/SourceButton.jsx"
import RatioButton from "../components/RatioButton.jsx"
import ColorSnackbar from "../components/ColorSnackbar.jsx"
import config from "../../config/config"

const styles = {
    root: {
        flexGrow: 1,
        height: "100vh",
        overflow: "hidden"
    },
    flex: {
        flex: 1,
    },
    menuButton: {
        marginLeft: -12,
        marginRight: 20,
    },
    appBar: {
        backgroundColor: blue[500]
    }
}

const theme = createMuiTheme({
    palette: {
        primary: {
            main: blue[500],
            dark: blue[500]
        }
    }
})

class PlayerPage extends React.Component {
    render() {
        const { classes, match } = this.props
        return (
            <div className={classes.root}>
                <AppBar position="static" classes={{ root: classes.appBar }}>
                    <Toolbar>
                        <Tooltip title="返回频道列表">
                            <Link to={`/${config.version}/list/channel/热门频道`}>
                                <IconButton className={classes.menuButton}
                                    color="inherit" aria-label="Home">
                                    <HomeIcon />
                                </IconButton>
                            </Link>
                        </Tooltip>
                        <Typography variant="title" color="inherit"
                            className={classes.flex} noWrap
                        >
                            {this.state.title}
                        </Typography>
                        <SourceButton name={this.state.currentSourceName}
                            setSource={this.setSource}
                            sourceList={this.state.sourceList}
                            channel={match.params.channel} />
                        <FavoriteButton channel={match.params.channel} />
                        <VideoListButton color="inherit"
                            channel={match.params.channel}
                            timeline={this.state.timeline}
                            videoList={this.state.videoList} />
                        <RatioButton ratio={this.state.ratio}
                            setRatio={this.setRatio} />
                    </Toolbar>
                </AppBar>
                <MuiThemeProvider theme={theme}>
                    <Player path={this.state.currentSourcePath}
                        title={this.state.title}
                        thumbnails={this.state.currentSourceThumbnails}
                        channel={this.state.channel}
                        timeline={this.state.timeline}
                        videoList={this.state.videoList}
                        ratio={this.state.ratio}
                        sourceCount={this.state.sourceList ? this.state.sourceList.length : 1}
                        onPlayEnd={this.openDialog}
                        onTimeshift={this.handleTimeshift}
                        onBackToLive={this.handleBackToLive}
                        onSourceError={this.handleSourceError}
                    />
                    <ColorSnackbar />
                    <Dialog
                        open={this.state.isDialogOpen}
                        TransitionComponent={Slide}
                        keepMounted
                        onClose={this.closeDialog}
                        aria-labelledby="alert-dialog-slide-title"
                        aria-describedby="alert-dialog-slide-description"
                    >
                        <DialogTitle id="alert-dialog-slide-title">
                            {"是否播放下一个节目?"}
                        </DialogTitle>
                        <DialogContent>
                            <DialogContentText id="alert-dialog-slide-description">
                                当前视频已经播放完毕.
                        </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={this.closeDialog} color="default">
                                取消
                        </Button>
                            <Button onClick={this.playNextVideo} color="primary">
                                播放
                        </Button>
                        </DialogActions>
                    </Dialog>
                </MuiThemeProvider>
            </div>
        )
    }

    constructor(props) {
        super(props)
        this.state = {
            title: "正在加载",
            sourceList: [],
            currentSourcePath: "",
            currentSourceName: "",
            currentSourceThumbnails: "",
            currentSourceIndex: "",
            timeline: "",
            channel: "",
            ratio: "",
            videoList: [],
            isDialogOpen: false,
            isSnackbarOpen: false
        }
        console.log(props)
        this.slug = "" // 直播流文件名, 时移地址需要 (如 fhzx)
        this.setSource = this.setSource.bind(this)
        this.setRatio = this.setRatio.bind(this)
        this.playNextVideo = this.playNextVideo.bind(this)
        this.openDialog = this.openDialog.bind(this)
        this.closeDialog = this.closeDialog.bind(this)
        this.handleTimeshift = this.handleTimeshift.bind(this)
        this.handleBackToLive = this.handleBackToLive.bind(this)
        this.handleSourceError = this.handleSourceError.bind(this)
    }

    componentDidMount() {
        const channel = this.props.match.params.channel,
            timeline = this.props.match.params.timeline

        this.loadSource(channel, timeline)

        // 获取节目列表
        this.getVideoList()

        // 设置视频比例
        let ratio = localStorage.getItem("ratio")
        if (ratio) {
            this.setState({ ratio })
        } else {
            this.setState({ ratio: "自动" })
            localStorage.setItem("ratio", "自动")
        }
    }

    componentDidUpdate(prevProps, prevState) {
        let channel = this.props.match.params.channel,
            timeline = this.props.match.params.timeline,
            prevChannel = prevProps.match.params.channel,
            prevTimeline = prevProps.match.params.timeline

        if (channel === prevChannel && timeline === prevTimeline) {
            return
        }

        // 同频道内时移起点变化(ts-A -> ts-B): 无需重新请求直播源, 直接重建时移地址
        if (channel === prevChannel && this.isTimeshift(timeline) &&
            this.isTimeshift(prevTimeline) && this.slug) {
            this.applyTimeshiftSource(timeline)
        } else {
            this.loadSource(channel, timeline)
        }

        this.getVideoList()

        // 存储state
        if (this.state.ratio !== prevState.ratio) {
            localStorage.setItem("ratio", this.state.ratio)
        }
    }

    // timeline 是否为时移路由: "ts-{startTime}"
    isTimeshift(timeline) {
        return Boolean(timeline && timeline.indexOf("ts-") === 0)
    }

    // 时移播放地址: {timeshiftHost}/review/{start}-{now}-{节目名}.m3u8
    buildShiftUrl(tsStart) {
        return config.timeshiftHost + "/review/" + tsStart + "-" +
            Math.floor(Date.now() / 1000) + "-" + this.slug + ".m3u8"
    }

    // 用当前 slug 生成时移源并应用
    applyTimeshiftSource(timeline) {
        const tsStart = parseInt(timeline.slice(3), 10)
        if (isNaN(tsStart) || !this.slug) {
            return
        }
        this.setState({
            currentSourcePath: this.buildShiftUrl(tsStart),
            currentSourceThumbnails: "",
            // 同步更新 timeline, 播放头位置/进度保存等依赖时移起点
            timeline
        })
    }

    // 加载频道播放源: 直播/回看走后端接口, 时移(ts-)基于直播源信息生成时移地址
    loadSource(channel, timeline) {
        const isTs = this.isTimeshift(timeline)
        // 时移路由下按直播源请求 (空 timeline), 否则按回看 timeline 请求
        fetch(`${config.sources}/${channel}/${isTs ? "" : (timeline || "")}`)
            .then((res) => {
                res.json().then((data) => {
                    let index = 0
                    const savedInfo = JSON.parse(localStorage.getItem(channel))
                    if (savedInfo && savedInfo.index) {
                        index = savedInfo.index
                    }
                    index = index < data.sourceList.length ? index : 0
                    const source = data.sourceList[index]
                    // 从直播流地址提取节目名 (如 .../fhzx.m3u8 -> fhzx)
                    const m = /\.m3u8$/.test(source.path)
                        ? source.path.replace(/.*\//, "").replace(/\.m3u8$/, "")
                        : ""
                    if (m) {
                        this.slug = m
                    }
                    this.setState({
                        title: data.title,
                        sourceList: data.sourceList,
                        currentSourceName: source.name,
                        currentSourcePath: isTs && m
                            ? this.buildShiftUrl(parseInt(timeline.slice(3), 10))
                            : source.path,
                        currentSourceIndex: index,
                        timeline,
                        channel,
                        currentSourceThumbnails:
                            isTs ? "" : config.host + source.thumbnails
                    })
                })
            })
    }

    // 直播页点击 24 小时时移轴 -> 进入该时刻开始的时移播放 (点轴最右端即回到直播)
    handleTimeshift(tsStart) {
        const channel = this.props.match.params.channel
        this.props.history.push(`/${config.version}/player/${channel}/ts-${tsStart}`)
    }

    // 时移页"回到直播"按钮
    handleBackToLive() {
        const channel = this.props.match.params.channel
        this.props.history.push(`/${config.version}/player/${channel}/`)
    }

    // 播放出错时自动切换到下一个节目源 (循环); 播放器会在所有源都失败后才显示错误界面
    handleSourceError() {
        const list = this.state.sourceList
        if (!list || list.length < 2) {
            return
        }
        const timeline = this.state.timeline || ""
        const isTs = this.isTimeshift(timeline)
        const nextIndex = ((this.state.currentSourceIndex || 0) + 1) % list.length
        const source = list[nextIndex]
        // 不同源的流文件名可能不同, 时移地址需要用新源的节目名重建
        const m = /\.m3u8$/.test(source.path)
            ? source.path.replace(/.*\//, "").replace(/\.m3u8$/, "")
            : ""
        if (m) {
            this.slug = m
        }
        if (isTs && m) {
            this.setState({
                currentSourceIndex: nextIndex,
                currentSourceName: source.name,
                currentSourcePath: this.buildShiftUrl(parseInt(timeline.slice(3), 10)),
                currentSourceThumbnails: ""
            })
        } else {
            this.setSource(source.name, source.path,
                config.host + source.thumbnails, nextIndex)
        }
    }

    openDialog() {
        // 播放结束退出全屏 (老浏览器可能没有该 API)
        if (document.exitFullscreen) {
            document.exitFullscreen()
        }

        // 是回放的节目播放完毕 (时移路由 ts- 不参与连播逻辑)
        if (this.state.timeline && this.state.timeline.indexOf("ts-") !== 0 &&
            this.state.timeline.includes("-")) {
            const timeline = this.state.timeline.split("-")
            const endTime = timeline[1]
            const videoListInOrder = this.state.videoList.slice().reverse()
            for (let i = 0, allLen = videoListInOrder.length; i < allLen; i++) {
                for (let j = 0, list = videoListInOrder[i].list,
                    len = list.length; j < len; j++) {
                    if (endTime <= list[j].endTime) {
                        if (j === len - 1) {
                            if (i !== allLen - 1) {
                                const nextVideo = videoListInOrder[i + 1].list[0]
                                if (nextVideo.endTime * 1000 >= Date.now()) {
                                    return
                                }
                            } else {
                                return
                            }
                        } else {
                            if (list[j + 1].endTime * 1000 >= Date.now()) {
                                return
                            }
                        }
                        this.setState({
                            isDialogOpen: true
                        })
                        return
                    }
                }
            }
        }
    }

    closeDialog() {
        this.setState({
            isDialogOpen: false
        })
    }

    // 设置选择的节目源并存储
    setSource(name, path, thumbnails, index) {
        this.setState({
            currentSourceName: name,
            currentSourcePath: path,
            currentSourceThumbnails: thumbnails,
            currentSourceIndex: index
        })
        let channel = this.props.match.params.channel,
            savedInfo = JSON.parse(localStorage.getItem(channel))
        savedInfo = savedInfo ? savedInfo : {}
        localStorage.setItem(channel, JSON.stringify(Object.assign({}, savedInfo, {
            index
        })))
        // console.log(savedInfo)
    }

    playNextVideo() {
        // 是回放的节目播放完毕 (时移路由 ts- 不参与连播逻辑)
        if (this.state.timeline && this.state.timeline.indexOf("ts-") !== 0 &&
            this.state.timeline.includes("-")) {
            const timeline = this.state.timeline.split("-")
            const endTime = timeline[1]
            const videoListInOrder = this.state.videoList.slice().reverse()
            const channel = this.state.channel
            for (let i = 0, allLen = videoListInOrder.length; i < allLen; i++) {
                for (let j = 0, list = videoListInOrder[i].list,
                    len = list.length; j < len; j++) {
                    if (endTime <= list[j].endTime) {
                        if (j === len - 1) {
                            if (i !== allLen - 1) {
                                const nextVideo = videoListInOrder[i + 1].list[0]
                                if (nextVideo.endTime * 1000 < Date.now()) {
                                    this.props.history.push(
                                        `/${config.version}/player/${channel}/${
                                        nextVideo.startTime
                                        }-${
                                        nextVideo.endTime
                                        }`
                                    )
                                }
                            }
                        } else {
                            if (list[j + 1].endTime * 1000 < Date.now()) {
                                this.props.history.push(
                                    `/${config.version}/player/${channel}/${
                                    list[j + 1].startTime
                                    }-${
                                    list[j + 1].endTime
                                    }`
                                )
                            }
                        }
                        this.closeDialog()
                        return
                    }
                }
            }
        }
    }

    setRatio(ratio) {
        this.setState({ ratio })
    }

    getVideoList() {
        fetch(`${config.list}/${this.props.match.params.channel}/7`).then((res) => {
            res.json().then((list) => {
                // console.log(list)
                this.setState({
                    videoList: list.reverse()
                })
            })
        })
    }
}

export default withStyles(styles)(PlayerPage)
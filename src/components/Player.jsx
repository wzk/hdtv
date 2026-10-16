import React from 'react'
import { withStyles } from '@material-ui/core/styles'
import IconButton from '@material-ui/core/IconButton'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import Slide from '@material-ui/core/Slide'
import PlayArrowIcon from '@material-ui/icons/PlayArrow'
import PauseIcon from '@material-ui/icons/Pause'
import VolumeUpIcon from '@material-ui/icons/VolumeUp'
import VolumeOffIcon from '@material-ui/icons/VolumeOff'
import FullscreenIcon from '@material-ui/icons/Fullscreen'
import FullscreenExitIcon from '@material-ui/icons/FullscreenExit'
import Hls from 'hls.js'
import "./player.css"

// 方案B: 原生 <video> + hls.js, 单video元素由组件全程管理,
// 切换节目时销毁旧 hls 实例后复用同一个 video 元素, 从机制上杜绝双播放

const SAVE_INTERVAL = 10 * 1000
const CONTROLS_HIDE_DELAY = 3000
// 缩略图配置与原 flowplayer 插件一致: interval=1, startIndex=1, preload=false
const THUMB_INTERVAL = 1
const THUMB_START_INDEX = 1

const isPc = (() => {
    var userAgentInfo = navigator.userAgent
    var Agents = new Array("Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod");
    var flag = true
    for (var v = 0; v < Agents.length; v++) {
        if (userAgentInfo.indexOf(Agents[v]) > 0) {
            flag = false
            break
        }
    }
    return flag
})()

const isTouch = ("ontouchstart" in window) ||
    (navigator.maxTouchPoints ? navigator.maxTouchPoints > 0 : false)

const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))

const getFullscreenElement = () => {
    return document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
}

const requestFullscreen = (el) => {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
        el.mozRequestFullScreen || el.msRequestFullscreen
    if (!fn) {
        return false
    }
    try {
        const result = fn.call(el)
        if (result && result.catch) {
            result.catch(() => { })
        }
        return true
    } catch (e) {
        return false
    }
}

const exitFullscreen = () => {
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
        document.mozCancelFullScreen || document.msExitFullscreen
    if (!fn) {
        return false
    }
    try {
        const result = fn.call(document)
        if (result && result.catch) {
            result.catch(() => { })
        }
        return true
    } catch (e) {
        return false
    }
}

const fmt = (t) => {
    t = Math.floor(t || 0)
    if (!isFinite(t) || t < 0) {
        t = 0
    }
    const h = Math.floor(t / 3600)
    const m = Math.floor((t % 3600) / 60)
    const s = t % 60
    const pad = (n) => (n < 10 ? "0" + n : "" + n)
    return h > 0 ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s)
}

const FULLSCREEN_EVENTS = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange"
]

const styles = (theme) => ({
    player: {
        height: "calc(100vh - 64px)",
        width: "100%",
        overflow: "hidden",
        [theme.breakpoints.only("xs")]: {
            height: "calc(100vh - 56px)"
        }
    },
    btn: {
        color: "#fff",
        padding: 6
    }
})

class Player extends React.Component {
    render() {
        const { classes } = this.props
        const s = this.state
        const live = this.props.isLive
        const hasDuration = s.duration > 0 && isFinite(s.duration)
        const playedPct = hasDuration ? (s.currentTime / s.duration) * 100 : 0
        const bufferedPct = hasDuration ? Math.min(100, (s.buffered / s.duration) * 100) : 0
        const volumePct = (s.muted ? 0 : s.volume) * 100

        return (
            <React.Fragment>
                <div id="playerContainer"
                    ref={this.containerRef}
                    className={`${classes.player} hdtv-player${s.controlsVisible ? "" : " hp-hidden"}`}
                    onMouseMove={this.showControls}
                    onMouseLeave={this.onContainerMouseLeave}
                    onTouchStart={this.showControls}
                >
                    <div className="hp-frame" ref={this.frameRef}>
                        <video ref={this.videoRef} className="hp-video"
                            onClick={this.onVideoClick}
                            onTouchEnd={this.onVideoTouchEnd}
                        />
                    </div>

                    {/* 移动端标题, 对应原 flowplayer 的 clip.title */}
                    {!isPc && s.controlsVisible && this.props.title
                        ? <div className="hp-title">{this.props.title}</div>
                        : null}

                    {s.loading && !s.error ? (
                        <div className="hp-center">
                            <div className="hp-spinner" />
                        </div>
                    ) : null}

                    {this.props.path && !s.loading && !s.playing && !s.error ? (
                        <div className="hp-center">
                            <button type="button" className="hp-bigplay"
                                onClick={this.togglePlay} aria-label="播放">
                                <PlayArrowIcon />
                            </button>
                        </div>
                    ) : null}

                    {s.error ? (
                        <div className="hp-error">
                            <div className="hp-error-text">{s.error}</div>
                            <Button className={classes.btn + " hp-error-btn"}
                                onClick={this.retry}>
                                重试
                            </Button>
                        </div>
                    ) : null}

                    {s.showUnmuteHint && s.muted ? (
                        <div className="hp-hint" onClick={this.unmute}>
                            已自动静音, 点击开启声音
                        </div>
                    ) : null}

                    <div className="hp-controls">
                        {!live && hasDuration ? (
                            <div className="hp-progress" ref={this.barRef}
                                onMouseDown={this.onBarMouseDown}
                                onMouseMove={this.onBarMouseMove}
                                onMouseLeave={this.onBarMouseLeave}
                                onTouchStart={this.onBarTouchStart}
                                onTouchMove={this.onBarTouchMove}
                                onTouchEnd={this.onBarTouchEnd}
                            >
                                <div className="hp-progress-inner">
                                    <div className="hp-buffered"
                                        style={{ width: bufferedPct + "%" }} />
                                    <div className="hp-played"
                                        style={{ width: playedPct + "%" }} />
                                </div>
                                {s.thumb ? (
                                    <div className="hp-thumb" style={{ left: s.thumb.x + "px" }}>
                                        <div className="hp-thumb-img"
                                            style={{ backgroundImage: 'url("' + s.thumb.url + '")' }} />
                                        <div className="hp-thumb-time">{fmt(s.thumb.time)}</div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        <div className="hp-buttons">
                            <IconButton className={classes.btn}
                                onClick={this.togglePlay}
                                aria-label={s.playing ? "暂停" : "播放"}>
                                {s.playing ? <PauseIcon /> : <PlayArrowIcon />}
                            </IconButton>
                            {live ? (
                                <div className="hp-live">
                                    <span className="hp-live-dot" />直播
                                </div>
                            ) : (
                                <div className="hp-time">
                                    {fmt(s.currentTime)}{hasDuration ? " / " + fmt(s.duration) : ""}
                                </div>
                            )}
                            <div className="hp-spacer" />
                            {isPc ? (
                                <React.Fragment>
                                    <IconButton className={classes.btn}
                                        onClick={this.toggleMute}
                                        aria-label={s.muted ? "取消静音" : "静音"}>
                                        {s.muted || s.volume === 0
                                            ? <VolumeOffIcon />
                                            : <VolumeUpIcon />}
                                    </IconButton>
                                    <div className="hp-volume" ref={this.volumeRef}
                                        onMouseDown={this.onVolumeMouseDown}
                                        onMouseMove={this.onVolumeMouseMove}
                                    >
                                        <div className="hp-volume-inner">
                                            <div className="hp-volume-fill"
                                                style={{ width: volumePct + "%" }} />
                                        </div>
                                    </div>
                                </React.Fragment>
                            ) : null}
                            <IconButton className={classes.btn}
                                onClick={this.toggleFullscreen}
                                aria-label={s.isFullscreen ? "退出全屏" : "全屏"}>
                                {s.isFullscreen
                                    ? <FullscreenExitIcon />
                                    : <FullscreenIcon />}
                            </IconButton>
                        </div>
                    </div>
                </div>
                <Dialog
                    open={this.state.isDialogOpen}
                    TransitionComponent={Slide}
                    keepMounted
                    onClose={this.closeDialog}
                    aria-labelledby="alert-dialog-slide-title"
                    aria-describedby="alert-dialog-slide-description"
                >
                    <DialogTitle id="alert-dialog-slide-title">
                        {"是否跳转到上次播放的进度?"}
                    </DialogTitle>
                    <DialogContent>
                        <DialogContentText id="alert-dialog-slide-description">
                            我们检测到你的本地存储中有此节目的播放记录
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.closeDialog} color="default">
                            取消
                        </Button>
                        <Button onClick={this.continuePlayProcess} color="primary">
                            跳转
                        </Button>
                    </DialogActions>
                </Dialog>
            </React.Fragment>
        )
    }

    constructor(props) {
        super(props)
        this.state = {
            isDialogOpen: false,
            playing: false,
            loading: false,
            error: "",
            muted: false,
            volume: 1,
            currentTime: 0,
            duration: 0,
            buffered: 0,
            controlsVisible: true,
            isFullscreen: false,
            thumb: null,
            showUnmuteHint: false
        }

        this.containerRef = React.createRef()
        this.frameRef = React.createRef()
        this.videoRef = React.createRef()
        this.barRef = React.createRef()
        this.volumeRef = React.createRef()

        this.hls = null
        this.savedInfo = {}
        this.timer = null
        this.hideTimer = null
        this.thumbCache = {}
        this.lastThumbSecond = -1
        this.thumbSeq = 0
        this.dragging = false
        this.volumeDragging = false
        this.touchedAt = 0
        this.retryNetwork = 0
        this.retryMedia = 0
        this.resumeChecked = false

        this.closeDialog = this.closeDialog.bind(this)
        this.continuePlayProcess = this.continuePlayProcess.bind(this)
        this.keyupHandler = this.keyupHandler.bind(this)

        this.showControls = this.showControls.bind(this)
        this.onContainerMouseLeave = this.onContainerMouseLeave.bind(this)
        this.onVideoClick = this.onVideoClick.bind(this)
        this.onVideoTouchEnd = this.onVideoTouchEnd.bind(this)
        this.togglePlay = this.togglePlay.bind(this)
        this.toggleMute = this.toggleMute.bind(this)
        this.unmute = this.unmute.bind(this)
        this.retry = this.retry.bind(this)
        this.toggleFullscreen = this.toggleFullscreen.bind(this)
        this.onFullscreenChange = this.onFullscreenChange.bind(this)

        this.setupVideo = this.setupVideo.bind(this)
        this.saveProgress = this.saveProgress.bind(this)
        this.onLoadedMetadata = this.onLoadedMetadata.bind(this)
        this.onTimeUpdate = this.onTimeUpdate.bind(this)
        this.onDurationChange = this.onDurationChange.bind(this)
        this.onProgress = this.onProgress.bind(this)
        this.onPlay = this.onPlay.bind(this)
        this.onPause = this.onPause.bind(this)
        this.onEnded = this.onEnded.bind(this)
        this.onWaiting = this.onWaiting.bind(this)
        this.onPlaying = this.onPlaying.bind(this)
        this.onCanPlay = this.onCanPlay.bind(this)
        this.onVideoError = this.onVideoError.bind(this)
        this.onVolumeChange = this.onVolumeChange.bind(this)
        this.onHlsError = this.onHlsError.bind(this)
        this.applyRatio = this.applyRatio.bind(this)
        this.seekRelative = this.seekRelative.bind(this)
        this.setVolume = this.setVolume.bind(this)

        this.onBarMouseDown = this.onBarMouseDown.bind(this)
        this.onBarMouseMove = this.onBarMouseMove.bind(this)
        this.onBarMouseLeave = this.onBarMouseLeave.bind(this)
        this.onBarTouchStart = this.onBarTouchStart.bind(this)
        this.onBarTouchMove = this.onBarTouchMove.bind(this)
        this.onBarTouchEnd = this.onBarTouchEnd.bind(this)
        this.onDocMouseMove = this.onDocMouseMove.bind(this)
        this.onDocMouseUp = this.onDocMouseUp.bind(this)

        this.onVolumeMouseDown = this.onVolumeMouseDown.bind(this)
        this.onVolumeMouseMove = this.onVolumeMouseMove.bind(this)
        this.onVolumeDocMove = this.onVolumeDocMove.bind(this)
        this.onVolumeDocUp = this.onVolumeDocUp.bind(this)

        // video 元素全程只有一个, 事件监听挂一次即可
        this.boundVideoHandlers = [
            ["loadedmetadata", this.onLoadedMetadata],
            ["timeupdate", this.onTimeUpdate],
            ["durationchange", this.onDurationChange],
            ["progress", this.onProgress],
            ["play", this.onPlay],
            ["pause", this.onPause],
            ["ended", this.onEnded],
            ["waiting", this.onWaiting],
            ["playing", this.onPlaying],
            ["canplay", this.onCanPlay],
            ["error", this.onVideoError],
            ["volumechange", this.onVolumeChange]
        ]
    }

    componentDidMount() {
        const video = this.videoRef.current
        if (video) {
            // 移动端内联播放 (iOS 需要这两个属性)
            video.setAttribute("playsinline", "")
            video.setAttribute("webkit-playsinline", "")
            this.boundVideoHandlers.forEach((pair) => {
                video.addEventListener(pair[0], pair[1])
            })

            // 恢复上次的音量
            let savedVolume = null
            try {
                savedVolume = JSON.parse(localStorage.getItem("volume"))
            } catch (e) { }
            if (typeof savedVolume === "number" && savedVolume >= 0 && savedVolume <= 1) {
                try {
                    video.volume = savedVolume
                } catch (e) { }
            }
        }

        FULLSCREEN_EVENTS.forEach((name) => {
            document.addEventListener(name, this.onFullscreenChange)
        })

        document.addEventListener("keyup", this.keyupHandler)
    }

    componentDidUpdate(prevProps) {
        if (prevProps.ratio !== this.props.ratio) {
            this.applyRatio(this.props.ratio)
        }
        if (!this.props.path) {
            return
        }
        if (this.props.path === prevProps.path &&
            this.props.isLive === prevProps.isLive) {
            return
        }

        try {
            this.savedInfo = JSON.parse(localStorage.getItem(this.props.channel)) || {}
        } catch (e) {
            this.savedInfo = {}
        }

        this.setupVideo(this.props.path)

        clearInterval(this.timer)

        // 如果是回看节目, 记录timeline
        if (this.props.timeline) {
            this.timer = setInterval(this.saveProgress, SAVE_INTERVAL)
        }
    }

    componentWillUnmount() {
        document.removeEventListener("keyup", this.keyupHandler)
        FULLSCREEN_EVENTS.forEach((name) => {
            document.removeEventListener(name, this.onFullscreenChange)
        })

        // 返回主页前存储信息 (视频不存在时安全跳过, 修复原版此处崩溃导致播放器无法卸载的问题)
        this.saveProgress()

        clearInterval(this.timer)
        clearTimeout(this.hideTimer)

        const video = this.videoRef.current
        if (video) {
            video.pause()
            this.boundVideoHandlers.forEach((pair) => {
                video.removeEventListener(pair[0], pair[1])
            })
        }

        // 销毁 hls 实例, 彻底停止拉流
        if (this.hls) {
            this.hls.destroy()
            this.hls = null
        }
        if (video) {
            video.removeAttribute("src")
            try {
                video.load()
            } catch (e) { }
        }
    }

    // ------- 播放核心 -------

    setupVideo(path) {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        this.resumeChecked = false
        this.retryNetwork = 0
        this.retryMedia = 0
        this.thumbCache = {}
        this.lastThumbSecond = -1
        this.thumbSeq++
        this.setState({
            error: "",
            currentTime: 0,
            duration: 0,
            buffered: 0,
            loading: true,
            playing: false,
            thumb: null
        })

        // 先销毁旧的 hls 实例再挂新流, video 元素复用, 不会出现两路同时播放
        if (this.hls) {
            this.hls.destroy()
            this.hls = null
        }

        const canNative = video.canPlayType("application/vnd.apple.mpegurl")
        // Safari/iOS 使用原生 HLS, 其它支持 MSE 的浏览器使用 hls.js
        if (Hls.isSupported() && !(canNative && isApple)) {
            const hls = new Hls({
                xhrSetup: (xhr) => {
                    xhr.withCredentials = false
                }
            })
            this.hls = hls
            hls.loadSource(path)
            hls.attachMedia(video)
            hls.on(Hls.Events.ERROR, this.onHlsError)
        } else if (canNative) {
            video.src = path
            video.load()
        } else {
            this.setState({
                error: "当前浏览器不支持 HLS 视频播放",
                loading: false
            })
            return
        }

        this.tryPlay(video)
        this.showControls()
    }

    tryPlay(video) {
        const promise = video.play()
        if (promise && promise.catch) {
            promise.catch(() => {
                // 自动播放被浏览器拦截: 静音后重试 (Chrome 自动播放策略兜底)
                if (!video.muted) {
                    video.muted = true
                    const retry = video.play()
                    if (retry && retry.catch) {
                        retry.catch(() => {
                            this.setState({
                                loading: false,
                                playing: false,
                                showUnmuteHint: true
                            })
                        })
                    }
                    this.setState({ showUnmuteHint: true })
                } else {
                    this.setState({
                        loading: false,
                        playing: false,
                        showUnmuteHint: true
                    })
                }
            })
        }
    }

    saveProgress() {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        const info = Object.assign({}, this.savedInfo, {
            time: video.currentTime || 0,
            timeline: this.props.timeline
        })
        try {
            localStorage.setItem(this.props.channel, JSON.stringify(info))
        } catch (e) { }
    }

    onHlsError(ev, data) {
        if (!data || !data.fatal) {
            return
        }
        const hls = this.hls
        if (!hls) {
            return
        }
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            if (this.retryNetwork < 5) {
                this.retryNetwork++
                hls.startLoad()
                return
            }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            if (this.retryMedia < 3) {
                this.retryMedia++
                hls.recoverMediaError()
                return
            }
        }
        hls.destroy()
        this.hls = null
        this.setState({
            error: "视频播放出错, 请重试",
            loading: false,
            playing: false
        })
    }

    // ------- video 事件 -------

    onLoadedMetadata() {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        this.setState({
            duration: isFinite(video.duration) ? video.duration : 0,
            loading: false
        })

        let savedVolume = null
        try {
            savedVolume = JSON.parse(localStorage.getItem("volume"))
        } catch (e) { }
        if (typeof savedVolume === "number" && savedVolume >= 0 && savedVolume <= 1) {
            try {
                video.volume = savedVolume
            } catch (e) { }
        }

        this.applyRatio(this.props.ratio)

        // 回看时, 如果之前回看过该内容, 询问是否接着回看
        if (!this.resumeChecked) {
            this.resumeChecked = true
            const info = this.savedInfo
            if (this.props.timeline && info &&
                info.timeline === this.props.timeline && info.time > 0) {
                this.setState({ isDialogOpen: true })
            }
        }
    }

    onTimeUpdate() {
        const video = this.videoRef.current
        if (video) {
            this.setState({ currentTime: video.currentTime || 0 })
        }
    }

    onDurationChange() {
        const video = this.videoRef.current
        if (video && isFinite(video.duration)) {
            this.setState({ duration: video.duration })
        }
    }

    onProgress() {
        const video = this.videoRef.current
        if (video && video.buffered && video.buffered.length > 0) {
            this.setState({
                buffered: video.buffered.end(video.buffered.length - 1)
            })
        }
    }

    onPlay() {
        this.setState({ playing: true })
        this.showControls()
    }

    onPause() {
        this.setState({ playing: false })
        this.showControls()
    }

    onEnded() {
        this.setState({ playing: false })
        if (this.props.onPlayEnd) {
            this.props.onPlayEnd()
        }
    }

    onWaiting() {
        this.setState({ loading: true })
    }

    onPlaying() {
        this.setState({ playing: true, loading: false })
    }

    onCanPlay() {
        this.setState({ loading: false })
    }

    onVideoError() {
        // hls.js 场景下错误由 onHlsError 处理; 忽略主动清空 src 触发的错误
        if (this.hls) {
            return
        }
        const video = this.videoRef.current
        if (!video || !video.currentSrc) {
            return
        }
        this.setState({
            error: "视频加载失败, 请重试",
            loading: false,
            playing: false
        })
    }

    onVolumeChange() {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        this.setState((state) => ({
            volume: video.volume,
            muted: video.muted,
            showUnmuteHint: video.muted ? state.showUnmuteHint : false
        }))
    }

    // ------- 交互 -------

    showControls() {
        if (!this.state.controlsVisible) {
            this.setState({ controlsVisible: true })
        }
        clearTimeout(this.hideTimer)
        const video = this.videoRef.current
        if (video && !video.paused && !this.dragging && !this.volumeDragging) {
            this.hideTimer = setTimeout(() => {
                this.setState({ controlsVisible: false })
            }, CONTROLS_HIDE_DELAY)
        }
    }

    onContainerMouseLeave() {
        clearTimeout(this.hideTimer)
        const video = this.videoRef.current
        if (video && !video.paused && !this.dragging && !this.volumeDragging) {
            this.setState({ controlsVisible: false })
        }
    }

    onVideoTouchEnd() {
        this.touchedAt = Date.now()
    }

    onVideoClick() {
        // 触屏后紧跟的合成 click 忽略, 触屏交互由 touch 事件完成
        if (Date.now() - this.touchedAt < 700) {
            return
        }
        const video = this.videoRef.current
        if (!video || this.state.error || !this.props.path) {
            return
        }
        if (this.state.controlsVisible) {
            this.togglePlay()
        } else {
            this.showControls()
        }
    }

    togglePlay() {
        const video = this.videoRef.current
        if (!video || !this.props.path || this.state.error) {
            return
        }
        if (video.paused || video.ended) {
            this.tryPlay(video)
        } else {
            video.pause()
        }
    }

    toggleMute() {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        if (video.muted) {
            video.muted = false
            if (video.volume === 0) {
                this.setVolume(0.5)
            }
        } else {
            video.muted = true
        }
    }

    unmute() {
        const video = this.videoRef.current
        if (video) {
            video.muted = false
        }
        this.setState({ showUnmuteHint: false })
    }

    retry() {
        if (this.props.path) {
            this.setupVideo(this.props.path)
        }
    }

    setVolume(volume) {
        const video = this.videoRef.current
        if (!video) {
            return
        }
        try {
            video.volume = Math.min(1, Math.max(0, volume))
            if (video.volume > 0 && video.muted) {
                video.muted = false
            }
            localStorage.setItem("volume", JSON.stringify(video.volume))
        } catch (e) { }
    }

    seekRelative(delta) {
        const video = this.videoRef.current
        if (!video || this.props.isLive) {
            return
        }
        const duration = this.state.duration
        if (!duration || !isFinite(duration)) {
            return
        }
        let target = video.currentTime + delta
        if (target < 0) {
            target = 0
        }
        if (target > duration) {
            target = duration
        }
        video.currentTime = target
    }

    toggleFullscreen() {
        const container = this.containerRef.current
        const video = this.videoRef.current
        if (getFullscreenElement()) {
            exitFullscreen()
            return
        }
        // iOS iPhone 不支持元素全屏, 退回视频原生全屏
        const requested = container ? requestFullscreen(container) : false
        if (!requested && video && video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen()
        }
    }

    onFullscreenChange() {
        this.setState({ isFullscreen: Boolean(getFullscreenElement()) })
    }

    keyupHandler(event) {
        const video = this.videoRef.current
        if (!video || !this.props.path || this.state.error) {
            return
        }
        switch (event.key) {
            case "ArrowUp": {
                this.setVolume(Math.min(1, video.volume + 0.1))
                break
            }
            case "ArrowDown": {
                this.setVolume(Math.max(0, video.volume - 0.1))
                break
            }
            case "ArrowLeft": {
                this.seekRelative(-10)
                break
            }
            case "ArrowRight": {
                this.seekRelative(10)
                break
            }
            case " ": {
                this.togglePlay()
                break
            }
        }
    }

    // ------- 进度条与缩略图 -------

    seekByEvent(e) {
        const bar = this.barRef.current
        const video = this.videoRef.current
        if (!bar || !video) {
            return
        }
        const duration = this.state.duration
        if (!duration || !isFinite(duration)) {
            return
        }
        const rect = bar.getBoundingClientRect()
        const clientX = e.touches ? e.touches[0].clientX : e.clientX
        let ratio = (clientX - rect.left) / rect.width
        if (ratio < 0) {
            ratio = 0
        }
        if (ratio > 1) {
            ratio = 1
        }
        video.currentTime = ratio * duration
        this.setState({ currentTime: ratio * duration })
    }

    onBarMouseDown(e) {
        if (this.props.isLive || !this.state.duration) {
            return
        }
        this.hideThumb()
        this.dragging = true
        this.seekByEvent(e)
        document.addEventListener("mousemove", this.onDocMouseMove)
        document.addEventListener("mouseup", this.onDocMouseUp)
    }

    onDocMouseMove(e) {
        if (this.dragging) {
            this.seekByEvent(e)
        }
    }

    onDocMouseUp() {
        this.dragging = false
        document.removeEventListener("mousemove", this.onDocMouseMove)
        document.removeEventListener("mouseup", this.onDocMouseUp)
        this.showControls()
    }

    onBarTouchStart(e) {
        if (this.props.isLive || !this.state.duration) {
            return
        }
        this.hideThumb()
        this.dragging = true
        this.seekByEvent(e)
    }

    onBarTouchMove(e) {
        if (this.dragging) {
            e.preventDefault()
            this.seekByEvent(e)
        }
    }

    onBarTouchEnd() {
        this.dragging = false
        this.showControls()
    }

    onBarMouseMove(e) {
        if (this.dragging) {
            this.seekByEvent(e)
            return
        }
        this.updateThumb(e)
    }

    onBarMouseLeave() {
        this.hideThumb()
    }

    updateThumb(e) {
        const bar = this.barRef.current
        if (!bar || this.props.isLive || !this.props.thumbnails || isTouch) {
            return
        }
        const duration = this.state.duration
        if (!duration || !isFinite(duration)) {
            return
        }
        const rect = bar.getBoundingClientRect()
        let ratio = (e.clientX - rect.left) / rect.width
        if (ratio < 0) {
            ratio = 0
        }
        if (ratio > 1) {
            ratio = 1
        }
        const seconds = Math.floor(ratio * duration)
        const x = Math.min(Math.max(ratio * rect.width, 84), Math.max(84, rect.width - 84))

        const setThumb = (url) => {
            this.setState({ thumb: { url, x, time: seconds } })
        }

        const cached = this.thumbCache[seconds]
        if (cached) {
            setThumb(cached)
            this.lastThumbSecond = seconds
            return
        }
        if (seconds === this.lastThumbSecond) {
            return
        }
        this.lastThumbSecond = seconds
        const seq = ++this.thumbSeq
        const url = this.props.thumbnails
            .replace("{time}", seconds / THUMB_INTERVAL + THUMB_START_INDEX)
        const img = new Image()
        img.onload = () => {
            this.thumbCache[seconds] = url
            if (seq === this.thumbSeq) {
                setThumb(url)
            }
        }
        img.src = url
    }

    hideThumb() {
        this.thumbSeq++
        this.lastThumbSecond = -1
        if (this.state.thumb) {
            this.setState({ thumb: null })
        }
    }

    // ------- 音量条 -------

    setVolumeByEvent(e) {
        const el = this.volumeRef.current
        if (!el) {
            return
        }
        const rect = el.getBoundingClientRect()
        let ratio = (e.clientX - rect.left) / rect.width
        if (ratio < 0) {
            ratio = 0
        }
        if (ratio > 1) {
            ratio = 1
        }
        this.setVolume(ratio)
    }

    onVolumeMouseDown(e) {
        this.volumeDragging = true
        this.setVolumeByEvent(e)
        document.addEventListener("mousemove", this.onVolumeDocMove)
        document.addEventListener("mouseup", this.onVolumeDocUp)
    }

    onVolumeMouseMove(e) {
        if (this.volumeDragging || (e.buttons && (e.buttons & 1))) {
            this.setVolumeByEvent(e)
        }
    }

    onVolumeDocMove(e) {
        if (this.volumeDragging) {
            this.setVolumeByEvent(e)
        }
    }

    onVolumeDocUp() {
        this.volumeDragging = false
        document.removeEventListener("mousemove", this.onVolumeDocMove)
        document.removeEventListener("mouseup", this.onVolumeDocUp)
        this.showControls()
    }

    // ------- 画面比例 -------

    applyRatio(ratio) {
        const player = this.frameRef.current
        const video = this.videoRef.current
        if (!player || !video) {
            return
        }
        localStorage.setItem("ratio", ratio)
        switch (ratio) {
            case "自动": {
                video.style["object-fit"] = ""
                Object.assign(player.style, {
                    "margin": "",
                    "height": "",
                    "width": "",
                    "left": "",
                    "right": ""
                })
                break
            }
            case "铺满": {
                video.style["object-fit"] = "fill"
                Object.assign(player.style, {
                    "height": "100%",
                    "width": "100%",
                    "margin": "0 auto"
                })
                break
            }
            case "16:9": {
                video.style["object-fit"] = "fill"
                Object.assign(player.style, {
                    "margin": "0 auto",
                    "left": 0,
                    "right": 0,
                    "height": "100%",
                    "width": player.clientHeight / 9 * 16 + "px"
                })
                break
            }
            case "4:3": {
                video.style["object-fit"] = "fill"
                Object.assign(player.style, {
                    "margin": "0 auto",
                    "left": 0,
                    "right": 0,
                    "height": "100%",
                    "width": player.clientHeight / 3 * 4 + "px"
                })
                break
            }
            case "3:2": {
                video.style["object-fit"] = "fill"
                Object.assign(player.style, {
                    "margin": "0 auto",
                    "left": 0,
                    "right": 0,
                    "height": "100%",
                    "width": player.clientHeight / 2 * 3 + "px"
                })
                break
            }
            default: {
                video.style["object-fit"] = ""
                Object.assign(player.style, {
                    "margin": "",
                    "height": "",
                    "width": "",
                    "left": "",
                    "right": ""
                })
            }
        }
    }

    closeDialog() {
        this.setState({
            isDialogOpen: false
        })
    }

    continuePlayProcess() {
        const video = this.videoRef.current
        if (video && this.savedInfo) {
            try {
                video.currentTime = this.savedInfo.time
            } catch (e) { }
        }
        this.closeDialog()
    }
}

export default withStyles(styles)(Player)

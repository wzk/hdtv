import React from 'react'
import IconButton from '@material-ui/core/IconButton'
import Collapse from '@material-ui/core/Collapse'
import { withStyles } from '@material-ui/core/styles'
import ClickAwayListener from '@material-ui/core/ClickAwayListener'
import MoreVertIcon from '@material-ui/icons/MoreVert'
import panelStyles from "./panelStyles.js"

// 小屏播放页"更多"菜单: 顶栏的选择源/收藏/节目单/屏幕比例收纳为竖排三点按钮,
// 点开弹出入口列表, 选中项通过 onPick 通知 PlayerPage 打开对应面板/动作
// (面板样式与节目源/节目单/屏幕比例完全一致)
const styles = panelStyles

const menuItems = [
    { key: "source", label: "节目源" },
    { key: "favorite", label: "收藏" },
    { key: "videolist", label: "节目单" },
    { key: "ratio", label: "屏幕比例" }
]

class MobileMenuButton extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            isShow: false
        }
        this.toggleList = this.toggleList.bind(this)
        this.closeList = this.closeList.bind(this)
    }

    toggleList() {
        this.setState({ isShow: !this.state.isShow })
    }

    closeList() {
        this.setState({ isShow: false })
    }

    render() {
        const { classes } = this.props
        const last = menuItems.length - 1
        // 已收藏频道显示"取消收藏"
        const itemLabel = (item) => {
            if (item.key === "favorite" && this.props.isFavorite) {
                return "取消收藏"
            }
            return item.label
        }
        return (
            <div className={this.props.className}>
                <IconButton aria-haspopup="true" onClick={this.toggleList}
                    color="inherit">
                    <MoreVertIcon />
                </IconButton>
                <Collapse in={this.state.isShow} timeout="auto"
                    unmountOnExit>
                    <div className={classes.list}>
                        <ClickAwayListener onClickAway={this.closeList}>
                            <div className={classes.panel} id="hp-more-panel">
                                <div className={classes.panelHead}>更多</div>
                                {
                                    menuItems.map((item, index) => {
                                        const cls = index === last
                                            ? classes.itemLast : classes.item
                                        return (
                                            <div key={item.key} className={cls}
                                                onClick={() => {
                                                    this.closeList()
                                                    this.props.onPick(item.key)
                                                }}>
                                                {itemLabel(item)}
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </ClickAwayListener>
                    </div>
                </Collapse>
            </div>
        )
    }
}

export default withStyles(styles)(MobileMenuButton)

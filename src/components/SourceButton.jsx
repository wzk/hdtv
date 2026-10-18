import React from 'react';
import Button from '@material-ui/core/Button';
import Collapse from '@material-ui/core/Collapse';
import { withStyles } from '@material-ui/core/styles';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';
import panelStyles from "./panelStyles.js"
import config from "../../config/config"

// 节目源面板: 与节目单一致(固定右上角、圆角阴影、标题头、行分隔、选中高亮)
const styles = panelStyles

class SourceButton extends React.Component {
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
        const last = this.props.sourceList.length - 1

        return (
            <div>
                <Button
                    aria-haspopup="true"
                    onClick={this.toggleList}
                    color="inherit"
                >
                    {this.props.name}
                </Button>
                <Collapse in={this.state.isShow} timeout="auto"
                    unmountOnExit>
                    <div className={classes.list}>
                        <ClickAwayListener onClickAway={this.closeList}>
                            <div className={classes.panel}>
                                <div className={classes.panelHead}>选择节目源</div>
                                {
                                    this.props.sourceList.map((source, index) => {
                                        const isOn = source.name === this.props.name
                                        const cls = isOn
                                            ? (index === last ? classes.itemOnLast : classes.itemOn)
                                            : (index === last ? classes.itemLast : classes.item)
                                        return (
                                            <div key={source.path} className={cls}
                                                onClick={() => {
                                                    this.closeList()
                                                    this.props.setSource(source.name, source.path,
                                                        config.host + source.thumbnails, index)
                                                }}>
                                                {source.name}
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        </ClickAwayListener>
                    </div>
                </Collapse>
            </div>
        );
    }
}

export default withStyles(styles)(SourceButton)

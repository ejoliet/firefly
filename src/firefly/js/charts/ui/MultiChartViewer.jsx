/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import './ChartPanel.css';

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {isEmpty, isUndefined} from 'lodash';
import {flux} from '../../core/ReduxFlux.js';

import {CloseButton} from '../../ui/CloseButton.jsx';
import {ChartPanel} from './ChartPanel.jsx';
import {MultiItemViewerView} from '../../visualize/ui/MultiItemViewerView.jsx';
import {dispatchAddViewer, dispatchViewerUnmounted, dispatchUpdateCustom,
        getMultiViewRoot, getViewer, getLayoutType, PLOT2D} from '../../visualize/MultiViewCntlr.js';
import {getExpandedChartProps, getChartData} from '../ChartsCntlr.js';
import {LO_VIEW, LO_MODE, dispatchSetLayoutMode} from '../../core/LayoutCntlr.js';

import {MultiChartToolbarStandard, MultiChartToolbarExpanded} from './MultiChartToolbar.jsx';
import {RenderTreeIdCtx} from '../../ui/RenderTreeIdCtx.jsx';

export function getActiveViewerItemId(viewerId, useDefault) {
    const viewer= getViewer(getMultiViewRoot(),viewerId);
    const activeItemId = viewer?.customData?.activeItemId;
    return activeItemId || (useDefault ? viewer?.itemIdAry?.[0] : undefined);
}


function nextState(props, state) {
    const {viewerId}= props;
    const viewer= getViewer(getMultiViewRoot(),viewerId);
    if (viewer!==state.viewer) {
        return {viewer};
    }
    return null;
}

export class MultiChartViewer extends PureComponent {

    constructor(props) {
        super(props);
        this.state= {viewer : getViewer(getMultiViewRoot(), props.viewerId)};
    }

    static getDerivedStateFromProps(props,state) {
        return nextState(props,state);
    }

    componentDidUpdate(prevProps) {
        const {viewerId}= this.props;
        if (prevProps.viewerId!==viewerId) {
            const {renderTreeId}= this.context;
            dispatchAddViewer(viewerId,this.props.canReceiveNewItems,PLOT2D,true,renderTreeId);
            dispatchViewerUnmounted(prevProps.viewerId);
        } else if (this.props.expandedMode && prevProps.expandedMode!==this.props.expandedMode) {
            const {chartId} = getExpandedChartProps();
            dispatchUpdateCustom(viewerId, {activeItemId: chartId});
        }

    }


    componentWillUnmount() {
        this.iAmMounted= false;
        if (this.removeListener) this.removeListener();
        dispatchViewerUnmounted(this.props.viewerId);

    }

    componentDidMount() {
        const {viewerId, canReceiveNewItems, expandedMode}= this.props;
        const {renderTreeId}= this.context;
        dispatchAddViewer(viewerId,canReceiveNewItems,PLOT2D,true, renderTreeId);
        if (expandedMode) {
            const {chartId} = getExpandedChartProps();
            dispatchUpdateCustom(viewerId, {activeItemId: chartId});
        }
        this.iAmMounted= true;
        this.removeListener= flux.addListener(() => this.storeUpdate());
    }


    storeUpdate() {
        const ns= nextState(this.props,this.state);
        if (this.iAmMounted && ns) this.setState(ns);
    }

    render() {
        const {viewerId, expandedMode, closeable, noChartToolbar, label, autoRowOriented=true} = this.props;
        const {viewer}= this.state;
        const layoutType= getLayoutType(getMultiViewRoot(),viewerId);
        if (!viewer || isEmpty(viewer.itemIdAry)) {
            if (expandedMode && closeable) {
                return (
                    <div className='ChartPanel__container'>
                        <div style={{position: 'relative', flexGrow: 1}}>
                        {expandedMode && closeable && <CloseButton style={{paddingLeft: 10, position: 'absolute', top: 0, left: 0}} onClick={() => dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.none)}/>}
                        </div>
                    </div>
                );
            } else {
                return false;
            }
        }
        let activeItemId = getActiveViewerItemId(viewerId);
        if (isUndefined(activeItemId) || !getChartData(activeItemId)) {
            activeItemId = viewer.itemIdAry[0];
        }
        // if there are more than 1 chart in the viewer, they should be deletable by default
        const deletable = viewer.itemIdAry.length > 1;

        const onChartSelect = (ev,chartId) => {
            if (chartId !== activeItemId) {
                dispatchUpdateCustom(viewerId, {activeItemId: chartId});
            }
            stopPropagation(ev);
        };

        const glass = Boolean(noChartToolbar);

        const makeItemViewer = (chartId) => (
            <div className={chartId === activeItemId ? 'ChartPanel ChartPanel--active' : 'ChartPanel'}
                 onClick={(ev)=>onChartSelect(ev,chartId)}
                 onTouchStart={stopPropagation}
                 onMouseDown={stopPropagation}>
                <ChartPanel key={chartId} showToolbar={false} chartId={chartId} deletable={deletable} glass={glass}/>
            </div>
        );

        const makeItemViewerFull = (chartId) => (
            <div onClick={stopPropagation}
                 onTouchStart={stopPropagation}
                 onMouseDown={stopPropagation}>
                <ChartPanel key={chartId} showToolbar={false} chartId={chartId} deletable={deletable} glass={glass}/>
            </div>
        );

        const newProps = {
            viewerItemIds: viewer.itemIdAry,
            activeItemId,
            layoutType,
            makeItemViewer,
            makeItemViewerFull,
            label
        };

        //console.log('Active chart ID: '+activeItemId);

        const ToolBar = expandedMode ? MultiChartToolbarExpanded : MultiChartToolbarStandard;
        const showChartToolbar = !Boolean(noChartToolbar);

        return (
            <div className='ChartPanel__wrapper' style={{width: '100%', height: '100%', boxSizing: 'border-box'}}>
                {showChartToolbar &&
                    <ToolBar chartId={activeItemId} expandable={!expandedMode} {...{
                        expandedMode,
                        closeable,
                        viewerId,
                        layoutType,
                        activeItemId
                    }}/>
                }
                <MultiItemViewerView {...this.props} {...newProps}/>
            </div>
        );
    }
}


const stopPropagation= (ev) => ev.stopPropagation();

MultiChartViewer.contextType= RenderTreeIdCtx;

MultiChartViewer.propTypes= {
    viewerId : PropTypes.string,
    canReceiveNewItems : PropTypes.string,
    forceRowSize : PropTypes.number,
    forceColSize : PropTypes.number,
    gridDefFunc : PropTypes.func,
    insideFlex : PropTypes.bool,
    closeable : PropTypes.bool,
    expandedMode: PropTypes.bool,
    noChartToolbar: PropTypes.bool

};

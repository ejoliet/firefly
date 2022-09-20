/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */


import React, {memo, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import shallowequal from 'shallowequal';
import {isEmpty,omit,isFunction} from 'lodash';
import {getAppOptions} from '../../api/ApiUtil.js';
import {getPlotGroupById}  from '../PlotGroup.js';
import {ExpandType, dispatchChangeActivePlotView} from '../ImagePlotCntlr.js';
import {VisCtxToolbarView, canConvertHipsAndFits} from '../ui/VisCtxToolbarView';
import {VisInlineToolbarView} from '../ui/VisInlineToolbarView.jsx';
import {primePlot, isActivePlotView, getAllDrawLayersForPlot, getPlotViewById} from '../PlotViewUtil.js';
import {ImageViewerLayout}  from '../ImageViewerLayout.jsx';
import {isImage, isHiPS} from '../WebPlot.js';
import {PlotAttribute} from '../PlotAttribute.js';
import {AnnotationOps} from '../WebPlotRequest.js';
import {AREA_SELECT,LINE_SELECT,POINT} from '../../core/ExternalAccessUtils.js';
import {PlotTitle, TitleType} from './PlotTitle.jsx';
import Catalog, {CatalogType} from '../../drawingLayers/Catalog.js';
import LSSTFootprint from '../../drawingLayers/ImageLineBasedFootprint';
import {DataTypes} from '../draw/DrawLayer.js';
import {wrapResizer} from '../../ui/SizeMeConfig.js';
import {getNumFilters} from '../../tables/FilterInfo';
import {ZoomButton, ZoomType} from 'firefly/visualize/ui/ZoomButton.jsx';
import {ToolbarButton} from 'firefly/ui/ToolbarButton.jsx';
import {expand} from 'firefly/visualize/ui/VisMiniToolbar.jsx';

import './ImageViewerDecorate.css';
import OUTLINE_EXPAND from 'images/icons-2014/24x24_ExpandArrowsWhiteOutline.png';

const EMPTY_ARRAY=[];

const briefAnno= [
    AnnotationOps.INLINE_BRIEF,
    AnnotationOps.INLINE_BRIEF_TOOLS,
    AnnotationOps.TITLE_BAR_BRIEF,
    AnnotationOps.TITLE_BAR_BRIEF_TOOLS,
    AnnotationOps.TITLE_BAR_BRIEF_CHECK_BOX
];

const toolsAnno= [
    AnnotationOps.INLINE,
    AnnotationOps.TITLE_BAR,
    AnnotationOps.TITLE_BAR_BRIEF_TOOLS,
    AnnotationOps.INLINE_BRIEF_TOOLS
];


const isCatalogPtData= (dl) => dl.drawLayerTypeId === Catalog.TYPE_ID && dl.catalogType===CatalogType.POINT;


/**
 * todo
 * show the select and filter button show?
 * @param pv
 * @param dlAry
 * @return {boolean}
 */
function showSelect(pv,dlAry) {
    return getAllDrawLayersForPlot(dlAry, pv.plotId,true)
        .some( (dl) => (isCatalogPtData(dl) && (dl.canSelect && !dl.dataTooBigForSelection) ) ||
                        (dl.drawLayerTypeId === LSSTFootprint.TYPE_ID && dl.canSelect) );
}

function showFilter(pv,dlAry) {
    return getAllDrawLayersForPlot(dlAry, pv.plotId,true)
        .some( (dl) => (isCatalogPtData(dl) && dl.canFilter) ||
                       (dl.drawLayerTypeId === LSSTFootprint.TYPE_ID && dl.canFilter) );
}

function showClearFilter(pv,dlAry) {
    return getAllDrawLayersForPlot(dlAry, pv.plotId,true)
        .some( (dl) => {
            const filterCnt= getNumFilters(dl.tableRequest);
            return (isCatalogPtData(dl) &&  filterCnt) ||
                   (dl.drawLayerTypeId === LSSTFootprint.TYPE_ID && filterCnt);
        });
}


/**
 * todo
 * show the unselect button?
 * @param pv
 * @param dlAry
 * @return {boolean}
 */
function showUnselect(pv,dlAry) {
    return getAllDrawLayersForPlot(dlAry, pv.plotId,true)
        .filter( (dl) => {
            return (dl.drawLayerTypeId===Catalog.TYPE_ID && dl.catalog) ||
                   (dl.drawLayerTypeId===LSSTFootprint.TYPE_ID);
        })
        .some( (dl) => {
                  const selectIdxs=dl.drawData[DataTypes.SELECTED_IDXS];
                  const hasIndexes= isFunction(selectIdxs) || !isEmpty(selectIdxs);
                  return (hasIndexes && dl.canSelect);
        });
}


// TEST DATA
//var testExtAry= [
//    {
//        id: 'ext1ID',
//        plotId: pv.plotId,
//        title: 'Ext 1',
//        toolTip: 'tip for ext 1',
//        extType: LINE_SELECT,
//        callback() {console.log('hello ext 1')}
//    },
//    {
//        id: 'ext2ID',
//        plotId: pv.plotId,
//        title: 'Longer Ext 2',
//        toolTip: 'tip for ext 2, and a little longer',
//        extType: LINE_SELECT,
//        callback() {console.log('hello ext 2')}
//    }
//];



function contextToolbar(plotView,dlAry,extensionList, width) {
    const plot= primePlot(plotView);
    if (!plot) return;

    const showMultiImageController= isImage(plot) ? plotView.plots.length>1 : plot.cubeDepth>1;
    const hipsFits= canConvertHipsAndFits(plotView);

    if (plot.attributes[PlotAttribute.SELECTION]) {
        const select= showSelect(plotView,dlAry);
        const unselect= showUnselect(plotView,dlAry);
        const filter= showFilter(plotView,dlAry);
        const clearFilter= showClearFilter(plotView,dlAry);
        const selAry= extensionList.filter( (ext) => ext.extType===AREA_SELECT);
        const extensionAry= isEmpty(selAry) ? EMPTY_ARRAY : selAry;
        const searchActions= getAppOptions()?.searchActions;
        return (
            <VisCtxToolbarView {...{plotView, extensionAry, width,
                showSelectionTools:true, showCatSelect:select, showCatUnSelect:unselect, searchActions,
                showFilter:filter, showClearFilter:clearFilter, showMultiImageController}} />
        );
    }
    else if (plot.attributes[PlotAttribute.ACTIVE_DISTANCE]) {
        const distAry= extensionList.filter( (ext) => ext.extType===LINE_SELECT);
        if (!distAry.length && !showMultiImageController && !hipsFits) return;
        return (
                <VisCtxToolbarView {...{plotView, extensionAry:isEmpty(distAry)?EMPTY_ARRAY:distAry,
                    width, showMultiImageController}}/>
        );
    }
    else if (plot.attributes[PlotAttribute.ACTIVE_POINT]) {
        const ptAry= extensionList.filter( (ext) => ext.extType===POINT);
        if (!ptAry.length && !showMultiImageController && !hipsFits) return;
        return (
                <VisCtxToolbarView {...{plotView, extensionAry:isEmpty(ptAry)?EMPTY_ARRAY:ptAry, width,
                    showMultiImageController}}/>
        );
    }
    else if (showUnselect(plotView, dlAry)) {
        return (
               <VisCtxToolbarView {...{plotView, extensionAry:EMPTY_ARRAY, width,
                       showCatUnSelect:true, showClearFilter:showClearFilter(plotView,dlAry),
                       showMultiImageController}} />
        );
    }
    else if (showClearFilter(plotView,dlAry)) {
        return (
                <VisCtxToolbarView {...{plotView, extensionAry:EMPTY_ARRAY,  width,
                    showClearFilter:true, showMultiImageController}} />
        );
    }
    else if (showMultiImageController || hipsFits || isHiPS(plot)) {
        return ( <VisCtxToolbarView {...{plotView, extensionAry:EMPTY_ARRAY, showMultiImageController, width}}/> );
    }
}


function getBorderColor(pv,visRoot) {
    if (!pv && !pv.plotId) return 'rgba(0,0,0,.4)';
    if (isActivePlotView(visRoot,pv.plotId)) return 'orange';
    const group= getPlotGroupById(visRoot,pv.plotGroupId);
    // if (group && group.overlayColorLock) return 'rgba(0, 93, 164, .2)';
    if (group && group.overlayColorLock) return 'rgba(0, 0, 0, .1)';
    else return 'rgba(0,0,0,.2)';
}



//===========================================================================
//---------- React Components -----------------------------------------------
//===========================================================================

const omitList= ['mousePlotId', 'size'];

function arePropsEquals(props, np) {
    if (props.size.width!==np.size.width || props.size.height!==np.size.height) return false;
    if (!shallowequal(omit(np,omitList), omit(props,omitList))) return false;
    // if (props.mousePlotId!==np.mousePlotId && (props.mousePlotId===plotId || np.mousePlotId===plotId)) return false;
    if (props.mousePlotId!==np.mousePlotId) return false;
    if (props.plotId!==np.plotId) return false;
    return true;
} //todo: look at closely for optimization


function ZoomGroup({visRoot, pv, show}) {

    const {showImageToolbar=true}= pv?.plotViewCtx.menuItemKeys ?? {};
    const manageExpand= !showImageToolbar && visRoot.expandedMode===ExpandType.COLLAPSE;

    return (
        primePlot(pv) ? <div
            style={{
                visibility: show ? 'visible' : 'hidden',
                opacity: show ? 1 : 0,
                transition: show ? 'opacity .15s linear' : 'visibility 0s .15s, opacity .15s linear',
                background:'rgba(227, 227, 227, .8)',
                display:'inline-flex',
                borderRadius:'0 0 5px ',
                position: 'relative',
                flexDirection: 'row',
                alignSelf: 'flex-start',
                }}>

            {manageExpand && <ToolbarButton icon={OUTLINE_EXPAND}
                                            tip='Expand this panel to take up a larger area'
                                            horizontal={true} onClick={() =>expand(pv?.plotId, false)}/>}
            
            <div style={{display:'flex', alignSelf: 'flex-start'}}>
                <ZoomButton size={20} plotView={pv} zoomType={ZoomType.UP} horizontal={true}/>
                <ZoomButton size={20} plotView={pv} zoomType={ZoomType.DOWN} horizontal={true}/>
            </div>
            <div style={{display:'flex', alignSelf: 'flex-start'}}>
                <ZoomButton size={20} plotView={pv} zoomType={ZoomType.FIT} horizontal={true}/>
                <ZoomButton size={20} plotView={pv} zoomType={ZoomType.FILL} horizontal={true}/>
            </div>
        </div> : <div/>
    );
    
}

const ImageViewerDecorate= memo((props) => {
    const {plotView:pv,drawLayersAry,extensionList,visRoot,mousePlotId, workingIcon,
        size:{width,height}, inlineTitle=true, aboveTitle= false }= props;

    const [showDelAnyway, setShowSelAnyway]= useState(false);

    useEffect(() => {
        const mousePlotIdExist= Boolean(getPlotViewById(visRoot,mousePlotId));
        if (mousePlotIdExist) {
            setShowSelAnyway(false);
            return;
        }
        setShowSelAnyway(true);
        const id= setTimeout(() => setShowSelAnyway(false), 5000);
        return () => clearTimeout(id);
    },[mousePlotId]);

    const showDelete= pv.plotViewCtx.userCanDeletePlots;
    const ctxToolbar= contextToolbar(pv,drawLayersAry,extensionList,width);
    // const topOffset= ctxToolbar?32:0;
    // const top= ctxToolbar?32:0;
    const expandedToSingle= (visRoot.expandedMode===ExpandType.SINGLE);
    const plot= primePlot(pv);
    const iWidth= Math.max(expandedToSingle ? width : width-4,0);
    const iHeight=Math.max(expandedToSingle ? height :height-5,0);

    const brief= briefAnno.includes(pv.plotViewCtx.annotationOps);
    const titleLineHeaderUI= (plot && aboveTitle) ?
                <PlotTitle brief={brief} titleType={TitleType.HEAD} plotView={pv} /> : undefined;

    const outerStyle= { width: '100%', height: '100%', overflow:'hidden', position:'relative'};

    const innerStyle= {
        width:'calc(100% - 4px)',
        bottom: 0,
        top: titleLineHeaderUI ? 20 : 0,
        overflow: 'hidden',
        position: 'absolute',
        borderStyle: 'solid',
        borderWidth: expandedToSingle ? '0 0 0 0' : '3px 2px 2px 2px',
        borderColor: getBorderColor(pv,visRoot)
    };

    if (titleLineHeaderUI) {
        outerStyle.boxShadow= 'inset 0 0 3px #000';
        outerStyle.padding= '3px';
        outerStyle.width='calc(100% - 6px)';
        outerStyle.height='calc(100% - 6px)';
        innerStyle.bottom= 2;
        innerStyle.width= 'calc(100% - 10px)';
    }

    const makeActive= () => pv?.plotId && dispatchChangeActivePlotView(pv.plotId);
    const showZoom= mousePlotId===pv?.plotId;
    const showDel= showDelAnyway || mousePlotId===pv?.plotId || !plot || pv.nonRecoverableFail;

    return (
        <div style={outerStyle} className='disable-select' onTouchStart={makeActive} onClick={makeActive} >
            {titleLineHeaderUI}
            <div className='image-viewer-decorate' style={innerStyle}>
                <div style={{position: 'absolute', width:'100%', top:0, bottom:0, display:'flex', flexDirection:'column'}}>
                    <ImageViewerLayout plotView={pv} drawLayersAry={drawLayersAry}
                                       width={iWidth} height={iHeight}
                                       externalWidth={width} externalHeight={height}/>
                    {ctxToolbar}
                    {(plot && inlineTitle) ?
                        <PlotTitle brief={brief} titleType={TitleType.INLINE} plotView={pv}
                                   working={workingIcon} /> : undefined}
                    <ZoomGroup visRoot={visRoot} pv={pv} show={showZoom} />
                </div>
                <VisInlineToolbarView pv={pv} showDelete={showDelete} show={showDel}/>
            </div>
        </div>
        );

}, arePropsEquals);


ImageViewerDecorate.propTypes= {
    plotView : PropTypes.object.isRequired,
    drawLayersAry: PropTypes.array.isRequired,
    visRoot: PropTypes.object.isRequired,
    extensionList : PropTypes.array.isRequired,
    mousePlotId : PropTypes.string,
    size : PropTypes.object.isRequired,
    workingIcon: PropTypes.bool,
    inlineTitle: PropTypes.bool,
    aboveTitle: PropTypes.bool
};

export const ImageViewerView= wrapResizer(ImageViewerDecorate);

/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import PropTypes from 'prop-types';
import {isEmpty} from 'lodash';

import {ImageExpandedMode} from '../iv/ImageExpandedMode.jsx';
import {Tab, Tabs} from '../../ui/panel/TabPanel.jsx';
import {MultiViewStandardToolbar} from './MultiViewStandardToolbar.jsx';
import {MultiImageViewer} from './MultiImageViewer.jsx';
import {dispatchAddActionWatcher} from '../../core/MasterSaga.js';
import {DEFAULT_FITS_VIEWER_ID, REPLACE_VIEWER_ITEMS, NewPlotMode, getViewerItemIds, getMultiViewRoot,
        META_VIEWER_ID} from '../MultiViewCntlr.js';
import {getTblById, findGroupByTblId, getTblIdsByGroup, smartMerge} from '../../tables/TableUtil.js';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode, dispatchUpdateLayoutInfo, getLayouInfo} from '../../core/LayoutCntlr.js';
import ImagePlotCntlr, {visRoot} from '../../visualize/ImagePlotCntlr.js';
import {TABLE_HIGHLIGHT, TABLE_LOADED, TBL_RESULTS_ACTIVE, TBL_RESULTS_ADDED} from '../../tables/TablesCntlr.js';
import {REINIT_APP} from '../../core/AppDataCntlr.js';
import {hasCoverageData, isCatalog, isDataProductsTable} from '../../util/VOAnalyzer.js';
import {MetaDataMultiProductViewer} from './MetaDataMultiProductViewer';
import {CoverageViewer} from './CoveraeViewer';
import {isOrbitalPathTable} from '../../util/VOAnalyzer';
import {getPlotViewAry} from 'firefly/visualize/PlotViewUtil.js';


/**
 * This component works with ImageMetaDataWatch sega which should be launch during initialization
 * @param p
 * @param p.showCoverage
 * @param p.showFits
 * @param p.style
 * @param p.showMeta
 * @param p.selectedTab
 * @param p.imageExpandedMode if true, then imageExpandedMode overrides everything else
 * @param p.closeable expanded mode should have a close button
 * @param p.dataProductTableId
 * @constructor
 */
export function TriViewImageSection({showCoverage=false, showFits=false, selectedTab='fits',
                                     showMeta=false, imageExpandedMode=false, closeable=true,
                                     dataProductTableId, style={}}) {

    if (imageExpandedMode) {
        return  ( <ImageExpandedMode key='results-plots-expanded' closeFunc={closeable ? closeExpanded : null}/> );
    }
    const onTabSelect = (idx, id) => dispatchUpdateLayoutInfo({images:{selectedTab:id}});
    const table= getTblById(dataProductTableId);
    const title= table?.tableMeta?.title || table?.title || '';
    const metaTitle= `Data Product${title?': ' : ''}${title}`;

    if (showCoverage || showFits || showMeta) {
        return (
            <Tabs style={{height: '100%', ...style}} onTabSelect={onTabSelect} defaultSelected={selectedTab} useFlex={true} resizable={true}>
                { showFits &&
                    <Tab name='Images' removable={false} id='fits'>
                        <MultiImageViewer viewerId= {DEFAULT_FITS_VIEWER_ID} insideFlex={true}
                                          canReceiveNewPlots={NewPlotMode.create_replace.key}
                                          Toolbar={MultiViewStandardToolbar}/>
                    </Tab>
                }
                { showMeta &&
                    <Tab name={metaTitle} removable={false} id='meta'>
                        <MetaDataMultiProductViewer dataProductTableId={dataProductTableId} enableExtraction={true}/>
                    </Tab>
                }
                { showCoverage &&
                    <Tab name='Coverage' removable={false} id='coverage'>
                        <CoverageViewer/>
                    </Tab>
                }
            </Tabs>
        );

    }
    else {
        return <div/>;
    }
}


TriViewImageSection.propTypes= {
    showCoverage : PropTypes.bool,
    showFits : PropTypes.bool,
    showMeta : PropTypes.bool,
    imageExpandedMode : PropTypes.bool,
    closeable: PropTypes.bool,
    dataProductTableId: PropTypes.string,
    chartMetaId: PropTypes.string,
    selectedTab: PropTypes.oneOf(['fits', 'meta', 'coverage']),
    style: PropTypes.object
};

export function launchTableTypeWatchers() {
    startLayoutWatcher();
}

function startLayoutWatcher() {
    const actions = [
        ImagePlotCntlr.PLOT_IMAGE_START, ImagePlotCntlr.PLOT_IMAGE, ImagePlotCntlr.PLOT_HIPS,
        ImagePlotCntlr.DELETE_PLOT_VIEW, REPLACE_VIEWER_ITEMS,TABLE_HIGHLIGHT,
        TBL_RESULTS_ACTIVE, TABLE_LOADED, TBL_RESULTS_ADDED,
        REINIT_APP
    ];
    dispatchAddActionWatcher({id: 'layoutHandler', actions, callback: layoutHandler});
}


/**
 * Action watcher callback: manages layout info related to this component.
 * @callback actionWatcherCallback
 * @param action
 * @param cancelSelf
 */
function layoutHandler(action, cancelSelf) {

    /**
     * This is the current state of the layout store.  Action handlers should return newLayoutInfo if state changes
     * If state has changed, it will be dispatched into the flux.
     * @type {LayoutInfo}
     * @prop {Object}   layoutInfo.images      images specific states
     * @prop {string}   layoutInfo.images.metaTableId  tbl_id of the image meta table
     * @prop {string}   layoutInfo.images.selectedTab  selected tab of the images tabpanel
     * @prop {string}   layoutInfo.images.showCoverage  show images coverage tab
     * @prop {string}   layoutInfo.images.showFits  show images fits data tab
     * @prop {string}   layoutInfo.images.showMeta  show images image metea tab
     */
    const layoutInfo = getLayouInfo();
    let newLayoutInfo = layoutInfo;

    switch (action.type) {
        case ImagePlotCntlr.PLOT_IMAGE_START:
        case ImagePlotCntlr.PLOT_IMAGE :
        case ImagePlotCntlr.PLOT_HIPS:
        case REPLACE_VIEWER_ITEMS:
            newLayoutInfo = onNewImage(newLayoutInfo, action);
            break;
        case ImagePlotCntlr.DELETE_PLOT_VIEW:
            newLayoutInfo = onPlotDelete(newLayoutInfo, action);
            break;
        case TABLE_LOADED:
            if (action.payload.tbl_id) {
                newLayoutInfo = handleNewTable(newLayoutInfo, action);
            }
            break;
        case TBL_RESULTS_ADDED:
            if (action.payload.options.tbl_group==='main') {
                newLayoutInfo = handleNewTable(newLayoutInfo, action);
            }
            break;
        case TBL_RESULTS_ACTIVE:
            if (action.payload.tbl_group==='main') {
                newLayoutInfo = onActiveTable(newLayoutInfo, action);
            }
            break;
        case TABLE_HIGHLIGHT:
            if (action.payload.tbl_group==='main') {
                newLayoutInfo = onActiveTable(newLayoutInfo, action);
            }
            break;
        case REINIT_APP:
            cancelSelf();
            break;
    }

    if (newLayoutInfo !== layoutInfo) {
        dispatchUpdateLayoutInfo(newLayoutInfo);
    }
}


/*-----------------------------------------------------------------------------------------*/



function closeExpanded() {
    dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.none);
}
const hasCoverageTable= (tblList) => tblList.some( (id) => hasCoverageData(id) );
const hasOrbitalPathTable= (tblList) => tblList.some( (id) => isOrbitalPathTable(id) );
const hasDataProductsTable= (tblList) => tblList.some( (id) => isDataProductsTable(id) );
const findFirstDataProductsTable= (tblList) => tblList.find( (id) => isDataProductsTable(id) );
const shouldShowFits= () => !isEmpty(getViewerItemIds(getMultiViewRoot(), DEFAULT_FITS_VIEWER_ID));

function handleNewTable(layoutInfo, action) {
    const {tbl_id} = action.payload;
    const {images={}, showTables}  = layoutInfo;
    let {showImages} = layoutInfo;
    let {showFits, showMeta, showCoverage, selectedTab, dataProductTableId} = images;
    const isMeta = isDataProductsTable(tbl_id);


    if ((isMeta || hasCoverageData(tbl_id)|| isOrbitalPathTable(tbl_id) || isCatalog(tbl_id)) && showTables ) {
        if (!showFits) selectedTab = 'coverage';
        showFits= showFits || shouldShowFits();
        showCoverage = true;
        showImages = true;
    }
    if (isMeta && showTables) {
        showImages = true;
        selectedTab = 'meta';
        showMeta = true;
        dataProductTableId = tbl_id;
    }
    return smartMerge(layoutInfo, {showTables: true, showImages, images: {showFits, showMeta, showCoverage, selectedTab, dataProductTableId}});
}

function onActiveTable (layoutInfo, action) {
    const {tbl_id} = action.payload;
    let {images={}} = layoutInfo;
    let {showCoverage, showMeta, dataProductTableId} = images;

    const showFits= shouldShowFits();
    let showImages= showFits;

    if (!tbl_id) {
        images = {showMeta: false, showCoverage: false, showFits, dataProductTableId: null};
        return smartMerge(layoutInfo, {images, showImages:showFits});
    }

    const tblGroup= findGroupByTblId(tbl_id);
    if (!tblGroup) return smartMerge(layoutInfo, {showImages});

    const tblList= getTblIdsByGroup(tblGroup);
    if (isEmpty(tblList)) return smartMerge(layoutInfo, {showImages});

    // check for catalog or meta images
    const anyHasCoverage= hasCoverageTable(tblList);
    const hasOrbitalPath=  hasOrbitalPathTable(tblList);
    const anyHasMeta= hasDataProductsTable(tblList);

    if (anyHasCoverage || anyHasMeta || hasOrbitalPath) {
        showCoverage = true;
        showImages = true;
    } else {
        showCoverage = false;
        showImages= showFits;
    }
    if (anyHasMeta) {
        dataProductTableId = isDataProductsTable(tbl_id) ? tbl_id : findFirstDataProductsTable(tblList);
        showMeta = true;
        showImages = true;
    } else {
        dataProductTableId = null;
        showMeta = false;
    }
    return smartMerge(layoutInfo, {images: {showCoverage, showMeta, dataProductTableId}, showImages});
}

function onPlotDelete(layoutInfo, action) {
    const {images={}}  = layoutInfo;
    let {showImages} = layoutInfo;
    const {dataProductTableId} = images;
    const showFits = shouldShowFits();
    if (!visRoot().plotViewAry?.length) {
        showImages= Boolean(dataProductTableId);
    }
    return smartMerge(layoutInfo, {showImages, images:{showFits}});
}

function onNewImage(layoutInfo, action) {
    const {images={}} = layoutInfo;
    let {selectedTab, showMeta, showFits} = images;

    const showImages= getPlotViewAry(visRoot()).some( (pv) => pv.plotViewCtx.useForSearchResults);
    if (!showImages) return layoutInfo;

    const {viewerId} = action.payload || {};
    if (viewerId === META_VIEWER_ID) {
        // select meta tab when new images are added to meta image group.
        selectedTab = 'meta';
        showMeta = true;
    } else if (viewerId === DEFAULT_FITS_VIEWER_ID) {
        // select fits tab when new images are added to default group.
        selectedTab = 'fits';
        showFits = true;
    }


    return smartMerge(layoutInfo, {showImages:true, images: {selectedTab, showMeta, showFits}});
}

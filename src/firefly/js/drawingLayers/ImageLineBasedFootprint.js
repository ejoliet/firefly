/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import {get, set, has, isEmpty, isString,  isUndefined} from 'lodash';
import {makeDrawingDef, TextLocation, Style} from '../visualize/draw/DrawingDef.js';
import DrawLayer, {DataTypes, ColorChangeType}  from '../visualize/draw/DrawLayer.js';
import {makeFactoryDef} from '../visualize/draw/DrawLayerFactory.js';
import {primePlot, getAllDrawLayersForPlot} from '../visualize/PlotViewUtil.js';
import DrawLayerCntlr, {RegionSelStyle, RegionSelColor, dlRoot, dispatchSelectRegion, dispatchModifyCustomField}
                                                                     from '../visualize/DrawLayerCntlr.js';
import {clone} from '../util/WebUtil.js';
import {MouseState} from '../visualize/VisMouseSync.js';
import {convertConnectedObjsToDrawObjs, getImageCoordsOnFootprint, drawHighlightFootprintObj,
        drawSelectFootprintObj} from '../visualize/draw/ImageLineBasedObj.js';
import {getUIComponent} from './ImageLineFootPrintUI.jsx';
import {rateOpacity} from '../util/Color.js';
import {visRoot} from '../visualize/ImagePlotCntlr.js';
import CsysConverter from '../visualize/CsysConverter.js';
import {DrawSymbol} from '../visualize/draw/PointDataObj.js';
import {dispatchTableHighlight,  dispatchTableSelect, dispatchTableFilter} from '../tables/TablesCntlr.js';
import {findIndex, getTblById, getCellValue} from '../tables/TableUtil.js';
import {PlotAttribute} from '../visualize/WebPlot.js';
import {getSelectedShape} from './Catalog.js';
import {getSelectedPts} from '../visualize/VisUtil.js';
import {SelectInfo} from '../tables/SelectInfo.js';
import {detachSelectArea} from '../visualize/ui/SelectAreaDropDownView.jsx';
import {FilterInfo} from '../tables/FilterInfo.js';

const ID= 'ImageLineBasedFP_PLOT';
const TYPE_ID= 'ImageLineBasedFP_PLOT_TYPE';
const factoryDef= makeFactoryDef(TYPE_ID, creator, getDrawData, getLayerChanges, null, getUIComponent, null);
export default {factoryDef, TYPE_ID};

let idCnt=0;
const colorList = ['rgba(74, 144, 226, 1.0)', 'blue', 'cyan', 'green', 'magenta', 'orange', 'lime', 'red',  'yellow'];
const colorN = colorList.length;


/**
 * create region plot layer
 * @param initPayload moc_nuniq_nums, highlightedCell, selectMode
 * @return {DrawLayer}
 */
function creator(initPayload) {

    const {selectInfo, highlightedRow, tbl_id, tableRequest} = initPayload;
    const drawingDef= makeDrawingDef(get(initPayload, 'color', colorList[idCnt%colorN]),
                                     {style: get(initPayload, 'style', Style.FILL),
                                      showText: get(initPayload, 'showText', false),
                                      canUseOptimization: true,
                                      textLoc: TextLocation.CENTER,
                                      selectedColor: 'yellow',
                                      size: 3,
                                      symbol: DrawSymbol.X});

    set(drawingDef, RegionSelStyle, 'SolidReplace');
    set(drawingDef, RegionSelColor, 'orange');
    const pairs = {
        [MouseState.DOWN.key]: highlightChange
    };

    idCnt++;
    const options= {
        canUseMouse:true,
        canHighlight:true,
        canFilter: true,
        canSelect: true,
        canUserChangeColor: ColorChangeType.DYNAMIC,
        hasPerPlotData: true,
        destroyWhenAllDetached: true,
        isPointData:true
    };

    const actionTypes = [DrawLayerCntlr.REGION_SELECT];

    const id = get(initPayload, 'drawLayerId', `${ID}-${idCnt}`);
    const dl = DrawLayer.makeDrawLayer( id, TYPE_ID, get(initPayload, 'title', 'Lsst footprint '+id),
                                        options, drawingDef, actionTypes, pairs);

    dl.imageLineBasedFP = get(initPayload, 'imageLineBasedFP') || {};
    Object.assign(dl, {selectInfo, highlightedRow, tbl_id, tableRequest});
    dl.selectRowIdxs = {};   // map: row_idx / row_num
    return dl;
}

/**
 * find the drawObj which is selected for highlight
 * @param mouseStatePayload
 * @returns {Function}
 */
function highlightChange(mouseStatePayload) {
    const {drawLayer,plotId,screenPt} = mouseStatePayload;
    var done = false;
    var closestInfo = null;
    var closestObj = null;
    const maxChunk = 1000;

    const {connectedObjs, pixelSys} = get(drawLayer, 'imageLineBasedFP') || {};
    const plot = primePlot(visRoot(), plotId);
    const cc = CsysConverter.make(plot);
    const tPt = getImageCoordsOnFootprint(screenPt, cc, pixelSys);
    const {tableRequest} = drawLayer;

    function* getDrawObj() {
        let index = 0;

        while (index < connectedObjs.length) {
            yield connectedObjs[index++];
        }
    }
    var gen = getDrawObj();

    const sId = window.setInterval( () => {
        if (done) {
            window.clearInterval(sId);

            // set the highlight region on current drawLayer,
            // unset the highlight on other drawLayer if a highlight is found for current layer

            dlRoot().drawLayerAry.forEach( (dl) => {
                if (dl.drawLayerId === drawLayer.drawLayerId) {
                    if (drawLayer.tbl_id) {
                        if (closestObj) {
                            findIndex(drawLayer.tbl_id, `ROW_IDX = ${closestObj.tableRowIdx}`).then((highlightedRow) => {
                                    if (highlightedRow >= 0) {
                                        dispatchTableHighlight(drawLayer.tbl_id, highlightedRow, tableRequest);
                                    }
                                });
                        }
                    } else {
                        dispatchSelectRegion(dl.drawLayerId, closestObj);
                    }
                } else if (closestObj) {
                    if (!drawLayer.tbl_id) {
                        dispatchSelectRegion(dl.drawLayerId, null);
                    }
                }
            });
        }

        for (let i = 0; i < maxChunk; i++ ) {
            var dObj = gen.next().value;

            if (dObj) {
                const distInfo = dObj.connectObj.containPoint(tPt);

                if (distInfo.inside) {
                    if (!closestInfo || closestInfo.dist > distInfo.dist) {
                        closestInfo = distInfo;
                        closestObj = dObj;
                    }
                }
            } else {
                done = true;
                break;
            }
        }
    }, 0);

    return () => window.clearInterval(sId);
}

function getTitle(dl, pIdAry) {
    const {drawLayerId, title} = dl;

    const tObj = isString(title) ? {} : Object.assign({}, title);
    const mTitle = 'lsst footprint ' + drawLayerId;
    pIdAry.forEach((pId) => tObj[pId] = mTitle);

    return tObj;
}


/**
 * state update on the drawlayer change
 * @param drawLayer
 * @param action
 * @returns {*}
 */
function getLayerChanges(drawLayer, action) {
    const {drawLayerId, plotId, plotIdAry} = action.payload;
    if (drawLayerId && drawLayerId !== drawLayer.drawLayerId) return null;

    const dd = Object.assign({}, drawLayer.drawData);

    switch (action.type) {
        case DrawLayerCntlr.ATTACH_LAYER_TO_PLOT:
            if (!plotIdAry && !plotId) return null;

            const pIdAry = plotIdAry ? plotIdAry :[plotId];
            const tObj = getTitle(drawLayer, pIdAry);

            return {title: tObj};

        case DrawLayerCntlr.MODIFY_CUSTOM_FIELD:
            const {changes} = action.payload;
            const {fillStyle, selectInfo, highlightedRow, selectRowIdxs,
                   tableRequest, tableData, imageLineBasedFP} = changes;
            const pId = plotId ? plotId : (plotIdAry ? plotIdAry[0]: null);

            if (!pId) return null;

            if (fillStyle) {
                const style = fillStyle.includes('outline') ? Style.STANDARD : Style.FILL;
                const showText = fillStyle.includes('text');
                const drawingDef = clone(drawLayer.drawingDef, {style, showText});

                set(dd, [DataTypes.DATA, pId], null);
                return Object.assign({}, {drawingDef, drawData: dd});
            }

            const changesUpdate = {};

            if (tableData) {    // from watcher on TABLE_LOADED
                set(dd, [DataTypes.DATA, pId], null);
            }

            set(dd, [DataTypes.HIGHLIGHT_DATA, pId], null);

            if (imageLineBasedFP) {
                Object.assign(changesUpdate, {imageLineBasedFP});
            }

            if (selectInfo && !tableData) {   // from dispatch TableSelect, watcher on TABLE_SELECT or TABLE_LOADED
                if (tableData) {
                    Object.assign(changesUpdate, {selectRowIdxs: {}});
                } else {
                    const crtRowIdxs = updateSelectRowIdx(drawLayer, selectInfo);
                    Object.assign(changesUpdate, {selectRowIdxs: crtRowIdxs});
                }
                Object.assign(changesUpdate, {selectInfo});
            }

            if (tableRequest) {  // from watcher TABLE_LOADED
                Object.assign(changesUpdate, {tableRequest});
            }

            if (!isUndefined(highlightedRow)) {  // from watcher TABLE_UPDATE, TABLE_HIGHLIGHT, TABLE_LOADED
                Object.assign(changesUpdate, {highlightedRow});
            }

            if (!isUndefined(selectRowIdxs)) {   // from selectFootprint
                Object.assign(changesUpdate, {selectRowIdxs});
            }

            return Object.assign({}, changesUpdate, {drawData: dd});

        case DrawLayerCntlr.REGION_SELECT:
            const {selectedRegion} = action.payload;
            let   hideFPId = '';

            Object.keys(dd[DataTypes.HIGHLIGHT_DATA]).forEach((plotId) => {   // reset all highlight
                set(dd[DataTypes.HIGHLIGHT_DATA], plotId, null);              // deHighlight previous selected one
            });


            if (selectedRegion) {
                if (has(drawLayer, 'selectMode.selectStyle') && drawLayer.selectMode.selectStyle.includes('Replace')) {
                    hideFPId = selectedRegion.id;

                    Object.keys(dd[DataTypes.DATA]).forEach((plotId) => {
                        set(dd[DataTypes.DATA], plotId, null);               // will update data objs
                    });
                }
            }

            return Object.assign({}, {highlightedFootprint: selectedRegion, drawData: dd, hideFPId});
        default:
            return null;
    }
}

function updateSelectRowIdx(drawLayer, selectInfo) {
    const {tbl_id, selectRowIdxs} = drawLayer;
    const selectInfoCls = SelectInfo.newInstance(selectInfo);
    const selected = selectInfoCls.getSelected();
    const tbl = getTblById(tbl_id);
    const dataRows = get(tbl, ['tableData', 'data', 'length'], 0);

    // remove de-select row
    const newRowIdxs = Object.keys(selectRowIdxs).reduce((prev, rowIdx) => {
          const row_num = selectRowIdxs[rowIdx];
          if (Number(row_num) >= dataRows || Number(row_num) < 0 || selected.has(Number(row_num))) {
              prev[rowIdx] = row_num;
          }
          return prev;
    }, {});

    // add select row
    selected.forEach((rownum) => {
        const row_idx = getCellValue(tbl, rownum, 'ROW_IDX');
        if (!has(newRowIdxs, row_idx)) {
            newRowIdxs[row_idx] = `${rownum}`;
        }
    });

    return newRowIdxs;
}

function getDrawData(dataType, plotId, drawLayer, action, lastDataRet) {
    const {highlightedFootprint, drawingDef, tbl_id} = drawLayer;

    switch (dataType) {
        case DataTypes.DATA:    // based on the same drawObjAry to draw the region on each plot
            return isEmpty(lastDataRet) ? plotLayer(drawLayer) : lastDataRet;
        case DataTypes.HIGHLIGHT_DATA:      // create the region drawObj based on the original region for upright case.
            if (!tbl_id) {
                return isEmpty(lastDataRet) ? plotHighlightRegion(drawLayer, highlightedFootprint, plotId, drawingDef) : lastDataRet;
            } else {
                return isEmpty(lastDataRet) ? plotSelectFootprint(drawLayer, plotId, drawingDef) : lastDataRet;
            }
            break;
        /*
        case DataTypes.SELECTED_IDXS:
            if (!drawLayer.imageLineBasedFP) return null;
            if (action.type ===  DrawLayerCntlr.MODIFY_CUSTOM_FIELD && changes && changes.selectInfo) {
                return isEmpty(lastDataRet) ? computeSelectedIdxAry(drawLayer) : lastDataRet;
            }
        */
    }
    return null;
}

/*
function computeSelectedIdxAry(dl) {
    const {selectInfo, selectRowIdxs} = dl;
    if (!selectInfo) return null;

    const si = SelectInfo.newInstance(selectInfo);
    if (!si.getSelectedCount()) return null;

    const data = get(dl, ['drawData', 'data']);
    const pId =  data && Object.keys(data).find((pId) => data[pId]);
    const footprintObjs = pId ? data[pId] : null;

    const isSelected =  (idx) => {
        return footprintObjs && selectRowIdxs && selectRowIdxs.includes(footprintObjs[idx].tableRowIdx);
    };
    return isSelected;
}
*/


function getTableData(drawLayer) {
    const {tbl_id} = drawLayer || {};
    if (!tbl_id) return null;

    const tbl = getTblById(tbl_id);
    return tbl.tableData;
}
/**
 * create DrawingObj for highlighted row
 * @param drawLayer
 * @param highlightedRow
 * @param plotId
 * @param drawingDef
 */
function plotHighlightedRow(drawLayer, highlightedRow, plotId, drawingDef) {
    const tableData = getTableData(drawLayer);

    if (!tableData || !tableData.data || !tableData.columns) return null;

    const {columns} = tableData;
    const d = tableData.data[highlightedRow];
    if (!d) return null;


    const colIdx = columns.findIndex((c) => {
        return (c.name === 'id');
    });

    if (colIdx < 0) return null;

    const id = d[colIdx];
    const {connectedObjs} = get(drawLayer, 'imageLineBasedFP') || {};
    if (connectedObjs) {
        const footprintHighlight = connectedObjs.find((oneFootprintObj) => {
            return oneFootprintObj.id === id;
        });

        return plotHighlightRegion(drawLayer, footprintHighlight, plotId, drawingDef);
    } else {
        return null;
    }
}

/**
 *
 * @param drawLayer
 * @param plotId
 * @param drawingDef
 * @returns {*}
 */
function plotSelectFootprint(drawLayer, plotId, drawingDef) {
    //const tableData = getTableData(drawLayer);

    const {highlightedRow, selectRowIdxs} = drawLayer;

    const highlightedObjs = isUndefined(highlightedRow) ? null : plotHighlightedRow(drawLayer, highlightedRow, plotId, drawingDef);

    if (isEmpty(selectRowIdxs)) {
        return highlightedObjs;
    }
    const {connectedObjs=[]} = drawLayer.imageLineBasedFP || {};
    const selRowIdxs = Object.keys(selectRowIdxs);
    const selectedCObjs = connectedObjs.filter((cobj) => selRowIdxs.includes(cobj.tableRowIdx));

    if (selectedCObjs.length === 0) {
        return highlightedObjs;
    }

    //let polySels, pointSels;
    const plot = primePlot(visRoot(), plotId);
    const selDrawDef= Object.assign({}, drawingDef, {selectColor:drawingDef.selectedColor});

    const selDrawObjs = selectedCObjs.reduce((prev, cobj) => {
        const selObjs = drawSelectFootprintObj(cobj, plot, selDrawDef);

        prev.push(...selObjs);
        return prev;
    }, []);

    if (highlightedObjs) {
        selDrawObjs.push(...highlightedObjs);
    }
    return selDrawObjs;
}



/**
 * @summary create DrawingObj for highlighted region
 * @param {object} drawLayer
 * @param {Object} highlightedFootprint object for ConnectedObj
 * @param {string} plotId
 * @param {Object} drawingDef
 * @returns {Object[]}
 */
function plotHighlightRegion(drawLayer, highlightedFootprint, plotId, drawingDef) {
    if (!highlightedFootprint || !drawLayer.imageLineBasedFP) {
        return [];
    }

    return drawHighlightFootprintObj(highlightedFootprint, primePlot(visRoot(), plotId), drawingDef);
}

function plotLayer(dl) {
    const {style=Style.FILL, showText, color} = dl.drawingDef || {};
    const {imageLineBasedFP, hideFPId} = dl || {};

    if (!imageLineBasedFP || !imageLineBasedFP.connectedObjs) return null;
    return convertConnectedObjsToDrawObjs(imageLineBasedFP, style,
                                          {fill: rateOpacity(color, 0.5), outline: color, hole: rateOpacity('red', 0.5)}, showText, null, hideFPId);
}

function getLayers(pv,dlAry) {
    return getAllDrawLayersForPlot(dlAry, pv.plotId,true)
        .filter( (dl) => dl.drawLayerTypeId===TYPE_ID);
}

export function selectFootprint(pv, dlAry) {
    if (dlAry.length === 0) return;

    const footprintAry = getLayers(pv, dlAry);
    if (footprintAry.length === 0) return;

    const p= primePlot(pv);
    const sel= p.attributes[PlotAttribute.SELECTION];
    if (!sel) return;

    const setSelectInfo = (nums, selectInfoCls) => {
        nums.forEach((idx) => selectInfoCls.setRowSelect(idx, true));
    };

    const selectedShape = getSelectedShape(pv, dlAry);
    footprintAry.forEach( (dl, dlIndex) => {
        const connectObjs = get(dl.drawData.data, [pv.plotId]);

        const tbl = getTblById(dl.tbl_id);
        //const selectInfoCls = SelectInfo.newInstance(tbl.selectInfo);
        const dataRows = get(tbl, ['tableData', 'data', 'length'], 0);
        const selectInfoCls = SelectInfo.newInstance({rowCount: dataRows});
        const allCObjsIdxs = getSelectedPts(sel, p, connectObjs, selectedShape);
        const row_nums = [];
        const row_idxs = clone(dl.selectRowIdxs);

        allCObjsIdxs.reduce((ps, cObjIdx, n) => {
            ps = ps.then(() => {
                    const rowIdx = connectObjs[cObjIdx].tableRowIdx;
                    findIndex(dl.tbl_id, `ROW_IDX = ${rowIdx}`).then((row_num) => {
                        if (row_num >= 0) {
                            row_nums.push(Number(row_num));
                        }
                        row_idxs[rowIdx] = row_num;

                        if (n === allCObjsIdxs.length - 1) {
                            setSelectInfo(row_nums, selectInfoCls);
                            dispatchModifyCustomField(dl.tbl_id, {selectRowIdxs: row_idxs}, p.plotId);
                            dispatchTableSelect(dl.drawLayerId, selectInfoCls.data);

                            if (dlIndex === footprintAry.length - 1) {
                                detachSelectArea(pv);
                            }
                        }

                        return row_num;
                    });
            });
            return ps;
        }, Promise.resolve());
    });
}


export function unselectFootprint(pv, dlAry) {
    const p= primePlot(pv);
    getLayers(pv,dlAry)
        .forEach( (dl) => {
            const connectObjs = get(dl.drawData.data, [pv.plotId]);
            const selectInfoCls = SelectInfo.newInstance({rowCount: connectObjs ? connectObjs.length : 0});
            dispatchModifyCustomField(dl.tbl_id, {selectRowIdxs: {}}, p.plotId);
            dispatchTableSelect(dl.drawLayerId, selectInfoCls.data);
        });
}

export function  filterFootprint(pv, dlAry) {
    const p = primePlot(pv);
    const sel = p.attributes[PlotAttribute.SELECTION];
    if (!sel) return;

    const footprintAry = getLayers(pv, dlAry);
    if (footprintAry.length === 0) return;

    const selectedShape =  getSelectedShape(pv, dlAry);
    footprintAry.forEach((dl) => {
        const tbl = getTblById(dl.tbl_id);
        const filterInfo = get(tbl, 'request.filters');
        const filterInfoCls = FilterInfo.parse(filterInfo);

        const connectObjs = get(dl.drawData.data, [pv.plotId]);
        const allCObjsIdx = getSelectedPts(sel, p, connectObjs, selectedShape);
        const idxs = allCObjsIdx.map((idx) => connectObjs[idx].tableRowIdx);

        const filter= `IN (${idxs.length === 0 ? -1 : idxs.toString()})`;     //  ROW_IDX is always positive.. use -1 to force no row selected
        filterInfoCls.setFilter('ROW_IDX', filter);
        const newRequest = {tbl_id: tbl.tbl_id, filters: filterInfoCls.serialize()};
        dispatchTableFilter(newRequest);
    });
    detachSelectArea(pv);
}


export function  clearFilterFootprint(pv, dlAry) {
    getLayers(pv, dlAry).forEach((dl) => {
        if (dl.tbl_id) {
            dispatchTableFilter({tbl_id: dl.tbl_id, filters: ''});
        }
    });
}
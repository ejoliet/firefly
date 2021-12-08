/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */



import React, {useEffect, useState} from 'react';
import {downloadChart, PlotlyWrapper} from '../../charts/ui/PlotlyWrapper.jsx';
import {PopupPanel} from 'firefly/ui/PopupPanel.jsx';
import DialogRootContainer from 'firefly/ui/DialogRootContainer.jsx';
import {dispatchHideDialog, dispatchShowDialog} from 'firefly/core/ComponentCntlr.js';
import ImagePlotCntlr, {
    dispatchAttributeChange,
    dispatchChangePointSelection,
    dispatchChangePrimePlot,
    visRoot
} from 'firefly/visualize/ImagePlotCntlr.js';
import CompleteButton from 'firefly/ui/CompleteButton.jsx';
import HelpIcon from 'firefly/ui/HelpIcon.jsx';
import {useStoreConnector} from 'firefly/ui/SimpleComponent.jsx';
import {
    convertHDUIdxToImageIdx,
    getActivePlotView, getAllWaveLengthsForCube, getCubePlaneFromWavelength,
    getDrawLayerByType,
    getHDU,
    getHDUIndex, getHduPlotStartIndexes,
    getImageCubeIdx, getPtWavelength, getWaveLengthUnits,
    hasWCSProjection, hasWLInfo,
    isDrawLayerAttached,
    isImageCube,
    isMultiHDUFits,
    primePlot
} from 'firefly/visualize/PlotViewUtil.js';
import {PlotAttribute} from 'firefly/visualize/PlotAttribute.js';
import {CCUtil, CysConverter} from 'firefly/visualize/CsysConverter.js';
import {ListBoxInputFieldView} from 'firefly/ui/ListBoxInputField.jsx';
import { callGetCubeDrillDownAry, callGetPointExtractionAry } from 'firefly/rpc/PlotServicesJson.js';
import {wrapResizer} from '../../ui/SizeMeConfig.js';
import {getExtName} from 'firefly/visualize/FitsHeaderUtil.js';
import {dispatchTableFetch, dispatchTableSearch, TABLE_REMOVE} from 'firefly/tables/TablesCntlr.js';
import {makeTblRequest} from 'firefly/tables/TableRequestUtil.js';
import ExtractLineTool from 'firefly/drawingLayers/ExtractLineTool.js';
import ExtractPointsTool from 'firefly/drawingLayers/ExtractPointsTool.js';
import {
    dispatchAttachLayerToPlot, dispatchCreateDrawLayer,
    dispatchDetachLayerFromPlot, dispatchModifyCustomField, getDlAry } from 'firefly/visualize/DrawLayerCntlr.js';
import {makeImagePt} from 'firefly/api/ApiUtilImage.jsx';
import {computeDistance, computeScreenDistance, getLinePointAry} from 'firefly/visualize/VisUtil.js';
import {RadioGroupInputFieldView} from 'firefly/ui/RadioGroupInputFieldView.jsx';
import {addZAxisExtractionWatcher} from 'firefly/visualize/ui/ExtractionWatchers.js';
import {sprintf} from 'firefly/externalSource/sprintf.js';
import {getFluxUnits} from 'firefly/visualize/WebPlot.js';
import {Band} from 'firefly/visualize/Band.js';
import {onTableLoaded} from 'firefly/tables/TableUtil.js';
import {showTableDownloadDialog} from 'firefly/tables/ui/TableSave.jsx';
import {getAppOptions} from 'firefly/api/ApiUtil.js';
import {showPinMessage} from 'firefly/ui/PopupUtil.jsx';
import ReactDOM from 'react-dom';
import {MetaConst} from 'firefly/data/MetaConst.js';
import {dispatchAddActionWatcher} from 'firefly/core/MasterSaga.js';



const DIALOG_ID= 'extrationDialog';
const CHART_ID= 'extractionChart';
// const LINE_POINT_SELECTION_ID= 'lineSelectExtraction';
const ZAXIS_POINT_SELECTION_ID= 'z-axisExtraction';

export const Z_AXIS= 'Z_AXIS';
export const LINE= 'LINE';
export const POINTS= 'POINTS';

const exTypeCntl= {
    Z_AXIS: {
        Panel: ZAxisExtractionPanel,
        cancelFunc: cancelZaxisExtraction,
        start: () => dispatchChangePointSelection(ZAXIS_POINT_SELECTION_ID, true),
    },
    LINE: {
        Panel: LineExtractionPanel,
        cancelFunc: cancelLineExtraction,
        start: () => enableDrawLayer(ExtractLineTool.TYPE_ID),
    },
    POINTS: {
        Panel: PointExtractionPanel,
        cancelFunc: cancelPointExtraction,
        start: () => enableDrawLayer(ExtractPointsTool.TYPE_ID),
    }

};


function enableDrawLayer(typeId) {
    const pv= getActivePlotView(visRoot());
    const dl= getDrawLayerByType(getDlAry(), typeId);
    !dl && dispatchCreateDrawLayer(typeId);
    !isDrawLayerAttached(dl,pv.plotId) && dispatchAttachLayerToPlot(typeId,pv.plotId,true,true, true);
}

const EXTRACT_END_ID= 'extractEndId';


export function showExtractionDialog(extractionType,wasCanceled) {
    endExtraction();
    exTypeCntl[extractionType].start();
    DialogRootContainer.defineDialog(DIALOG_ID, <ExtractDialog {...{extractionType, wasCanceled}}/> );
    dispatchShowDialog(DIALOG_ID);


    dispatchAddActionWatcher( {
        id: EXTRACT_END_ID,
        callback: (action,cancelSelf) => {
            endExtraction();
            cancelSelf();
        },
        actions:[ImagePlotCntlr.PLOT_IMAGE]
    });
}


export function endExtraction() {
    cancelPointExtraction();
    cancelZaxisExtraction();
    cancelLineExtraction();
}

function ExtractDialog({extractionType,wasCanceled}) {
    const [pv] = useStoreConnector( getStoreState);
    const {canCreateExtractionTable}= getAppOptions().image;
    const {Panel, cancelFunc}= exTypeCntl[extractionType];

    const doCancel= () => {
        cancelFunc();
        wasCanceled?.();
    };

    return(
        <PopupPanel title={`Extract - ${primePlot(pv)?.title ?? ''}`}
                    closeCallback={doCancel} requestToClose={doCancel}  >
            <Panel canCreateExtractionTable={canCreateExtractionTable} pv={pv}/>
        </PopupPanel>
    );
}



function getStoreState(prevPv) {
    const pv= getActivePlotView(visRoot());
    return pv===prevPv ? prevPv : pv;
}

const sizeOp=[];
for(let i= 1; i<=7;i+=2) sizeOp.push({label:`${i}x${i}`, value:i});

function afterZAxisChartRedraw(imPt, pv, chart) {
    chart.on('plotly_click', (ev) => {
        setTimeout( () => {
            const plane= hasWLInfo(primePlot(pv)) ?
                getCubePlaneFromWavelength(pv,ev.points[0].x,imPt) : ev.points[0].x-1;
            const primeIdx= convertHDUIdxToImageIdx(pv, getHDUIndex(pv,primePlot(pv)), plane);
            if (pv.primeIdx!==primeIdx) {
                dispatchChangePrimePlot({plotId:pv.plotId,primeIdx});
            }
        },5);
    });
}

function afterLineChartRedraw(pv, chart,pl, imPtAry, pt1, pt2) {
    chart.on('plotly_click', (ev) => {
        setTimeout( () => {
            const plot= primePlot(pv);
            const imPt= makeImagePt(Math.round(imPtAry[ev.points[0].pointNumber].x)+.5, Math.round(imPtAry[ev.points[0].pointNumber].y)+.5);
            dispatchModifyCustomField( ExtractLineTool.TYPE_ID,
                {activePt: hasWCSProjection(plot) ? CCUtil.getWorldCoords(plot,imPt) : imPt},
                pv.plotId);
            dispatchAttributeChange({plotId:plot.plotId,overlayColorScope:false,toAllPlotsInPlotView:false,
                changes:{
                    [PlotAttribute.SELECT_ACTIVE_CHART_PT]: {x:ev.points[0].x,y:ev.points[0].y}
                }
            });
        },5);
    });
}

function afterPointsChartRedraw(pv, chart,pl,chartXAxis, imPtAry) {
    chart.on('plotly_click', (ev) => {
        setTimeout( () => {
            const plot= primePlot(pv);
            const key= chartXAxis==='imageX' ? 'x' : 'y';
            const {x,y}= ev.points[0];
            const imPt= imPtAry.find( (pt) => pt[key]===x);
            const cenImPt= makeImagePt(imPt.x+.5, imPt.y+.5);
            dispatchModifyCustomField( ExtractPointsTool.TYPE_ID,
                {activePt: hasWCSProjection(plot) ? CCUtil.getWorldCoords(plot,cenImPt) : cenImPt}, pv.plotId);
            dispatchAttributeChange({plotId:plot.plotId,overlayColorScope:false,toAllPlotsInPlotView:false,
                changes:{[PlotAttribute.SELECT_ACTIVE_CHART_PT]: {x,y,chartXAxis}}
            });
        },5);
    });
}


function ExtractionChart({plotlyDivStyle, plotlyData, plotlyLayout, afterRedraw, size:{width,height}}) {
    return (
        <div style={{width:'100%', height:'100%'}}>
            <PlotlyWrapper data={plotlyData} layout={{width,height,...plotlyLayout}}  style={plotlyDivStyle}
                           autoSizePlot={true}
                           autoDetectResizing={true}
                           chartId={CHART_ID}
                           divUpdateCB={() => undefined}
                           newPlotCB={ (chart,pl) => afterRedraw(chart,pl) } />
        </div>
    );
}

const ExtractionChartResizeable= wrapResizer(ExtractionChart);

function makeLineExtractionTitle(pv,x1,y1,x2,y2) {
    const plot= primePlot(pv);
    let hduInfo= '';
    let cubeInfo= '';
    if (isMultiHDUFits(pv)) {
        const extName= getExtName(plot);
        hduInfo= (extName || ` HDU #${getHDU(plot)}`)  + ' - ';
    }
    if (getImageCubeIdx(plot)>-1) {
        cubeInfo= `Plane #${getImageCubeIdx(plot)+1} - `;
    }
    return  `Line Extract Preview - ${hduInfo}${cubeInfo}(${x1},${y1}) to (${x2},${y2})`;
}


function PointExtractionPanel({canCreateExtractionTable, pv}) {
    const [{plotlyDivStyle, plotlyData, plotlyLayout},setChartParams]= useState({});
    const [pointSize,setPointSize]= useState(1);
    const [allRelatedHDUS,setAllRelatedHDUS]= useState(true);
    const [chartXAxis,setChartXAxis]= useState('imageX');
    const plot= primePlot(pv);
    const ptAry=plot?.attributes?.[PlotAttribute.PT_ARY] ??[];
    const cc= CysConverter.make(plot);
    const imPtAry= ptAry
        .map( (pt) => cc?.getImageCoords(pt))
        .map( (pt) => pt? makeImagePt(Math.trunc(pt.x), Math.trunc(pt.y)) : undefined)
        .filter((pt) => pt);

    const {plotId,plotImageId}= plot ?? {};
    const hduNum= getHDU(plot);
    const plane= getImageCubeIdx(plot)>-1 ? getImageCubeIdx(plot) : 0;
    const {x:chartX,y:chartY,chartXAxis:lastChartChartXAxis=chartXAxis}=plot?.attributes?.[PlotAttribute.SELECT_ACTIVE_CHART_PT] ?? {};


    const bottomUI = plotlyData ?
            (<RadioGroupInputFieldView value={chartXAxis} buttonGroup={true} wrapperStyle={{paddingTop: 5}}
                                       options={ [ {label: 'Image X', value: 'imageX'}, {label: 'Image Y', value: 'imageY'} ]}
                                       onChange={(ev) => setChartXAxis(ev.target.value)} />) :
            undefined;

    useEffect(() => {
        const getData= async () => {
            if (imPtAry && imPtAry.length && plot) {
                const dataAry= await callGetPointExtractionAry(plot, hduNum, plane, imPtAry, pointSize, allRelatedHDUS);
                const chartTitle= 'Point Extract Preview';
                let activeIdx= 0;
                const key= lastChartChartXAxis==='imageX' ? 'x' : 'y';
                if (plot.attributes[PlotAttribute.SELECT_ACTIVE_CHART_PT]) {
                    activeIdx= imPtAry.findIndex( (pt) => pt[key]===chartX);
                    if (activeIdx<0) activeIdx= 0;
                }
                const chartData=
                    genPointChartData(dataAry,imPtAry, imPtAry[activeIdx][key], dataAry[activeIdx],
                        pointSize,chartTitle, chartXAxis, activeIdx);
                setChartParams(chartData);
            }
            if (!plot) cancelPointExtraction();
        };
        getData();
    },[ptAry.length,hduNum,plotId,plotImageId,pointSize,chartX,chartY,chartXAxis]);

    return (
        <ExtractionPanelView {...{
            allRelatedHDUS, setAllRelatedHDUS, pointSize, setPointSize,
            plotlyDivStyle, plotlyData, plotlyLayout, canCreateExtractionTable,
            startUpHelp: (
                <div>
                    <div> Click on an image to extract a point, continue clicking to extract more points. </div>
                    <div style={{marginTop:25}}> Shift-click will change images without extracting points. </div>
                </div>
            ),
            afterRedraw: (chart,pl) => afterPointsChartRedraw(pv,chart,pl,chartXAxis, imPtAry),
            callKeepExtraction: (download, doOverlay) => keepPointsExtraction(imPtAry, pv, plot, plot.plotState.getWorkingFitsFileStr(), hduNum, plane, pointSize,download, doOverlay),
            cancelFunc: () => cancelZaxisExtraction(), bottomUI
        }} /> );
}



function LineExtractionPanel({canCreateExtractionTable, pv}) {
    const [{plotlyDivStyle, plotlyData, plotlyLayout},setChartParams]= useState({});
    const [imPtAry,setImPtAry]= useState(undefined);
    const [pointSize,setPointSize]= useState(1);
    const [allRelatedHDUS,setAllRelatedHDUS]= useState(true);
    const plot= primePlot(pv);
    const {pt0:pt1,pt1:pt2}=plot?.attributes?.[PlotAttribute.ACTIVE_DISTANCE] ?? {};
    const extractionData=plot?.attributes?.[PlotAttribute.EXTRACTION_DATA] ?? false;
    const cc= CysConverter.make(plot);
    const ipt1= cc?.getImageCoords(pt1);
    const ipt2= cc?.getImageCoords(pt2);
    const x1= Math.trunc(ipt1?.x ?? 0);
    const y1= Math.trunc(ipt1?.y ?? 0);
    const x2= Math.trunc(ipt2?.x ?? 0);
    const y2= Math.trunc(ipt2?.y ?? 0);
    const {plotId,plotImageId}= plot ?? {};
    const hduNum= getHDU(plot);
    const plane= getImageCubeIdx(plot)>-1 ? getImageCubeIdx(plot) : 0;
    const {x:chartX,y:chartY}=plot?.attributes?.[PlotAttribute.SELECT_ACTIVE_CHART_PT] ?? {};

    useEffect(() => {
        const getData= async () => {
            if (ipt1 && ipt2 && plot) {
                const {direction}= xLineData(ipt1,ipt2);
                const newImPtAry= getLinePointAry(ipt1,ipt2);
                if (!newImPtAry?.length) {
                    ReactDOM.unstable_batchedUpdates( () => {
                        setImPtAry(undefined);
                        setChartParams({});
                    } );
                    return;
                }
                const cc= CysConverter.make(plot);

                const dataAry= await callGetPointExtractionAry(plot, hduNum, plane, newImPtAry, pointSize, allRelatedHDUS);
                const chartTitle= makeLineExtractionTitle(pv,x1,y1,x2,y2);
                const pt0= hasWCSProjection(plot) ? cc.getWorldCoords(newImPtAry[0]) : newImPtAry[0];
                const xOffAry= hasWCSProjection(plot) ?
                    newImPtAry.map( (pt) => computeDistance(pt0,cc.getWorldCoords(pt))*3600) :
                    newImPtAry.map( (pt) => computeScreenDistance(pt0.x,pt0.y,pt.x,pt.y));
                const chartData=
                    genSliceChartData(plot, ipt1,ipt2,xOffAry, dataAry, chartX, chartY, pointSize, chartTitle, direction<0);
                ReactDOM.unstable_batchedUpdates( () => {
                        setChartParams(chartData);
                        setImPtAry(newImPtAry);
                } );
            }
            if (!plot) cancelLineExtraction();
        };
        if (extractionData) getData();
    },[x1,y1,x2,y2,hduNum,plotId,plotImageId,pointSize,chartX,chartY]);

    return (
        <ExtractionPanelView {...{
            allRelatedHDUS, setAllRelatedHDUS, pointSize, setPointSize, canCreateExtractionTable,
            plotlyDivStyle, plotlyData: extractionData&&plotlyData, plotlyLayout,
            startUpHelp: (
                <div>
                    <div> Draw line on image to extract point on line and show chart. </div>
                    <div style={{marginTop:25}}> Shift-click will change images without selecting a new line. </div>
                </div>
            ),
            afterRedraw: (chart,pl) => afterLineChartRedraw(pv,chart,pl,imPtAry,makeImagePt(x1,y1), makeImagePt(x2,y2)),
            callKeepExtraction: (download, doOverlay) => keepLineExtraction(ipt1,ipt2, pv, plot, plot.plotState.getWorkingFitsFileStr(), hduNum, plane, pointSize, download, doOverlay),
            cancelFunc: () => cancelZaxisExtraction()
        }} /> );
}

const xLineData= (pt1,pt2) => {
    if (usingXAxis(pt1,pt2)) {
        return {
            startValue: minValue(pt1,pt2),
            direction: pt1.x-pt2.x < 0 ? 1 : -1
        };
    }
    else {
        return {
            startValue: minValue(pt1,pt2),
            direction: pt1.y - pt2.y < 0 ? 1 : -1
        };
    }
};

const minValue= (pt1,pt2) => usingXAxis(pt1,pt2) ? Math.min(pt1.x,pt2.x) : Math.min(pt1.y,pt2.y);
// const maxValue= (pt1,pt2) => usingXAxis(pt1,pt2) ? Math.max(pt1.x,pt2.x) : Math.max(pt1.y,pt2.y);

function usingXAxis(pt1,pt2) {
    const deltaX = Math.abs(pt2.x - pt1.x);
    const deltaY = Math.abs(pt2.y - pt1.y);
    return (deltaX > deltaY);
}


function ZAxisExtractionPanel({canCreateExtractionTable, pv}) {
    const [pointSize,setPointSize]= useState(1);
    const [allRelatedHDUS,setAllRelatedHDUS]= useState(true);
    const [{plotlyDivStyle, plotlyData, plotlyLayout},setChartParams]= useState({});
    const plot= primePlot(pv);
    const {pt}=plot?.attributes?.[PlotAttribute.ACTIVE_POINT] ?? {};
    const ipt= CCUtil.getImageCoords(plot,pt);
    const x= Math.trunc(ipt?.x ?? 0);
    const y= Math.trunc(ipt?.y ?? 0);
    const {plotId,plotImageId}= plot ?? {};
    const hduNum= getHDU(plot);
    const extName= getExtName(plot);

    useEffect(() => {
        const updateChart= async () => {
            if (ipt && plot) {
                if (!isImageCube(plot)) {
                    setChartParams({});
                    return;
                }
                const dataAry = await callGetCubeDrillDownAry(plot, hduNum, ipt, pointSize, allRelatedHDUS);
                const plane=getImageCubeIdx(plot);
                const chartTitle= `Z Axis Preview - ${extName?extName+',':''} HDU #${hduNum}, Point: (${x},${y})`;
                setChartParams(genZAxisChartData(makeImagePt(x,y), pv, dataAry, plane , dataAry[plane] , pointSize, chartTitle));
            }
            if (!plot) cancelZaxisExtraction();
        };
        void updateChart();
    },[x,y,hduNum,plotId,pointSize,plotImageId]);

    if (!plot) return <div/>;

    return (
        <ExtractionPanelView {...{
            allRelatedHDUS, setAllRelatedHDUS, pointSize, setPointSize,
            plotlyDivStyle, plotlyData, plotlyLayout, canCreateExtractionTable,
            startUpHelp: isImageCube(plot) ?
                'Click on a pixel to extract data from all planes of the cube' :
                'Please choose a cube to extract z-axis data',
            afterRedraw: (chart,pl) => afterZAxisChartRedraw(makeImagePt(x,y), pv,chart,pl),
            callKeepExtraction: (download, doOverlay) => keepZAxisExtraction(makeImagePt(x,y), pv, plot, plot.plotState.getWorkingFitsFileStr(), hduNum, pointSize, download,doOverlay),
            cancelFunc: () => cancelZaxisExtraction()
        }} />
    );
}

const pointSizeTip= 'Extract the average pixel values in the specifed aperture centered on the pixel closest to where you clicked.';

function ExtractionPanelView({pointSize, setPointSize, afterRedraw, plotlyDivStyle, plotlyData, canCreateExtractionTable,
                                 plotlyLayout, startUpHelp, callKeepExtraction, bottomUI}) {
    return (
        <div style={{
            padding: 3, display:'flex', flexDirection:'column',
            alignItems:'center', resize:'both', overflow: 'hidden', zIndex:1}}>
            <div style={{margin: '2px 0 10px 0'}}>
                <span title={pointSizeTip}>
                    Aperture (Values will be averaged)</span>
                <ListBoxInputFieldView
                    inline={true} value={pointSize} onChange={(ev) => setPointSize(ev.target.value)}
                    labelWidth={10} label={' '} tooltip={ pointSizeTip} options={sizeOp} multiple={false} />
            </div>
            <div style={{minWidth:440, minHeight:200, width:'100%', height:'100%',
                flex: '1 1 auto', boxSizing: 'border-box',
                border: plotlyData ? '1px solid rgba(0,0,0,.3' : 'none' }}>
                {plotlyData ?
                    <ExtractionChartResizeable {...{plotlyDivStyle, plotlyData, plotlyLayout,afterRedraw}} /> :
                    <div style={{paddingTop:40, textAlign:'center', fontSize:'large', margin:10}}>{startUpHelp}</div>
                }
            </div>
            {bottomUI && <div>{bottomUI} </div>}
            <div style={{
                textAlign:'center', alignSelf: 'stretch', flexDirection:'row',  display:'flex',
                justifyContent:'space-between', padding: '15px 15px 7px 8px' }}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    {plotlyData && canCreateExtractionTable &&
                    <CompleteButton style={{paddingLeft: 15}} text='Pin Table' onSuccess={()=> callKeepExtraction(false, true)} />}
                    {plotlyData &&
                    <CompleteButton style={{paddingLeft: 15}} text='Download as Table' onSuccess={()=> callKeepExtraction(true,false)}/>}
                    {plotlyData &&
                    <CompleteButton style={{paddingLeft: 15}} text='Download Chart' onSuccess={()=> downloadChart(CHART_ID)}/>}
                </div>
                <HelpIcon helpId={'visualization.extraction'}/>
            </div>
        </div>
    );
}



function cancelZaxisExtraction() {
    dispatchChangePointSelection(ZAXIS_POINT_SELECTION_ID, false);
    dispatchHideDialog(DIALOG_ID);
}

function cancelLineExtraction() {
    const pv= getActivePlotView(visRoot());
    if (pv) {
        dispatchDetachLayerFromPlot(ExtractLineTool.TYPE_ID,pv.plotId,true);
        dispatchAttributeChange({plotId:pv.plotId,overlayColorScope:true,
            changes:{[PlotAttribute.SELECT_ACTIVE_CHART_PT]: undefined }});
    }
    dispatchHideDialog(DIALOG_ID);
}

function cancelPointExtraction() {
    const pv= getActivePlotView(visRoot());
    if (pv) dispatchDetachLayerFromPlot(ExtractPointsTool.TYPE_ID,pv.plotId,true);
    dispatchHideDialog(DIALOG_ID);
}


let idCnt= 0;
const getNextTblId= () => 'extraction-table-'+(idCnt++);



async function doDispatchTableSaving(req, doOverlay) {
    const {tbl_id}= req;
    const sendReq= {...req};
    sendReq.META_INFO= !doOverlay ? {...sendReq.META_INFO, [MetaConst.CATALOG_OVERLAY_TYPE]: 'FALSE'} :{...sendReq.META_INFO};
    dispatchTableFetch(sendReq,{ tbl_group: 'main', backgroundable: false});
    await onTableLoaded(tbl_id);
    showTableDownloadDialog({tbl_id,tbl_ui_id:undefined})();
}



function doDispatchTable(req, doOverlay) {
    showPinMessage('Pinning Extraction to Table Area');
    const sendReq= {...req};
    sendReq.META_INFO= !doOverlay ? {...sendReq.META_INFO, [MetaConst.CATALOG_OVERLAY_TYPE]: 'FALSE'} :{...sendReq.META_INFO};
    dispatchTableSearch(sendReq,{
        logHistory: false,
        removable:true,
        tbl_group: 'main',
        backgroundable: false,
        showFilters: true,
        showInfoButton: true
    });
}

let titleCnt= 1;

function keepZAxisExtraction(pt,pv, plot, filename,refHDUNum,extractionSize, save=false, doOverlay=true) {
    const wlUnit= getWaveLengthUnits(plot);
    const wpt= CCUtil.getWorldCoords(plot,pt);
    const fluxUnit= getHduPlotStartIndexes(pv)
        .map( (idx) => ({hdu:getHDU(pv.plots[idx]), unit:getFluxUnits(pv.plots[idx],Band.NO_BAND)}))
        .map( ({hdu,unit}) => `${hdu}=${unit}`);

    const tbl_id= getNextTblId();
    addZAxisExtractionWatcher(tbl_id);
    const dataTableReq= makeTblRequest('ExtractFromImage', `Extraction Z-Axis - ${titleCnt}`,
        {
            startIdx : 0,
            pageSize : save? 0: 100,
            extractionType: 'z-axis',
            pt: pt.toString(),
            wpt: wpt?.toString(),
            wlAry: hasWLInfo(plot) ? JSON.stringify(getAllWaveLengthsForCube(pv,pt)) : undefined,
            wlUnit,
            fluxUnit: JSON.stringify(fluxUnit),
            filename,
            refHDUNum,
            extractionSize,
            allMatchingHDUs: true,
        },
        {tbl_id});
    save ? doDispatchTableSaving(dataTableReq, doOverlay) : doDispatchTable(dataTableReq, doOverlay);
    idCnt++;
    titleCnt++;
}

function keepLineExtraction(pt, pt2,pv, plot, filename,refHDUNum,plane,extractionSize,save=false,doOverlay=true) {
    const tbl_id= getNextTblId();
    const imPtAry= getLinePointAry(pt,pt2);
    const cc= CysConverter.make(plot);

    const wptStrAry= hasWCSProjection(plot) ?
        imPtAry.map( (pt) => cc.getWorldCoords(pt)).map( (wpt) => wpt.toString()) : undefined;
    const dataTableReq= makeTblRequest('ExtractFromImage', makePlaneTitle('Extract Line',pv,plot,titleCnt), {
            startIdx : 0,
            pageSize : 100,
            extractionType: 'line',
            ptAry: JSON.stringify(imPtAry.map((pt) => pt.toString())),
            wptAry: JSON.stringify(wptStrAry),
            filename,
            refHDUNum,
            plane,
            extractionSize,
            allMatchingHDUs: true,
        },
        {tbl_id});
    save ? doDispatchTableSaving(dataTableReq, doOverlay) : doDispatchTable(dataTableReq, doOverlay);
    idCnt++;
    titleCnt++;
}

function makePlaneTitle(rootStr, pv,plot,cnt) {
    let hduStr='';
    let cubeStr='';
    if (isMultiHDUFits(pv)) {
        if (getExtName(plot)) hduStr= `- ${getExtName(plot)}`;
        else hduStr= `- HDU#${getHDU(plot)} `;
    }
    if (isImageCube(plot)) cubeStr= `- Plane: ${getImageCubeIdx(plot)+1}`;
    return `${rootStr} ${cnt}${hduStr}${cubeStr}`;
}

function keepPointsExtraction(ptAry,pv, plot, filename,refHDUNum,plane,extractionSize,save=false,doOverlay=true) {
    const tbl_id= getNextTblId();
    const cc= CysConverter.make(plot);
    const wptStrAry=
        hasWCSProjection(plot) ?
            ptAry.map( (pt) => cc.getWorldCoords(pt)).map( (pt) => pt.toString()) :
            undefined;
    const dataTableReq= makeTblRequest('ExtractFromImage', makePlaneTitle('Points',pv,plot,titleCnt),
        {
            startIdx : 0,
            pageSize : 100,
            extractionType: 'points',
            ptAry: JSON.stringify(ptAry.map((pt) => pt.toString())),
            wptAry: JSON.stringify(wptStrAry),
            filename,
            refHDUNum,
            plane,
            extractionSize,
            allMatchingHDUs: true,
        },
        {tbl_id});
    save ? doDispatchTableSaving(dataTableReq,doOverlay) : doDispatchTable(dataTableReq,doOverlay);
    idCnt++;
    titleCnt++;
}

const plotlyDivStyle= { border: '1px solid a5a5a5', borderRadius: 5, width: '100%', height: '100%' };


function makePlotlyLayoutObj(title,xAxis,yAxis, reversed=false) {
    const font= {size: 12};
    return {
        hovermode: 'closest',
        title: {text: title, font},
        showlegend: false,
        xaxis: {
            title: {text: xAxis, font},
            gridLineWidth: 1,
            type: 'linear',
            lineColor: '#e9e9e9',
            zeroline: false,
            tickfont: font,
            exponentformat:'e',
            autorange: reversed ? 'reversed': true,
        },
        yaxis: {
            title: {text: yAxis, font},
            gridLineWidth: 1,
            type: 'linear',
            lineColor: '#e9e9e9',
            exponentformat:'e'
        },
        margin: { l: 50, r: 50, b: 50, t: 30, pad: 2 }
    };
}


const dataRoot= { displaylogo: false, mode: 'markers', hoverinfo: 'text', hovermode: 'closest'};

function makePlotlyDataObj(xDataAry, yDataAry,x,y,ttXStr,ttYStr, makeXDesc= (i)=> xDataAry[i], highlightXDesc=x+'') {
    const result= [
        {
            ...dataRoot,
            type: xDataAry?.length>6000 ? 'scattergl' : 'scatter',
            marker: { symbol: 'circle', size: 6, color: 'rgba(63, 127, 191, 0.5)' },
            x: xDataAry,
            y: yDataAry,
            hovertext: Array.from(yDataAry).map((d,i) => `<span> ${ttXStr} = ${makeXDesc(i)}  <br> ${ttYStr}= ${d}   </span>`),
            textfont: {color: 'rgba(31,119,180,0.5)'},
        },
        {
            ...dataRoot,
            type: 'scatter',
            marker: { symbol: 'circle', size: 6, color: 'rgba(255, 200, 0, 1)' },
            x: [x],
            y: [y],
            hovertext: [`<span> ${ttXStr} = ${highlightXDesc}  <br> ${ttYStr} = ${y}   </span>`],
        }
    ];
    return result;
}


function genSliceChartData(plot, ipt1,ipt2, xDataAry,yDataAry,x,y, pointSize, title, reversed) {
    const unitStr= hasWCSProjection(plot) ? ' (arcsec)' : '';
    return {
        plotlyDivStyle,
        plotlyData: makePlotlyDataObj(xDataAry, yDataAry, x, y, 'Offset'+unitStr, 'Value'),
        plotlyLayout: makePlotlyLayoutObj(title, 'Offset'+unitStr, `Value${pointSize > 1 ? ` (${pointSize}x${pointSize} avg)` : ''}`, reversed),
    };
}

function genPointChartData(dataAry,imPtAry, x,y, pointSize, title, chartXAxis, activeIdx) {

    const xAxis= chartXAxis==='imageX' ? imPtAry.map( (pt) => pt.x) : imPtAry.map( (pt) => pt.y);
    const xAxisTitle= chartXAxis==='imageX' ? 'Image X': 'Image Y';
    const xLabel= (i) => `(${imPtAry[i].x},${imPtAry[i].y})`;

    return {
        plotlyDivStyle,
        plotlyData: makePlotlyDataObj(xAxis, dataAry, x, y, xAxisTitle, 'Value',
          xLabel , xLabel(activeIdx)),
        plotlyLayout: makePlotlyLayoutObj(title, xAxisTitle, `Value${pointSize > 1 ? ` (${pointSize}x${pointSize} avg)` : ''}`),
    };
}



function genZAxisChartData(imPt, pv, dataAry,x,y, pointSize, title) {
    const plot= primePlot(pv);
    const hasWL= hasWLInfo(plot);
    const xAry= hasWL ? getAllWaveLengthsForCube(pv,imPt) : dataAry.map( (d,i) => i+1);
    const highlightX= hasWL ? getPtWavelength(primePlot(pv), imPt,x)  : x+1;
    const highlightXLabel= `${sprintf('%5.4f',highlightX)} (plane: ${x+1})`;

    const format= (v) => isNaN(v) ? '' : sprintf('%5.4f',v);
    const xLabel= (i) => `${format(getPtWavelength(primePlot(pv), imPt,x))} (plane: ${i+1})`;

    const plotlyData= hasWL ?
       makePlotlyDataObj(xAry,dataAry,highlightX,y, 'Wavelength', 'z-azis', xLabel, highlightXLabel) :
       makePlotlyDataObj(xAry,dataAry,highlightX,y,'Plane','z-azis');

    return {
        plotlyDivStyle,
        plotlyData,
        plotlyLayout: makePlotlyLayoutObj(title,hasWL?'Wavelength':'cube plane', `Z-Axis${pointSize>1?` (${pointSize}x${pointSize} avg)`:''}`),
    };
}


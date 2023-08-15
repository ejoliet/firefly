import {makeWorldPtUsingCenterColumns} from '../../util/VOAnalyzer.js';
import {Band} from '../../visualize/Band.js';
import {getSearchTarget} from '../../visualize/saga/CatalogWatcher.js';
import {WPConst} from '../../visualize/WebPlotRequest.js';
import {dpdtImage, dpdtMessageWithDownload, dpdtSimpleMsg, DPtypes} from '../DataProductsType.js';
import {
    createGridImagesActivate, createRelatedGridImagesActivate, createSingleImageExtraction
} from '../ImageDataProductsUtil.js';
import {fetchDatalinkTable} from './DatalinkFetch.js';
import {
    filterDLList,
    getDataLinkData, IMAGE, processDatalinkTable, RELATED_IMAGE_GRID, SPECTRUM, USE_ALL
} from './DataLinkProcessor.js';


export async function getDatalinkRelatedGridProduct({dlTableUrl, activateParams, table, row, threeColorOps, titleStr, options}) {
    try {
        const positionWP = getSearchTarget(table.request, table) ?? makeWorldPtUsingCenterColumns(table, row);
        const datalinkTable = await fetchDatalinkTable(dlTableUrl);

        const gridData = getDataLinkData(datalinkTable).filter((d) => d.isThis && d.isGrid && d.isImage);
        if (!gridData.length) return dpdtSimpleMsg('no support for related grid in datalink file');


        const dataLinkGrid = processDatalinkTable({
            sourceTable: table, row, datalinkTable, positionWP, activateParams,
            baseTitle: titleStr, dlTableUrl, doFileAnalysis: false,
            options, parsingAlgorithm: RELATED_IMAGE_GRID
        });


        const {imageViewerId} = activateParams;
        const requestAry = dataLinkGrid.menu
            .filter((result) => result?.request && (
                result.displayType === DPtypes.IMAGE ||
                result.displayType === DPtypes.PROMISE ||
                result.displayType === DPtypes.ANALYZE))
            .map((result) => result.request);
        
        requestAry.forEach((r, idx) => r.setPlotId(r.getPlotId() + '-related_grid-' + idx));

        const threeColorReqAry= (threeColorOps && requestAry.length>1) &&
                                          make3ColorRequestAry(requestAry,threeColorOps,datalinkTable.tbl_id);
        const activate = createRelatedGridImagesActivate(requestAry, threeColorReqAry, imageViewerId, table.tbl_id);
        const extraction = createSingleImageExtraction(requestAry);
        return dpdtImage({name:'image grid', activate, extraction, menuKey:'image-grid-0'});
    } catch (reason) {
        return dpdtMessageWithDownload(`No data to display: Could not retrieve datalink data, ${reason}`, 'Download File: ' + titleStr, dlTableUrl);
    }
}

function make3ColorRequestAry(requestAry,threeColorOps,tbl_id) {
    const plotId= `3id_${tbl_id}`;
    return [
        threeColorOps[0] ? requestAry[threeColorOps[0]]?.makeCopy({[WPConst.PLOT_ID]:plotId}) :undefined,
        threeColorOps[1] ? requestAry[threeColorOps[1]]?.makeCopy({[WPConst.PLOT_ID]:plotId}) :undefined,
        threeColorOps[2] ? requestAry[threeColorOps[2]]?.makeCopy({[WPConst.PLOT_ID]:plotId}) :undefined,
    ];
}

export async function getDatalinkSingleDataProduct({
                                                       dlTableUrl,
                                                       options,
                                                       sourceTable,
                                                       row,
                                                       activateParams,
                                                       titleStr = 'datalink table',
                                                       doFileAnalysis = true,
                                                       additionalServiceDescMenuList
                                                   }) {
    try {
        const datalinkTable = await fetchDatalinkTable(dlTableUrl);
        let parsingAlgorithm = USE_ALL;
        if (options.singleViewImageOnly) parsingAlgorithm = IMAGE;
        if (options.singleViewTableOnly) parsingAlgorithm = SPECTRUM;

        return processDatalinkTable({
            sourceTable, row, datalinkTable, activateParams, baseTitle: titleStr,
            options, parsingAlgorithm, doFileAnalysis,
            dlTableUrl, additionalServiceDescMenuList
        });
    } catch (reason) {
        //todo - what about if when the data link fetch fails but there is a serviceDescMenuList - what to do? does it matter?
        return dpdtMessageWithDownload(`No data to display: Could not retrieve datalink data, ${reason}`, 'Download File: ' + titleStr, dlTableUrl);
    }
}

export async function createGridResult(promiseAry, activateParams, table, plotRows) {
    return Promise.all(promiseAry).then((resultAry) => {
        const {imageViewerId} = activateParams;
        const requestAry = resultAry
            .filter((result) => result?.request && (
                result?.displayType === DPtypes.IMAGE ||
                result?.displayType === DPtypes.PROMISE ||
                result?.displayType === DPtypes.ANALYZE))
            .map((result) => result.request);
        const activate = createGridImagesActivate(requestAry, imageViewerId, table.tbl_id, plotRows);
        const extraction = createSingleImageExtraction(requestAry);
        return dpdtImage({name:'image grid', activate, extraction, menuKey:'image-grid-0'});
    });
}


export async function datalinkDescribeThreeColor(dlTableUrl, table,row, options) {
    const datalinkTable = await fetchDatalinkTable(dlTableUrl);
    const dataLinkGrid = processDatalinkTable({
        sourceTable: table, row, datalinkTable, activateParams:{},
        baseTitle: '', dlTableUrl, doFileAnalysis: false,
        options, parsingAlgorithm: RELATED_IMAGE_GRID
    });

    const bandData = dataLinkGrid.menu
        .filter((result) => result?.request && (
            result.displayType === DPtypes.IMAGE ||
            result.displayType === DPtypes.PROMISE ||
            result.displayType === DPtypes.ANALYZE))
        .map((result) => result.request.getTitle())
        .reduce( (obj,title,idx) => {
            obj[idx]= {color:undefined, title};
            return obj;
        },{});


    const {r,g,b}= get3CBandIdxes(datalinkTable);

    if (bandData[r]) bandData[r].color= Band.RED;
    if (bandData[g]) bandData[g].color= Band.GREEN;
    if (bandData[b]) bandData[b].color= Band.BLUE;

    return bandData;
}

function get3CBandIdxes(datalinkTable) {
    const gridData= filterDLList(RELATED_IMAGE_GRID,getDataLinkData(datalinkTable));
    const rBandIdx= gridData.findIndex( (d) => d.rBand);
    const gBandIdx= gridData.findIndex( (d) => d.gBand);
    const bBandIdx= gridData.findIndex( (d) => d.bBand);

    const bandAry= [];
    bandAry.length= gridData.length;
    if (rBandIdx!==-1) bandAry[rBandIdx]= Band.RED;
    if (gBandIdx!==-1) bandAry[gBandIdx]= Band.GREEN;
    if (bBandIdx!==-1) bandAry[bBandIdx]= Band.BLUE;

    if (!bandAry.includes(Band.RED)) bandAry[bandAry.findIndex((v)=> !v)]= Band.RED;
    if (!bandAry.includes(Band.GREEN)) bandAry[bandAry.findIndex((v)=> !v)]= Band.GREEN;
    if (!bandAry.includes(Band.BLUE)) bandAry[bandAry.findIndex((v)=> !v)]= Band.BLUE;
    return {
        r: bandAry.findIndex( (v) => v===Band.RED),
        g: bandAry.findIndex( (v) => v===Band.GREEN),
        b: bandAry.findIndex( (v) => v===Band.BLUE),
    };
}
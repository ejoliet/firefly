import {get, isArray} from 'lodash';
import Enum from 'enum';
import {getAppOptions} from '../core/AppDataCntlr.js';
import {getTblById, isTableLoaded, findGroupByTblId} from '../tables/TableUtil.js';
import {dispatchTableFetch, dispatchTableHighlight} from '../tables/TablesCntlr.js';
import {makeTblRequest} from '../tables/TableRequestUtil.js';
import {getColumnIdx} from '../tables/TableUtil.js';
import {ServerParams} from '../data/ServerParams.js';
import {dispatchAddActionWatcher} from '../core/MasterSaga.js';
import {TABLE_LOADED} from '../tables/TablesCntlr';

export const HiPSSurveyTableColumn = new Enum(['Url', 'Title', 'Type', 'Order', 'Coverage', 'Frame', 'Source', 'Properties']);
export const HiPSId = 'hips';
export const HiPSDataType= new Enum([ 'image', 'cube', 'catalog'], { ignoreCase: true });
export const HiPSData = [HiPSDataType.image, HiPSDataType.cube];
export const HiPSSources = ServerParams.CDS.toLowerCase()+',' + ServerParams.IRSA.toLowerCase();

const HiPSSurvey = 'HiPS_Surveys_';
const IVO_ID_COL= 'CreatorID';
const URL_COL= 'Url';

export function makeHiPSSurveysTableName(hipsId, sources) {
    const nHipsId = updateHiPSId(hipsId||HiPSId, (sources===ServerParams.ALL ? HiPSSources : sources));


    return nHipsId.startsWith(HiPSSurvey) ? nHipsId : (HiPSSurvey + nHipsId);
}

export function getAppHiPSConfig() {
    return get(getAppOptions(), ['hips', 'useForImageSearch'], false);
}

export function defHiPSSortOrder() {
    return get(getAppOptions(), ['hips', ServerParams.SORT_ORDER], ServerParams.ALL);
}

export function getHiPSSources() {
    return get(getAppOptions(), ['hips', ServerParams.HIPS_SOURCES], ServerParams.ALL);
}

export function defHiPSSources() {
    return get(getAppOptions(), ['hips', ServerParams.HIPS_DEFSOURCES]);
}


/**
 * update HiPS surveys id based on if it is for popular surveys
 * @param id
 * @param sources
 * @returns {*}
 */
function updateHiPSId(id, sources) {
    const sortedSources = sources.split(',').filter((s) => s)
                                            .map((s) => s.toLowerCase())
                                            .sort();
    const idSuffix = '__' + sortedSources.join('_');  // suffix in lower case
    const sId = id.endsWith(idSuffix) ? id : (id + idSuffix);

    return sId;
}

/**
 * get HiPS list, used as a callback for HiPS selection
 * @param {Object} params defining dataTypes, id, isPopular, sources, sortOrder for HiPS master query.
 * @param {array} params.dataTypes
 * @param {string} params.id
 * @param {boolean} params.isPopular
 * @param {string} params.sources
 * @param {string} params.sortOrder
 */
export function onHiPSSurveys({dataTypes, id, sources=defHiPSSources(), sortOrder = defHiPSSortOrder()}) {
    if (!sources) return;

    const tbl_id = makeHiPSSurveysTableName(id, sources);
    const types = isArray(dataTypes) ? dataTypes.join(',') : dataTypes;
    const ss = isArray(sources) ? sources.join(',') : sources;
    const so = isArray(sortOrder) ? sortOrder.join(',') : sortOrder;
    if (!getHiPSSurveys(tbl_id)) {
        const req = makeTblRequest('HiPSSearch', 'HiPS Maps',
                                  {[ServerParams.HIPS_DATATYPES]: types,
                                   [ServerParams.HIPS_SOURCES]: ss,
                                   [ServerParams.SORT_ORDER]: so},
                                   {tbl_id, removable: true, pageSize: 10000});

        dispatchTableFetch(req, 0);
    }
}


//todo
export function getHiPSSurveysTable(dataTypes, id, sources=defHiPSSources()) {

    const hipsSurveys = getHiPSSurveys(makeHiPSSurveysTableName(id, sources));
    if (hipsSurveys && hipsSurveys.tableData) return Promise.resolve(hipsSurveys);


    return new Promise((resolve) => {
        const watcher= (action, cancelSelf) =>{
            const {tbl_id}= action.payload;
            if (tbl_id!==makeHiPSSurveysTableName(id, sources)) return;
            const loadSurveys = getHiPSSurveys(makeHiPSSurveysTableName(id, sources));
            resolve(loadSurveys);
            cancelSelf();
        };
        dispatchAddActionWatcher({actions:[TABLE_LOADED], callback: watcher});
        onHiPSSurveys({dataTypes,id,sources});
    });
}


/**
 * resolve a ivo hips id to a URL if a url is passed just return it.
 * @param {string} ivoOrUrl - a url or a IVO id
 * @return {Promise} a promise the resolves to a url
 */
export function resolveHiPSIvoURL(ivoOrUrl) {
    if (!ivoOrUrl) return Promise.reject(new Error('empty url'));
    if (ivoOrUrl.startsWith('http')) return Promise.resolve(ivoOrUrl);


    return getHiPSSurveysTable([HiPSDataType.image, HiPSDataType.cube], 'hipsResolveTable')
        .then( (tableModel) => {
            const ivoIdx= getColumnIdx(tableModel, IVO_ID_COL);
            const urlIdx= getColumnIdx(tableModel, URL_COL);
            if (ivoIdx<0 || urlIdx<1) return undefined;
            const lowerIvo= ivoOrUrl.toLowerCase();
            // now match the table
            const foundRow= tableModel.tableData.data.find( (row) =>
                                row[ivoIdx] && row[ivoIdx].toLowerCase().includes(lowerIvo) );
            const replaceUrl= foundRow && foundRow[urlIdx];
            return replaceUrl || ivoOrUrl;
        });
}




function stripTrailingSlash(url) {
    if (typeof url === 'string') {
        return url.trim().replace(/\/$/, '');
    }
    return url;
}

/**
 *
 * @param tbl table
 * @param url
 * @returns {*}
 */
export function indexInHiPSSurveys(tbl, url) {
    if (!url || typeof url !== 'string') return 0;
    const cIdx = tbl ? getColumnIdx(tbl, HiPSSurveyTableColumn.Url.key) : -1;

    if (tbl && cIdx >= 0) {
        const newUrl = stripTrailingSlash(url).toLowerCase();

        const data = get(tbl, ['tableData', 'data']);

        return data.findIndex((s) => {
            return (stripTrailingSlash(s[cIdx]).toLowerCase() === newUrl);
        });
    }
    return 0;
}

/**
 * get HiPS survey list from the store
 * @param id table id
 * @returns {*}
 */
export function getHiPSSurveys(id) {
    return getTblById(id);
}


/**
 * check if HiPS survey list is under loading
 * @param id table id
 * @returns {*}
 */
export function isLoadingHiPSSurverys(id) {
    if (!id.startsWith(HiPSSurvey)) {
        id = HiPSSurvey + id;
    }
    const tbl = getHiPSSurveys(id);

    return tbl ? (tbl.isFetching ? true : !isTableLoaded(tbl)) : false;
}


/**
 * get loading message if there is
 * @param id
 * @returns {*}
 */
export function getHiPSLoadingMessage(id) {
    //return get(flux.getState(), [HIPSSURVEY_PATH, id, 'message']);
    const tbl = getHiPSSurveys(id);

    return get(tbl, 'error', '');
}

/**
 *  update highlighted row of both original master hips table and popular hips table if there is
 * @param url
 * @param hipsId
 * @param sources
 */
export function updateHiPSTblHighlightOnUrl(url, hipsId, sources) {
    const tblId = makeHiPSSurveysTableName(hipsId, sources);
    const tblHiPS = getHiPSSurveys(tblId);
    const groupId = findGroupByTblId(tblId);
    if (tblHiPS) {
        let hIdx = indexInHiPSSurveys(tblHiPS, url);

        if (hIdx < 0) {
            hIdx = 0;
        }
        if (hIdx !== tblHiPS.highlightedRow) {
            dispatchTableHighlight(tblId, hIdx);
        }
    }

}
import {get, isArray} from 'lodash';
import Enum from 'enum';
import {getAppOptions} from '../core/AppDataCntlr.js';
import {makeTblRequest, MAX_ROW} from '../tables/TableRequestUtil.js';
import {getColumnIdx, doFetchTable} from '../tables/TableUtil.js';
import {ServerParams} from '../data/ServerParams.js';
import {isBlankHiPSURL} from './WebPlot.js';

export const HiPSId = 'hips';
export const HiPSDataType= new Enum([ 'image', 'cube', 'catalog'], { ignoreCase: true });
export const HiPSData = [HiPSDataType.image, HiPSDataType.cube];
export const HiPSSources = ServerParams.IRSA + ',' + ServerParams.CDS;

export const IVO_ID_COL= 'CreatorID';
export const URL_COL= 'Url';
export const IVOAID_COL= 'CreatorID';
export const TITLE_COL= 'Title';

const BLANK_HIPS_URL= 'ivo://CDS/P/2MASS/color';
const HIPS_SEARCH = 'hips';
let FULL_HIPS_TABLE;            // saved for efficiency .. used by resolveHiPSIvoURL



export function useForImageSearch() {
    return get(getAppOptions(), ['hips', 'useForImageSearch'], false);
}

// convert comma separated string into trimmed-lowercase.
const toCsvLowercase = (items, sep = ',') => {
    return items?.split(sep).map( (s) => s?.trim()?.toLowerCase()).join(sep);
};

/**
 * get all available HiPS sources
 * @returns {string}
 */
export function getHiPSSources() {
    let srcs =  get(getAppOptions(), [HIPS_SEARCH, ServerParams.HIPS_SOURCES], ServerParams.ALL);

    if (srcs.toLowerCase() === ServerParams.ALL.toLowerCase()) {
        srcs = HiPSSources;
    }
    return toCsvLowercase(srcs);
}

/**
 * get default sources with source and label.  Put in an array if more than one.
 * i.e. {source: 'abc', label: 'ABC featured'}
 * @returns {Array}
 */
export function defHiPSSources() {
    let defObj = get(getAppOptions(), [HIPS_SEARCH, ServerParams.HIPS_DEFSOURCES]);
    if (!defObj) {
        // if not given, take the first entry from all sources
        defObj = getHiPSSources().split(',')?.map((s='') => ({source: s.trim(), label: s.trim().toUpperCase()}));
        defObj = defObj?.[0];
    }
    return isArray(defObj) ? defObj : [defObj];}


/**
 * get HiPS source priority for the merged list
 * @returns {string}
 */
export function getHiPSMergePriority() {
    const mergeP = get(getAppOptions(), [HIPS_SEARCH, ServerParams.HIPS_MERGE_PRIORITY], '');
    return toCsvLowercase(mergeP);
}


export function makeHiPSRequest(tableType, sources=getHiPSSources(), mocSources, tbl_id, types=HiPSData) {
    const sourceMergePriority = getHiPSMergePriority();
    const sp = sourceMergePriority?.join?.(',') || sourceMergePriority;
    const params=
        {
            [ServerParams.HIPS_DATATYPES]: types?.join(','),
            [ServerParams.HIPS_SOURCES]: sources,
            [ServerParams.HIPS_TABLE_TYPE]: tableType,
            [ServerParams.HIPS_MERGE_PRIORITY]: sp,
        };
    if (mocSources) params[ServerParams.ADD_HOC_SOURCE]= mocSources.join(',');
    return makeTblRequest('HiPSSearch', 'HiPS Maps', params, {tbl_id, pageSize: MAX_ROW});
}

/**
 * resolve a ivo hips id to a URL if a url is passed just return it.
 * @param {string} ivoOrUrl - a url or a IVO id
 * @return {Promise} a promise the resolves to a url
 */
export function resolveHiPSIvoURL(ivoOrUrl) {
    if (!ivoOrUrl) return Promise.reject(new Error('empty url'));
    if (ivoOrUrl.startsWith('http')) return Promise.resolve(ivoOrUrl);
    if (isBlankHiPSURL(ivoOrUrl)) ivoOrUrl= BLANK_HIPS_URL;

    const findInTable = (tableModel) => {
        const ivoIdx= getColumnIdx(tableModel, IVO_ID_COL);
        const urlIdx= getColumnIdx(tableModel, URL_COL);
        if (ivoIdx<0 || urlIdx<1) return undefined;
        const lowerIvo= ivoOrUrl.toLowerCase();
        // now match the table
        const foundRow= get(tableModel,'tableData.data', []).find( (row) =>
            row?.[ivoIdx]?.toLowerCase().includes(lowerIvo) );
        return foundRow?.[urlIdx] || ivoOrUrl;
    };

    if (FULL_HIPS_TABLE) {
        return Promise.resolve(findInTable(FULL_HIPS_TABLE));
    } else {
        const request = makeHiPSRequest('hips');
        return doFetchTable(request).then( (tableModel) => {
            FULL_HIPS_TABLE = tableModel;
            return findInTable(tableModel);
        });
    }

}

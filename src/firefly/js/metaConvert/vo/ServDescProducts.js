import {isEmpty} from 'lodash';
import {getComponentState} from '../../core/ComponentCntlr.js';
import {getCellValue} from '../../tables/TableUtil.js';
import {makeCircleString} from '../../ui/dynamic/DynamicUISearchPanel';
import {isSIAStandardID} from '../../ui/dynamic/ServiceDefTools';
import {CUTOUT_UCDs, standardIDs} from '../../voAnalyzer/VoConst';

import {isDataLinkServiceDesc} from '../../voAnalyzer/VoDataLinkServDef.js';
import {isDefined} from '../../util/WebUtil.js';
import {makeAnalysisActivateFunc} from '../AnalysisUtils.js';
import {DEFAULT_DATA_PRODUCTS_COMPONENT_KEY} from '../DataProductsCntlr.js';
import {dpdtAnalyze, dpdtImage} from '../DataProductsType.js';
import {createSingleImageActivate, createSingleImageExtraction} from '../ImageDataProductsUtil';
import {makeObsCoreRequest} from './VORequest.js';


export const SD_CUTOUT_KEY= 'sdCutoutSize';

/**
 *
 * @param {Object} p
 * @param p.name
 * @param p.serDef
 * @param p.sourceTable
 * @param p.sourceRow
 * @param p.idx
 * @param p.positionWP
 * @param p.activateParams
 * @param {DataProductsFactoryOptions} p.options
 * @param p.titleStr
 * @param p.activeMenuLookupKey
 * @param p.menuKey
 * @param [p.datalinkExtra]
 * @return {DataProductsDisplayType}
 */
export function makeServiceDefDataProduct({
                                              name, serDef, sourceTable, sourceRow, idx, positionWP, activateParams,
                                              options, titleStr, activeMenuLookupKey, menuKey,
                                              datalinkExtra = {} }) {
    const {title: servDescTitle = '', accessURL, standardID, serDefParams, ID} = serDef;
    const {activateServiceDef=false}= options;

    const allowsInput = serDefParams.some((p) => p.allowsInput);
    const noInputRequired = serDefParams.some((p) => !p.inputRequired);
    const {semantics, size, sRegion, prodTypeHint, serviceDefRef, dlAnalysis} = datalinkExtra;

    if (dlAnalysis?.isCutout && canMakeCutoutProduct(serDef,positionWP)) {
       return makeCutoutProduct({
           name, serDef, sourceTable, sourceRow, idx, positionWP, activateParams,
           options, titleStr, activeMenuLookupKey, menuKey, datalinkExtra
       });
    }
    else if (activateServiceDef && noInputRequired) {
        const url= makeUrlFromParams(accessURL, serDef, idx, getComponentInputs(serDef,options));
        const request = makeObsCoreRequest(url, positionWP, titleStr, sourceTable, sourceRow);
        const activate = makeAnalysisActivateFunc({table:sourceTable, row:sourceRow, request, activateParams,
            menuKey, dataTypeHint:prodTypeHint, serDef, options});
        return dpdtAnalyze({
            name:'Show: ' + (titleStr || name), activate, url:request.getURL(), serDef, menuKey,
            activeMenuLookupKey, request, sRegion, prodTypeHint, semantics, size, serviceDefRef});
    } else {
        const request = makeObsCoreRequest(accessURL, positionWP, titleStr, sourceTable, sourceRow);
        const activate = makeAnalysisActivateFunc({table:sourceTable, row:sourceRow, request, activateParams, menuKey,
            dataTypeHint:prodTypeHint ?? 'unknown', serDef, originalTitle:name,options});
        const entryName = `Show: ${titleStr || servDescTitle || `Service #${idx}: ${name}`} ${allowsInput ? ' (Input Required)' : ''}`;
        return dpdtAnalyze({
            name:entryName, activate, url:request.getURL(), serDef, menuKey,
            activeMenuLookupKey, request, allowsInput, serviceDefRef, standardID, ID,
            semantics, size, sRegion,
            prodTypeHint: prodTypeHint ?? 'unknown'
            });
    }
}

function canMakeCutoutProduct(serDef, positionWP){
    const {standardID,serDefParams} = serDef;

    if (!positionWP) return false;
    if (isSIAStandardID(standardID) || serDefParams.find( ({xtype}) => xtype?.toLowerCase()==='circle')  ) {
        return true;
    }
    const obsFieldParam= serDefParams.find( ({UCD=''}) =>
        CUTOUT_UCDs.find( (testUcd) => UCD.toLowerCase().includes(testUcd)) );
    return Boolean(obsFieldParam);
}

function makeCutoutProduct({ name, serDef, sourceTable, sourceRow, idx, positionWP, activateParams,
                             options, titleStr, menuKey}) {

    const {accessURL, standardID, serDefParams} = serDef;
    const key= options.dataProductsComponentKey ?? DEFAULT_DATA_PRODUCTS_COMPONENT_KEY;
    const cutoutSize= getComponentState(key,{})[SD_CUTOUT_KEY] ?? 0.0213;
    if (cutoutSize<=0) return; // must be greater than 0
    if (!positionWP) return; // this must exist, should check in calling function

    let params;
    const cutoutOptions= {...options};
    const {xtypeKeys=[],ucdKeys=[]}= cutoutOptions;
    if (isSIAStandardID(standardID) || serDefParams.find( ({xtype}) => xtype?.toLowerCase()==='circle')  ) {
        cutoutOptions.xtypeKeys= [...xtypeKeys,'circle'];
        params= {circle : makeCircleString(positionWP.x,positionWP.y,cutoutSize,standardID)};
    }
    else {
        const obsFieldParam= serDefParams.find( ({UCD=''}) =>
                              CUTOUT_UCDs.find( (testUcd) => UCD.toLowerCase().includes(testUcd)) );
        const ucd= obsFieldParam.UCD;
        cutoutOptions.ucdKeys= [...ucdKeys,ucd];
        params= {[ucd] : cutoutSize};
    }
    const url= makeUrlFromParams(accessURL, serDef, idx, getComponentInputs(serDef,cutoutOptions,params));
    const request = makeObsCoreRequest(url, positionWP, titleStr, sourceTable, sourceRow);

    const activate= createSingleImageActivate(request,activateParams.imageViewerId,sourceTable.tbl_id,sourceTable.highlightedRow);
    return dpdtImage({
        name:'Show: ' + (titleStr || name),
        activate, menuKey,
        extraction: createSingleImageExtraction(request), enableCutout:true,
        request, override:false, interpretedData:false, requestDefault:false});
}


/**
 * return a list of inputs from the user that will go into the service descriptor URL
 * @param serDef
 * @param {DataProductsFactoryOptions} options
 * @return {Object.<string, *>}
 */
function getComponentInputs(serDef, options, moreParams={}) {
    const key= options.dataProductsComponentKey ?? DEFAULT_DATA_PRODUCTS_COMPONENT_KEY;
    const valueObj= {...getComponentState(key,{}), ...moreParams};
    if (isEmpty(valueObj)) return {};
    const {serDefParams}= serDef;
    const {paramNameKeys= [], ucdKeys=[], utypeKeys=[], xtypeKeys=[]}= options;
    const userInputParams= paramNameKeys.reduce( (obj, key) => {
        if (isDefined(valueObj[key])) obj[key]= valueObj[key];
        return obj;
    },{});
    const ucdParams= ucdKeys.reduce( (obj, key) => {
        if (!isDefined(valueObj[key])) return obj;
        const foundParam= serDefParams.find((p) => p.UCD===key);
        if (foundParam) obj[foundParam.name]= valueObj[key];
        return obj;
    },{});
    const utypeParams= utypeKeys.reduce( (obj, key) => {
        if (!isDefined(valueObj[key])) return obj;
        const foundParam= serDefParams.find((p) => p.utype===key);
        if (foundParam) obj[foundParam.name]= valueObj[key];
        return obj;
    },{});
    const xtypeParams= xtypeKeys.reduce( (obj, key) => {
        if (!isDefined(valueObj[key])) return obj;
        const foundParam= serDefParams.find((p) => p.xtype===key);
        if (foundParam) obj[foundParam.name]= valueObj[key];
        return obj;
    },{});
    return {...ucdParams, ...utypeParams, ...userInputParams, ...xtypeParams};
}

/**
 *
 * @param {Object} p
 * @param {Array.<ServiceDescriptorDef>} p.descriptors
 * @param {WorldPt|undefined} p.positionWP
 * @param {TableModel} p.table
 * @param {number} p.row
 * @param {ActivateParams} p.activateParams
 * @param {String} p.activeMenuLookupKey
 * @param {DataProductsFactoryOptions} p.options
 * @return {Array.<DataProductsDisplayType>}
 */
export function createServDescMenuRet({ descriptors, positionWP, table, row,
                                          activateParams, activeMenuLookupKey, options }) {
    return descriptors
        .filter((sDesc) => !isDataLinkServiceDesc(sDesc))
        .map((serDef, idx) => {
            return makeServiceDefDataProduct({
                name: 'Show: ' + serDef.title,
                serDef, positionWP,
                sourceTable: table, sourceRow: row, idx: row,
                activateParams, options, activeMenuLookupKey,
                titleStr: serDef.title, menuKey: 'serdesc-dlt-' + idx
            });
        });
}

export function makeUrlFromParams(url, serDef, rowIdx, userInputParams = {}) {
    const sendParams = {};
    serDef?.serDefParams  // if it is defaulted, then set it
        ?.filter(({value}) => isDefined(value))
        .forEach(({name, value}) => sendParams[name] = value);
    serDef?.serDefParams // if it is referenced, then set it
        ?.filter(({ref}) => ref)
        .forEach((p) => sendParams[p.name] = getCellValue(serDef.sdSourceTable, rowIdx, p.colName));
    userInputParams && Object.entries(userInputParams).forEach(([k, v]) => v && (sendParams[k] = v));
    const newUrl = new URL(url);
    if (!newUrl) return undefined;
    Object.entries(sendParams).forEach(([k, v]) => newUrl.searchParams.append(k, v));
    logServiceDescriptor(newUrl, sendParams, newUrl.toString());
    return newUrl.toString();
}
function logServiceDescriptor(baseUrl, sendParams, newUrl) {
    // console.log(`service descriptor base URL: ${baseUrl}`);
    // Object.entries(sendParams).forEach(([k,v]) => console.log(`param: ${k}, value: ${v}`));
    console.log(`service descriptor new URL: ${newUrl}`);
}

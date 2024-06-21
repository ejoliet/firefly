import {Box, Link, Sheet, Skeleton, Stack, Typography} from '@mui/joy';
import {isArray, isEmpty} from 'lodash';
import {bool, func, object, shape, string} from 'prop-types';
import React, {useEffect, useState} from 'react';
import {makeWorldPt, visRoot} from '../../api/ApiUtilImage.jsx';
import {dispatchActiveTarget} from '../../core/AppDataCntlr.js';
import {getComponentState} from '../../core/ComponentCntlr.js';
import {MetaConst} from '../../data/MetaConst.js';
import {dispatchMountFieldGroup} from '../../fieldGroup/FieldGroupCntlr.js';
import {getFieldGroupResults} from '../../fieldGroup/FieldGroupUtils.js';
import {getJsonProperty} from '../../rpc/CoreServices.js';
import {makeFileRequest, MAX_ROW, META} from '../../tables/TableRequestUtil.js';
import {dispatchTableFetch, dispatchTableHighlight} from '../../tables/TablesCntlr.js';
import {getCellValue, getColumnIdx, getTblById, onTableLoaded,} from '../../tables/TableUtil.js';
import {Logger} from '../../util/Logger.js';
import {makeSearchOnce, toBoolean} from '../../util/WebUtil.js';
import CoordSys from '../../visualize/CoordSys.js';
import {ensureHiPSInit} from '../../visualize/HiPSListUtil.js';
import {getHiPSZoomLevelForFOV} from '../../visualize/HiPSUtil.js';
import {dispatchChangeCenterOfProjection, dispatchZoom} from '../../visualize/ImagePlotCntlr.js';
import {getPlotViewById, primePlot} from '../../visualize/PlotViewUtil.js';
import {pointEquals} from '../../visualize/Point.js';
import {CONE_CHOICE_KEY} from '../../visualize/ui/CommonUIKeys.js';
import {isHiPS} from '../../visualize/WebPlot.js';
import {UserZoomTypes} from '../../visualize/ZoomUtil.js';
import {cisxAdhocServiceUtype, standardIDs} from '../../voAnalyzer/VoConst.js';
import {FieldGroup} from '../FieldGroup.jsx';
import {FieldGroupTabs, Tab} from '../panel/TabPanel.jsx';
import {showInfoPopup} from '../PopupUtil.jsx';
import {useStoreConnector} from '../SimpleComponent.jsx';
import {analyzeQueries, handleSearch} from './DLGenAnalyzeSearch.js';
import {DLSearchTitle, SideBarAnimation, SideBarTable} from './DLuiDecoration.jsx';
import {DLuiRootSearchPanel} from './DLuiRootSearchPanel.jsx';
import {CIRCLE, POSITION, RANGE} from './DynamicDef.js';
import {convertRequest, DynLayoutPanelTypes, findTargetFromRequest} from './DynamicUISearchPanel.jsx';
import {getSpacialSearchType, hasValidSpacialSearch} from './DynComponents.jsx';
import {confirmDLMenuItem} from './FetchDatalinkTable.js';
import {getStandardIdType, ingestInitArgs, makeFieldDefs, makeSearchAreaInfo} from './ServiceDefTools.js';


export const DL_UI_LIST= 'DL_UI_LIST';
const HIPS_PLOT_ID= 'dlGeneratedHipsPlotId';
const registryData= {};

export function defaultGetCollectionUrl(registryTblId, rowIdx, columnName) {
    const table= getTblById(registryTblId);
    if (!table) return;
    return getCellValue(table,rowIdx,columnName);
}

export function defaultFindUrlInReg(url, registryTblId, columnName= 'access_url') {
    const table= getTblById(registryTblId);
    if (!table) return false;
    const idx= getColumnIdx(table, columnName);
    if (idx===-1) return false;
    return table?.tableData?.data?.findIndex( (d) => d[idx]===url);
}

const defaultRegistrySearchDef = {
    getCollectionAttributes: (registryTblId, rowIdx)  => ({}),     // eslint-disable-line no-unused-vars
    makeRegistryRequest: (url, registryTblId) =>
        makeFileRequest('registry', url, undefined, { pageSize: MAX_ROW, tbl_id: registryTblId, } ),
    getCollectionUrl: (registryTblId, rowIdx) => defaultGetCollectionUrl(registryTblId,rowIdx, 'access_url'),
    findUrlInReg: (url, registryTblId) =>  defaultFindUrlInReg(url,registryTblId,'access_url'),
};



const logger = Logger('DLGeneratedDropDown');



async function doLoadRegistry(url, request, registryTblId, name) {
    try {
        dispatchTableFetch(request);
        logger.warn(`Registry URL: ${url}`);
        const result= await onTableLoaded(registryTblId);
        const {tableModel}= result ?? {};
        if (tableModel.error) {
            tableModel.error = `Failed to get data for ${url}: ${tableModel.error}`;
        } else if (!tableModel.tableData) {
            tableModel.error = 'No data available';
        }
        registryData[name].regLoaded= true;
    } catch(reason) {
        return {error:`Failed to get schemas for ${url}: ${reason?.message ?? reason}`};
    }
}

const initPanelInfo= async (loadRegistry, registryTblId, makeRegistryRequest, name,setIsRegLoaded, setHasRegistry,urlApi,searchParams) => {
    const ctx= registryData[name];
    if (ctx.regLoaded || ctx.regLoading) return;
    ctx.regLoading= true;
    const registryUrl= loadRegistry ? await getJsonProperty('inventory.serverURLAry') : undefined;
    if (isEmpty(registryUrl)) {
        setHasRegistry(false);
        ctx.hasRegistry= false;
        if (urlApi?.url || searchParams?.url) {
            ctx.savedUrl= urlApi?.url || searchParams?.url;
        }
    }
    else {
        const r= makeRegistryRequest(registryUrl?.[0],registryTblId);
        await doLoadRegistry(registryUrl?.[0], r, registryTblId, name);
        ctx.regLoading=false;
        await ensureHiPSInit();
    }
    ctx.regLoaded= true;
    setIsRegLoaded(true);
};


export function DLGeneratedDropDown({initArgs={},
                                        registrySearchDef= defaultRegistrySearchDef,
                                        slotProps= {},
                                        loadRegistry=true,
                                        name = 'DLGeneratedDropDownCmd'}) {
    const registryTblId= `COLLECTIONS_NAV_TABLE-${name}`;
    const groupKey= name;
    const {urlApi,searchParams}= initArgs;
    const {fetchedTables={}}=  useStoreConnector(() => getComponentState(DL_UI_LIST));

    const [useCurrentIdx,setUseCurrentIdx]= useState(false);
    const [loadedTblIds, setLoadedTblIds]=  useState(registryData[name]?.loadedTblIdCache ?? {});
    const [regLoaded, setIsRegLoaded]= useState(registryData[name]?.regLoaded ?? false);
    const [initialRow]= useState(() => getTblById(registryTblId)?.highlightedRow ?? 0);
    const [hasRegistry,setHasRegistry]= useState(registryData[name]?.hasRegistry ?? true);
    const currentIdx= useStoreConnector(() => getTblById(registryTblId)?.highlightedRow ?? -1);
    const [url,setUrl]= useState();
    const [searchAttributes,setSearchAttributes]= useState({});
    const {makeRegistryRequest,findUrlInReg,getCollectionUrl,getCollectionAttributes}=
        { ...defaultRegistrySearchDef, ...registrySearchDef};

    registryData[name] ??= { regLoaded: false, hasRegistry:true, regLoading: false, loadedTblIdCache:undefined, savedUrl: undefined};

    registryData[name].loadedTblIdCache= loadedTblIds;

    useEffect(() => {
        setTimeout(() => confirmDLMenuItem(name), 20);
    }, []);

    useEffect(() => {// load registry and merge any already fetched tables
        void initPanelInfo(loadRegistry, registryTblId, makeRegistryRequest, name,
            setIsRegLoaded, setHasRegistry,urlApi,searchParams);
        if (!isEmpty(fetchedTables)) setLoadedTblIds({...loadedTblIds, ...fetchedTables});
    }, [fetchedTables]);

    useEffect(() => {
        const inUrl=  urlApi?.url ?? searchParams?.url ?? registryData[name].savedUrl;
        if (!inUrl) {
            setUseCurrentIdx(true);
            return;
        }
        const newUrl= isArray(inUrl) ? inUrl[0] : inUrl;
        if (!newUrl) return;
        setUseCurrentIdx(false);
        if (regLoaded && hasRegistry) {
            const rowIdx = findUrlInReg(newUrl, registryTblId);
            if (rowIdx > -1) {
                setUseCurrentIdx(true);
                dispatchTableHighlight(registryTblId, rowIdx);
            }
            else {
                setUrl(newUrl);
            }
        }
        else {
            setUrl(newUrl);
        }
    }, [urlApi?.url, searchParams?.url, registryData[name].savedUrl, regLoaded]);

    useEffect(() => {
        if (!useCurrentIdx && currentIdx>-1 && currentIdx!==initialRow) setUseCurrentIdx(true);
    }, [currentIdx]);

    useEffect(() => {
        if (!regLoaded || !useCurrentIdx) return;
        const newUrl= getCollectionUrl(registryTblId, currentIdx);
        if (newUrl) {
            setUrl(newUrl);
            setSearchAttributes(getCollectionAttributes(registryTblId,currentIdx));
        }
    }, [currentIdx, regLoaded, useCurrentIdx]);


    if (!hasRegistry && regLoaded && !url) {
        return (
            <Sheet>
                <Typography level='h4' color='warning' textAlign='center' mt={5}> No Collection loaded </Typography>
            </Sheet>
        );
    }

    return (<DLGeneratedDropDownTables {...{registryTblId,regLoaded, loadedTblIds, setLoadedTblIds, url,
        searchAttributes, groupKey, slotProps, findUrlInReg, initArgs, hasRegistry}}/>);
}

DLGeneratedDropDown.propTypes= {
    name: string,
    loadRegistry: bool,
    initArgs: shape({
        searchParams: object,
        urlApi: object,
    }),
    registrySearchDef: shape({
            makeRegistryRequest: func,
            findUrlInReg: func,
            getCollectionUrl: func,
            getCollectionAttributes: func
        }
    ),
    slotProps: shape({
        sideBar: shape({
            hideLabel: string,
            hideTip: string,
            chooserTitle: string,
            sideBarWidth: string,
            chooserDetails: string,
            sideTransition: string,
            }
        ),
        searchTitle: shape({
            showOtherDataLabel: string,
            allSkyAdditionalLabel: string,
        }),
    }),
};




function DLGeneratedDropDownTables({registryTblId, regLoaded, loadedTblIds, setLoadedTblIds, url, hasRegistry,
                                       searchAttributes, groupKey, slotProps, findUrlInReg, initArgs}) {

    const [sideBarShowing, setSideBarShowing]= useState(true);
    const currentTblId= loadedTblIds?.[url];
    useEffect(() => {
        if (regLoaded && !currentTblId) {
            const loadOptions=  {META_INFO:{
                    [MetaConst.LOAD_TO_DATALINK_UI]: 'true',
                    [MetaConst.IMAGE_SOURCE_ID] : 'FALSE',
                    ...searchAttributes,
                },
            };
            if (!url) return;
            console.log(`Dataset url: ${url}`);
            const req= makeFileRequest('Data link UI', url, undefined, loadOptions);
            const {tbl_id}= req.META_INFO;
            dispatchTableFetch(req);
            onTableLoaded(tbl_id).then(() => {
                setLoadedTblIds({...loadedTblIds, [url]:tbl_id});
            });

        }
    }, [currentTblId,url,regLoaded]);

    useEffect(() => {
        const showChooser= toBoolean(initArgs.urlApi?.showChooser ?? true, false, ['true','']);
        setSideBarShowing(showChooser);
    },[]);


    const sideBar= hasRegistry && <SideBarTable {...{registryTblId, setSideBarShowing,...slotProps.sideBar}}/>;
    const regHasUrl= findUrlInReg(url, registryTblId)>-1;
    const qAna= analyzeQueries(currentTblId);
    return (
        <Sheet sx={{display:'flex', flexDirection: 'row', width:1, height:1, minWidth:800, minHeight:400}}>
            <DLGeneratedTableSearch {...{currentTblId, qAna, groupKey, initArgs, sideBar, regHasUrl, url, regLoaded,slotProps, sideBarShowing, setSideBarShowing}}/>
        </Sheet>
    );
}



/**
 *
 * @param {Object} props
 * @param props.fds
 * @param props.groupKey
 * @param props.sx
 * @param props.desc
 * @param props.setSideBarShowing
 * @param props.sideBarShowing
 * @param props.docRows
 * @param props.setClickFunc
 * @param props.submitSearch
 * @param props.isAllSky
 * @param props.slotProps
 * @param {QueryAnalysis} props.qAna
 * @return {JSX.Element}
 * @constructor
 */
function ServDescPanel({fds, sx, desc, groupKey, setSideBarShowing, sideBarShowing, docRows, setClickFunc, submitSearch, isAllSky, qAna={},slotProps})  {
    const {concurrentSearchDef}= qAna;
    const SearchPanelWrapper= ({children}) => (
        <DLuiRootSearchPanel {...{children, groupKey, submitSearch, setClickFunc, docRows, concurrentSearchDef}}/>
    );
    return  (
        <Stack {...{justifyContent:'space-between', sx}}>
            <DLSearchTitle {...{desc,isAllSky,sideBarShowing,setSideBarShowing,...slotProps.searchTitle}}/>
            <DynLayoutPanelTypes.Inset fieldDefAry={fds} plotId={HIPS_PLOT_ID} style={{height:'100%', marginTop:4}}
                                       WrapperComponent={SearchPanelWrapper} toolbarHelpId={'dlGenerated.VisualSelection'} submitSearch={submitSearch} />
        </Stack>
    );
}

const TabView= ({tabsKey, groupKey, setSideBarShowing, sideBarShowing, searchObjFds,qAna, docRows, isAllSky, setClickFunc, submitSearch, slotProps}) => (
    <FieldGroupTabs style ={{height:'100%', width:'100%'}} initialState={{ value:searchObjFds[0]?.ID}} fieldKey={tabsKey}>
        {
            searchObjFds.map((sFds) => {
                const {fds, idx, ID, desc}= sFds;
                return (
                    <Tab name={`${qAna.primarySearchDef[idx].desc}`} id={ID} key={idx+''}>
                        <ServDescPanel{...{fds, groupKey, setSideBarShowing, sideBarShowing, sx:{width:1}, desc, docRows,
                            isAllSky, setClickFunc, submitSearch, qAna, slotProps}}/>
                    </Tab>
                );
            })
        }
    </FieldGroupTabs>
);



const executeInitOnce= makeSearchOnce(false);
const executeInitTargetOnce= makeSearchOnce(false);


function DLGeneratedTableSearch({currentTblId, qAna, groupKey, initArgs, sideBar, regHasUrl, url,
                                    sideBarShowing, slotProps, regLoaded, setSideBarShowing}) {
    const [,setCallId]= useState('none');
    const [{onClick},setClickFuncImpl]= useState({});
    const tabsKey= 'Tabs-'+currentTblId;
    const matchUrl= initArgs?.urlApi?.url?.[0]===url;

    const setClickFunc= (obj) => {
        if (obj?.onClick && !onClick) setClickFuncImpl(obj);
    };


    useEffect(() => {
        if (initArgs?.urlApi?.execute && onClick && matchUrl) {
            executeInitOnce(true, () => {
                logger.warn(`execute (${initArgs.urlApi.callId}) url: ${initArgs?.urlApi.url}`, initArgs?.urlApi);
                setCallId(initArgs.urlApi.callId ?? 'none'); //forces one more render after unmount
                dispatchMountFieldGroup(groupKey, false, false); // unmount to force to forget default so it will reinit
                setTimeout(() => onClick(),10);
            }, initArgs.urlApi.callId);
        }
    }, [onClick, initArgs?.urlApi?.callId, matchUrl]);


    const fdAry= qAna?.primarySearchDef.map( (fd) => {
        const {serviceDef}= fd; //todo handle case with only an access url
        if (!serviceDef) return;
        const standId= (serviceDef.standardID??'').toLowerCase();
        const utype= (serviceDef.utype||'').toLowerCase();
        let fdEntryAry;
        if (utype===cisxAdhocServiceUtype && standId.startsWith(standardIDs.tap) && serviceDef.cisxTokenSub) {
            fdEntryAry= makeFieldDefs(serviceDef.cisxTokenSub, undefined, makeSearchAreaInfo(serviceDef.cisxUI), false);
        }
        else {
            fdEntryAry= makeFieldDefs(serviceDef.serDefParams, undefined, makeSearchAreaInfo(serviceDef.cisxUI), true);
        }
        if (!isEmpty(initArgs.urlApi)) {
            const originalWp= fdEntryAry.find((fd) => fd.type===POSITION)?.initValue ?? fdEntryAry.find((fd) => fd.type===CIRCLE)?.targetDetails?.centerPt;
            const initFdEntryAry= ingestInitArgs(fdEntryAry,initArgs.urlApi);
            const initWp= initFdEntryAry.find((fd) => fd.type===POSITION)?.initValue ?? initFdEntryAry.find((fd) => fd.type===CIRCLE)?.targetDetails?.centerPt;
            if (!pointEquals(originalWp,initWp)) {
                executeInitTargetOnce(true, () => initWp && dispatchActiveTarget(initWp), initArgs?.urlApi?.callId);
            }
            return initFdEntryAry;
        }
        else {
            return fdEntryAry;
        }

    }).filter( (entry) => entry);


    const searchObjFds= fdAry
        ?.map((fds,idx) => {
            fds= fds.filter( (entry) => entry.type!==RANGE);
            const primeSd= qAna.primarySearchDef[idx].serviceDef;
            const desc= qAna.primarySearchDef[idx].desc;
            const {standardID='', ID}= primeSd;
            return {fds, standardID, idx, ID, desc};
        });

    const findFieldDefInfo= (request) =>
        searchObjFds.length===1 ? searchObjFds[0] : searchObjFds.find(({ID}) => ID===request[tabsKey]) ?? {};


    useEffect(() => { // on table change: recenter hips if no target entered, change hips if new one is specified
        if (!currentTblId) return;
        const plot= primePlot(visRoot(),HIPS_PLOT_ID);
        if (!plot || !isHiPS(plot)) return;
        if (!qAna?.primarySearchDef?.[0]?.serviceDef?.cisxUI) return;
        const request= getFieldGroupResults(groupKey); // todo: this might not be right, there might be an array of field groups
        const {fds}= findFieldDefInfo(request) ?? {};
        const tgt= findTargetFromRequest(request,fds);
        if (tgt) return;

        const {cisxUI}= qAna.primarySearchDef[0].serviceDef;
        const raStr= cisxUI.find( (e) => e.name==='hips_initial_ra')?.value;
        const decStr= cisxUI.find( (e) => e.name==='hips_initial_dec')?.value;
        const ucdStr= cisxUI.find( (e) => e.name==='hips_initial_ra')?.UCD;
        const fovStr= cisxUI.find( (e) => e.name==='hips_initial_fov')?.value;
        const coordSys= ucdStr==='pos.galactic.lon' ? CoordSys.GALACTIC : CoordSys.EQ_J2000;
        const centerProjPt= makeWorldPt(raStr, decStr, coordSys);
        if (!centerProjPt) return;
        dispatchChangeCenterOfProjection({plotId:HIPS_PLOT_ID, centerProjPt});
        const fov= Number(fovStr);
        const pv= getPlotViewById(visRoot(),HIPS_PLOT_ID);
        if (fov && pv) {
            const MIN_FOV_SIZE= .0025; // 9 arcsec - minimum fov for initial size
            const cleanFov= Math.max(fov,MIN_FOV_SIZE);
            const level= getHiPSZoomLevelForFOV(pv,cleanFov);
            if (level) dispatchZoom({plotId:pv.plotId, userZoomType: UserZoomTypes.LEVEL, level});
       }
    }, [currentTblId]);

    const {cisxUI}= qAna?.primarySearchDef?.[0]?.serviceDef ?? {};
    const isAllSky= toBoolean(cisxUI?.find( (e) => e.name==='data_covers_allsky')?.value);
    const docRows= qAna?.urlRows.filter( ({semantic}) => semantic?.toLowerCase().endsWith('documentation'));
    const submitSearch= (request) => doSubmitSearch(request,docRows,qAna,fdAry,searchObjFds,tabsKey);

    return (
        <Sheet sx={{width:1,height:1}}>
            <Stack {...{width:1, height:1, justifyContent:'center', p:1/4}}>
                <Stack {...{direction:'row', minWidth:800, minHeight:400, width:1, height:1, spacing:1/2}}>
                    {sideBar && <SideBarAnimation {...{sideBar,sideBarShowing,...slotProps.sideBar}}/>}
                    <FieldGroup groupKey={groupKey} keepState={true} style={{width:'100%'}}>
                        {(regLoaded && qAna) ? searchObjFds.length===1 ?
                                <ServDescPanel{...{initArgs, groupKey, setSideBarShowing, sideBarShowing, fds:searchObjFds[0].fds,
                                    setClickFunc, submitSearch, isAllSky, qAna, slotProps,
                                    sx:{width:1,height:1}, desc:searchObjFds[0].desc, docRows}} /> :
                                <TabView{...{initArgs, groupKey, tabsKey, setSideBarShowing, sideBarShowing, searchObjFds, qAna,
                                    docRows, isAllSky, setClickFunc, submitSearch, slotProps}}/>
                            :
                            <NotLoaded {...{regHasUrl,regLoaded,url}}/>
                        }
                    </FieldGroup>
                </Stack>
            </Stack>
        </Sheet>
    );
}



const NotLoaded= ({regHasUrl,regLoaded, url}) => (
    (regHasUrl || !regLoaded) ?
        (<Box sx={{position:'relative', width:1, height:1}}> <Skeleton/> </Box>) :
        (<Typography level='title-lg' color='warning' sx={{alignSelf:'center', pl:5}}>
            {`No collections to load from: ${url}`}
        </Typography>)
);


const doSubmitSearch= (r,docRows,qAna,fdAry,searchObjFds,tabsKey) => {
    const {fds, standardID, idx}=
        searchObjFds.length===1 ? searchObjFds[0] : searchObjFds.find(({ID}) => ID===r[tabsKey]) ?? {};

    if (!hasValidSpacialSearch(r,fds)) {
        showInfoPopup( getSpacialSearchType(r,fds)===CONE_CHOICE_KEY ?
                'Target is required' :
                'Search Area is require and must have at least 3 point pairs, each optionally separated by commas',
            'Error');
        return false;
    }

    const convertedR= convertRequest(r,fds,getStandardIdType(standardID));
    const selectedConcurrent= r.searchOptions ?? '';

    const numKeys= [...new Set(fds.map( ({key}) => key))].length;
    if (Object.keys(convertedR).length<numKeys) {
        showInfoPopup('Please enter all of the fields', 'Error');
        return false;
    }
    const extraMeta = docRows?.[0] ? {[META.doclink.url]: docRows[0].accessUrl, [META.doclink.desc]: docRows[0].desc} : {};
    handleSearch(convertedR,qAna,fdAry, idx, extraMeta, selectedConcurrent);
    return true;
};


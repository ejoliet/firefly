/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {useContext, useEffect, useState} from 'react';
import shallowequal from 'shallowequal';
import SplitPane from 'react-split-pane';

import {FieldGroupCtx} from '../../ui/FieldGroup.jsx';
import {FileUpload} from '../../ui/FileUpload.jsx';
import {getFieldVal, getField} from '../../fieldGroup/FieldGroupUtils';
import {TablePanel} from '../../tables/ui/TablePanel.jsx';
import {getCellValue, getTblById} from '../../tables/TableUtil.js';
import {dispatchTableAddLocal} from '../../tables/TablesCntlr.js';
import {getSizeAsString} from '../../util/WebUtil.js';

import {SelectInfo} from '../../tables/SelectInfo.js';
import ImagePlotCntlr from '../ImagePlotCntlr.js';
import {RadioGroupInputField} from '../../ui/RadioGroupInputField.jsx';
import {showInfoPopup} from '../../ui/PopupUtil.jsx';
import {WorkspaceUpload} from '../../ui/WorkspaceViewer.jsx';
import {isAccessWorkspace, getWorkspaceConfig} from '../WorkspaceCntlr.js';
import {isMOCFitsFromUploadAnalsysis} from '../HiPSMocUtil.js';
import {isLsstFootprintTable} from '../task/LSSTFootprintTask.js';
import {getComponentState, dispatchComponentStateChange} from '../../core/ComponentCntlr.js';

import {useStoreConnector} from '../../ui/SimpleComponent.jsx';

import './FileUploadViewPanel.css';
import {getIntHeader} from '../../metaConvert/PartAnalyzer';
import {FileAnalysisType} from '../../data/FileAnalysis';
import {dispatchValueChange} from 'firefly/fieldGroup/FieldGroupCntlr.js';
import {CompleteButton,NONE} from 'firefly/ui/CompleteButton.jsx';
import {getAppOptions} from 'firefly/core/AppDataCntlr.js';
import {dispatchAddActionWatcher, dispatchCancelActionWatcher} from 'firefly/core/MasterSaga.js';
import {CheckboxGroupInputField} from 'firefly/ui/CheckboxGroupInputField.jsx';
import {
    getFileFormat,
    getFirstPartType,
    getSelectedRows,
    isRegion
} from 'firefly/ui/FileUploadProcessor';

const  FILE_ID = 'fileUpload';
const  URL_ID = 'urlUpload';
const  WS_ID = 'wsUpload';

const SUPPORTED_TYPES=[
    FileAnalysisType.REGION,
    FileAnalysisType.Image,
    FileAnalysisType.Table,
    FileAnalysisType.Spectrum,
    FileAnalysisType.REGION,
];

const TABLES_ONLY_SUPPORTED_TYPES=[
    FileAnalysisType.Table,
];

const uploadOptions = 'uploadOptions';

const FILE_UPLOAD_KEY= 'file-upload-key-';
let keyCnt=0;

export function FileUploadViewPanel({setSubmitText, acceptMoc}) {

    const {groupKey}= useContext(FieldGroupCtx);

    const {isLoading,statusKey} = useStoreConnector(() => getComponentState(groupKey, {isLoading:false,statusKey:''}));
    const isWsUpdating          = useStoreConnector(() => isAccessWorkspace());
    const uploadSrc             = useStoreConnector(() => getFieldVal(groupKey, uploadOptions));


    const SUMMARY_TBL_ID = groupKey; //FileUploadAnalysis
    const DETAILS_TBL_ID = groupKey + '-Details';
    const UNKNOWN_FORMAT = 'UNKNOWN';
    const summaryUiId = SUMMARY_TBL_ID + '-UI';
    const detailsUiId = DETAILS_TBL_ID + '-UI';

    let {message, analysisResult, report, summaryModel, detailsModel, prevAnalysisResult} = useStoreConnector((oldState) =>
        getNextState(oldState, groupKey));

    const [loadingMsg,setLoadingMsg]= useState(() => '');
    const [uploadKey,setUploadKey]= useState(() => FILE_UPLOAD_KEY+keyCnt);

    useEffect(() => {
        dispatchValueChange({fieldKey:getLoadingFieldName(groupKey), groupKey:groupKey, prevAnalysisResult: analysisResult});
    }, [analysisResult]);

    useEffect(() => {
        dispatchValueChange({fieldKey:getLoadingFieldName(groupKey), groupKey:groupKey, report: report});
    }, [report]);

    useEffect(() => {
        if (message || analysisResult) dispatchComponentStateChange(groupKey, {isLoading: false});
    }, [message, analysisResult]);

    useEffect(() => {
        dispatchTableAddLocal(summaryModel, undefined, false);
        dispatchValueChange({fieldKey:getLoadingFieldName(groupKey), groupKey:groupKey, summaryModel: summaryModel});
    }, [summaryModel]);

    useEffect(() => {
        dispatchTableAddLocal(detailsModel, undefined, false);
    }, [detailsModel]);

    useEffect(() => {
        setSubmitText(getLoadButtonText(SUMMARY_TBL_ID,report,detailsModel,summaryModel));
    },[report,setSubmitText, summaryModel, detailsModel]);

    let aWStatusKey;
    useEffect(() => {
        if (isLoading) {
            if (statusKey) {
                aWStatusKey= statusKey;
                aWStatusKey && dispatchCancelActionWatcher(aWStatusKey);

                const watchForUploadUpdate= ({payload}) => {
                    payload.requestKey===statusKey && setLoadingMsg(payload.message);
                };
                dispatchAddActionWatcher({ id: statusKey, actions:[ImagePlotCntlr.PLOT_PROGRESS_UPDATE],
                    callback:watchForUploadUpdate, params:{statusKey}});
            }
        }
        else {
            setLoadingMsg('');
            dispatchCancelActionWatcher(aWStatusKey);
        }
        return (() => {
            aWStatusKey && dispatchCancelActionWatcher(aWStatusKey);
        });
    }, [isLoading, statusKey] );

    const isTablesOnly= () => getAppOptions()?.uploadPanelLimit==='tablesOnly';
    const tablesOnly= isTablesOnly();

    const workspace = getWorkspaceConfig();
    const uploadMethod = [{value: FILE_ID, label: 'Upload file'},
        {value: URL_ID, label: 'Upload from URL'}
    ].concat(workspace ? [{value: WS_ID, label: 'Upload from workspace'}] : []);

    const clearReport= () => {
        dispatchValueChange({fieldKey:getLoadingFieldName(groupKey), groupKey:groupKey, value:'', displayValue:'', analysisResult:undefined});
    };

    const isMoc=  isMOCFitsFromUploadAnalsysis(report)?.valid;

    return (
        <div style={{position: 'relative', height: '100%', display: 'flex', alignItems: 'stretch',
            flexDirection: 'column' }}>
                <div className='FileUpload'>
                    <div className='FileUpload__input'>
                        <RadioGroupInputField
                            initialState={{value: uploadMethod[0].value}}
                            fieldKey={uploadOptions}
                            alignment={'horizontal'}
                            options={uploadMethod}
                            wrapperStyle={{fontWeight: 'bold', fontSize: 12}}/>
                        <div style={{paddingTop: '10px', display:'flex', flexDirection:'row', justifyContent:'space-between'}}>
                            <UploadOptions {...{uploadSrc, isLoading, isWsUpdating,  uploadKey:uploadKey, groupKey}}/>
                            {report && <CompleteButton text='Clear File' groupKey={NONE}
                                                       onSuccess={() =>{
                                                           clearReport();
                                                           keyCnt++;
                                                           setUploadKey(FILE_UPLOAD_KEY+keyCnt);
                                                       }}/> }
                        </div>
                    </div>
                    <FileAnalysis {...{report, summaryModel, detailsModel,tablesOnly, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId, acceptMoc}}/>
                    <ImageDisplayOption SUMMARY_TBL_ID={SUMMARY_TBL_ID} currentReport={report} currentSummaryModel={summaryModel}/>
                    <TableDisplayOption isMoc={isMoc} SUMMARY_TBL_ID={SUMMARY_TBL_ID} currentReport={report} currentSummaryModel={summaryModel}/>
                </div>
                {(isLoading) && <LoadingMessage message={loadingMsg}/>}
        </div>
    );
}

const LoadingMessage= ({message}) => (
    <div style={{
        position: 'absolute',
        display:'flex',
        flexDirection: 'column',
        justifyContent:'center',
        background: 'rgba(0,0,0,.25)',
        alignItems: 'center',
        top:1, bottom:5, left:1, right:1 }}>
        <div style={{width:30, height:30}} className='loading-animation' />
        {Boolean(message?.trim()) &&
        <div style={{
            alignSelf:'center', fontSize:'14pt', padding: 8, marginTop:15,
            backgroundColor: 'rgba(255,255,255,.8)', borderRadius:8}}>
            {message}
        </div>}
    </div>
);

function getLoadButtonText(SUMMARY_TBL_ID,currentReport,currentDetailsModel,currentSummaryModel) {
    const tblCnt = getSelectedRows(FileAnalysisType.Table, SUMMARY_TBL_ID, currentReport, currentSummaryModel)?.length ?? 0;
    if (tblCnt && isMOCFitsFromUploadAnalsysis(currentReport).valid) return 'Load MOC';
    if (isRegion(currentSummaryModel)) return 'Load Region';

    const imgCnt = getSelectedRows(FileAnalysisType.Image, SUMMARY_TBL_ID, currentReport, currentSummaryModel)?.length ?? 0;

    if (isLsstFootprintTable(currentDetailsModel) ) return 'Load Footprint';
    if (tblCnt && !imgCnt) return tblCnt>1 ? `Load ${tblCnt} Tables` : 'Load Table';
    if (!tblCnt && imgCnt) return imgCnt>1 ? `Load ${imgCnt} Images` : 'Load Image';
    if (tblCnt && imgCnt) return `Load ${imgCnt>1?imgCnt+' ' : ''}Image${imgCnt >1 ?'s':''} and ${tblCnt>1?tblCnt+' ' : ''}Table${tblCnt>1? 's':''}`;
    return  'Load';
}


export function resultFail() {
    showInfoPopup('One or more fields are invalid', 'Validation Error');
}


function isSinglePartFileSupported(currentSummaryModel) {
    const isTablesOnly= () => getAppOptions()?.uploadPanelLimit==='tablesOnly';
    const supportedTypes= isTablesOnly() ? TABLES_ONLY_SUPPORTED_TYPES : SUPPORTED_TYPES;
    return getFirstPartType(currentSummaryModel) && (supportedTypes.includes(getFirstPartType(currentSummaryModel)));
}


function getFirstExtWithData(parts) {
    const isTablesOnly= () => getAppOptions()?.uploadPanelLimit==='tablesOnly';
    return isTablesOnly() ?
        parts.findIndex((p) => p.type.includes(FileAnalysisType.Table)) :
        parts.findIndex((p) => !p.type.includes(FileAnalysisType.HeaderOnly));
}

/*-----------------------------------------------------------------------------------------*/

const getLoadingFieldName= (groupKey) => getFieldVal(groupKey, uploadOptions) || FILE_ID;

function getNextState(oldState, groupKey) {
    // because this value is stored in different fields.. so we have to check on what options were selected to determine the active value

    const SUMMARY_TBL_ID = groupKey; //FileUploadAnalysis
    const DETAILS_TBL_ID = groupKey + '-Details';
    const UNKNOWN_FORMAT = 'UNKNOWN';

    let currentReport, currentSummaryModel, currentDetailsModel;

    const fieldState = getField(groupKey, getLoadingFieldName(groupKey)) || {};
    let {analysisResult, message, summaryModel, prevAnalysisResult, report} = fieldState;

    prevAnalysisResult = oldState?.analysisResult? oldState.analysisResult : prevAnalysisResult;
    currentReport = oldState?.report? oldState.report: report;
    currentSummaryModel = oldState?.summaryModel? oldState.summaryModel: summaryModel;
    currentDetailsModel = oldState?.detailsModel;

    if (!analysisResult) { //clearReport sets analysisResult:undefined, so set currentReport=undefined to clear the file
        currentReport = undefined;
    }
    let modelToUseForDetails= getTblById(SUMMARY_TBL_ID)?? currentSummaryModel;

    if (message) {
        return {message, report:undefined, summaryModel:undefined, detailsModel:undefined};
    } else  if (analysisResult) {
        if (analysisResult && analysisResult !== prevAnalysisResult) {
            currentReport = JSON.parse(analysisResult);
            if (currentReport.fileFormat===UNKNOWN_FORMAT) {
                return {message:'Unrecognized file type', report:undefined, summaryModel:undefined, detailsModel:undefined};
            }

            currentSummaryModel= makeSummaryModel(currentReport, SUMMARY_TBL_ID);
            modelToUseForDetails= currentSummaryModel;

            const firstExtWithData= getFirstExtWithData(currentReport.parts);
            if (firstExtWithData >= 0) {
                const selectInfo = SelectInfo.newInstance({rowCount: currentSummaryModel.tableData.data.length});
                selectInfo.setRowSelect(firstExtWithData, true);        // default select first extension/part with data
                currentSummaryModel.selectInfo = selectInfo.data;
                modelToUseForDetails.highlightedRow= firstExtWithData;
            }

        }
    }
    detailsModel = getDetailsModel( modelToUseForDetails,currentReport,DETAILS_TBL_ID,UNKNOWN_FORMAT);
    if (shallowequal(detailsModel, currentDetailsModel)) {
        detailsModel = currentDetailsModel;
    }

    const newState= {message, analysisResult, report:currentReport, summaryModel:currentSummaryModel, detailsModel,
                    prevAnalysisResult: oldState?.analysisResult};
    if (statesEqual(oldState,newState)) {
        return oldState;
    }
    else {
        // even if we have a new state, test to see if we have to replace the summaryModel.
        return oldState &&
        summaryModelEqual(newState.summaryModel,oldState.summaryModel) &&
        oldState.analysisResult!==oldState.analysisResult ?
            {...newState,summaryModel:oldState.summaryModel} : newState;
    }
}

function statesEqual(s1,s2) {
    if (!s1 || !s2) return false;
    if (s1.message!==s2.message) return false;
    if (s1.analysisResult!==s2.analysisResult) return false;
    const r1= s1.report;
    const r2= s2.report;
    if (r1 && r2) {
        if (r1 !== r2) {
            if (r1.fileName !== r2.fileName || r1.fileFormat !== r2.fileFormat ||
                r1.fileSize !== r2.fileSize || r1.parts?.length !== r2.parts?.length) return false;
        }
    }
    if ((r1 && !r2) || (!r1 && r2)) {
        return false;
    }

    if (!summaryModelEqual(s1.summaryModel, s2.summaryModel)) return false;

    const d1= s1.detailsModel;
    const d2= s2.detailsModel;
    if (d1 && d2) {
        if (d1 !== d2 &&
            (d1?.totalRows !== d2?.totalRows ||
                d1?.tableData.data?.find((d, idx) => d?.[2] !== d2?.tableData.data[idx][2]))) return false;
    }
    if ((d1 && !d2) || (!d1 && d2)) {
        return false;
    }
    return true;

}

function summaryModelEqual(sm1,sm2) {
    return !(sm1 !== sm2 &&
        sm1?.totalRows !== sm2?.totalRows &&
        sm1?.selectInfo !== sm2?.selectInfo);
}

function makeSummaryModel(report, SUMMARY_TBL_ID) {
    const columns = [
        {name: 'Index', type: 'int', desc: 'Extension Index'},
        {name: 'Type', type: 'char', desc: 'Data Type'},
        {name: 'Description', type: 'char', desc: 'Extension Description'}
    ];
    const {parts=[]} = report;
    const data = parts.map( (p) => {
        const naxis= getIntHeader('NAXIS',p,0);
        return [p.index, (naxis===1 && p.type===FileAnalysisType.Image)?FileAnalysisType.Table :p.type, p.desc];
    });
    const summaryModel = {
        tbl_id: SUMMARY_TBL_ID,
        title: 'File Summary',
        totalRows: data.length,
        tableData: {columns, data}
    };
    return summaryModel;
}

function getDetailsModel(tableModel, report, DETAILS_TBL_ID, UNKNOWN_FORMAT) {
    if (!tableModel) return;
    const {highlightedRow=0} = tableModel;
    const partNum = getCellValue(tableModel, highlightedRow, 'Index');
    const type = getCellValue(tableModel, highlightedRow, 'Type');
    if (type===UNKNOWN_FORMAT) return undefined;
    const details = report?.parts?.[partNum]?.details;
    if (details) details.tbl_id = DETAILS_TBL_ID;
    return details;
}

function TableDisplayOption({isMoc, SUMMARY_TBL_ID, currentReport, currentSummaryModel}) {

    const selectedTables = getFileFormat(currentReport) ?
        getSelectedRows('Table', SUMMARY_TBL_ID, currentReport, currentSummaryModel) : [];
        //useStoreConnector(() => getFileFormat(currentReport) ?
        //getSelectedRows('Table', SUMMARY_TBL_ID, currentReport, currentSummaryModel) : [] );
    if ( selectedTables.length < 1) return null;

    if (isMoc) {
        const options= [{label:'Load as MOC Overlay', value:'moc'}, {label:'Load as Table', value:'table'}];
        return (
            <div style={{padding: '5px 0 5px 0'}}>
                <RadioGroupInputField options={options}
                                      labelWidth={100}
                                      alignment={'horizontal'}
                                      defaultValue = {'moc'}
                                      fieldKey = 'mocOp' />

            </div>
        );
    }

    return (
        <div style={{marginTop: 3}}>
            <div style={{padding:'5px 0 9px 0'}}>
                <CheckboxGroupInputField
                    options={[{value: 'spectrum',
                        title:'If possible - interpret table columns names to fit into a spectrum data model',
                        label:'Attempt to interpret tables as spectra'}]}
                    fieldKey='tablesAsSpectrum'
                    labelWidth={90}
                />
            </div>
        </div>
    );
}

function ImageDisplayOption({SUMMARY_TBL_ID, currentReport, currentSummaryModel}) {
    const selectedImages = getSelectedRows('Image', SUMMARY_TBL_ID, currentReport, currentSummaryModel);//useStoreConnector(() => getSelectedRows('Image', SUMMARY_TBL_ID, currentReport, currentSummaryModel));
    if ( selectedImages.length < 2) return null;

    const imgOptions = [{value: 'oneWindow', label: 'All images in one window'},
        {value: 'mulWindow', label: 'One extension image per window'}];
    return (
        <div style={{marginTop: 3}}>
            <RadioGroupInputField
                tooltip='display image extensions in one window or multiple windows'
                fieldKey='imageDisplay'
                options={imgOptions}
            />
        </div>
    );
}

function UploadOptions({uploadSrc=FILE_ID, isloading, isWsUpdating, uploadKey, groupKey}) {

    const onLoading = (loading, statusKey) => {
        dispatchComponentStateChange(groupKey, {isLoading: loading, statusKey:loading?statusKey:''});
    };

    if (uploadSrc === FILE_ID) {
        return (
            <FileUpload
                key={uploadKey}
                innerStyle={{width: '7em'}}
                fileNameStyle={{marginLeft: 5, fontSize: 12}}
                fieldKey={FILE_ID}
                fileAnalysis={onLoading}
                tooltip='Select a file with FITS, VOTABLE, CSV, TSV, or IPAC format'
            />
        );
    } else if (uploadSrc === URL_ID) {
        return (
            <FileUpload
                key={uploadKey}
                innerStyle={{width: 300}}
                fieldKey={URL_ID}
                fileAnalysis={onLoading}
                isFromURL={true}
                label='Enter URL of a file:'
                tooltip='Select a URL with file in FITS, VOTABLE, CSV, TSV, or IPAC format'
            />
        );
    } else if (uploadSrc === WS_ID) {
        return (
            <WorkspaceUpload
                key={uploadKey}
                wrapperStyle={{marginRight: 32}}
                preloadWsFile={true}
                fieldKey={WS_ID}
                isLoading={isloading || isWsUpdating}
                fileAnalysis={onLoading}
                tooltip='Select a file in FITS, VOTABLE, CSV, TSV, or IPAC format from workspace'
            />
        );
    }
    return null;
}

function AnalysisInfo({report,supported=true,UNKNOWN_FORMAT}) {
    const partDesc = report.fileFormat === 'FITS' ? 'Extensions:' :
        report.fileFormat === UNKNOWN_FORMAT ? '' : 'Parts:';
    const partCnt= report?.parts?.length ?? 1;
    return (
        <div className='FileUpload__headers'>
            <div className='keyword-label'>Format:</div>  <div className='keyword-value'>{report.fileFormat}</div>
            <div className='keyword-label'>Size:</div>  <div className='keyword-value'>{getSizeAsString(report.fileSize)}</div>
            <div className='keyword-label'>Name:</div>  <div className='keyword-value'>{report.fileName}</div>
            {partCnt>1 && <div className='keyword-label'>{partDesc}</div>}
            {partCnt>1 &&<div className='keyword-value'>{partCnt}</div> }
            {!supported && <div style={{color:'red', fontSize:'larger'}}>
                {getFirstPartType() ? `File type of ${getFirstPartType()} is not supported` : 'Could not recognize the file type'}</div>}
        </div>
    );
}

const tblOptions = {showToolbar:false, border:false, showOptionButton: false, showFilters: true};

function AnalysisTable({summaryModel, detailsModel, report, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId}) {
    if (!summaryModel) return null;

    // Details table need to render first to create a stub to collect data when Summary table is loaded.
    return (
        <div className='FileUpload__summary'>
            {(summaryModel.tableData.data.length>1) ?
                <MultiDataSet summaryModel={summaryModel} detailsModel={detailsModel} isMoc={isMoc} summaryUiId={summaryUiId}/> :
                <SingleDataSet type={summaryModel.tableData.data[0][1]} desc={summaryModel.tableData.data[0][2]}
                               detailsModel={detailsModel} report={report} UNKNOWN_FORMAT={UNKNOWN_FORMAT} detailsUiId={detailsUiId}
                               currentSummaryModel={summaryModel}
                />
            }
        </div>
    );
}

function SingleDataSet({type, desc, detailsModel, report, UNKNOWN_FORMAT, detailsUiId, currentSummaryModel}) {
    const supported = isSinglePartFileSupported(currentSummaryModel);
    const showDetails= supported && detailsModel;
    return (
        <div style={{display:'flex', flex:'1 1 auto', justifyContent: showDetails?'start':'center'}}>
            <div style={{padding:'30px 20px 0 0'}}>
                <div style={{whiteSpace:'nowrap', fontSize:'larger', fontWeight:'bold', paddingBottom:40}}>
                    {type}{desc ? ` - ${desc}` : ''}
                </div>
                <AnalysisInfo report={report} supported={supported} UNKNOWN_FORMAT={UNKNOWN_FORMAT} />
                <div style={{paddingTop:15}}>No other detail about this file</div>
            </div>
            {  showDetails && <Details detailsModel={detailsModel} detailsUiId={detailsUiId}/>}
        </div>
    );
}

function MultiDataSet({summaryModel, detailsModel, isMoc, summaryUiId}) {
    return (
        <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
            {
                isMoc &&
                <div style={{height: 20, fontWeight: 'bold', alignSelf: 'center', fontSize: 'larger', }}>
                    This table is a MOC and can be overlaid on a HiPS Survey
                </div>
            }
            <div style={{height:'100%', position:'relative'}}>
                <SplitPane split='vertical' maxSize={-20} minSize={20} defaultSize={350}>
                    <TablePanel showTypes={false} title='File Summary' tableModel={summaryModel} tbl_ui_id={summaryUiId} {...tblOptions} />
                    <Details detailsModel={detailsModel}/>
                </SplitPane>
            </div>
        </div>
    );
}


function Details({detailsModel,detailsUiId}) {
    if (!detailsModel) return <div className='FileUpload__noDetails'>Details not available</div>;

    return (
        <TablePanel showTypes={false}  title='File Details'
                    tableModel={detailsModel} tbl_ui_id={detailsUiId}
                    {...tblOptions} showMetaInfo={true} selectable={false}/>
    );

}


function getTableArea(report, summaryModel, detailsModel, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId) {
    if (report?.fileFormat === UNKNOWN_FORMAT) {
        return (
            <div style={{flexGrow: 1, marginTop: 40, textAlign:'center', fontSize: 'larger', color: 'red'}}>
                Error: Unrecognized Format
            </div>
        );
    }
    return <AnalysisTable {...{summaryModel, detailsModel, report, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId}} />;
}


const FileAnalysis = ({report, summaryModel, detailsModel, tablesOnly, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId, acceptMoc}) => {
    //getting FieldGroup context and adding required params to the request object (sent to resultSuccess)
    const {groupKey, register, unregister}= useContext(FieldGroupCtx);
    const additionalReqObjs = {summaryModel: summaryModel, currentReport: report, currentDetailsModel: detailsModel, groupKey: groupKey};
    //const [getRequestObjs, setRequestObjs] = useFieldGroupMetaState(additionalReqObjs);
    useEffect(() => {
        register('additionalParams', () => additionalReqObjs);
        return () => unregister('additionalParams');
    }, [report]);

    if (acceptMoc && !isMoc) {
        return (<div style={{color:'gray', margin:'20px 0 0 200px', fontSize:'larger', lineHeight:'1.3em'}}>
            Warning: You are attempting to upload a non-MOC file.
        </div>);
    }

    else if (report) {
        return (
            <div className='FileUpload__report'>
                {summaryModel.tableData.data.length>1 && <AnalysisInfo report={report} />}
                {getTableArea(report, summaryModel, detailsModel, isMoc, UNKNOWN_FORMAT, summaryUiId, detailsUiId)}
            </div>
        );
    }

    else {
        const liStyle= {listStyleType:'circle'};
        return (<div style={{color:'gray', margin:'20px 0 0 200px', fontSize:'larger', lineHeight:'1.3em'}}>
            You can load any of the following types of files:
            <ul>
                <li style={liStyle}>Custom catalog in IPAC, CSV, TSV, VOTABLE, or FITS table format</li>
                {!tablesOnly && <li style={liStyle}>Any FITS file with tables or images (including multiple HDUs)</li>}
                {!tablesOnly && <li style={liStyle}>A Region file</li> }
                {!tablesOnly && <li style={liStyle}>A MOC FITS file</li> }
            </ul>
        </div>);

    }
};





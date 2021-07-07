/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import React, {memo,useState} from 'react';
import PropTypes from 'prop-types';
import {set, isEmpty, capitalize} from 'lodash';
import {dispatchShowDialog, dispatchHideDialog, isDialogVisible} from '../core/ComponentCntlr.js';
import {Operation} from '../visualize/PlotState.js';
import {getRootURL, getCmdSrvURL, encodeUrl, updateSet, replaceExt} from '../util/WebUtil.js';
import {RadioGroupInputField} from './RadioGroupInputField.jsx';
import CompleteButton from './CompleteButton.jsx';
import {FieldGroup} from './FieldGroup.jsx';
import DialogRootContainer from './DialogRootContainer.jsx';
import {PopupPanel} from './PopupPanel.jsx';
import FieldGroupUtils, {getFieldVal} from '../fieldGroup/FieldGroupUtils.js';
import {primePlot, getActivePlotView, getAllCanvasLayersForPlot, isThreeColor} from '../visualize/PlotViewUtil.js';
import {Band} from '../visualize/Band.js';
import {visRoot} from '../visualize/ImagePlotCntlr.js';
import {isImage} from '../visualize/WebPlot.js';
import {makeRegionsFromPlot} from '../visualize/region/RegionDescription.js';
import {saveDS9RegionFile} from '../rpc/PlotServicesJson.js';
import FieldGroupCntlr from '../fieldGroup/FieldGroupCntlr.js';
import {DownloadOptionsDialog, fileNameValidator, getTypeData, WORKSPACE, LOCALFILE} from './DownloadOptionsDialog.jsx';
import {isValidWSFolder, WS_SERVER_PARAM, getWorkspacePath, isWsFolder, dispatchWorkspaceUpdate} from '../visualize/WorkspaceCntlr.js';
import {doDownloadWorkspace, workspacePopupMsg, validateFileName} from './WorkspaceViewer.jsx';
import {ServerParams} from '../data/ServerParams.js';
import {INFO_POPUP, showInfoPopup} from './PopupUtil.jsx';
import {getWorkspaceConfig} from '../visualize/WorkspaceCntlr.js';
import {upload} from '../rpc/CoreServices.js';
import {download, downloadBlob, makeDefaultDownloadFileName} from '../util/fetch.js';
import {useBindFieldGroupToStore} from './SimpleComponent.jsx';

import HelpIcon from './HelpIcon.jsx';

const STRING_SPLIT_TOKEN= '--STR--';
const dialogWidth = 500;
const dialogHeightWS = 500;
const dialogHeightLOCAL = 400;
const mTOP = 10;
const dialogPopupId = 'fitsDownloadDialog';
const fitsDownGroup = 'FITS_DOWNLOAD_FORM';
const labelWidth = 100;
const hipsFileTypeOps= [ {label: 'PNG File', value: 'png' }, {label: 'Region File', value: 'reg'} ];
const imageFileTypeOps=  [{label: 'FITS Image', value: 'fits'}, ...hipsFileTypeOps];

const fKeyDef = {
    fileType: {fKey: 'fileType', label: 'Type of files:'},
    opOption: {fKey: 'operationOption', label: 'FITS Image:'},
    colorBand:{fKey: 'threeBandColor', label: 'Color Band:'},
    fileName: {fKey: 'fileName', label: 'File name:'},
    location: {fKey: 'fileLocation', label: 'File location:'},
    wsSelect: {fKey: 'wsSelect', label: ''},
    overWritable: {fKey: 'fileOverwritable', label: 'File overwritable: '}
};

const defValues = {
    [fKeyDef.fileType.fKey]: Object.assign(getTypeData(fKeyDef.fileType.fKey, 'fits',
        'Please select an file type', fKeyDef.fileType.label, labelWidth), {validator: null}),
    [fKeyDef.opOption.fKey]: Object.assign(getTypeData(fKeyDef.opOption.fKey, 'fileTypeOrig',
        'Please select an option', fKeyDef.opOption.label, labelWidth), {validator: null}),
    [fKeyDef.colorBand.fKey]: Object.assign(getTypeData(fKeyDef.colorBand.fKey, '',
        'Please select a color option', fKeyDef.colorBand.label, labelWidth), {validator: null}),
    [fKeyDef.fileName.fKey]: Object.assign(getTypeData(fKeyDef.fileName.fKey, '',
        'Please enter a filename, a default name will be used if it is blank', fKeyDef.fileName.label, labelWidth), {validator: null}),
    [fKeyDef.location.fKey]: Object.assign(getTypeData(fKeyDef.location.fKey, 'isLocal',
        'select the location where the file is downloaded to', fKeyDef.location.label, labelWidth), {validator: null}),
    [fKeyDef.wsSelect.fKey]: Object.assign(getTypeData(fKeyDef.wsSelect.fKey, '',
        'workspace file system', fKeyDef.wsSelect.label, labelWidth), {validator: null}),
    [fKeyDef.overWritable.fKey]: Object.assign(getTypeData(fKeyDef.overWritable.fKey, '0',
        'File is overwritable', fKeyDef.overWritable.label, labelWidth), {validator: null})
};

const popupPanelResizableStyle = {
    width: dialogWidth,
    minWidth: dialogWidth,
    resize: 'both',
    overflow: 'hidden',
    position: 'relative'
};

export function showFitsDownloadDialog() {
    const fileLocation = getFieldVal(fitsDownGroup, 'fileLocation', LOCALFILE);
    if (fileLocation === WORKSPACE) dispatchWorkspaceUpdate();

    const isWs = getWorkspaceConfig();
    const adHeight = (fileLocation === WORKSPACE) ? dialogHeightWS
                                                         : (isWs ? dialogHeightLOCAL : dialogHeightLOCAL - 100);
    const minHeight = (fileLocation === LOCALFILE) && (!isWs) ? dialogHeightLOCAL-100 : dialogHeightLOCAL;
    const  popup = (
        <PopupPanel title={'Save Image'}>
            <div style={{...popupPanelResizableStyle, height: adHeight, minHeight}}>
                <FitsDownloadDialogForm groupKey={fitsDownGroup} popupId={dialogPopupId} isWs={isWs}/>
            </div>
        </PopupPanel>
    );
    DialogRootContainer.defineDialog(dialogPopupId , popup);
    dispatchShowDialog(dialogPopupId);
}

function closePopup(popupId) {
    popupId && dispatchHideDialog(popupId);
    if (isDialogVisible(INFO_POPUP)) dispatchHideDialog(INFO_POPUP);
}

const getColors= (plot) => isThreeColor(plot) ? plot.plotState.getBands().map( (b) => capitalize(b.key)) : ['NO_BAND'];

const renderOperationOption= () => (
        <div style={{display: 'flex', marginTop: mTOP}}>
            <div>
                <RadioGroupInputField
                    options={[ { label:'Original', value:'fileTypeOrig'}, { label:'Cropped', value:'fileTypeCrop'} ]}
                    fieldKey='operationOption' />
            </div>
        </div> );

function renderThreeBand(colors) {
    const ft = FieldGroupUtils.getGroupFields(fitsDownGroup)?.fileType?.value;
    if (ft==='png' || ft==='reg') return false;
    return (
        <div style={{display: 'flex', marginTop: mTOP}}>
            <div>
                <RadioGroupInputField options={colors.map( (c) => ({label: c, value: c}))} fieldKey='threeBandColor' />
            </div>
        </div> );
}

const makeFileOptions= (plot,colors,hasOperation) => (
    <div>
        <div style={{display: 'flex', marginTop: mTOP}}>
            <div>
                <RadioGroupInputField options={isImage(plot) ? imageFileTypeOps : hipsFileTypeOps} fieldKey='fileType'/>
            </div>
        </div>
        {hasOperation && renderOperationOption()}
        {isThreeColor(plot) && renderThreeBand(colors)}
    </div>);

function getInitState()  {
    const pv= getActivePlotView(visRoot());
    const plot = primePlot(pv);
    const colors= getColors(plot);
    return {
        plot, pv, colors,
        threeC: isThreeColor(plot),
        hasOperation: plot.plotState.hasOperation(Operation.CROP) && !plot.plotState.hasOperation(Operation.ROTATE),
    };
}

const FitsDownloadDialogForm= memo( ({isWs, popupId, groupKey}) => {
    const [{pv,plot,hasOperation,threeC,colors}]= useState(getInitState);
    useBindFieldGroupToStore(groupKey); // this will force a rerender when anything changes
    const band = threeC ? getFieldVal(groupKey, 'threeBandColor', colors[0]) : Band.NO_BAND.key;
    const totalChildren = (isWs ? 3 : 2) +  (hasOperation ? 1 : 0) + (threeC ? 1 : 0);// fileType + save as + (fileLocation)
    const childH = (totalChildren*(20+mTOP));

    return (
        <FieldGroup style={{height: 'calc(100% - 10px)', width: '100%'}} groupKey={groupKey}
                    reducerFunc={makeFitsDLReducer(plot,band)}>
            <div style={{boxSizing: 'border-box', paddingLeft:5, paddingRight:5, width: '100%', height: 'calc(100% - 70px)'}}>
                <DownloadOptionsDialog {...{
                    fromGroupKey:groupKey, workspace:isWs, children: makeFileOptions(plot,colors,hasOperation),
                    labelWidth, dialogWidth:'100%', dialogHeight:`calc(100% - ${childH}pt)` }}/>
            </div>
            <div style={{display:'flex', width:'calc(100% - 20px)', margin: '20px 10px 10px 10px', justifyContent:'space-between'}}>
                <div style={{display:'flex', width:'30%', justifyContent:'space-around'}}>
                    <CompleteButton text='Save' onSuccess={ (request) => resultsSuccess(request, pv, popupId )}
                                    onFail={resultsFail} />
                    <CompleteButton text='Cancel' groupKey='' onSuccess={() => closePopup(popupId)} />
                </div>
                <HelpIcon helpId={'visualization.saveimage'}/>
            </div>
        </FieldGroup>
    );
});

FitsDownloadDialogForm.propTypes = {
    groupKey: PropTypes.string.isRequired,
    popupId: PropTypes.string,
    isWs: PropTypes.oneOfType([PropTypes.bool, PropTypes.string])
};

function makeFitsDLReducer(plot, band) {
    return (inFields, action) => {
        if (!inFields) {
            const defV = {...defValues};
            set(defV, [fKeyDef.colorBand.fKey, 'value'], (band !== Band.NO_BAND.key) ? band : '');
            set(defV, [fKeyDef.fileName.fKey, 'value'], makeFileName(plot,band,'fits'));
            set(defV, [fKeyDef.wsSelect.fKey, 'value'], '');
            set(defV, [fKeyDef.wsSelect.fKey, 'validator'], isWsFolder());
            set(defV, [fKeyDef.fileName.fKey, 'validator'], fileNameValidator());
            return defV;
        }
        const {fieldKey,value}= action.payload;
        const fType = inFields[fKeyDef.fileType.fKey]?.value;
        switch (action.type) {
            case FieldGroupCntlr.VALUE_CHANGE:
                if (fieldKey === fKeyDef.wsSelect.fKey) {
                    // change the filename if a file is selected from the file picker
                    if (value && isValidWSFolder(value, false).valid) {
                        const fName = value.substring(value.lastIndexOf('/') + 1);
                        inFields = updateSet(inFields, [fKeyDef.fileName.fKey, 'value'], fName);
                    }
                }
                else {
                    let fileName;
                    if (!isThreeColor(plot)) {
                        fileName= replaceExt(inFields.fileName.value,fType);
                    }
                    else {
                        fileName= matchPossibleDefaultNames(plot,inFields.fileName?.value) ?
                            makeFileName(plot,inFields.threeBandColor?.value,fType) :
                            replaceExt(inFields.fileName.value,fType);
                    }
                    inFields = updateSet(inFields, [fKeyDef.fileName.fKey, 'value'], fileName);
                }
                break;
            case FieldGroupCntlr.MOUNT_FIELD_GROUP:
                inFields = updateSet(inFields, [fKeyDef.colorBand.fKey, 'value'],
                    ((band !== Band.NO_BAND.key) ? band : ''));
                inFields = updateSet(inFields, [fKeyDef.fileName.fKey, 'value'], makeFileName(plot,band,fType));
                break;
        }
        return {...inFields};
    };
}

function matchPossibleDefaultNames(plot,fileName) {
    const possibleRoots= [makeFileName(plot,Band.NO_BAND.key, 'fits'), makeFileName(plot,Band.RED.key, 'fits'),
                          makeFileName(plot,Band.GREEN.key, 'fits'), makeFileName(plot,Band.BLUE.key, 'fits')]
        .map( (f) => f.substring(0,f.lastIndexOf('.fits')));
    return possibleRoots.includes(fileName.substring(0,fileName.lastIndexOf('.')));
}

function resultsFail(request={}) {
    const {wsSelect, fileLocation} = request;
    if (fileLocation !== WORKSPACE) return;
    if (wsSelect) {
        const {valid,message} = isValidWSFolder(wsSelect);
        if (!valid) workspacePopupMsg(message, 'Save to workspace');
    } else {
        workspacePopupMsg('please select a workspace folder', 'Save to workspace');
    }
}


/**
 * This function process the request
 * @param request
 * @param plotView
 * @param popupId
 */
function resultsSuccess(request, plotView, popupId) {
    const plot= primePlot(plotView);
    const plotState = plot.plotState;

    if (isEmpty(request)) return resultsFail(request);

    const {threeBandColor:bandSelect, operationOption:whichOp, fileLocation, wsSelect} = request;
    const isWorkspace= (fileLocation === WORKSPACE);
    const ext= (request.fileType??'').toLowerCase();

    let {fileName} = request;
    const band = bandSelect ? Band.get(bandSelect) : Band.NO_BAND;

    if (ext) fileName= fileName ? fileName.replace('.fits', '.'+ ext) : makeFileName(plot,band,ext);

    if (isWorkspace && !validateFileName(wsSelect, fileName)) return false;

    const getRegionsDes = (bSeperateText) => {
        const regionDes = makeRegionsFromPlot(plot, bSeperateText);
        return `[${regionDes.join(STRING_SPLIT_TOKEN)}]`;
    };

    const downloadFileAndClose = (params) => {
        const url = isWorkspace ? getCmdSrvURL() : getRootURL() + 'servlet/Download';
        isWorkspace ? doDownloadWorkspace(url, {params}) : download(encodeUrl(url, params));
        closePopup(popupId);
    };

    const wsCmd = isWorkspace ? {wsCmd: ServerParams.WS_PUT_IMAGE_FILE,
                                 [ServerParams.COMMAND]: ServerParams.WS_PUT_IMAGE_FILE,
                                 [WS_SERVER_PARAM.currentrelpath.key]: getWorkspacePath(wsSelect, fileName),
                                 [WS_SERVER_PARAM.newpath.key] : fileName,
                                 [WS_SERVER_PARAM.should_overwrite.key]: true} : {};
    if (ext === 'fits') {
        const fitsFile = !plotState.getOriginalFitsFileStr(band) || !whichOp ?
                          plotState.getWorkingFitsFileStr(band) :
                          plotState.getOriginalFitsFileStr(band);
        downloadFileAndClose({file: fitsFile, return: fileName, log: true, fileLocation,...wsCmd});
    }
    else if ( ext === 'png') {
        isWorkspace ?
            makePngWorkspace(plotView.plotId, getWorkspacePath(wsSelect, fileName), fileName) :
            makePngLocal(plotView.plotId, fileName);
        closePopup(popupId);
    }
    else if (ext === 'reg') {
        saveDS9RegionFile(getRegionsDes(false)).then( (result ) => {
            if (result.success) {
                const rgFile = result?.RegionFileName;
                if (!rgFile) return;
                downloadFileAndClose({file: rgFile, return: fileName, log: true, fileLocation, ...wsCmd});
            } else {
                showInfoPopup( (result?.briefFailReason ?? 'download region file error'), 'region file download');
            }
        }, () => {
            console.log('error');
        });
    }
}

function makeFileName(plot, band='NO_BAND', ext= 'fits') {
    const req = plot.plotState.getWebPlotRequest(band);
    let root = isImage(plot) ? 'image' : 'HiPS';
    if (isImage(plot) && isThreeColor(plot) && ext==='fits') {
        switch (band.toUpperCase()) {
            case Band.RED.key: root= 'image-red'; break;
            case Band.GREEN.key: root= 'image-green'; break;
            case Band.BLUE.key: root= 'image-blue'; break;
        }
    }
    const title= req.getDownloadFileNameRoot() ? req.getDownloadFileNameRoot() : plot.title;
    return makeDefaultDownloadFileName(root, title, ext);
}

const makePngLocal= (plotId, filename= 'a.png') =>
            makeImageCanvas(plotId)?.toBlob( (blob) => downloadBlob(blob, filename) , 'image/png');

function makePngWorkspace(plotId, path, filename= 'a.png') {
    const canvas= makeImageCanvas(plotId);
    if (!canvas) return;
    canvas.toBlob( (blob) => {
        const params = {
            type:'PNG',
            filename,
            workspacePut:true,
            [WS_SERVER_PARAM.currentrelpath.key]: path,
            [WS_SERVER_PARAM.newpath.key] : filename,
            [WS_SERVER_PARAM.should_overwrite.key]: true
        };
        return upload(blob, false, params).then( () => undefined);
    }, 'image/png');
}

function makeImageCanvas(plotId) {
    const cAry= getAllCanvasLayersForPlot(plotId);
    if (isEmpty(cAry)) return;
    const canvas = document.createElement('canvas');
    canvas.width= cAry[0].width;
    canvas.height= cAry[0].height;
    const ctx= canvas.getContext('2d');
    cAry.forEach( (c) => ctx.drawImage(c, 0,0));
    return canvas;
}
/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import React, {memo, useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {isEmpty, capitalize} from 'lodash';
import {dispatchShowDialog, dispatchHideDialog, isDialogVisible} from '../core/ComponentCntlr.js';
import {Operation} from '../visualize/PlotState.js';
import {getRootURL, getCmdSrvSyncURL, encodeUrl, replaceExt} from '../util/WebUtil.js';
import {RadioGroupInputField} from './RadioGroupInputField.jsx';
import CompleteButton from './CompleteButton.jsx';
import {FieldGroup} from './FieldGroup.jsx';
import DialogRootContainer from './DialogRootContainer.jsx';
import {PopupPanel} from './PopupPanel.jsx';
import {getFieldVal} from '../fieldGroup/FieldGroupUtils.js';
import {
    primePlot,
    getActivePlotView,
    getAllCanvasLayersForPlot,
    isThreeColor
} from '../visualize/PlotViewUtil.js';
import {Band} from '../visualize/Band.js';
import {visRoot} from '../visualize/ImagePlotCntlr.js';
import {isImage} from '../visualize/WebPlot.js';
import {makeRegionsFromPlot} from '../visualize/region/RegionDescription.js';
import {saveDS9RegionFile} from '../rpc/PlotServicesJson.js';
import {DownloadOptionsDialog, WORKSPACE, LOCALFILE} from './DownloadOptionsDialog.jsx';
import {isValidWSFolder, WS_SERVER_PARAM, getWorkspacePath, dispatchWorkspaceUpdate} from '../visualize/WorkspaceCntlr.js';
import {doDownloadWorkspace, workspacePopupMsg, validateFileName} from './WorkspaceViewer.jsx';
import {ServerParams} from '../data/ServerParams.js';
import {INFO_POPUP, showInfoPopup} from './PopupUtil.jsx';
import {getWorkspaceConfig} from '../visualize/WorkspaceCntlr.js';
import {upload} from '../rpc/CoreServices.js';
import {download, downloadBlob, makeDefaultDownloadFileName} from '../util/fetch.js';
import {useFieldGroupValue} from './SimpleComponent.jsx';
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
                    fieldKey='operationOption' tooltip='Please select an option'/>
            </div>
        </div> );

const RenderThreeBand = ({colors}) => {
    const [ft] = useFieldGroupValue ('fileType', fitsDownGroup);
    if (ft()==='png' || ft()==='reg') return false;
    return (
        <div style={{display: 'flex', marginTop: mTOP}}>
            <div>
                <RadioGroupInputField options={colors.map( (c) => ({label: c, value: c}))} fieldKey='threeBandColor'
                    label='Color Band:' labelWidth={100} tooltip='Please select a color option'/>
            </div>
        </div> );
};

const MakeFileOptions = ({plot,colors,hasOperation,threeC}) => {
     return (
        <div>
            <div style={{display: 'flex', marginTop: mTOP}}>
                <div>
                    <RadioGroupInputField options={isImage(plot) ? imageFileTypeOps : hipsFileTypeOps} fieldKey='fileType'
                      label='Type of files:' labelWidth={100} tooltip='Please select a file type' />
                </div>
            </div>
            {hasOperation && renderOperationOption()}
            {threeC && <RenderThreeBand {...{colors}}/>}
        </div>);
};

function getInitState()  {
    const pv= getActivePlotView(visRoot());
    const plot = primePlot(pv);
    const colors= getColors(plot);
    return {
        plot, pv, colors,
        threeC: isThreeColor(plot),
        hasOperation: plot.plotState.hasOperation(Operation.CROP)
    };
}

const FitsDownloadDialogForm= memo( ({isWs, popupId, groupKey}) => {
    const [{pv, plot, hasOperation, threeC, colors}] = useState(getInitState);
    const [getBand]= useFieldGroupValue ('threeBandColor', groupKey);
    const band= threeC ? getBand() : Band.NO_BAND.key;

    const totalChildren = (isWs ? 3 : 2) + (hasOperation ? 1 : 0) + (threeC ? 1 : 0);// fileType + save as + (fileLocation)
    const childH = (totalChildren * (20 + mTOP));

    const [getFileType] = useFieldGroupValue ('fileType', groupKey);
    const [getFileName, setFileName] = useFieldGroupValue('fileName', groupKey);
    const [getLocation] = useFieldGroupValue('fileLocation', groupKey);

    useEffect(() => {
        const fileType = getFileType();
        const fileName = getFileName();
        const fileLocation = getLocation();
        let fName = '';

        // change the filename if a file is selected from the file picker
        if (fileLocation === 'isWs' && isValidWSFolder(fileName, false).valid) {
            fName = fileName.substring(fileName.lastIndexOf('/') + 1);
        }
        else { //FileLocation = isLocal: check for fileType change or fileName change. If fileType changes, replace file extension
            if (fileName) { //checking if filename is !empty string allows user to delete the input string (default fileName)
                if (!isThreeColor(plot)) {
                    fName = replaceExt(fileName, fileType);//replaceExt(fields.fileName.value, fType);
                } else {
                    fName = matchPossibleDefaultNames(plot, fileName) ?
                        makeFileName(plot, fileName, fileType) :
                        replaceExt(fileName, fileType);
                }
            }
        }
        setFileName(fName);
    }, [getFileType, getFileName, getLocation]);

    return (
        <FieldGroup style={{height: 'calc(100% - 10px)', width: '100%'}} groupKey={groupKey}>
            <div style={{boxSizing: 'border-box', paddingLeft:5, paddingRight:5, width: '100%', height: 'calc(100% - 70px)'}}>
                <DownloadOptionsDialog {...{
                    fromGroupKey:groupKey, fileName: makeFileName(plot,band,'fits'), workspace:isWs,
                    labelWidth, dialogWidth:'100%', dialogHeight:`calc(100% - ${childH}pt)`,
                }}>
                    <MakeFileOptions {...{plot, colors, hasOperation, threeC}}/>
                </DownloadOptionsDialog>
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

    //if fileName is ".fits" or ".png" or ".reg", set fileName = "" so that makeFileName creates a default fileName below
    //earlier, saving with a ".fits" or ".reg" in the filName resulted in it being downloaded "fits.txt" or "regs.txt" - now fixed
    if (fileName === '.' + ext) fileName = '';

    if (ext) fileName= fileName ? fileName.replace('.fits', '.'+ ext) : makeFileName(plot,band,ext);

    if (isWorkspace && !validateFileName(wsSelect, fileName)) return false;

    const getRegionsDes = (bSeperateText) => {
        const regionDes = makeRegionsFromPlot(plot, bSeperateText);
        return `[${regionDes.join(STRING_SPLIT_TOKEN)}]`;
    };

    const downloadFileAndClose = (params) => {
        const url = isWorkspace ? getCmdSrvSyncURL() : getRootURL() + 'servlet/Download';
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
        switch (band.key || band.toUpperCase()) {
            case Band.RED.key: root= 'image-red'; break;
            case Band.GREEN.key: root= 'image-green'; break;
            case Band.BLUE.key: root= 'image-blue'; break;
        }
    }
    const title= req?.getDownloadFileNameRoot() ?? plot.title;
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
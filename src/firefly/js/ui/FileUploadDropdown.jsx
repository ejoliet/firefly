/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {useState} from 'react';
import {FormPanel} from './FormPanel.jsx';
import {dispatchHideDropDown} from '../core/LayoutCntlr.js';
import { FileUploadViewPanel, resultFail} from '../visualize/ui/FileUploadViewPanel.jsx';
import {getAppOptions} from 'firefly/api/ApiUtil.js';
import DialogRootContainer from 'firefly/ui/DialogRootContainer.jsx';
import {dispatchHideDialog, dispatchShowDialog} from 'firefly/core/ComponentCntlr.js';
import {PopupPanel} from 'firefly/ui/PopupPanel.jsx';
import {resultSuccess} from 'firefly/ui/FileUploadProcessor';
import {FieldGroup} from 'firefly/ui/FieldGroup';
import {DATA_LINK_TABLES, IMAGES, MOC_TABLES, REGIONS, SPECTRUM_TABLES, TABLES} from 'firefly/ui/FileUploadUtil';

const maskWrapper= { position:'absolute', left:0, top:0, width:'100%', height:'100%' };
const panelKey = 'FileUploadAnalysis';

const defaultAcceptList = [
    TABLES,
    REGIONS,
    DATA_LINK_TABLES,
    SPECTRUM_TABLES,
    MOC_TABLES,
    IMAGES
];

const tableOnlyDefaultAcceptList = [
    TABLES
];

export const FileUploadDropdown= ({style={}, onCancel=dispatchHideDropDown, onSubmit=resultSuccess, keepState=true,
                                      groupKey=panelKey, acceptList= getAppOptions()?.uploadPanelLimit==='tablesOnly'?
        tableOnlyDefaultAcceptList: defaultAcceptList, acceptOneItem=false}) =>{
    const [submitText,setSubmitText]= useState('Load');
    const [doMask, changeMasking]= useState(() => false);
    const helpId = getAppOptions()?.uploadPanelHelpId ?? 'basics.searching';
    return (

        <div style={{width: '100%', ...style}}>
            <FieldGroup groupKey={groupKey} keepState={keepState} style={{height:'100%', width: '100%',
                display: 'flex', alignItems: 'stretch', flexDirection: 'column'}}>
                <FormPanel
                    width='auto' height='auto' groupKey={groupKey} onSubmit={onSubmit}
                    onError={resultFail}
                    onCancel={onCancel}
                    submitText={submitText}
                    params={{hideOnInvalid: false}}
                    changeMasking={changeMasking}
                    inputStyle={{height:'100%'}}
                    submitBarStyle={{padding: '2px 3px 3px'}} help_id={helpId}>
                    <FileUploadViewPanel {...{setSubmitText, acceptList, acceptOneItem}}/>
                </FormPanel>
            </FieldGroup>
            {doMask && <div style={maskWrapper}> <div className='loading-mask'/> </div> }
        </div>


    );
};

const DIALOG_ID= 'FileUploadDialog';

export function showUploadDialog(acceptList, keepState, groupKey, acceptOneItem) {

    DialogRootContainer.defineDialog(DIALOG_ID,
        <PopupPanel title={'Upload'}
                    closeCallback={
                        () => {
                        }
                    }>
            <div style={{resize:'both', overflow: 'hidden', zIndex:1, minWidth:600, minHeight:700}} >
                <FileUploadDropdown
                    style={{height: '100%'}}
                    onCancel={() => dispatchHideDialog(DIALOG_ID)}
                    onSubmit={
                        (request) => {
                            if (resultSuccess(request)) dispatchHideDialog(DIALOG_ID);
                        }
                    }
                    keepState={keepState}
                    groupKey={groupKey}
                    acceptList={acceptList}
                    acceptOneItem={acceptOneItem}
                />
            </div>
        </PopupPanel>
    );
    dispatchShowDialog(DIALOG_ID);
}

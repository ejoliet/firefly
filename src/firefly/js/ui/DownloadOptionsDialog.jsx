/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {isEmpty} from 'lodash';
import {ValidationField} from './ValidationField.jsx';
import {RadioGroupInputField} from './RadioGroupInputField.jsx';
import {getWorkspaceList, getWorkspaceErrorMsg,
        dispatchWorkspaceUpdate, isAccessWorkspace} from '../visualize/WorkspaceCntlr.js';
import {WorkspaceSave} from './WorkspaceViewer.jsx';
import {useFieldGroupValue, useStoreConnector} from 'firefly/ui/SimpleComponent';
import LOADING from 'html/images/gxt/loading.gif';

export const LOCALFILE = 'isLocal';
export const WORKSPACE = 'isWs';

export function getTypeData(key, val='', tip = '', labelV='', labelW) {
    return {
        fieldKey: key,
        label: labelV,
        value: val,
        tooltip: tip,
        labelWidth: labelW
    };
}


export function DownloadOptionsDialog({fromGroupKey, children, fileName, labelWidth, dialogWidth=500, dialogHeight=300,
                                      workspace}) {

    const isUpdating = useStoreConnector(isAccessWorkspace);
    const wsList = useStoreConnector(getWorkspaceList);
    const [getLoc] = useFieldGroupValue('fileLocation', fromGroupKey);
    const where= fromGroupKey && getLoc();
    const [getWs] = useFieldGroupValue('wsSelect', fromGroupKey);
    const wsSelect= fromGroupKey && getWs();

    useEffect(() => {
        if (where ===  WORKSPACE) {
            dispatchWorkspaceUpdate();
        }
    }, [where]);

    const ShowWorkspace = () => {

        const loading  = (
                <div style={{width: '100%', height: '100%', display:'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <img style={{width:14,height:14}} src={LOADING}/>
                </div>
        );

        const showSave = (
                <div style={{marginTop: 10,
                             boxSizing: 'border-box',
                             width: 'calc(100%)', height: 'calc(100% - 10px)',
                             overflow: 'auto',
                             padding: 5,
                             border:'1px solid #a3aeb9'}}>
                    <WorkspaceSave fieldKey={'wsSelect'} files={wsList} value={wsSelect}
                        tooltip='workspace file system'/>
                </div>
        );

        const showNoWSFiles = (
                <div style={{marginTop: 10,
                             padding: 10,
                             boxSizing: 'border-box',
                             width: 'calc(100%)',
                             textAlign: 'center',
                             border:'1px solid #a3aeb9'}}>
                    {'Workspace access error: ' + getWorkspaceErrorMsg()}
                </div>
        );

        return isUpdating ? loading : !isEmpty(wsList) ? showSave : showNoWSFiles;
    };

    const showLocation = (
            <div style={{marginTop: 10}}>
                <RadioGroupInputField
                    options={[{label: 'Local File', value: LOCALFILE},
                              {label: 'Workspace', value: WORKSPACE }] }
                    fieldKey={'fileLocation'}
                    label='File location:'
                    labelWidth={100}
                    tooltip='select the location where the file is downloaded to'
                />
            </div>
    );

    return (
        <div style={{height: '100%', width: '100%'}}>
            <div>
                {children}
            </div>
            <ValidationField
                wrapperStyle={{marginTop: 10}}
                size={50}
                fieldKey={'fileName'}
                initialState= {{
                    value: fileName
                }}
                label='File name:'
                labelWidth={100}
                tooltip='Please enter a filename, a default name will be used if it is blank'
            />

            {workspace && showLocation}

            <div  style={{width: dialogWidth, height: dialogHeight}}>
                {where === WORKSPACE && <ShowWorkspace/>}
            </div>
        </div>
    );
}

DownloadOptionsDialog.propTypes = {
    fromGroupKey: PropTypes.string,
    children: PropTypes.object,
    fileName: PropTypes.string,
    labelWidth: PropTypes.number,
    dialogWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    dialogHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    workspace: PropTypes.oneOfType([PropTypes.bool, PropTypes.string])
};


/**
 * file name on download options dialog validator
 * @returns {Function}
 */
export function fileNameValidator() {
    return (valStr) => {
        const valid = (typeof valStr === 'string') ;
        const retRes = {valid};

        if (!retRes.valid) {
            //retRes.message = `the same file, ${valStr}, exists in workspace and is not writable`;
            retRes.message = 'illegal file name';
        }

        return retRes;
    };
}


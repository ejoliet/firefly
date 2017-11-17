/*
 * License information at https://github.com/CaltechIPAC/firefly/blob/master/License.txt
 */
import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import Enum from 'enum';
import {get} from 'lodash';
import {RadioGroupInputField} from './RadioGroupInputField.jsx';
import FieldGroupUtils, {getFieldVal} from '../fieldGroup/FieldGroupUtils.js';
import {FileUpload} from './FileUpload.jsx';
import {WorkspaceUpload} from './WorkspaceViewer.jsx';


export const LOCALFILE = 'isLocal';

const ULOptionsKey = new Enum(['local', 'workspace', 'url', 'location']);


export class UploadOptionsDialog extends PureComponent {
    constructor(props) {
        super(props);
        //fieldKey for fileLocation, fileUpload, and workspaceUpload fields
        this.fileLocation = get(props, ['fieldKeys', ULOptionsKey.location.key], ULOptionsKey.location.key );
        this.fileUpload   = get(props, ['fieldKeys', ULOptionsKey.local.key], ULOptionsKey.local.key );
        this.workspaceUpload = get(props, ['fieldKeys', ULOptionsKey.workspace.key], ULOptionsKey.workspace.key );

        const where = getFieldVal(props.fromGroupKey, this.fileLocation, LOCALFILE);
        this.state = {where};
    }

    componentWillUnmount() {
        if (this.unbinder) this.unbinder();
        this.iAmMounted = false;
    }

    componentDidMount() {
        this.iAmMounted = true;
        if (this.props.fromGroupKey) {
            this.unbinder = FieldGroupUtils.bindToStore(this.props.fromGroupKey, (fields) => {
                if (this.iAmMounted) {
                    this.setState((state) => {
                        const loc = get(fields, [this.fileLocation, 'value']);

                        if (loc !== state.where) {
                             state.where = loc;
                        }

                        return state;
                    });
                }
            });
        }
    }

    render() {
        const {where} = this.state;
        const {labelWidth, dialogWidth,preloadWsFile=true} = this.props;

        const showUploadLocation = () => {
            const options = [ {id: 0, label: 'Local File', value: 'isLocal'},
                              {id: 1, label: 'Workspace',  value: 'isWs'}];

            return (
                <div style={{margin: '5px 10px 2px 10px'}}>
                    <RadioGroupInputField
                        alignment={'horizontal'}
                        fieldKey={this.fileLocation}
                        options={options}
                        initialState={
                           {tooltip: get(this.props, ['tooltips', ULOptionsKey.location.key], 'Select where the file is from'),
                            labelWidth}
                        }
                    />
                </div>
            );
        };
        
        const showFileUploadButton = () => {
            return (where === 'isLocal') ?
                (
                    <FileUpload
                        wrapperStyle={{margin: '2px 10px 8px 10px'}}
                        fieldKey={this.fileUpload}
                        initialState={
                             {tooltip: get(this.props, ['tooltips', ULOptionsKey.local.key], 'Select a file to upload')}}
                    />
                ) :
                (
                    <WorkspaceUpload
                        wrapperStyle={{margin: '2px 10px 8px 10px'}}
                        preloadWsFile={preloadWsFile}
                        fieldKey={this.workspaceUpload}
                        initialState={
                            {tooltip: get(this.props, ['tooltips', ULOptionsKey.workspace.key],
                                                       'Select a file from workspace to upload')}}
                    />
                );
        };

        
        return (
            <div style={{width: dialogWidth}} >
                {showUploadLocation()}
                {showFileUploadButton()}
            </div>
        );
    }
}

UploadOptionsDialog.propTypes = {
    fromGroupKey: PropTypes.string.isRequired,
    labelWidth: PropTypes.number,
    dialogWidth: PropTypes.number,
    fieldKeys: PropTypes.object,
    tooltips: PropTypes.object,
    preloadWsFile: PropTypes.bool
};

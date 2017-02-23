import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
import {get, has, isEmpty, set, omit} from 'lodash';
import {getLayouInfo, dispatchUpdateLayoutInfo} from '../../../core/LayoutCntlr.js';
import FieldGroupUtils from '../../../fieldGroup/FieldGroupUtils';
import {dispatchMultiValueChange} from '../../../fieldGroup/FieldGroupCntlr.js';
import {ValidationField} from '../../../ui/ValidationField.jsx';
import {SuggestBoxInputField} from '../../../ui/SuggestBoxInputField.jsx';
import {RadioGroupInputField} from '../../../ui/RadioGroupInputField.jsx';
import {FieldGroup} from '../../../ui/FieldGroup.jsx';
import {makeFileRequest, makeTblRequest} from '../../../tables/TableUtil.js';
import {dispatchTableSearch} from '../../../tables/TablesCntlr.js';
import {sortInfoString} from '../../../tables/SortInfo.js';
import {FilterInfo} from '../../../tables/FilterInfo.js';

import {LC, getViewerGroupKey, removeTablesFromGroup} from '../LcManager.js';
import {getTypeData} from './../LcUtil.jsx';

const labelWidth = 100;

export class LsstSdssSettingBox extends Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }


    render() {
        const {generalEntries, missionEntries} = this.props;


        if (isEmpty(generalEntries) || isEmpty(missionEntries)) return false;
        const wrapperStyle = {margin: '3px 0'};

        var rightEntries = Object.keys(generalEntries).map((key) =>
            <ValidationField key={key} fieldKey={key} wrapperStyle={wrapperStyle} style={{width: 80}}/>
        );

        const validFluxVals = get(missionEntries, LC.META_FLUX_NAMES, []);

        var leftEntries = [
            <RadioGroupInputField key='band' fieldKey='band' wrapperStyle={wrapperStyle}
                alignment='horizontal'
                options={[
                    {label: 'u', value: 'u'},
                    {label: 'g', value: 'g'},
                    {label: 'r', value: 'r'},
                    {label: 'i', value: 'i'},
                    {label: 'z', value: 'z'}
                ]}
            />,
            <SuggestBoxInputField key={LC.META_FLUX_CNAME}
                fieldKey={LC.META_FLUX_CNAME} wrapperStyle={wrapperStyle}
                getSuggestions={(val) => {
                    const suggestions =  validFluxVals && validFluxVals.filter((el) => {return el.startsWith(val);});
                    return suggestions.length > 0 ? suggestions : validFluxVals;
                }}
            />
        ];

        const groupKey = getViewerGroupKey(missionEntries);

        return (
            <FieldGroup groupKey={groupKey}
                        reducerFunc={lsstSdssReducer(missionEntries, generalEntries)} keepState={true}>
                <div style={{display: 'flex', alignItems: 'flex-end'}} >
                    <div >
                        {leftEntries}
                    </div>
                    <div>
                        {rightEntries}
                    </div>
                </div>
            </FieldGroup>
        );
    }
}

LsstSdssSettingBox.propTypes = {
    generalEntries: PropTypes.object,
    missionEntries: PropTypes.object
};

export const lsstSdssReducer = (missionEntries, generalEntries) => {
    return (inFields, action) => {
        if (inFields) {
            return inFields;
        }

        const validFluxVals = get(missionEntries, LC.META_FLUX_NAMES, []);
        const fluxFldValidator = (val) => {
            let retVal = {valid: true, message: ''};
            if (validFluxVals.length !== 0 && !validFluxVals.includes(val)) {
                retVal = {valid: false, message: `${val} is not a valid column name`};
            }
            return retVal;
        };

        // defValues used to keep the initial values for parameters in the field group of result page
        // band: lsst sdss band name
        // flux: flux column
        // cutoutsize: image cutout size

        const defValues = {
            band: Object.assign(getTypeData('band', '',
                'LSST SDSS band',
                'LSST SDSS Band:', labelWidth)),
            [LC.META_FLUX_CNAME]: Object.assign(getTypeData(LC.META_FLUX_CNAME, '',
                'Y column name',
                'Periodic Column:', labelWidth),
                {validator: fluxFldValidator}),
            ['cutoutSize']: Object.assign(getTypeData('cutoutSize', '',
                'image cutout size',
                'Cutout Size (deg):', labelWidth)),
            [LC.META_ERR_CNAME]: Object.assign(getTypeData(LC.META_ERR_CNAME, '',
                'flux error column name',
                'Error Column:', labelWidth))
        };

        var   defV = Object.assign({}, defValues);

        const missionKeys = ['band', LC.META_FLUX_CNAME];

        // set value
        missionKeys.forEach((key) => {
            set(defV, [key, 'value'], get(missionEntries, key, ''));
        });
        Object.keys(generalEntries).forEach((key) => {
            set(defV, [key, 'value'], get(generalEntries, key, ''));
        });
        return defV;
    };
};



function setFields(missionEntries, generalEntries) {
    const groupKey = getViewerGroupKey(missionEntries);
    const fields = FieldGroupUtils.getGroupFields(groupKey);
    if (fields) {
        const initState = Object.keys(fields).reduce((prev, fieldKey) => {
            if (has(missionEntries, fieldKey)) {
                prev.push({fieldKey, value: get(missionEntries, fieldKey)});
            } else if (has(generalEntries,fieldKey)) {
                prev.push({fieldKey, value: get(generalEntries, fieldKey)});
            }
            return prev;
        }, []);
        dispatchMultiValueChange(groupKey, initState);
    }
}



export function lsstSdssOnNewRawTable(rawTable, converterData, generalEntries) {
    const metaInfo = rawTable && rawTable.tableMeta;
    const missionEntries = {
        [LC.META_MISSION]: converterData.converterId,
        [LC.META_TIME_CNAME]: get(metaInfo, LC.META_TIME_CNAME, converterData.defaultTimeCName),
        [LC.META_FLUX_CNAME]: get(metaInfo, LC.META_FLUX_CNAME, converterData.defaultYCname),
        [LC.META_ERR_CNAME]: get(metaInfo, LC.META_ERR_CNAME, converterData.defaultYErrCname),
        [LC.META_TIME_NAMES]: get(metaInfo, LC.META_TIME_NAMES, converterData.timeNames),
        [LC.META_FLUX_NAMES]: get(metaInfo, LC.META_FLUX_NAMES, converterData.yNames),
        [LC.META_ERR_NAMES]: get(metaInfo, LC.META_ERR_NAMES, converterData.yErrNames),
        band: get(metaInfo, 'band', 'u'),
        rawTableSource: get(metaInfo, 'rawTableSource')
    };
    setFields(missionEntries, generalEntries);
    return missionEntries;
}

export function lsstSdssOnFieldUpdate(fieldKey, value) {
    var layoutInfo = getLayouInfo();
    const missionEntries = get(layoutInfo, LC.MISSION_DATA);
    if (!missionEntries) return;
    const newMissionEntries = Object.assign(omit(missionEntries,[LC.META_TIME_NAMES, LC.META_FLUX_NAMES,LC.META_ERR_NAMES]), {[fieldKey]: value});
    if (fieldKey === 'band' || fieldKey === LC.META_TIME_CNAME) {
        removeTablesFromGroup();
        removeTablesFromGroup(LC.PERIODOGRAM_GROUP);
        var layoutInfo = getLayouInfo();
        dispatchUpdateLayoutInfo(Object.assign({}, layoutInfo, {showTables: false, showXyPlots: false, fullRawTable: null, missionEntries: {}}));  // clear full rawtable
        const treq = makeRawTableRequest(newMissionEntries);
        dispatchTableSearch(treq, {removable: true});
        return {};
    } else if ([LC.META_FLUX_CNAME, LC.META_ERR_CNAME].includes(fieldKey)) {
        return {[fieldKey]: value};
    }
}

export function lsstSdssRawTableRequest(converter, source) {
    const missionEntries = {
        band: 'u',
        [LC.META_TIME_CNAME]: converter.defaultTimeCName,
        [LC.META_MISSION]: converter.converterId,
        rawTableSource: source
    };
    return makeRawTableRequest(missionEntries);

}

function makeRawTableRequest(missionEntries) {
    const band = missionEntries['band'];
    const filterInfo = new FilterInfo;
    filterInfo.addFilter('filterName', `LIKE ${band}`);
    const searchRequest = JSON.stringify(makeFileRequest('Raw Table', missionEntries['rawTableSource'], null, {filters: filterInfo.serialize()}));
    const options = {
        tbl_id: LC.RAW_TABLE,
        tblType: 'notACatalog',
        sortInfo: sortInfoString(missionEntries[LC.META_TIME_CNAME]),
        META_INFO: missionEntries,
        pageSize: LC.TABLE_PAGESIZE
    };
    return makeTblRequest('IpacTableFromSource', `Raw Table ${band}`, {searchRequest}, options);
}
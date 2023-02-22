/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import {CoordinateSys, parseWorldPt} from '../../api/ApiUtilImage.jsx';
import {CONE_CHOICE_KEY, POLY_CHOICE_KEY} from '../../visualize/ui/CommonUIKeys.js';
import {convert} from '../../visualize/VisUtil.js';
import CompleteButton from '../CompleteButton.jsx';
import {FieldGroup} from '../FieldGroup.jsx';
import {FormPanel} from '../FormPanel.jsx';
import {showInfoPopup} from '../PopupUtil.jsx';
import {AREA, CHECKBOX, CIRCLE, CONE_AREA_KEY, ENUM, FLOAT, INT, POLYGON, POSITION, UNKNOWN} from './DynamicDef.js';
import {
    getSpacialSearchType, hasValidSpacialSearch, makeAllFields, makeUnitsStr
} from './DynComponents.jsx';
import './DynamicUI.css';


const defaultOnError= () => showInfoPopup('One or more fields are not valid', 'Invalid Data');

export const DynamicFieldGroupPanel = ({DynLayoutPanel, groupKey, fieldDefAry, keepState = true, plotId='defaultHiPSTargetSearch'}) => (
    <FieldGroup groupKey={groupKey} keepState={keepState}>
        <DynLayoutPanel fieldDefAry={fieldDefAry} style={{margin: '8px 3px 15px 3px', width: '100%'}} plotId={plotId}/>
    </FieldGroup>
);


export const DynCompleteButton= ({fieldDefAry, onSuccess, ...restOfProps}) => (
    <CompleteButton {...{...restOfProps,
        onSuccess:(r) => onSuccess(convertRequest(r,fieldDefAry))
    }}/> );

export function DynamicForm({DynLayoutPanel, groupKey,fieldDefAry, onSubmit, onError=defaultOnError, onCancel, help_id, style={}}) {

    const onSearchSubmit= (request) => {
        if (!hasValidSpacialSearch(request,fieldDefAry)) {
            showInfoPopup(
                getSpacialSearchType(request,fieldDefAry)===CONE_CHOICE_KEY ?
                    'Target is required' : 'Search Area is require and must have a least 3 points');
            return false;
        }
        return onSubmit?.(convertRequest(request, fieldDefAry));
    };

    return (
        <div style={style}>
            <FormPanel  {...{
                inputStyle: {display: 'flex', flexDirection: 'column', backgroundColor: 'transparent', padding: 'none', border: 'none'},
                submitBarStyle:{padding: '2px 3px 3px'},
                buttonStyle:{justifyContent: 'left'},
                groupKey, onSubmit:onSearchSubmit, onCancel, onError, help_id,
                params:{hideOnInvalid: false},
            }} >
                <DynamicFieldGroupPanel {...{DynLayoutPanel, groupKey,fieldDefAry}}/>
            </FormPanel>
        </div>
    );
}


export function convertRequest(request, fieldDefAry, treatAsSia= false) {
    const retReq= fieldDefAry.reduce( (out, {key,type, targetDetails:{raKey,decKey, targetKey,polygonKey, sizeKey}={} }) => {
        const coneOrArea= request[CONE_AREA_KEY] ?? (targetKey ? CONE_CHOICE_KEY : POLY_CHOICE_KEY);
        if (coneOrArea) {
            if (type===POLYGON && coneOrArea !== POLY_CHOICE_KEY) return out;
            if (type===CIRCLE && coneOrArea !== CONE_CHOICE_KEY) return out;
            if (type===POSITION && coneOrArea !== CONE_CHOICE_KEY) return out;
            if (type===AREA && coneOrArea !== CONE_CHOICE_KEY) return out;
        }
        switch (type) {
            case FLOAT: case INT: case AREA: case ENUM:
                out[key]= request[key];
                return out;
            case UNKNOWN:
                return out;
            case POLYGON:
                out[key]= treatAsSia ?
                    'POLYGON ' +request[polygonKey].replaceAll(',', '') : request[polygonKey];
                return out;
            case CHECKBOX:
                const value= Object.entries(request)
                    .find( ([k]) => k.includes(key))?.[1]?.includes(key) ?? false;
                out[key]= value;
                return out;
            case POSITION:
                if (raKey && decKey) {
                    const wp= convert(parseWorldPt(request[key]), CoordinateSys.EQ_J2000);
                    out[raKey]= wp?.x;
                    out[decKey]= wp?.y;
                }
                else {
                    out[key]= request[targetKey];
                }
                return out;
            case CIRCLE:
                const radius= request[sizeKey];
                const wp= convert(parseWorldPt(request[targetKey]), CoordinateSys.EQ_J2000);
                if (radius && wp) {
                    out[key]= `${treatAsSia?'CIRCLE ':''}${wp.x} ${wp.y} ${radius}`;
                }
                return out;
            default: return out;
        }
    }, {});
    const hiddenFields= fieldDefAry
        .reduce( (obj,{hide, key,initValue}) => {
            if (hide && key && initValue) obj[key]= initValue;
            return obj;
        },{});
    return {...retReq,...hiddenFields};
}

export function findTargetFromRequest(request, fieldDefAry) {
    let wp;
    fieldDefAry?.forEach( ({key,type, targetDetails:{raKey,decKey, targetKey}={} }) => {
        switch (type) {
            case POSITION:
                if (raKey && decKey) wp= convert(parseWorldPt(request[key]), CoordinateSys.EQ_J2000);
                return;
            case CIRCLE:
                wp= convert(parseWorldPt(request[targetKey]), CoordinateSys.EQ_J2000);
                return;
        }
    });
    return wp;
}


function SimpleDynSearchPanel({style={}, fieldDefAry, popupHiPS= true, plotId='defaultHiPSTargetSearch'}) {
    const { spacialPanel, areaFields, polyPanel, checkBoxFields, fieldsInputAry, opsInputAry,
        useSpacial, useArea}= makeAllFields(fieldDefAry,false,popupHiPS, plotId);

    let iFieldLayout;
    if (fieldsInputAry.length || opsInputAry.length) {
        iFieldLayout= (
            <>
                <div key='top' style={{paddingTop:5}}/>
                {fieldsInputAry}
                {Boolean(fieldsInputAry.length) && <div key='pad' style={{paddingTop:5}}/>}
                {opsInputAry}
            </>);
    }


    return (
        <div style={style}>
            {useSpacial &&
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', height:'100%'}}> {spacialPanel} </div>}
            {Boolean(polyPanel) &&
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}> {polyPanel} </div>}
            <div style={{paddingLeft:5, display:'flex', flexDirection:'column'}}>
                {useArea &&
                    <div key='a' style={{paddingTop:5, display:'flex', flexDirection:'column'}}>
                        {areaFields}
                    </div>}
                <div style={{display:'flex', flexDirection:'row', alignItems:'center'}}>
                    {Boolean(iFieldLayout) && <div>{iFieldLayout}</div>}
                    {Boolean(checkBoxFields) &&
                        <div style={{padding: '5px 0 0 45px', display:'flex', flexDirection:'column', alignSelf:'center'}}>
                            {checkBoxFields}
                        </div> }
                </div>
            </div>
        </div>
    );
}

function GridDynSearchPanel({style={}, fieldDefAry, popupHiPS= true, plotId='defaultHiPSTargetSearch'}) {
    const { spacialPanel, areaFields, checkBoxFields, fieldsInputAry, opsInputAry,
        useArea, useSpacial}= makeAllFields(fieldDefAry, true, popupHiPS);

    const labelAry= fieldDefAry
        .filter( ({type}) => type===INT || type===FLOAT || type===ENUM || type===UNKNOWN)
        .map( ({desc,units}) => `${desc}${makeUnitsStr(units)}` );

    let gridFieldLayout;
    if (fieldsInputAry.length || opsInputAry.length) {
        const combinedAry= [];
        [...fieldsInputAry,...opsInputAry].forEach( (f,idx) => {
            combinedAry.push((<div key={labelAry[idx]} style={{justifySelf:'end'}}>{labelAry[idx]}</div>));
            combinedAry.push(f);
        } );

        gridFieldLayout= (
            <div className='dynGrid' style={{paddingTop:20}}>
                {combinedAry}
            </div>);
    }
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch', ...style}}>
            {useSpacial &&
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', alignSelf:'stretch'}}>
                    {spacialPanel}
                    {useArea && <> {areaFields} </>}
                </div>
            }
            {Boolean(checkBoxFields) && <div key='b' style={{paddingTop:5, display:'flex', flexDirection:'column'}}>
                {checkBoxFields}
            </div> }
            {Boolean(gridFieldLayout) && gridFieldLayout}
        </div>
    );
}


export const DynLayoutPanelTypes= {
    Simple: SimpleDynSearchPanel,
    Grid: GridDynSearchPanel,
};

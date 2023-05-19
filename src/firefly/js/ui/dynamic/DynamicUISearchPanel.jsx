/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import {CoordinateSys, parseWorldPt} from '../../api/ApiUtilImage.jsx';
import {standardIDs} from '../../util/VOAnalyzer.js';
import {CONE_CHOICE_KEY, POLY_CHOICE_KEY} from '../../visualize/ui/CommonUIKeys.js';
import {convert} from '../../visualize/VisUtil.js';
import CompleteButton from '../CompleteButton.jsx';
import {FieldGroup} from '../FieldGroup.jsx';
import {FormPanel} from '../FormPanel.jsx';
import {showInfoPopup} from '../PopupUtil.jsx';
import {
    AREA, CHECKBOX, CIRCLE, CONE_AREA_KEY, ENUM, FLOAT, INT, POINT, POLYGON, POSITION, UNKNOWN
} from './DynamicDef.js';
import {
    getSpacialSearchType, hasValidSpacialSearch, makeAllFields, makeUnitsStr
} from './DynComponents.jsx';
import './DynamicUI.css';
import {findFieldDefType} from './ServiceDefTools.js';


const defaultOnError= () => showInfoPopup('One or more fields are not valid', 'Invalid Data');

export const DynamicFieldGroupPanel = ({DynLayoutPanel, groupKey, fieldDefAry, style,
                                           keepState = true, plotId='defaultHiPSTargetSearch'}) => (
    <FieldGroup groupKey={groupKey} keepState={keepState} style={style}>
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

function cleanupPolygonString(inStr='') {
   return inStr.replaceAll(',', ' ')
       .split(' ')
       .filter( (s) => s)
       .join(' ');
}

export function convertRequest(request, fieldDefAry, standardIDType) {
    const retReq= fieldDefAry.reduce( (out, {key,type, targetDetails:{raKey,decKey, targetKey,polygonKey, sizeKey}={} }) => {
        const supportsPoly= findFieldDefType(fieldDefAry, POLYGON);
        const coneOrArea= request[CONE_AREA_KEY] ?? (targetKey ? CONE_CHOICE_KEY : supportsPoly ? POLY_CHOICE_KEY : CONE_CHOICE_KEY);
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
                if (standardIDType===standardIDs.sia) out[key]= 'POLYGON ' +cleanupPolygonString(request[polygonKey]);
                else if (standardIDType===standardIDs.soda) out[key]= cleanupPolygonString(request[polygonKey]);
                else out[key]=request[polygonKey];
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
            case POINT:
                if (targetKey) {
                    const wp= convert(parseWorldPt(request[targetKey]), CoordinateSys.EQ_J2000);
                    if (wp) out[key]= makePointString(wp.x, wp.y,standardIDType);
                }
                return out;
            case CIRCLE:
                if (targetKey) {
                    const radius= request[sizeKey];
                    const wp= convert(parseWorldPt(request[targetKey]), CoordinateSys.EQ_J2000);
                    if (radius && wp) out[key]= makeCircleString(wp.x,wp.y,radius,standardIDType);
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



function makeCircleString(ra,dec,radius,standardID) {
     return `${standardID?.toLowerCase()?.startsWith(standardIDs.sia)?'CIRCLE ':''}${ra} ${dec} ${radius}`;
}
function makePointString(ra,dec,standardID) {
    const sep= standardID?.toLowerCase().startsWith(standardIDs.ssa) ? ',' : ' ';
    return `${ra}${sep}${dec}`;
}

export function isCircleSearch(primaryFdAry) {
    return findFieldDefType(primaryFdAry,CIRCLE);
}

export function isPolySearch(primaryFdAry) {
    return findFieldDefType(primaryFdAry,POLYGON);
}

export function isPointAreaSearch(primaryFdAry) {
    return findFieldDefType(primaryFdAry,POINT) && findFieldDefType(primaryFdAry,POINT) ;
}

function getUnknownsConst(fdAry) {
    const unknownValues = fdAry
        .filter( (fd) => fd.type===UNKNOWN && fd.initValue)
        .map( (fd) => [fd.key,fd.initValue]);
    return Object.fromEntries(unknownValues);
}

export function convertCircleToPointArea(request, primaryFdAry, secondaryFdAry, primStandardID, secondStandardID) {
    const cKey= findFieldDefType(primaryFdAry,CIRCLE)?.key;
    if (!cKey) return;
    const cStr= request[cKey];
    if (!cStr) return;
    const stringToSplit= primStandardID!==standardIDs.sia ? cStr : 'circle ' + cStr;
    const [,ra,dec,radius]= stringToSplit.split(' ');
    if (!ra || !dec || !radius) return;
    const pKey= findFieldDefType(secondaryFdAry,POINT)?.key;
    const aKey= findFieldDefType(secondaryFdAry,AREA)?.key;
    if (!pKey || !aKey) return;
    return {[pKey]: makePointString(ra,dec,secondStandardID), [aKey]:radius, ...getUnknownsConst(secondaryFdAry)};
}

export function convertPointAreaToCircle(request, primaryFdAry, secondaryFdAry, primStandardID, secondStandardID) {
    const pKey= findFieldDefType(primaryFdAry,POINT)?.key;
    const aKey= findFieldDefType(primaryFdAry,AREA)?.key;
    if (!pKey || !aKey || !request[aKey]) return;
    const pStr= request[pKey];
    if (!pStr) return;
    const [ra,dec]= pStr.split(primStandardID?.toLowerCase().startsWith(standardIDs.ssa)?',':' ');
    if (!ra || !dec) return;
    const cKey= findFieldDefType(secondaryFdAry,CIRCLE)?.key;
    return {[cKey]: makeCircleString(ra,dec,request[aKey],secondStandardID), ...getUnknownsConst(secondaryFdAry)};
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


function SimpleDynSearchPanel({style={}, fieldDefAry, popupHiPS= true, plotId='defaultHiPSTargetSearch', toolbarHelpId}) {
    const { DynSpacialPanel, areaFields, polyPanel, checkBoxFields, fieldsInputAry, opsInputAry,
        useSpacial, useArea}= makeAllFields({ fieldDefAry,popupHiPS, plotId, toolbarHelpId});

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
                <div style={{display:'flex', flexDirection:'column', alignItems:'center', height:'100%'}}> {<DynSpacialPanel/>} </div>}
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

function InsetDynSearchPanel({style={}, fieldDefAry, popupHiPS= false, plotId='defaultHiPSTargetSearch', toolbarHelpId,
                                 childComponents, WrapperComponent}) {
    const { DynSpacialPanel, areaFields, polyPanel, checkBoxFields, fieldsInputAry, opsInputAry,
        useSpacial, useArea}= makeAllFields({ fieldDefAry,popupHiPS, plotId, toolbarHelpId, insetSpacial:true});

    let iFieldLayout;
    if (fieldsInputAry.length || opsInputAry.length) {
        iFieldLayout= (
            <>
                <div key='top' style={{paddingTop:5}}/>
                <div style={{display:'flex', flexDirection:'column', alignItems:'flex-start', alignSelf:'flex-start'}}>
                    {fieldsInputAry}
                </div>
                {Boolean(fieldsInputAry.length) && <div key='pad' style={{paddingTop:5}}/>}
                {opsInputAry}
            </>);
    }



    const nonSpacial= (
        <>
            {Boolean(polyPanel) &&
                <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}> {polyPanel} </div>}
            <div style={{paddingLeft:5, display:'flex', flexDirection:'column', alignSelf:'flex-start'}}>
                {useArea &&
                    <div key='a' style={{paddingTop:5, display:'flex', flexDirection:'column'}}>
                        {areaFields}
                    </div>}
                <div style={{display:'flex', flexDirection:'row', alignItems:'center'}}>
                    {Boolean(iFieldLayout) && <div >{iFieldLayout}</div>}
                    {Boolean(checkBoxFields) &&
                        <div style={{padding: '5px 0 0 45px', display:'flex', flexDirection:'column', alignSelf:'center'}}>
                            {checkBoxFields}
                        </div> }
                </div>
            </div>
            {childComponents && childComponents}
        </>
    );

    if (!useSpacial) {
        const wrappedInternals= WrapperComponent ? <WrapperComponent>{nonSpacial}</WrapperComponent> : nonSpacial;
        return (
            <div style={style}> {wrappedInternals} </div>
        );
    }

    return (
        <div style={style}>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', height:'100%'}}>
                <DynSpacialPanel otherComponents={nonSpacial} WrapperComponent={WrapperComponent}/>
            </div>
        </div>
    );
}

function GridDynSearchPanel({style={}, fieldDefAry, popupHiPS= true, plotId='defaultHiPSTargetSearch', toolbarHelpId}) {
    const { DynSpacialPanel, areaFields, checkBoxFields, fieldsInputAry, opsInputAry,
        useArea, useSpacial}= makeAllFields({ fieldDefAry,noLabels:true, plotId, popupHiPS, toolbarHelpId});

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
                    {<DynSpacialPanel/>}
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
    Inset: InsetDynSearchPanel,
    Grid: GridDynSearchPanel,
};

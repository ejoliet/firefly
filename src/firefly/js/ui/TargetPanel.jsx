/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {Stack} from '@mui/joy';
import React, {memo, useContext, useEffect} from 'react';
import PropTypes, {bool} from 'prop-types';
import {ConnectionCtx} from './ConnectionCtx.js';
import {parseTarget} from './TargetPanelWorker.js';
import {formatPosForTextField, formatTargetForHelp} from './PositionFieldDef.js';
import {TargetFeedback} from './TargetFeedback.jsx';
import {InputFieldView} from './InputFieldView.jsx';
import {useFieldGroupConnector} from './FieldGroupConnector.jsx';
import {ListBoxInputFieldView} from './ListBoxInputField.jsx';
import FieldGroupUtils from '../fieldGroup/FieldGroupUtils.js';
import {dispatchActiveTarget, getActiveTarget} from '../core/AppDataCntlr.js';
import {isValidPoint, parseWorldPt} from '../visualize/Point.js';


const TARGET= 'targetSource';
const RESOLVER= 'resolverSource';
const LABEL_DEFAULT='Coords or Obj Name:';

const nedThenSimbad= 'nedthensimbad';
const simbadThenNed= 'simbadthenned';

const TargetPanelView = (props) =>{
    const {showHelp, feedback, valid, message, onChange, value, button,
        children, resolver, feedbackStyle, showResolveSourceOp= true, showExample= true,
        targetPanelExampleRow1, targetPanelExampleRow2,
        connectedMarker=false,
        examples, onUnmountCB, sx}= props;

    useEffect(() => () => onUnmountCB(props),[]);
    const connectContext= useContext(ConnectionCtx);

    const endDecorator= makeEndDecorator(showResolveSourceOp,onChange,resolver,button);

    const positionField = (
        <InputFieldView {...{valid, visible:true, message,
            placeholder:'Coords or Obj Name',
            onChange: (ev) => onChange(ev.target.value, TARGET),
            endDecorator,
            sx : makeSx(showResolveSourceOp, Boolean(button),sx),
            value,
            tooltip:'Enter a target',
            connectedMarker:connectedMarker||connectContext.controlConnected,
            }}
        />);
    const positionInput = children ? (<div style={{display: 'flex'}}>{positionField} {children}</div>) : positionField;



    return (
        <Stack spacing={1} direction='column'>
            {positionInput}
            {(showExample || !showHelp) && <TargetFeedback {...{showHelp, feedback, style:feedbackStyle,
                targetPanelExampleRow1, targetPanelExampleRow2, examples}}/> }
        </Stack>
    );
};


TargetPanelView.propTypes = {
    label : PropTypes.string,
    sx: PropTypes.object,
    valid   : PropTypes.bool.isRequired,
    showHelp   : PropTypes.bool.isRequired,
    feedback: PropTypes.string.isRequired,
    examples: PropTypes.object,
    resolver: PropTypes.string.isRequired,
    message: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    value : PropTypes.string.isRequired,
    labelWidth : PropTypes.number,
    onUnmountCB : PropTypes.func,
    feedbackStyle: PropTypes.object,
    nullAllowed: PropTypes.bool,
    showResolveSourceOp: PropTypes.bool,
    targetPanelExampleRow1: PropTypes.arrayOf(PropTypes.string),
    targetPanelExampleRow2: PropTypes.arrayOf(PropTypes.string),
    connectedMarker: bool,
    showExample: PropTypes.bool
};

function makeEndDecorator(showResolveSourceOp, onChange, resolver, button) {
    const resolverOp=
        showResolveSourceOp?
            (<ListBoxInputFieldView
                options={[
                    {label: 'Try NED then Simbad', value: nedThenSimbad},
                    {label: 'Try Simbad then NED', value: simbadThenNed}
                ]}
                onChange={(ev,newValue) => onChange(newValue, RESOLVER)}
                value={resolver} multiple={false}
                tooltip='Select which name resolver' label='' labelWidth={3} wrapperStyle={{}} />) : undefined;


    if  (resolverOp && !button) return resolverOp;
    if  (!resolverOp && button) return button;
    if  (resolverOp && button) {
        return (
            <Stack direction='row' alignItems='center' spacing={1}>
                {resolverOp}
                {button}
            </Stack>);
    }
    return undefined;
}

function makeSx(useResolver, useButton, sx) {
    if (useResolver && !useButton) return {'.MuiInput-root':{ 'paddingInlineEnd': 0, ...sx }};
    return sx;
}

function didUnmount(fieldKey,groupKey, props) {
    const wp= parseWorldPt(FieldGroupUtils.getFldValue(FieldGroupUtils.getGroupFields(groupKey),fieldKey));

    if (props.nullAllowed && !wp) {
        dispatchActiveTarget(null);
    }
    else if (isValidPoint(wp)) {
        dispatchActiveTarget(wp);
    }
}


function handleOnChange(value, source, params, fireValueChange) {
    let {parseResults={}}= params;

    let displayValue;
    let resolver;

    if (source===TARGET) {
        resolver= params.resolver || nedThenSimbad;
        displayValue= value;
    }
    else if (source===RESOLVER) {
        resolver= value;
        displayValue= params.displayValue || '';
    }
    else {
        console.error('should never be here');
    }

    parseResults= parseTarget(displayValue, parseResults, resolver);
    let {resolvePromise}= parseResults;

    const targetResolve= (asyncParseResults) => {
        return asyncParseResults ? makePayloadAndUpdateActive(displayValue, asyncParseResults, null, resolver) : null;
    };

    if (!displayValue && params.nullAllowed) {
        parseResults.valid= true;
        parseResults.feedback= 'valid: true';
    }



    resolvePromise= resolvePromise ? resolvePromise.then(targetResolve) : null;

    fireValueChange(makePayloadAndUpdateActive(displayValue,parseResults, resolvePromise, resolver));

}

/**
 * Make a payload and update the active target, Note: this function has as side effect to fires an action to update the active target
 * @param displayValue
 * @param parseResults
 * @param resolvePromise
 * @param {string} resolver the key to specify the resolver
 * @return {{message: string, displayValue: *, wpt: (*|null), value: null, valid: *, showHelp: (*|boolean), feedback: (string|*|string), parseResults: *}}
 */
function makePayloadAndUpdateActive(displayValue, parseResults, resolvePromise, resolver) {
    const {wpt}= parseResults;
    const wpStr= parseResults && wpt ? wpt.toString() : null;

    const payload= {
        message : parseResults.parseError || 'Could not resolve object: Enter valid object',
        displayValue,
        wpt,
        value : resolvePromise ? resolvePromise  : wpStr,
        valid : parseResults.valid,
        showHelp : parseResults.showHelp,
        feedback : parseResults.feedback,
        parseResults
    };
    if (resolver) payload.resolver= resolver;
    return payload;
}


function replaceValue(v,defaultToActiveTarget, computedState) {
    if (!defaultToActiveTarget) return v;
    if ((computedState.displayValue || computedState.message) && !computedState.valid) return '';
    return getActiveTarget()?.worldPt?.toString() ?? v;
}


export const DEF_TARGET_PANEL_KEY= 'UserTargetWorldPt';


export const TargetPanel = memo( ({fieldKey= DEF_TARGET_PANEL_KEY,initialState= {},
                                       defaultToActiveTarget= true, ...restOfProps}) => {
    const {viewProps, fireValueChange, groupKey}=  useFieldGroupConnector({
                                fieldKey, initialState,
                                confirmValueOnInit: (v, props,initialState,computedState) => replaceValue(v,defaultToActiveTarget,computedState)});
    const newProps= computeProps(viewProps, restOfProps, fieldKey, groupKey);
    return ( <TargetPanelView {...newProps}
                              onChange={(value,source) => handleOnChange(value,source,newProps, fireValueChange)}/>);
});

TargetPanel.propTypes = {
    sx: PropTypes.object,
    fieldKey: PropTypes.string,
    groupKey: PropTypes.string,
    examples: PropTypes.object,
    labelWidth : PropTypes.number,
    nullAllowed: PropTypes.bool,
    initialState: PropTypes.object,
    showResolveSourceOp: PropTypes.bool,
    targetPanelExampleRow1: PropTypes.arrayOf(PropTypes.string),
    targetPanelExampleRow2: PropTypes.arrayOf(PropTypes.string),
    showExample: PropTypes.bool,
    connectedMarker: bool,
    defaultToActiveTarget: PropTypes.bool,
};


function computeProps(viewProps, componentProps, fieldKey, groupKey) {

    let feedback;
    let value;
    let showHelp;
    const wp= parseWorldPt(viewProps.value);

    if (isValidPoint(wp) && !viewProps.displayValue) {
        feedback= formatTargetForHelp(wp);
        value= wp.objName || formatPosForTextField(wp);
        showHelp= false;
    }
    else {
        value= viewProps.displayValue;
        feedback= viewProps.feedback|| '';
        showHelp= viewProps?.showHelp ?? true;
    }

    return {
        ...viewProps,
        visible: true,
        label: 'Coords or Obj Name:',
        tooltip: 'Enter a target',
        value,
        feedback,
        resolver: viewProps.resolver ?? nedThenSimbad,
        showHelp,
        onUnmountCB: (props) => didUnmount(fieldKey,groupKey,props),
        ...componentProps};
}

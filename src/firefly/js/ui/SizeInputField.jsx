import React, {useEffect, memo, useState, useContext} from 'react';
import PropTypes, {bool} from 'prop-types';
import {convertAngle} from '../visualize/VisUtil.js';
import {ConnectionCtx} from './ConnectionCtx.js';
import {InputFieldView} from './InputFieldView.jsx';
import {ListBoxInputFieldView} from './ListBoxInputField.jsx';
import Validate from '../util/Validate.js';
import {toMaxFixed} from '../util/MathUtil.js';
import {useFieldGroupConnector} from './FieldGroupConnector.jsx';

const invalidSizeMsg = 'size is not set properly or size is out of range';
const DEC_DIGIT = 6;
const unitSign = { 'arcsec':'"', 'arcmin':'\'', 'deg':' deg' };

const getUnitSign= (unit) => unitSign[unit];

// input: string format,
// output: size in degree (string foramt, no decimal digit limit), '': invalid input
export const sizeToDeg = (sizestr, unit) => {
    if (sizestr && isNaN(parseFloat(sizestr))) {
        return sizestr;
    }
    return (sizestr) ? convertAngle(((unit) ? unit : 'deg'), 'deg', sizestr).toString() : '';
};

// input: size in degree string format
// output: size in string format in any given unit (for displaying)
export const sizeFromDeg= (sizeDeg, unit) => (
    (sizeDeg)? toMaxFixed(convertAngle('deg', ((unit) ? unit :'deg'), sizeDeg), DEC_DIGIT).toString() : ''
);

// validate if size (in degree, string format) is within the range
const isSizeValid = (sizeDeg,  min, max) => (
    (sizeDeg && Validate.floatRange(min, max, 1, 'value of  size in degree', sizeDeg).valid)
);

const isFieldValid= (valInDeg, nullAllowed, min, max) => (nullAllowed && !valInDeg) || isSizeValid(valInDeg, min, max);

function updateSizeInfo({unit, value, nullAllowed, min, max, displayValue}) {
    return {
        unit: unit || 'deg',
        valid: isFieldValid(value, nullAllowed, min, max),
        value,
        displayValue: displayValue ? displayValue : sizeFromDeg(value, unit)
    };
}

/**
 * @param ev
 * @param sizeInfo
 * @param params
 * @param fireValueChange unit, value, displayValue are string, and valid is bool
 * @return SizeInputFieldViewState
 */
function handleOnChange(ev, sizeInfo, params, fireValueChange) {
     const {unit, value, valid, displayValue} = {...params, ...sizeInfo};
     const min = () => sizeFromDeg(params.min, params.unit);
     const max = () => sizeFromDeg(params.max, params.unit);
     const feedback = valid? '': `${invalidSizeMsg}, ${min()}-${max()}${getUnitSign(params.unit)}.`;
     fireValueChange({ feedback, displayValue, unit, value, valid });
}

function getFeedback(unit, min, max, showFeedback) {
    const sign = getUnitSign(unit);
    const minmsg = `${sizeFromDeg(min, unit)}`;
    const maxmsg = `${sizeFromDeg(max, unit)}`;
    return {
        errmsg: `${invalidSizeMsg}, ${minmsg}-${maxmsg}${sign}.`,
        feedback: showFeedback ? `Valid range between: ${minmsg}${sign} and ${maxmsg}${sign}` : ''
    };
}

/**
 * @typedef SizeInputFieldViewState
 * @prop {string} value size value in degree
 * @prop {string} displayValue size value displayed
 * @prop {string} unit selected unit
 * @prop {bool}   valid validation of size value in degree
 */

const SizeInputFieldView= (props) => {
    const {nullAllowed, min, max, style= {}, wrapperStyle={} /*wrapperStyle is deprecated*/,
        connectedMarker= false,
        feedbackStyle={}, labelWidth, label, labelStyle, showFeedback, onChange} = props;
    const [{value, valid, displayValue, unit},setState]= useState(() => updateSizeInfo(props));
    const {feedback, errmsg}= getFeedback(unit,min,max,showFeedback);

    useEffect(() => {
        setState(updateSizeInfo(props));
    }, [ nullAllowed,  min, max,props.value, props.displayValue, props.unit]);
    const connectContext= useContext(ConnectionCtx);

    const onSizeChange= (ev) => {
        const newDisplayValue = ev?.target?.value;
        const degreesVal = sizeToDeg(newDisplayValue, unit);
        const stateUpdate = {
            displayValue: newDisplayValue,
            value: degreesVal,
            valid: isFieldValid(degreesVal,nullAllowed,min,max),
            unit
        };
        setState(stateUpdate);
        onChange?.(ev, stateUpdate);
    };

    const onUnitChange= (ev) => {
        const newUnit = ev?.target?.value;
        if (unit === newUnit) return;
        let newValue= value;
        let newValid= valid;
        if ( !valid ) {    // in case current displayed value is invalid, try keep it if it is good for new unit
            newValue = sizeToDeg(displayValue, newUnit);
            newValid = isFieldValid(newValue,nullAllowed,min,max);
            if (!newValid) newValue = '';   // set back to empty string in case still invalid
        }
        const stateUpdate = {
            unit:newUnit,
            displayValue: valid ? sizeFromDeg(value, newUnit) : displayValue,
            value: newValue,
            valid: newValid,
        };
        setState(stateUpdate);
        onChange?.(ev, stateUpdate);
    };


    return (
        <div style={{...wrapperStyle, ...style}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-start'}} >
                <InputFieldView
                    valid={valid}
                    onChange={onSizeChange} onBlur={onSizeChange}
                    value={displayValue} message={errmsg} label={label} labelWidth={labelWidth} labelStyle={labelStyle}
                    connectedMarker={connectedMarker||connectContext.controlConnected}
                    tooltip={'enter size within the valid range'} />
                <ListBoxInputFieldView
                    onChange={onUnitChange}
                    value={unit} multiple={false} labelWidth={2} label={''} tooltip={'unit of the size'}
                    options={[
                        {label: 'degrees', value: 'deg'},
                        {label: 'arcminutes', value: 'arcmin'},
                        {label: 'arcseconds', value: 'arcsec'}
                    ]} />
            </div>
            <div style={{marginLeft: labelWidth+5, marginTop:5,  ...feedbackStyle}}> {feedback} </div>
        </div>
    );
};

SizeInputFieldView.propTypes = {
    unit:  PropTypes.string,
    min:   PropTypes.number.isRequired,
    max:   PropTypes.number.isRequired,
    displayValue: PropTypes.string,
    labelWidth: PropTypes.number,
    label:    PropTypes.string,
    nullAllowed: PropTypes.bool,
    onChange: PropTypes.func,
    value: PropTypes.string,
    valid: PropTypes.bool,
    showFeedback: PropTypes.bool,
    wrapperStyle: PropTypes.object, // deprecated
    style: PropTypes.object,  // replaces wrapper style
    connectedMarker: bool,
    feedbackStyle: PropTypes.object
};

SizeInputFieldView.defaultProps = {
    label: 'Size: ',
    labelWidth: 50,
    unit: 'deg',
    showFeedback: false
};


export const SizeInputFields = memo( (props) => {

    const {viewProps, fireValueChange}=  useFieldGroupConnector(
        {
            ...props,
            initialState:{...props.initialState,
                validator: (value) => {
                    const v= (value+'').trim();
                    const valid =
                        (viewProps.nullAllowed && v==='') ||
                        isSizeValid(value, props.initialState.min, props.initialState.max);
                    const message= valid ? '' : (v ? 'Value out of range' : 'Value is required');
                    return {valid, message};
                }
            }
        }
);
    const {unit, valid, value, displayValue} = updateSizeInfo(viewProps);
    return (<SizeInputFieldView
            {...{...viewProps, unit, valid, value, displayValue}}
            onChange= {(ev, sizeInfo) => handleOnChange(ev, sizeInfo, viewProps, fireValueChange)} />
    );
});


SizeInputFields.propTypes={
    fieldKey : PropTypes.string,
    groupKey : PropTypes.string,
    connectedMarker: bool,
    initialState: PropTypes.shape({
        value: PropTypes.any,
        tooltip:  PropTypes.string,
        unit:  PropTypes.string,
        min:   PropTypes.number,
        max:   PropTypes.number,
        labelWidth:  PropTypes.number,
        nullAllowed: PropTypes.bool,
        displayValue: PropTypes.string,
        label:  PropTypes.string,
    }),
    label:       PropTypes.string,
    showFeedback:    PropTypes.bool
};

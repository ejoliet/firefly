/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {Checkbox, Stack, Typography} from '@mui/joy';
import React, {Fragment,memo, useState} from 'react';
import {number,string,oneOfType,object,func,bool} from 'prop-types';
import {dispatchChangePointSelection} from '../ImagePlotCntlr.js';
import {dispatchChangeLockByClick} from '../MouseReadoutCntlr.js';
import {copyToClipboard} from '../../util/WebUtil';
import {ToolbarButton} from '../../ui/ToolbarButton';

import CLIPBOARD from 'html/images/12x12_clipboard.png';
import CHECKED from 'html/images/12x12_clipboard-checked.png';
import CLIPBOARD_LARGE from 'html/images/20x20_clipboard.png';
import CHECKED_LARGE from 'html/images/20x20_clipboard-checked.png';
import './MouseReadout.css';

export const MouseReadoutLock= memo(({gArea, gAreaLabel, style={}, lockByClick}) => {
    const s= gArea ? {gridArea:gArea,...style} : style;
    const label= 'Lock by click';
    return (
        <React.Fragment>
            <Stack direction='row' style={s} title='Click on an image to lock the display at that point.'>
                <Checkbox label={gAreaLabel?'':label} checked={lockByClick}
                          onChange={() => {
                              dispatchChangePointSelection('mouseReadout', !lockByClick);
                              dispatchChangeLockByClick(!lockByClick);
                          }} />
            </Stack>
            {gAreaLabel &&
            <Typography level='body-xs'
                sx={ {
                    gridArea: gAreaLabel,
                    position:'relative',
                    whiteSpace:'nowrap',
                    textOverflow: 'ellipsis',
                    overflow:'hidden',
                    pr:.5,
                    minWidth: 20
                } }>
                {label}
            </Typography>}
        </React.Fragment>
);
});

MouseReadoutLock.propTypes = {
    style:       object,
    gArea:       string, // grid Area used with css grid-template-areas
    gAreaLabel:  string, // grid Area used with css grid-template-areas
    lockByClick: bool.isRequired
};

const baseVS={whiteSpace:'nowrap', overflow:'hidden', textOverflow: 'ellipsis'};
const baseLS={whiteSpace:'nowrap', textOverflow: 'ellipsis'};


export const DataReadoutItem= memo(({lArea, vArea, cArea, labelStyle={}, valueStyle={}, showCopy=false,
                                        label='', value='', unit='', copyValue='', prefChangeFunc=undefined, monoFont=false}) => {
    const lS= lArea ? {gridArea:lArea,...baseLS,...labelStyle} : {...baseLS,...labelStyle};
    const vS= vArea ? {gridArea:vArea,...baseVS, ...valueStyle} : {...baseVS,...valueStyle};
    const cS= cArea ? {gridArea:cArea, overflow:'hidden'} : undefined;
    const labelClass= prefChangeFunc ? 'mouseReadoutLabel mouseReadoutClickLabel' : 'mouseReadoutLabel';
    const copyTitle= `Copy to clipboard: ${copyValue||value}`;

    let clipComponent= undefined;
    if (cArea) {
        clipComponent= (value && showCopy) ?
            <CopyToClipboard style={cS} title={copyTitle} value={copyValue||value} /> : <div style={cS}/>;
    }

    const mStyle= monoFont ? {fontFamily:'monospace'} : {};

    return (
        <Fragment>
            <Typography level='body-xs' className={labelClass} title={value+''} style={lS} onClick={prefChangeFunc}>{label}</Typography>
            <Typography level='body-xs' color='warning' style={{...vS, ...mStyle}} title={value+''}> {value} </Typography>
            <Typography level='body-xs' color='warning' style={vS} title={value+''}>
                <span style={mStyle}> {value}</span>
                <span> {unit}</span>
            </Typography>
            {clipComponent}
        </Fragment>
    );
});

DataReadoutItem.propTypes = {
    lArea:          string,   // label grid Area used with css grid-template-areas
    vArea:          string,   // value grid Area used with css grid-template-areas
    cArea:          string,   // clipboard grid Area used with css grid-template-areas
    showCopy:       bool,     // show the copy icon
    labelStyle:     object,
    valueStyle:     object,
    label:          string,
    value:          oneOfType([number,string]),
    copyValue:      string,   // for copy to clipboard, if specified, us this value other use value
    prefChangeFunc: func,
    monoFont:       bool,
};



const defButtonStyle= {
    borderRadius:2,
    backgroundColor:'rgba(255,255,255,.9',
    border:'solid transparent',
    borderWidth: '0 0 1px 0'
};


export function CopyToClipboard({value, title, style, size=12, buttonStyle={}}) {
    const uncheckedIco = size > 12 ? CLIPBOARD_LARGE : CLIPBOARD;
    const checkedIco = size > 12 ? CHECKED_LARGE : CHECKED;
    title= title ||  `Copy to clipboard: ${value}`;

    const [clipIcon, setClipIcon] = useState(uncheckedIco);

    const doCopy= (str) => {
        copyToClipboard(str);
        setTimeout( () => {
            setClipIcon(checkedIco);
            setTimeout( () => setClipIcon(uncheckedIco),750);
        }, 10);
    };

    return (
        <div style={style}>
            <ToolbarButton icon={clipIcon} tip={title} bgDark={true} style={{...defButtonStyle, ...buttonStyle}} imageStyle={{height:size, width:size}}
                           horizontal={true} onClick={() => doCopy(value)} />
        </div>
    );

}





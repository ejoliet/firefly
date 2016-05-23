/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 * Lijun
 *   6/03/16
 *   propType: define all the property variable for the component
 *   this.plot, this.plotSate are the class global variables
 *
 */
import React, {PropTypes} from 'react';
import {get} from 'lodash';
import {showMouseReadoutOptionDialog} from './MouseReadoutOptionPopups.jsx';
import {dispatchChangePointSelection} from '../ImagePlotCntlr.js';
import {STANDARD_READOUT, dispatchChangeLockByClick, dispatchChangeLockUnlockByClick} from '../../visualize/MouseReadoutCntlr.js';
import {getMouseReadout, labelMap} from './MouseReadout.jsx';

//--------------- Icons --------------------------------
import LOCKED from    'html/images/icons-2014/lock_20x20.png';
import UNLOCKED from  'html/images/icons-2014/unlock_20x20.png';

const rS = {
    padding : 5,
    cursor: 'pointer'
};


const EMPTY = <div style={rS}></div>;

const column1 =    {width: 100,    paddingLeft: 2, textAlign: 'left',display: 'inline-block'};
const column1_r2 = {width: 100,    addingLeft: 3,  textAlign: 'left',display: 'inline-block'};

const column2 = {
    width: 74,
    paddingRight: 1,
    textAlign: 'right',
    textDecoration: 'underline',
    color: 'DarkGray',
    fontStyle: 'italic',
    display: 'inline-block'
};

const cStyle = {
    textAlign: 'center',
    display: 'block'
};

const column3 = {width: 150,paddingLeft: 2, textAlign: 'left', display: 'inline-block'};

export function PopupMouseReadout({readout}){


    //get the standard readouts
    const sndReadout= readout[STANDARD_READOUT];
    if (!get(sndReadout,'readoutItems')) return EMPTY;

    var objList={};
    Object.keys( readout.readoutPref).forEach( (key) =>  {
        if (key!=='pixelSize') {
            objList[key] = getMouseReadout(sndReadout.readoutItems, readout.readoutPref[key]);
        }
    });

    if (!objList)return EMPTY;

    const {mouseReadout1, mouseReadout2} = objList;

    const lock = readout.isLocked ? LOCKED:UNLOCKED;
    return (

        <div style={ rS}>
            <div style = {cStyle}> Coverage
            {/*row1*/}
            <div  >
                <div style={column1}>
                   < img  src= {lock}  onClick ={() =>{
                      dispatchChangeLockUnlockByClick(!readout.isLocked);
                   }}
                />
                </div>

                <div style={ column2} onClick={ () => showDialog('mouseReadout1', readout.readoutPref.mouseReadout1)}>
                    { labelMap[readout.readoutPref.mouseReadout1] }
                </div>
                <div style={column3}> {mouseReadout1} </div>



            </div>
            <div>{/* row2*/}

                <div style={column1_r2} title='Click on an image to lock the display at that point.'>
                    <input type='checkbox' name='aLock' value='lock'
                           onChange={() => {
                           dispatchChangePointSelection('mouseReadout', !readout.lockByClick);
                           dispatchChangeLockByClick(!readout.lockByClick);
                      }}
                    />
                    Lock by click
                </div>
                <div style={ column2} onClick={ () => showDialog('mouseReadout2' ,readout.readoutPref.mouseReadout2 )}>
                    {labelMap[readout.readoutPref.mouseReadout2] } </div>

                <div style={column3}>  {mouseReadout2}  </div>



            </div>
           </div>
        </div>
    );
}

PopupMouseReadout.propTypes = {
    readout: PropTypes.object
};

function showDialog(fieldKey, radioValue) {

    showMouseReadoutOptionDialog(fieldKey, radioValue);

}

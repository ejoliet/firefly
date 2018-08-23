
/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import PropTypes from 'prop-types';
import {RadioGroupInputFieldView} from '../ui/RadioGroupInputFieldView.jsx';
import {dispatchModifyCustomField} from '../visualize/DrawLayerCntlr.js';

const options= [ {label: 'outline', value: 'outline'},
                 {label: 'outline/text', value: 'outline_text'},
                 {label: 'fill', value: 'fill'}];


export const getUIComponent = (drawLayer,pv) => <ImageLineFootPrintUI drawLayer={drawLayer} pv={pv}/>;

function ImageLineFootPrintUI({drawLayer,pv}) {
    const {style, showText} = drawLayer.drawingDef || {};
    const fillStyle = (!style || style.key === 'STANDARD') ? (showText ? 'outline_text' : 'outline') : 'fill';

    return (
            <div style={{display: 'inline-flex', padding: '2px 3px 2px 3px',
                         border: '1px solid rgba(60,60,60,.2', borderRadius: '5px'}}>
                <RadioGroupInputFieldView options={options}  value={fillStyle}
                                          buttonGroup={true}
                                          onChange={(ev) => changeFootprintPref(drawLayer,pv,ev.target.value, fillStyle)} />
            </div>
    );
}



function changeFootprintPref(drawLayer,pv,value, preValue) {
    if (preValue !== value) {
        dispatchModifyCustomField(drawLayer.drawLayerId, {fillStyle: value, targetPlotId: pv.plotId}, pv.plotId);
    }
}

ImageLineFootPrintUI.propTypes= {
    drawLayer     : PropTypes.object.isRequired,
    pv            : PropTypes.object.isRequired
};


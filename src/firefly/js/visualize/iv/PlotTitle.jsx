/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */


import React, {memo} from 'react';
import PropTypes from 'prop-types';
import Enum from 'enum';
import {sprintf} from '../../externalSource/sprintf';
import {useStoreConnector} from '../../ui/SimpleComponent.jsx';
import {FULL, HALF, QUARTER} from '../rawData/RawDataCommon.js';
import {getDataCompress} from '../rawData/RawDataOps.js';
// import {FULL, getDataCompress, HALF, QUARTER} from '../rawData/RawDataCommon.js';
import {getZoomDesc} from '../ZoomUtil.js';
import {primePlot} from '../PlotViewUtil.js';
import {isImage} from '../WebPlot.js';
import {hasWCSProjection, pvEqualExScroll} from '../PlotViewUtil';

import './PlotTitle.css';
import LOADING from 'html/images/gxt/loading.gif';

export const TitleType= new Enum(['INLINE', 'HEAD', 'EXPANDED']);

export const PlotTitle= memo(({plotView:pv, titleType, brief, working}) => {
        const dataCompress= useStoreConnector(() => getDataCompress(primePlot(pv).plotImageId));
        const plot= primePlot(pv);
        const world= hasWCSProjection(plot);
        const zlRet= getZoomDesc(pv);

        let colons= ':';
        let spaces= '';
        switch (dataCompress) {
            case QUARTER:
                spaces= '&nbsp;&nbsp;';
                colons= ':::';
            break;
            case HALF:
                spaces= '&nbsp;';
                colons= '::';
            break;
            case FULL:
                spaces= '';
                colons= ':';
            break;
        }
        let zlStr= world ? `${spaces}FOV:${zlRet.fovFormatted}` : zlRet.zoomLevelFormatted;
        let tooltip= world ? `${plot.title}\nHorizontal field of view: ${zlRet.fovFormatted}` : plot.title;
        if (isImage(plot)) {
            tooltip+= `\nZoom Level${colons} ${zlRet.zoomLevelFormatted}`;
        }
        let rotString;
        let flipString;
        if (pv.rotation) {
            if (pv.plotViewCtx.rotateNorthLock) {
                rotString= 'North';
            } else {
                const angleStr= sprintf('%d',Math.trunc(360-pv.rotation));
                rotString= angleStr + String.fromCharCode(176);
            }
            zlStr+=',';
            tooltip+= `, ${rotString}`;
        }
        if (pv.flipY) {
            flipString= ', Flip Y';
            tooltip+= ', Flip Y';
        }


        return (
            <div className={getStyleName(titleType)} title={tooltip}>
                <div className='plot-title-title'>{plot.title}</div>
                {!brief ? <div className='plot-title-zoom'><div title={tooltip} dangerouslySetInnerHTML={{__html:zlStr}}/> </div> : ''}
                {!brief && rotString ? <div title={tooltip} className='plot-title-rotation'>{rotString}</div> : ''}
                {!brief && flipString ? <div title={tooltip} className='plot-title-flipped'>{flipString}</div> : ''}
                {working && <img className={'plot-title-working'} src={LOADING}/>}
            </div>
        );
    },
    (p, np) => p.titleType===np.titleType && p.working===np.working && p.brief===np.brief &&
        pvEqualExScroll(p.plotView, np.plotView),
);

function getStyleName(titleType) {
    switch (titleType) {
        case TitleType.INLINE:   return 'plot-title-inline-title-container';
        case TitleType.HEAD:     return 'plot-title-header-title-container';
        case TitleType.EXPANDED: return 'plot-title-expanded-title-container';
    }
}

PlotTitle.propTypes= {
    plotView : PropTypes.object,
    titleType: PropTypes.object.isRequired,
    working : PropTypes.bool,
    brief : PropTypes.bool.isRequired
};


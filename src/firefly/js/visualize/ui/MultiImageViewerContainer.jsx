/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import PropTypes from 'prop-types';
import {ImageExpandedMode} from '../iv/ImageExpandedMode.jsx';
import {MultiViewStandardToolbar} from './MultiViewStandardToolbar.jsx';
import {MultiImageViewer} from './MultiImageViewer.jsx';
import {DEFAULT_FITS_VIEWER_ID, NewPlotMode} from '../MultiViewCntlr.js';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode} from '../../core/LayoutCntlr.js';

/**
 * A wrapper component for MultiImageViewer where expended mode is supported.
 * @param obj
 * @param obj.viewerId  MultiImageViewer's viewerId.
 * @param obj.imageExpandedMode  if true, then imageExpandedMode overrides everything else
 * @param {boolean} obj.closeable    if true, expanded view can be closed.
 * @param {boolean} obj.insideFlex  true if it's used inside a css flex box.  Defaults to false.
 * @param {Object} obj.Toolbar  the toolbar for the image multi viewer
 * @returns {Object}
 * @constructor
 */
export function MultiImageViewerContainer({viewerId, imageExpandedMode=false, closeable=true, insideFlex=false,
                                           forceRowSize, Toolbar= MultiViewStandardToolbar}) {
    
    if (imageExpandedMode) {
        return  ( <ImageExpandedMode
                        key='results-plots-expanded'
                        insideFlex = {insideFlex}
                        closeFunc={closeable ? closeExpanded : null}/>
                );
    } else {
        return ( <MultiImageViewer viewerId = {viewerId}
                        insideFlex = {insideFlex} forceRowSize={forceRowSize}
                        canReceiveNewPlots = {NewPlotMode.create_replace.key}
                        Toolbar = {Toolbar}/>
        );
    }
}


function closeExpanded() {
    dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.none);
}

MultiImageViewerContainer.propTypes = {
    viewerId: PropTypes.string,
    imageExpandedMode : PropTypes.bool,
    closeable: PropTypes.bool,
    insideFlex: PropTypes.bool,
};

MultiImageViewerContainer.defaultProps = {
    viewerId: DEFAULT_FITS_VIEWER_ID
};

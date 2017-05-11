/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import PropTypes from 'prop-types';
import {get} from 'lodash';
import {ExpandedModeDisplay} from '../iv/ExpandedModeDisplay.jsx';
import {Tab, Tabs} from '../../ui/panel/TabPanel.jsx';
import {MultiViewStandardToolbar} from './MultiViewStandardToolbar.jsx';
import {ImageMetaDataToolbar} from './ImageMetaDataToolbar.jsx';
import {MultiImageViewer} from './MultiImageViewer.jsx';
import {watchImageMetaData} from '../saga/ImageMetaDataWatcher.js';
import {watchCoverage} from '../saga/CoverageWatcher.js';
import {dispatchAddSaga} from '../../core/MasterSaga.js';
import {DEFAULT_FITS_VIEWER_ID, NewPlotMode} from '../MultiViewCntlr.js';
import {getTblById} from '../../tables/TableUtil.js';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode, dispatchUpdateLayoutInfo} from '../../core/LayoutCntlr.js';

export const META_VIEWER_ID = 'triViewImageMetaData';


/**
 * This component works with ImageMetaDataWatch sega which should be launch during initialization
 * @param p
 * @param p.showCoverage
 * @param p.showFits
 * @param p.showMeta
 * @param p.imageExpandedMode if true, then imageExpandedMode overrides everything else
 * @param p.closeable expanded mode should have a close button
 * @param p.metaDataTableId
 * @return {XML}
 * @constructor
 */
export function TriViewImageSection({showCoverage=false, showFits=false, selectedTab='fits',
                                     showMeta=false, imageExpandedMode=false, closeable=true,
                                     metaDataTableId}) {

    if (imageExpandedMode) {
        return  ( <ExpandedModeDisplay
                        key='results-plots-expanded'
                        forceExpandedMode={true}
                        closeFunc={closeable ? closeExpanded : null}/>
                );
    }
    const onTabSelect = (idx, id) => dispatchUpdateLayoutInfo({images:{selectedTab:id}});
    const table= getTblById(metaDataTableId);
    const metaTitle= get(table,'tableMeta.title')  || 'Image Meta Data';


    // showCoverage= true; // todo - let the application control is coverage is visible

    if (showCoverage || showFits || showMeta) {
        return (
            <Tabs onTabSelect={onTabSelect} defaultSelected={selectedTab} useFlex={true} resizable={true}>
                { showFits &&
                    <Tab name='FITS Data' removable={false} id='fits'>
                        <MultiImageViewer viewerId= {DEFAULT_FITS_VIEWER_ID}
                                          insideFlex={true}
                                          canReceiveNewPlots={NewPlotMode.create_replace.key}
                                          Toolbar={MultiViewStandardToolbar}/>
                    </Tab>
                }
                { showMeta &&
                    <Tab name={metaTitle} removable={false} id='meta'>
                        <MultiImageViewer viewerId= {META_VIEWER_ID}
                                          insideFlex={true}
                                          canReceiveNewPlots={NewPlotMode.none.key}
                                          tableId={metaDataTableId}
                                          Toolbar={ImageMetaDataToolbar}/>
                    </Tab>
                }
                { showCoverage &&
                    <Tab name='Coverage' removable={false} id='coverage'>
                        <MultiImageViewer viewerId='coverageImages'
                                          insideFlex={true}
                                          canReceiveNewPlots={NewPlotMode.replace_only.key}
                                          Toolbar={MultiViewStandardToolbar}/>
                    </Tab>
                }
            </Tabs>
        );

    }
    else {
        return <div>todo</div>;
    }
}


function closeExpanded() {
    dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.none);
}

export function launchImageMetaDataSega() {
    dispatchAddSaga(watchImageMetaData,{viewerId: META_VIEWER_ID});
    dispatchAddSaga(watchCoverage, {viewerId:'coverageImages', ignoreCatalogs:true});
}

TriViewImageSection.propTypes= {
    showCoverage : PropTypes.bool,
    showFits : PropTypes.bool,
    showMeta : PropTypes.bool,
    imageExpandedMode : PropTypes.bool,
    closeable: PropTypes.bool,
    metaDataTableId: PropTypes.string,
    selectedTab: PropTypes.oneOf(['fits', 'meta', 'coverage'])
};

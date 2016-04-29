/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {Component, PropTypes} from 'react';
import {isEmpty} from 'lodash';
import sCompare from 'react-addons-shallow-compare';
import {primePlot,isMultiImageFitsWithSameArea,getAllDrawLayersForPlot} from '../PlotViewUtil.js';
import {CysConverter} from '../CsysConverter.js';
import {PlotAttribute} from '../WebPlot.js';
import {makeImagePt} from '../Point.js';
import {callGetAreaStatistics} from '../../rpc/PlotServicesJson.js';
import {ToolbarButton} from '../../ui/ToolbarButton.jsx';
import {logError} from '../../util/WebUtil.js';
import SelectArea from '../../drawingLayers/SelectArea.js';
import {showImageAreaStatsPopup} from './ImageStatsPopup.jsx';

import {dispatchDetachLayerFromPlot} from '../DrawLayerCntlr.js';
import {dispatchCrop, dispatchChangePrimePlot} from '../ImagePlotCntlr.js';
import {makeExtActivateData} from '../PlotCmdExtension.js';
import {dispatchExtensionActivate} from '../../core/ExternalAccessCntlr.js';
import {selectCatalog,unselectCatalog,filterCatalog,clearFilterCatalog} from '../../drawingLayers/Catalog.js';

import CROP from 'html/images/icons-2014/24x24_Crop.png';
import STATISTICS from 'html/images/icons-2014/24x24_Statistics.png';
import SELECTED from 'html/images/icons-2014/24x24_Checkmark.png';
import UNSELECTED from 'html/images/icons-2014/24x24_CheckmarkOff_Circle.png';
import FILTER from 'html/images/icons-2014/24x24_FilterAdd.png';
import CLEAR_FILTER from 'html/images/icons-2014/24x24_FilterOff_Circle.png';
import PAGE_RIGHT from 'html/images/icons-2014/20x20_PageRight.png';
import PAGE_LEFT from 'html/images/icons-2014/20x20_PageLeft.png';

import CoordUtil from '../CoordUtil.js';
import { parseImagePt } from '../Point.js';


//todo move the statistics constants to where they are needed
const Metrics= {MAX:'MAX', MIN:'MIN', CENTROID:'CENTROID', FW_CENTROID:'FW_CENTROID', MEAN:'MEAN',
    STDEV:'STDEV', INTEGRATED_FLUX:'INTEGRATED_FLUX', NUM_PIXELS:'NUM_PIXELS', PIXEL_AREA:'PIXEL_AREA'};


/**
 * representing the number into decimal or exponential format
 * @param {number} [num]
 * @param {number} [fractionDigits=7] fractional digits after the decimal point
 * @return {string}
 */

function formatNumber(num, fractionDigits=7)
{
    let numStr, thred;
    const SigDig = 7;


    if (num === null || num === undefined) {
        return '';
    }
    thred = Math.min(Math.pow(10, SigDig - fractionDigits), 1.0);

    if (Math.abs(num) >= thred) {
        numStr = num.toFixed(fractionDigits);
    } else {
        numStr = num.toExponential(fractionDigits);
    }
    return numStr;
}

/**
 * tabularize the area statistics into summary and stats two sections for popup display
 * @param {object} wpResult
 * @param {object} cc
 * @returns { object } {statsSummary: array (for summary items), statsTable: array (for table rows)}}
 */

function tabulateStatics(wpResult, cc) {

    const SSummary = 'statsSummary';
    const STable   = 'statsTable';
    const ipMetrics = [Metrics.MIN, Metrics.MAX, Metrics.CENTROID, Metrics.FW_CENTROID];
    const bands  = wpResult.Band_Info;
    const noBand = 'NO_BAND';

    var bandData = {};

    function getOneStatSet(b) {

        let tblData = {};

        tblData[SSummary] = [
            [b.MEAN.desc, formatNumber(b.MEAN.value) + ' ' + b.MEAN.units],
            [b.STDEV.desc, formatNumber(b.STDEV.value) + ' ' + b.STDEV.units],
            [b.INTEGRATED_FLUX.desc,
                formatNumber(b.INTEGRATED_FLUX.value) + ' ' + b.INTEGRATED_FLUX.units]
        ];

        tblData[STable] = [{'cells': ['', 'Position', 'Value']}];

        for (let i = 0; i < ipMetrics.length; i++) {
            if (!b.hasOwnProperty(ipMetrics[i])) {
                continue;
            }

            const item = b[ipMetrics[i]];
            let ipt, wpt;
            let hmsRA, hmsDec;
            let statsRow = [];

            // item title
            statsRow.push(item.desc);

            // item location
            ipt = parseImagePt(item.ip);
            wpt = cc.getWorldCoords(ipt);
            hmsRA = CoordUtil.convertLonToString(wpt.getLon(), wpt.getCoordSys());
            hmsDec = CoordUtil.convertLatToString(wpt.getLat(), wpt.getCoordSys());
            statsRow.push(`RA: ${hmsRA}\nDEC: ${hmsDec}`);

            // item value
            if (item.value === null || item.value === undefined) {
                statsRow.push('');
            } else {
                statsRow.push(`${formatNumber(item.value)} ${item.units}`);
            }

            tblData[STable].push({'cells': statsRow, 'worldPt': wpt});
        }
        return tblData;
    }

    if (bands.hasOwnProperty(noBand)) {
        bandData[noBand] = getOneStatSet(bands[noBand]);
    } else {
        const bandName = ['Blue', 'Red', 'Green'];

        bandName.forEach((value) => {
            if (bands[value]) {
                bandData[value] = getOneStatSet(bands[value]);
            }
        });
    }

    return bandData;
}

/**
 *
 * @param pv
 */
function stats(pv) {
    //console.log('Stats getting: ' + primePlot(pv).title);
    //console.log(Metrics);
    var p= primePlot(pv);
    var cc= CysConverter.make(p);
    var sel= p.attributes[PlotAttribute.SELECTION];

    var ip0=  cc.getImageCoords(sel.pt0);
    var ip2=  cc.getImageCoords(sel.pt1);
    var ip1=  makeImagePt(ip2.x,ip0.y);
    var ip3=  makeImagePt(ip1.x,ip2.y);


    callGetAreaStatistics(p.plotState, ip0,ip1,ip2,ip3)
        .then( (wpResult) => {      // result of area stats

            // tabaularize stats data
            var tblData = tabulateStatics(wpResult, cc);

            //console.log(wpResult);
            showImageAreaStatsPopup(p.title, tblData, pv.plotId);
        })
        .catch ( (e) => {
            logError(`error, stat , plotId: ${p.plotId}`, e);
        });

}


function crop(pv) {
    var p= primePlot(pv);
    var cc= CysConverter.make(p);
    var sel= p.attributes[PlotAttribute.SELECTION];

    var ip0=  cc.getImageCoords(sel.pt0);
    var ip1=  cc.getImageCoords(sel.pt1);


    var cropMultiAll= p.plotState.isMultiImageFile() && isMultiImageFitsWithSameArea(pv);

    dispatchDetachLayerFromPlot(SelectArea.TYPE_ID,pv.plotId,true);
    dispatchCrop(pv.plotId, ip0,ip1,cropMultiAll);
}




function makeExtensionButtons(extensionAry,pv,dlAry) {
    if (!extensionAry) return false;
    return extensionAry.map( (ext,idx) => (
            <ToolbarButton icon={ext.imageUrl} text={ext.title}
                           tip={ext.toolTip} key={ext.id}
                           horizontal={true} enabled={true}
                           visible={true}
                           lastTextItem={idx===(extensionAry.length-1)}
                           onClick={() => dispatchExtensionActivate(ext,makeExtActivateData(ext,pv,dlAry))}/>
        )
    );
}


/**
 *
 * @param pv
 * @param dlAry
 * @param extensionAry
 * @param showCrop
 * @param showStats
 * @param showSelect
 * @param showUnSelect
 * @param showFilter
 * @param showClearFilter
 * @param showMultiImageController
 * @return {XML}
 * @constructor
 */

export class VisCtxToolbarView extends Component {

    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }


    render() {
        const {
            plotView:pv, dlAry, extensionAry, showCrop=false,
            showStats=false, showSelect=false, showUnSelect=false,
            showFilter=false, showClearFilter=false,
            showMultiImageController=false }= this.props;

        const rS= {
            width: '100% - 2px',
            display:'flex',
            height: 34,
            position: 'relative',
            verticalAlign: 'top',
            whiteSpace: 'nowrap',
            flexDirection:'row',
            flexWrap:'nowrap',
            alignItems: 'center'

        };

        var showOptions= showCrop|| showStats|| showSelect|| showUnSelect ||
            showFilter || showClearFilter || !isEmpty(extensionAry);

        return (
            <div style={rS}>
                {showMultiImageController && <MultiImageControllerView plotView={pv} />}
                {showOptions && <div
                    style={{display: 'inline-block', padding: '8px 7px 0 8px', alignSelf:'flex-start',
                        float : 'left', fontStyle: 'italic'}}>
                    Options:</div>
                }
                <ToolbarButton icon={CROP}
                               tip='Crop the image to the selected area'
                               horizontal={true}
                               visible={showCrop}
                               onClick={() => crop(pv)}/>

                <ToolbarButton icon={STATISTICS}
                               tip='Show statistics for the selected area'
                               horizontal={true}
                               visible={showStats}
                               onClick={() => stats(pv)}/>

                <ToolbarButton icon={SELECTED}
                               tip='Mark data in area as selected'
                               horizontal={true}
                               visible={showSelect}
                               onClick={() => selectCatalog(pv,dlAry)}/>

                <ToolbarButton icon={UNSELECTED}
                               tip='Mark all data unselected'
                               horizontal={true}
                               visible={showUnSelect}
                               onClick={() => unselectCatalog(pv,dlAry)}/>

                <ToolbarButton icon={FILTER}
                               tip='Filter in the selected area'
                               horizontal={true}
                               visible={showFilter}
                               onClick={() => filterCatalog(pv,dlAry)}/>

                <ToolbarButton icon={CLEAR_FILTER}
                               tip='Clear all the Filters'
                               horizontal={true}
                               visible={showClearFilter}
                               onClick={() => clearFilterCatalog(pv,dlAry)}/>


                {makeExtensionButtons(extensionAry,pv,dlAry)}

            </div>
        );
    }
}






VisCtxToolbarView.propTypes= {
    plotView : PropTypes.object.isRequired,
    dlAry : PropTypes.arrayOf(React.PropTypes.object),
    extensionAry : PropTypes.arrayOf(React.PropTypes.object),
    showCrop : PropTypes.bool,
    showStats : PropTypes.bool,
    showSelect : PropTypes.bool,
    showUnSelect : PropTypes.bool,
    showFilter : PropTypes.bool,
    showClearFilter : PropTypes.bool,
    showMultiImageController : PropTypes.bool
};



ToolbarButton.defaultProps= {
    showCrop : false,
    showStats : false,
    showSelect : false,
    showUnSelect : false,
    showFilter : false,
    extensionAry : null
};


const leftImageStyle= {
    verticalAlign:'bottom',
    cursor:'pointer',
    flex: '0 0 auto',
    paddingLeft: 3
};




const mulImStyle= {
    display:'inline-flex',
    height: 34,
    position: 'relative',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
    flexDirection:'row',
    flexWrap:'nowrap',
    alignItems: 'center',
    // width:'100%',
};


export function MultiImageControllerView({plotView:pv}) {

    const {plots,plotId}= pv;

    if (plots.length<3) {
        leftImageStyle.visibility='hidden';
    }
    const plot= primePlot(pv);

    var cIdx= plots.findIndex( (p) => p.plotImageId===plot.plotImageId);
    if (cIdx<0) cIdx= 0;

    const nextIdx= cIdx===plots.length-1 ? 0 : cIdx+1;
    const prevIdx= cIdx ? cIdx-1 : plots.length-1;
    
    return (
        <div style={mulImStyle}>
            <div style={{fontStyle: 'italic', padding: '8px 0 0 5px', alignSelf:'flex-start'}}>Image:</div>
            <img style={leftImageStyle} src={PAGE_LEFT}
                 onClick={() => dispatchChangePrimePlot(plotId,prevIdx)} />
            <img style={{verticalAlign:'bottom', cursor:'pointer', float: 'right', paddingLeft:3, flex: '0 0 auto'}}
                 src={PAGE_RIGHT}
                 onClick={() => dispatchChangePrimePlot(plotId,nextIdx)} />
            {plots[cIdx].plotDesc &&
                  <div style={{minWidth: '3em', padding:'0 10px 0 5px', fontWeight:'bold'}}>{plots[cIdx].plotDesc}</div>}
            <div style={{minWidth: '3em', paddingLeft:4}}>{`${cIdx+1}/${plots.length}`}</div>
        </div>
    );
}


MultiImageControllerView.propTypes= {
    plotView : PropTypes.object.isRequired,
};


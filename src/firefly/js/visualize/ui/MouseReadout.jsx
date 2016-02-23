
/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 * Lijun
 *   1/16/2016
 *   propType: define all the property variable for the component
 *   this.plot, this.plotSate are the class global variables
 *
 */
import React, {PropTypes} from 'react';
import {makeScreenPt,makeImagePt,makeWorldPt} from '../Point.js';
import MouseState from '../VisMouseCntlr.js';
import {makeImageFromTile,createImageUrl,isTileVisible} from './../iv/TileDrawHelper.jsx';
import {primePlot} from '../PlotViewUtil.js';
import {isBlankImage} from '../WebPlot.js';
import InputFieldLabel from '../../ui/InputFieldLabel.jsx';
import {showMouseReadoutOptionDialog} from './MouseReadoutOptionPopups.jsx';
import CoordinateSys from '../CoordSys.js';
import CysConverter from '../CsysConverter.js';
import CoordUtil from '../CoordUtil.js';
import VisUtil from '../VisUtil.js';

import debounce from 'lodash/debounce'; //TEST CODE
import {callGetFileFlux} from '../../rpc/PlotServicesJson.js'; //TEST CODE
import numeral from 'numeral';

var rS= {
	width: 550,
	height: 32,
	display: 'inline-block',
	position: 'relative',
	verticalAlign: 'top'
};

const EMPTY= <div style={rS}></div>;
const EMPTY_READOUT='';
const magMouse= [ MouseState.DRAG, MouseState.MOVE, MouseState.DOWN];
const coordinateMap = {
	galactic:CoordinateSys.GALACTIC,
	eqb1950:CoordinateSys.EQ_B1950,
	pixelSize:CoordinateSys.PIXEL,
	sPixelSize: CoordinateSys.SCREEN_PIXEL
};
const labelMap = {
	eqj2000hms:'EQ-J2000:',
	eqj2000DCM:'EQ-J2000:',
	galactic:'Gal:',
	eqb1950:'Eq-B1950:',
	fitsIP:'Image Pixel:',
	pixelSize:'Pixel Size:',
	sPixelSize:'Screen Pixel Size:'
};
const column1 = {width: 90, paddingRight: 5, textAlign:'right',textDecoration: 'underline', color: 'DarkGray', fontStyle:'italic' ,  display: 'inline-block'};
const column2 = {width: 60, display: 'inline-block'};
const column3 = {width: 75, paddingRight: 5, textAlign:'right',textDecoration: 'underline', color: 'DarkGray', fontStyle:'italic' ,  display: 'inline-block'};
const column4 = {width: 170,display: 'inline-block'};
const column5 = {width: 90, paddingLeft:8, display: 'inline-block'};
const column5_1 = {width: 90, paddingLeft:5, display: 'inline-block'};

/**
 *
 * @param visRoot
 * @param plotView
 * @param mouseState
 * @returns {XML}
 * @constructor
 */
export function MouseReadout({visRoot, plotView, mouseState}) {

	if (!plotView || !mouseState) return EMPTY;


	var plot= primePlot(plotView);
	if (!plot) return'';
	if (isBlankImage(plot)) return EMPTY;

	if (!magMouse.includes(mouseState.mouseState)) EMPTY;

	var spt= mouseState.screenPt;
	if (!spt) return EMPTY;


	var title = plotView.plots[0].title;
		return (
			<div style={ rS}>
               <div  >
				    <div style={ column1} onClick={ () => showDialog('pixelSize', visRoot.pixelSize)}>
						{labelMap[visRoot.pixelSize] }
					 </div>
					 <div style={column2} >{ showReadout(plot, mouseState,visRoot.pixelSize)}</div>


				    <div  style={ column3} onClick={ () => showDialog('mouseReadout1' ,visRoot.mouseReadout1)}>
						 { labelMap[visRoot.mouseReadout1] }
				    </div>
					<div style={column4} > {showReadout(plot, mouseState,visRoot.mouseReadout1)} </div>


				  <div style={column5}> {title}  </div>
             </div>


				<div>
					<div style={ column1} ></div>
					<div style={ column2}  > {showReadout(plot, mouseState,visRoot.flux ) }
					</div>

					<div  style={ column3} onClick={ () => showDialog('mouseReadout2' ,visRoot.mouseReadout2)}>
						{labelMap[ visRoot.mouseReadout2] } </div>
					<div style={column4} >	{showReadout(plot, mouseState, visRoot.mouseReadout2)}</div>

					<div style={column5_1}  title='Click on an image to lock the display at that point.'   >
						<input  type='checkbox' name='aLock' value='lock'
							   onChange = { (request) => setClickLock(plot,mouseState , request) } />
						Lock by click
					</div>
				</div>

			</div>




	);
}


MouseReadout.propTypes= {
	visRoot:   PropTypes.object.isRequired,
	plotView:  PropTypes.object,
	mouseState: PropTypes.object.isRequired,
};


/**
 *
 * This method map the value in coordinate option popup to its value
 * @param coordinateRadioValue : the value in the radio button
 * @returns {{coordinate: *, type: *}}
 */
function getCoordinateMap(coordinateRadioValue){
	var coordinate;
	var type;
	if (coordinateRadioValue ==='eqj2000hms'){
		coordinate = CoordinateSys.EQ_J2000;
		type = 'hms';
	}
	else if (coordinateRadioValue ==='eqj2000DCM'){
		coordinate = CoordinateSys.EQ_J2000;
		type = 'decimal';
	}
	else{
		coordinate = coordinateMap[coordinateRadioValue];
		//if coordinate is not define, assign it as below
		if (!coordinate) coordinate=CoordinateSys.UNDEFINED;
	}
	return {coordinate, type};
}

/**
 * set the image lock
 * @param plot
 * @param mouseState
 * @param request
 */
function setClickLock( plot,mouseState, request) {

	if (request.hasOwnProperty('target')) {
		var target = request.target;
		var pixelClickLock =target.checked;
		if (pixelClickLock) {
			plot.plotState.getWebPlotRequest().setAllowImageSelection(false);
			//mouseState.setAllowImageSelection(false);

		} else {
			plot.plotState.getWebPlotRequest().setAllowImageSelection(true);
			//mouseState.setAllowImageSelection(true);
		}
	}


}

/**
 * Display the mouse readout based on the chosen coordinate
 * @param plot
 * @param mouseState
 * @param readoutValue
 * @returns {*}
 */
function showReadout(plot, mouseState, readoutValue){

	if (!plot) return EMPTY_READOUT;
	if (isBlankImage(plot)) return EMPTY_READOUT;

	var spt= mouseState.screenPt;
	if (!spt) return EMPTY_READOUT;



	var {width:screenW, height:screenH }= plot.screenSize;
	if (spt.x<0 || spt.x>screenW || spt.y<0 || spt.y>screenH){
		return EMPTY_READOUT;
	}

	if (readoutValue==='Flux'){
		//TODO get flux
		return 'Flux';
	}

	var precision7Digit='0.0000000';
	var precision3Digit='0.000';

	if (readoutValue==='fitsIP'){
			return ' ' + numeral(mouseState.imagePt.x).format(precision3Digit)+', '+
			numeral(mouseState.imagePt.y).format(precision3Digit);
	}

	var result;
	var cc= CysConverter.make(plot);
	var wpt= cc.getWorldCoords(mouseState.imagePt);
	if (!wpt) return;
	var {coordinate, type} =getCoordinateMap(readoutValue);

	if (coordinate){
		var ptInCoord= VisUtil.convert(wpt, coordinate);

		var lon = ptInCoord.getLon();
		var lat = ptInCoord.getLat();
		var hmsLon = CoordUtil.convertLonToString(lon, coordinate);
		var hmsLat = CoordUtil.convertLatToString(lat, coordinate);

		switch (coordinate) {
			case CoordinateSys.EQ_J2000:
				if (type === 'hms') {
					result = ` ${hmsLon},  ${hmsLat}`;
		        }
				else {
					//convert to decimal representation
					var dmsLon = CoordUtil.convertStringToLon(hmsLon,coordinate);
					var dmsLat = CoordUtil.convertStringToLat( hmsLat,coordinate);
					result =` ${numeral(Number(dmsLon)).format(precision7Digit)}, ${numeral(Number(dmsLat)).format(precision7Digit)}`;
				}
				break;
			case CoordinateSys.GALACTIC:
			case CoordinateSys.SUPERGALACTIC:

				var lonShort = numeral(lon).format(precision7Digit) ;
				var latShort = numeral(lat).format(precision7Digit);
				result= ` ${lonShort}, ${latShort}`;
				break;
			case CoordinateSys.EQ_B1950:
				result = ' ' +  hmsLon + ',  ' + hmsLat;
				break;

			case CoordinateSys.PIXEL:
				var pt =plot.projection.getPixelScaleArcSec();
				result= `  ${numeral(pt).format(precision3Digit)}`;
				break;
			case CoordinateSys.SCREEN_PIXEL:
				var size =plot.projection.getPixelScaleArcSec()/plot.zoomFactor;
				result= `  ${numeral(size).format(precision3Digit)}`;
				break;

			default:
				result='';
				break;
		}

	}


    return result;
}

function showDialog(fieldKey, radioValue) {

		console.log('showing ' + fieldKey+ ' option dialog');
	    showMouseReadoutOptionDialog(fieldKey, radioValue);

}


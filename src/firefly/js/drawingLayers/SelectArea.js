/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import {isEmpty, get} from 'lodash';
import DrawLayerCntlr, {DRAWING_LAYER_KEY} from '../visualize/DrawLayerCntlr.js';
import {visRoot,dispatchAttributeChange} from '../visualize/ImagePlotCntlr.js';
import {makeDrawingDef} from '../visualize/draw/DrawingDef.js';
import DrawLayer, {ColorChangeType}  from '../visualize/draw/DrawLayer.js';
import {MouseState} from '../visualize/VisMouseSync.js';
import {PlotAttribute} from '../visualize/WebPlot.js';
import CsysConverter from '../visualize/CsysConverter.js';
import Point, {makeScreenPt, makeDevicePt} from '../visualize/Point.js';
import BrowserInfo from '../util/BrowserInfo.js';
import {getBoundingBox, computeScreenDistance} from '../visualize/VisUtil.js';
import SelectBox from '../visualize/draw/SelectBox.js';
import FootPrintObj from '../visualize/draw/FootprintObj.js';
import ShapeDataObj from '../visualize/draw/ShapeDataObj.js';
import {getPlotViewById, primePlot, getDrawLayerById} from '../visualize/PlotViewUtil.js';
import {Style} from '../visualize/draw/DrawingDef.js';
//import DrawLayerFactory from '../visualize/draw/DrawLayerFactory.js';
import {makeFactoryDef} from '../visualize/draw/DrawLayerFactory.js';

import Enum from 'enum';




const Corner = new Enum([ 'NE','NW','SE','SW' ]);
export const SelectedShape = new Enum(['rect', 'circle']);


const selHelpText=
`Click and drag to select an area, then choose from Options
To modify your selection: click on the corners
To select again: hold down the shift key, click, and drag`;

const editHelpText=
`Click and drag a corner to resize selection area, then choose from Options.
To select again: hold down the shift key, click, and drag`;

const EDIT_DISTANCE= BrowserInfo.isTouchInput() ? 18 : 10;


const ID= 'SELECT_AREA';
const TYPE_ID= 'SELECT_AREA_TYPE';

const factoryDef= makeFactoryDef(TYPE_ID,creator,null,getLayerChanges,onDetach,null);

export default {factoryDef, TYPE_ID}; // every draw layer must default export with factoryDef and TYPE_ID


let idCnt=0;


export function selectAreaEndActionCreator(rawAction) {
    return (dispatcher, getState) => {
        const {plotId}= rawAction.payload;
        let {drawLayer}= rawAction.payload;
        const pv= getPlotViewById(visRoot(),plotId);
        const plot= primePlot(pv);
        dispatcher({type:DrawLayerCntlr.SELECT_AREA_END, payload:rawAction.payload} );

        drawLayer= getDrawLayerById(getState()[DRAWING_LAYER_KEY], drawLayer.drawLayerId);

        if (drawLayer.drawData.data) {
            const selectBox= drawLayer.drawData.data.find( (drawObj) => drawObj.type===SelectBox.SELECT_BOX);
            const sel= {pt0:selectBox.pt1,pt1:selectBox.pt2};
            dispatchAttributeChange(plotId,true,PlotAttribute.SELECTION,sel,true);
            // const imBoundSel= pv.rotation ? getImageBoundsSelection(sel,CsysConverter.make(plot)) : sel;
            const imBoundSel= getImageBoundsSelection(sel,CsysConverter.make(plot), drawLayer.selectedShape, pv.rotation);
            dispatchAttributeChange(plotId,true,PlotAttribute.IMAGE_BOUNDS_SELECTION, imBoundSel,true);
        }
    };
}

/**
 * @param initPayload containing the setting for handle color, selected shape like 'rectangle', 'circle'
 * @return {Function}
 */
function creator(initPayload) {

    const drawingDef= makeDrawingDef('black');
    const pairs= {
        [MouseState.MOVE.key]: DrawLayerCntlr.SELECT_MOUSE_LOC,
        [MouseState.DRAG.key]: DrawLayerCntlr.SELECT_AREA_MOVE,
        [MouseState.DOWN.key]: DrawLayerCntlr.SELECT_AREA_START,
        [MouseState.UP.key]: DrawLayerCntlr.SELECT_AREA_END
    };

    const actionTypes= [DrawLayerCntlr.SELECT_AREA_START,
                      DrawLayerCntlr.SELECT_AREA_MOVE,
                      DrawLayerCntlr.SELECT_AREA_END,
                      DrawLayerCntlr.SELECT_MOUSE_LOC];

    const exclusiveDef= { exclusiveOnDown: true, type : 'anywhere' };



    idCnt++;
    const options= {
        canUseMouse:true,
        canUserChangeColor: ColorChangeType.DISABLE,
        canUserDelete: true,
        destroyWhenAllDetached: true
    };
    const dl = DrawLayer.makeDrawLayer( `${ID}-${idCnt}`, TYPE_ID, 'Selection Tool',
                                     options, drawingDef, actionTypes, pairs, exclusiveDef, getCursor);
    dl.handleColor = get(initPayload, 'handleColor');
    dl.selectedShape = get(initPayload, 'selectedShape', SelectedShape.rect.key);
    return dl;
}

function onDetach(drawLayer,action) {
    const {plotIdAry}= action.payload;
    plotIdAry.forEach( (plotId) => {
        dispatchAttributeChange(plotId,false,PlotAttribute.SELECTION,null,true);
        dispatchAttributeChange(plotId,false,PlotAttribute.IMAGE_BOUNDS_SELECTION,null,true);
    });
}

function getCursor(plotView, screenPt) {
    const plot= primePlot(plotView);
    const cc= CsysConverter.make(plot);
    const ptAry= getPtAryFromPlot(plot);
    if (!ptAry) return null;
    const corner= findClosestCorner(cc,ptAry, screenPt, EDIT_DISTANCE);
    if (!corner) return null;
    switch (corner) {
        case Corner.NE:
            return 'nesw-resize';
            break;
        case Corner.NW:
            return 'nwse-resize';
            break;
        case Corner.SE:
            return 'nwse-resize';
            break;
        case Corner.SW:
            return 'nesw-resize';
            break;
    }
    return null;
}

function getLayerChanges(drawLayer, action) {

    switch (action.type) {
        case DrawLayerCntlr.SELECT_AREA_START:
            return start(drawLayer,action);
            break;
        case DrawLayerCntlr.SELECT_AREA_MOVE:
            return drag(drawLayer,action);
            break;
        case DrawLayerCntlr.SELECT_AREA_END:
            return end(drawLayer,action);
            break;
        case DrawLayerCntlr.ATTACH_LAYER_TO_PLOT:
            if (isEmpty(get(drawLayer, ['drawData', 'data']))) {
                return attach();
            }
            break;
        case DrawLayerCntlr.SELECT_MOUSE_LOC:
            return moveMouse(drawLayer,action);
            break;
    }

}



function attach() {
    return {
        helpLine: selHelpText,
        drawData:{data:null},
        vertexDef: {points:null, pointDist:EDIT_DISTANCE},
        exclusiveDef: { exclusiveOnDown: true, type: 'anywhere' }
    };
}

function moveMouse(drawLayer,action) {
    const {screenPt,plotId}= action.payload;
    const plot= primePlot(visRoot(),plotId);
    const mode= getMode(plot);
    if (plot && mode==='edit') {
        const cc= CsysConverter.make(plot);
        const ptAry= getPtAryFromPlot(plot);
        if (!ptAry) return null;
        const corner= findClosestCorner(cc,ptAry, screenPt, EDIT_DISTANCE);
        let cursor;
        if (corner) {
            switch (corner) {
                case Corner.NE: cursor= 'ne-resize'; break;
                case Corner.NW: cursor= 'nw-resize'; break;
                case Corner.SE: cursor= 'se-resize'; break;
                case Corner.SW: cursor= 'sw-resize'; break;
            }
        } else {
            cursor= '';
        }
        return (drawLayer.cursor!==cursor) ? {cursor} : null;
    }
}


function start(drawLayer,action) {
    const {screenPt,imagePt,plotId,shiftDown}= action.payload;
    const plot= primePlot(visRoot(),plotId);
    const mode= getMode(plot);
    if (!plot) return;

    if (mode==='select' || shiftDown) {
        return setupSelect(imagePt);
    }
    else if (mode==='edit') {
        const ptAry= getPtAryFromPlot(plot);
        if (!ptAry) return {};

        const idx= findClosestPtIdx(ptAry,screenPt);
        if (idx<0) return {};
        const cc= CsysConverter.make(plot);
        const testPt= cc.getScreenCoords(ptAry[idx]);
        if (!testPt) return {};

        if (distance(testPt,screenPt)<EDIT_DISTANCE) {
            const retObj= {};
            const oppoIdx= (idx+2) % 4;
            retObj.firstPt= cc.getImageWorkSpaceCoords(ptAry[oppoIdx]);
            retObj.currentPt= cc.getImageWorkSpaceCoords(ptAry[idx]);
            if (!retObj.firstPt || !retObj.currentPt) return {};
            return retObj;
        }
        else {
            return setupSelect(imagePt);
        }
    }
}

function getPtAryFromPlot(plot) {
    const sel= plot.attributes[PlotAttribute.SELECTION];
    if (!sel) return null;
    return getPtAry(plot,sel.pt0,sel.pt1);
}

function getPtAry(plot,pt0,pt1) {
    const ptAry=[];
    const cc= CsysConverter.make(plot);
    ptAry[0]= cc.getScreenCoords(pt0);
    ptAry[2]= cc.getScreenCoords(pt1);
    if (!ptAry[0] || !ptAry[2]) return null;
    ptAry[1] = makeScreenPt(ptAry[2].x, ptAry[0].y);
    ptAry[3] = makeScreenPt(ptAry[0].x, ptAry[2].y);
    return ptAry;

}


function getPtAryForCorners(plot,pt0,pt1) {
    const screenPtAry= getPtAry(plot,pt0,pt1);
    if (isEmpty(screenPtAry)) return null;
    const cc= CsysConverter.make(plot);
    const useWld=  cc.projection.isSpecified();
    return screenPtAry.map( (sp) => useWld ? cc.getWorldCoords(sp) : cc.getImageCoords(sp));
}



function drag(drawLayer,action) {
    const {imagePt,plotId}= action.payload;
    const pv= getPlotViewById(visRoot(),plotId);
    const plot= primePlot(pv);
    if (!plot) return;
    const drawSel= makeSelectObj(drawLayer.firstPt, imagePt, CsysConverter.make(plot), pv.rotation, plot.title, drawLayer);
    const exclusiveDef= { exclusiveOnDown: true, type : 'vertexThenAnywhere' };
    return {currentPt:imagePt,
            drawData:{data:drawSel},
            exclusiveDef,
            vertexDef:{points:getPtAryForCorners(plot,drawLayer.firstPt,imagePt), pointDist:EDIT_DISTANCE}
     };
}

function end(drawLayer,action) {
    const mode= getMode(primePlot(visRoot(),action.payload.plotId));
    return  (mode==='select') ? {helpLine: editHelpText} : {};
}

function getMode(plot) {
    if (!plot) return 'select';
    const selection = plot.attributes[PlotAttribute.SELECTION];
    return (selection) ? 'edit' : 'select';
}

const distance= (pt1,pt2) => computeScreenDistance(pt1.x,pt1.y,pt2.x,pt2.y);

function setupSelect(imagePt) {
    return {firstPt: imagePt, currentPt: imagePt};
}

function findClosestPtIdx(ptAry, pt) {
    let dist= Number.MAX_VALUE;
    return ptAry.reduce( (idx,testPt,i) => {
        if (!testPt || !pt) return idx;
        const testDist= distance(testPt,pt);
        if (testDist<dist) {
            dist= testDist;
            idx= i;
        }
        return idx;
    },-1);

}


function findClosestCorner(cc,ptAry, spt, testDist) {
    const idx = findClosestPtIdx(ptAry, spt);
    if (idx<0) return null;
    const testPt = cc.getScreenCoords(ptAry[idx]);

    if (!testPt) return null;
    if (distance(testPt, spt)>testDist) return null;

    const idxBelow= idx-1>-1? idx-1 : 3;
    const idxAbove= idx+1<4? idx+1 : 0;

    const west= (ptAry[idx].x===Math.min( ptAry[idxBelow].x, ptAry[idxAbove].x));
    const north= (ptAry[idx].y===Math.min( ptAry[idxBelow].y, ptAry[idxAbove].y));

    if      (north && west) return Corner.NW;
    else if (north && !west) return Corner.NE;
    else if (!north && west) return Corner.SW;
    else if (!north && !west) return Corner.SE;

    return null;
}


/**
 * @param {object} firstPt
 * @param {object} currentPt
 * @param {CysConverter} cc
 * @param {boolean} rotation is plot rotated
 * @param {string} title
 * @param {object} dl
 * @return {Array}
 */
function makeSelectObj(firstPt,currentPt,cc, rotation, title, dl) {
    const fallbackAry= [firstPt,currentPt];

    const world= cc.projection.isSpecified();
    let twoPtAry=  world? [cc.getWorldCoords(firstPt),cc.getWorldCoords(currentPt)] : fallbackAry;

    if (!twoPtAry[0] || !twoPtAry[1]) twoPtAry= fallbackAry;

    const {x,y,w,h}= makeImageBoundingBox({pt0:firstPt,pt1:currentPt},cc, dl.selectedShape, rotation);
    const fpScreenAry= [ makeScreenPt(x,y), makeScreenPt(x+w,y), makeScreenPt(x+w,y+h), makeScreenPt(x,y+h) ];

    const fpAry= fpScreenAry.map( (p) => world ? cc.getWorldCoords(p) : cc.getImageCoords(p));
    const fpObj= FootPrintObj.make([fpAry]);
    fpObj.color= 'yellow';
    fpObj.renderOptions.lineDash= [8,5,2,5];

    const retAry=  [];
    if (rotation) retAry.push(fpObj);

    const selectBox = SelectBox.makeSelectBox(twoPtAry[0], twoPtAry[1], Style.HANDLED);

    selectBox.selectedShape = get(dl, 'selectedShape');
    selectBox.handleColor = get(dl, 'handleColor');
    retAry.push(selectBox);
    if (rotation) {
        const textInfo= ShapeDataObj.makeText(fpAry[0], `Selection: ${title} image space`);
        textInfo.color= 'yellow';
        retAry.push(textInfo);
    }
    return retAry;
}

function getImageBoundsSelection(sel,cc, shape, rotation) {
    const {x, y, w, h} = makeImageBoundingBox(sel,cc, shape, rotation);

    const sp0= makeScreenPt(x,y);
    const sp1= makeScreenPt(x+w,y+h);

    return sel.pt0.type=== Point.W_PT ?
            {pt0:cc.getWorldCoords(sp0),pt1:cc.getWorldCoords(sp1)} :
            {pt0:cc.getImageCoords(sp0),pt1:cc.getImageCoords(sp1)};

}

function modScreenPt(cc, p) {
    const {width,height}= cc.screenSize;

    let {x,y}= p;
    x= x<0 ? 0 : x;
    x= x> width-1 ? width-1 : x;
    y= y<0 ? 0 : y;
    y= y> height-1 ? height-1 : y;

    return makeScreenPt(x, y);
}

function makeImageBoundingBox(sel,cc, shape, rotation) {
    const {pt0,pt1}= sel;
    const dev0= cc.getDeviceCoords(pt0);
    const dev1= cc.getDeviceCoords(pt1);

    if (shape === SelectedShape.circle.key) {
        return getEllipseBoundingBox([dev0, dev1], cc, rotation);
    }

    const screenPtVersion= [
        cc.getScreenCoords(dev0),
        cc.getScreenCoords(makeDevicePt(dev0.x,dev1.y)),
        cc.getScreenCoords(dev1),
        cc.getScreenCoords(makeDevicePt(dev1.x,dev0.y))
    ];

    const modScreenPtVersion= screenPtVersion.map ( (p) => {
         return modScreenPt(cc, p);
    } );
    return getBoundingBox(modScreenPtVersion);
}

function getEllipseBoundingBox(devPts, cc, rotation ) {
    const sortX = devPts.map((pt) => pt.x).sort((v1, v2) => v1-v2);
    const sortY = devPts.map((pt) => pt.y).sort((v1, v2) => v1-v2);
    const centerDev =  makeDevicePt((devPts[0].x + devPts[1].x)/2, (devPts[0].y + devPts[1].y)/2);

    const r1_2 = Math.pow(Math.max((sortX[sortX.length-1] - sortX[0])/2, 1), 2);
    const r2_2 = Math.pow(Math.max((sortY[sortY.length-1] - sortY[0])/2, 1), 2);
    const angle = Math.PI*2 - (rotation*Math.PI/180);
    const cos_2 = Math.cos(angle) * Math.cos(angle);
    const sin_2 = Math.sin(angle) * Math.sin(angle);

    const x = Math.sqrt((r1_2 * cos_2) + (r2_2 * sin_2));  // find x & y where the denominator & numerator of dy/dx is 0
    const y = Math.sqrt((r1_2 * sin_2) + (r2_2 * cos_2));  // after ellipse is rotated by 'angle'

    const tangentScreenPts = [makeDevicePt(x, y),
                              makeDevicePt(x, -y),
                              makeDevicePt(-x, -y),
                              makeDevicePt(-x, y)].map((p) => {
        const o_x = Math.cos(-angle) * p.x - Math.sin(-angle) * p.y;   // rotate back
        const o_y = Math.sin(-angle) * p.x + Math.cos(-angle) * p.y;

        return modScreenPt(cc, cc.getScreenCoords(makeDevicePt(o_x + centerDev.x, o_y + centerDev.y)));
    });

    return getBoundingBox(tangentScreenPts);

}

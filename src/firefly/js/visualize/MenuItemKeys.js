/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import {getAppOptions} from '../core/AppDataCntlr.js';

export function getDefMenuItemKeys() {
    const MenuItemKeys= {
        lockImage: false,
        maskOverlay : false,
        irsaCatalog : false,
        fitsDownload : true,
        imageSelect : true,
        zoomUp : true,
        zoomDown : true,
        zoomOriginal : true,
        zoomFit : true,
        zoomFill : true,
        colorTable : true,
        stretchQuick : true,
        rotate: true,
        rotateNorth: true,
        flipImageY: true,
        recenter : true,
        selectArea: true,
        distanceTool: true,
        markerToolDD : true,
        northArrow : true,
        grid : true,
        ds9Region : true,
        layer : true,
        restore : true,
        overlayColorLock: true,
        fitsHeader: true,
        panByTableRow: true,
        matchLockDropDown: true,
        extractZAxis: true,
        extractLine: true,
        extractPoint: true,
        extract: true,
        showImageToolbar: true,
    };
    return {...MenuItemKeys, ...getAppOptions()?.MenuItemKeys};
}

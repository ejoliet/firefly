/**
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 * @author tatianag
 */
"use strict";

import {TableMeta, HAS_ACCESS_CNAME} from './TableMeta.js';

var StringUtils= require('ipac-firefly/util/StringUtils.js');


export class RawDataSet {


    /**
     * @param {TableMeta} meta
     * @param {Number} startingIndex
     * @param {Number} totalRows
     * @param {String} dataSetString
     */
    constructor(meta, startingIndex, totalRows, dataSetString) {
        this._meta = meta;
        this._startingIndex = startingIndex;
        this._totalRows = totalRows;
        this._dataSetString = dataSetString;
    }

    get meta() { return this._meta; }
    set meta(value) { this._meta = value; }
    get startingIndex() { return this._startingIndex; }
    set startingIndex(value) { this._startingIndex = value; }
    get totalRows() { return this._totalRows; }
    set totalRows(value) { this._totalRows = value; }
    get dataSetString() { return this._dataSetString; }
    set dataSetString(value) { this._dataSetString = value; }


    static parse(s) {
        const SPLIT_TOKEN= '--RawDataSet--';
        const NL_TOKEN=  /---nl---/g;

        try {
            var sAry = StringUtils.parseHelper(s,4,SPLIT_TOKEN);
            var i= 0;
            var startingIndex= sAry[i++];
            var totalRows=     sAry[i++];
            var meta= TableMeta.parse(sAry[i++]);
            var dsTmp= StringUtils.checkNull(sAry[i++]);
            var dataSetString= dsTmp.replace(NL_TOKEN,'\n');
            return new RawDataSet(meta,startingIndex,totalRows,dataSetString);
        } catch (e) {
            console.log(e);
            return null;
        }
    }

}

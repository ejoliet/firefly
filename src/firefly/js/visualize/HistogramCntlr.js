import {flux} from '../Firefly.js';

import {has, get, set} from 'lodash';

import ColValuesStatistics from './ColValuesStatistics.js';

import TableRequest from '../tables/TableRequest.js';
import LoadTable from '../tables/reducers/LoadTable.js';
import TableUtil from '../tables/TableUtil.js';

import TablesCntlr from '../tables/TablesCntlr.js';

/*
 Possible structure of store:
 /histogram
   tbl_id: the name of this node matches table id
     isTblLoaded: boolean - tells if the table is completely loaded
     searchRequest: TableRequest - if source table changes, histogram store should be recreated
     isColStatsReady: boolean
     colStats: [ColValuesStatistics]
       histogram_id - not yet implemented; the data below are at the same level as those above
       isColDataReady: boolean
       histogramData: [[numInBin: int, min: double, max: double]*]
       histogramParams: {
          columnOrExpr: column name or column expression
          algorithm: 'fixedSizeBins' or 'byesianBlocks'
          numBins: int - for 'fixedSizeBins' algorithm
          x: [log,reverse] x (domain) axis options
          y: [log,reverse] y (counts) axis options
          falsePositiveRate: double - for 'byesianBlocks' algorithm (default 0.05)
          minCutoff: double
          maxCutoff: double
   }
 */


const HISTOGRAM_DATA_KEY = 'histogram';
const SETUP_TBL_TRACKING = `${HISTOGRAM_DATA_KEY}/SETUP_TBL_TRACKING`;
const LOAD_TBL_STATS = `${HISTOGRAM_DATA_KEY}/LOAD_TBL_STATS`;
const UPDATE_TBL_STATS = `${HISTOGRAM_DATA_KEY}/UPDATE_TBL_STATS`;
const LOAD_COL_DATA = `${HISTOGRAM_DATA_KEY}/LOAD_COL_DATA`;
const UPDATE_COL_DATA = `${HISTOGRAM_DATA_KEY}/UPDATE_COL_DATA`;


/*
 * Set up store, which will reflect the data relevant to the given table
 * @param {string} tblId - table id
 */
const dispatchSetupTblTracking = function(tblId) {
    flux.process({type: SETUP_TBL_TRACKING, payload: {tblId}});
};

/*
 * Get the number of points, min and max values, units and description for each table column
 * @param {ServerRequest} searchRequest - table search request
 */
const dispatchLoadTblStats = function(searchRequest) {
    flux.process({type: LOAD_TBL_STATS, payload: {searchRequest}});
};

/*
 * The statistics is successfully returned from the server, update the store
 * @param {boolean} isColStatsReady flags that column statistics is now available
 * @param {ColValuesStatistics[]} an array which holds column statistics for each column
 * @param {ServerRequest} table search request
 */
const dispatchUpdateTblStats = function(isColStatsReady,colStats,searchRequest) {
    flux.process({type: UPDATE_TBL_STATS, payload: {isColStatsReady,colStats,searchRequest}});
};

/*
 * Get column histogram data
 * @param {Object} histogramParams - histogram options (column name, etc.)
 * @param {ServerRequest} searchRequest - table search request
 */
const dispatchLoadColData = function(histogramParams, searchRequest) {
    flux.process({type: LOAD_COL_DATA, payload: {histogramParams, searchRequest}});
};

/*
 * Get column histogram data
 * @param {boolean} isColDataReady - flags that column histogram data are available
 * @param {Number[][]} histogramData - an array of the number arrays with npoints, binmin, binmax
 * @param {Object} histogramParams - histogram options (column name, etc.)
 * @param {ServerRequest} searchRequest - table search request
 */
const dispatchUpdateColData = function(isColDataReady, histogramData, histogramParams, searchRequest) {
    flux.process({type: LOAD_COL_DATA, payload: {isColDataReady,histogramData,histogramParams,searchRequest}});
};

/*
 * @param rawAction (its payload should contain searchRequest to get source table)
 * @returns function which loads statistics (column name, num. values, range of values) for a source table
 */
const loadTblStats = function(rawAction) {
    return (dispatch) => {
        dispatch({ type : LOAD_TBL_STATS, payload : rawAction.payload });
        if (rawAction.payload.searchRequest) {
            fetchTblStats(dispatch, rawAction.payload.searchRequest);
        }
    };
};

/*
 * @param rawAction (its payload should contain searchRequest to get source table and histogram parameters)
 * @returns function which loads statistics (column name, num. values, range of values) for a source table
 */
const loadColData = function(rawAction) {
    return (dispatch) => {
        dispatch({ type : LOAD_COL_DATA, payload : rawAction.payload });
        if (rawAction.payload.searchRequest && rawAction.payload.histogramParams) {
            fetchColData(dispatch, rawAction.payload.searchRequest, rawAction.payload.histogramParams);
        }

    };
};

function getInitState() {
    return {
    };
}

/*
 Get the new state related to a particular table (if it's tracked)
 @param tblId {string} table id
 @param state {object} histogram store
 @param newProps {object} new properties
 @return {object} new state
 */
function getNewTblData(tblId, state, newProps) {
    if (has(state, tblId)) {
        const tblData = get(state, tblId);
        const newTblData = Object.assign({}, tblData, newProps);
        const newState = Object.assign({}, state);
        set(newState, tblId, newTblData);
        return newState;
    }
    return state;
}

function reducer(state=getInitState(), action={}) {
    switch (action.type) {
        case (SETUP_TBL_TRACKING) :
            var {tblId} = action.payload;
            var isTblLoaded;
            if (TableUtil.isFullyLoaded(tblId)) {
                isTblLoaded = true;
                action.sideEffect((dispatch) => fetchTblStats(dispatch, TableUtil.findById(tblId).model.request));

            } else {
                isTblLoaded = false;
            }
            const newState = Object.assign({}, state);
            set(newState, tblId, {isTblLoaded});
            return newState;
        case (TablesCntlr.LOAD_TABLE)  :
            const {tbl_id, tableMeta, request} = action.payload;
            if (has(state, tbl_id)) {
                if (tableMeta.isFullyLoaded && !get(state, [tbl_id, 'isTblLoaded'])){
                    const newState = Object.assign({}, state);
                    set(newState, tbl_id, {isTblLoaded:true});
                    action.sideEffect((dispatch) => fetchTblStats(dispatch,request));
                    return newState;
                }
            }
            return state;
        case (LOAD_TBL_STATS)  :
        {
            let {searchRequest} = action.payload;
            return getNewTblData(searchRequest.tbl_id, state, {isColStatsReady: false});
        }
        case (UPDATE_TBL_STATS)  :
        {
            let {isColStatsReady, colStats, searchRequest} = action.payload;
            return getNewTblData(searchRequest.tbl_id, state, {isColStatsReady, colStats, searchRequest});
        }
        case (LOAD_COL_DATA)  :
        {
            let {histogramParams, searchRequest} = action.payload;
            return getNewTblData(searchRequest.tbl_id, state, {isColDataReady: false});
        }
        case (UPDATE_COL_DATA)  :
        {
            let {isColDataReady, histogramData, histogramParams, searchRequest} = action.payload;
            return getNewTblData(searchRequest.tbl_id, state, {
                isColDataReady,
                histogramData,
                histogramParams,
                searchRequest
            });
        }
        default:
            return state;
    }
}


/**
 *
 * @param statsData {Object} The table statistics object to merge with the histogram branch under root
 * @returns {{type: string, payload: object}}
 */
function updateTblStats(statsData) {
    return { type : UPDATE_TBL_STATS, payload: statsData };
}

/**
 *
 * @param data {Object} the data to merge with the histogram branch under root
 * @returns {{type: string, payload: object}}
 */
function updateColData(data) {
    return { type : UPDATE_COL_DATA, payload: data };
}

/**
 * fetches histogram data for a column or column expression of an active table
 * set isColStatsReady to true once done.
 * @param dispatch
 * @param activeTableServerRequest table search request to obtain source table
 */
function fetchTblStats(dispatch, activeTableServerRequest) {

    // searchRequest
    const sreq = Object.assign({}, activeTableServerRequest, {'startIdx': 0, 'pageSize': 1000000});

    const req = TableRequest.newInstance({
                    id:'StatisticsProcessor',
                    searchRequest: JSON.stringify(sreq),
                    tbl_id: activeTableServerRequest.tbl_id
                });

    LoadTable.doFetchTable(req).then(
        (tableModel) => {
            if (tableModel.tableData && tableModel.tableData.data) {
                const colStats = tableModel.tableData.data.reduce((colstats, arow) => {
                    colstats.push(new ColValuesStatistics(...arow));
                    return colstats;
                }, []);
                dispatch(updateTblStats(
                    {
                        isColStatsReady: true,
                        colStats,
                        searchRequest: sreq
                    }));
            }
        }
    ).catch(
        (reason) => {
            console.error(`Failed to fetch table statistics: ${reason}`);
        }
    );
}

/**
 * fetches active table statistics data
 * set isColStatsReady to true once done.
 * @param dispatch
 * @param activeTableServerRequest table search request to obtain source table
 * @param histogramParams object, which contains histogram parameters

 */
function fetchColData(dispatch, activeTableServerRequest, histogramParams) {

    const sreq = Object.assign({}, activeTableServerRequest, {'startIdx' : 0, 'pageSize' : 1000000});

    const req = TableRequest.newInstance({id:'HistogramProcessor'});
    req.searchRequest = JSON.stringify(sreq);

    // histogram parameters
    req.columnExpression = histogramParams.columnOrExpr;
    if (histogramParams.x && histogramParams.x.includes('log')) {
        req.columnExpression = 'log('+req.columnExpression+')';
    }
    if (histogramParams.numBins) { // fixed size bins
        req.numBins = histogramParams.numBins;
    }
    if (histogramParams.falsePositiveRate) {  // variable size bins using Bayesian Blocks
        req.falsePositiveRate = histogramParams.falsePositiveRate;
    }
    if (histogramParams.minCutoff) {
        req.min = histogramParams.minCutoff;
    }
    if (histogramParams.maxCutoff) {
        req.max = histogramParams.maxCutoff;
    }

    req.tbl_id = activeTableServerRequest.tbl_id;

    LoadTable.doFetchTable(req).then(
        (tableModel) => {
            if (tableModel.tableData && tableModel.tableData.data) {
                // if logarithmic values were requested, convert the returned exponents back
                var toNumber = histogramParams.x.includes('log') ?
                    (val,i)=>{
                        if (i === 0) {
                            return Number(val);
                        }
                        else {
                            return Math.pow(10,Number(val));
                        }
                    } : (val)=>Number(val);
                const histogramData = tableModel.tableData.data.reduce((data, arow) => {
                    data.push(arow.map(toNumber));
                    return data;
                }, []);

                dispatch(updateColData(
                    {
                        isColDataReady : true,
                        histogramParams,
                        histogramData,
                        searchRequest : sreq
                    }));
            }
        }
    ).catch(
        (reason) => {
            console.error(`Failed to fetch histogram data: ${reason}`);
        }
    );
}



var HistogramCntlr = {
    reducer,
    HISTOGRAM_DATA_KEY,
    dispatchSetupTblTracking,
    dispatchLoadTblStats,
    dispatchLoadColData,
    SETUP_TBL_TRACKING,
    loadTblStats,
    LOAD_TBL_STATS,
    UPDATE_TBL_STATS,
    loadColData,
    LOAD_COL_DATA,
    UPDATE_COL_DATA };
export default HistogramCntlr;
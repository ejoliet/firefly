/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
export const ServerParams = {
        COMMAND : 'cmd',
        DO_JSONP : 'doJsonp',
        RED_REQUEST : 'red',
        GREEN_REQUEST : 'green',
        BLUE_REQUEST : 'blue',
        NOBAND_REQUEST : 'noband',
        REQUEST : 'request',
        SAVE_KEY : 'saveKey',
        CLIENT_REQUEST : 'clientRequest',
        WAIT_MILS : 'waitMils',
        STATE : 'state',
        PROGRESS_KEY : 'progressKey',
        LEVEL : 'level',
        FULL_SCREEN : 'fullScreen',
        IMAGE_PT1 : 'ImagePt1',
        FILE_AND_HEADER : 'fah',
        PT : 'pt',
        PT1 : 'pt1',
        PT2 : 'pt2',
        PT3 : 'pt3',
        PT4 : 'pt4',
        CRO_MULTI_ALL : 'cropMultiAll',
        STRETCH_DATA : 'stretchData',
        BAND : 'band',
        IDX : 'idx',
        COLOR_IDX : 'idx',
        COL_NAME: 'colName',
        NORTH : 'north',
        ANGLE : 'angle',
        ROTATE : 'rotate',
        WIDTH : 'width',
        HEIGHT : 'height',
        CTXSTR : 'ctx',
        USER_AGENT : 'userAgent',
        DRAW_INFO : 'drawInfo',
        SOURCE : 'source',
        ALT_SOURCE : 'alt_source',
        OBJ_NAME : 'objName',
        RESOLVER : 'resolver',
        ID : 'id',
        BID : 'bid',
        CHANNEL_ID : 'channelID',
        TRY_MS: 'tryMS',
        PLOT_ID : 'plotId',
        POLLING : 'polling',
        EMAIL : 'email',
        ATTRIBUTE : 'attribute',
        FILE : 'file',
        PLOT_EXTERNAL : 'PlotExternal',
        FILE_KEY : 'fileKey',
        REGION_DATA : 'regionData',
        ROWS : 'rows',
        REQUESTED_DATA_SET : 'RequestedDataSet',
        DATA_TYPE: 'DataType',
        DATA: 'Data',
        DESC: 'Desc',
        SPACIAL_TYPE: 'SpacialType',
        URL: 'URL',
        IP_ADDRESS: 'ipAddress',
        SCROLL_X: 'scrollX',
        SCROLL_Y: 'scrollY',
        ZOOM_FACTOR: 'zoomFactor',
        RANGE_VALUES: 'rangeValues',
        MASK_DATA: 'maskData',
        MASK_BITS: 'maskBits',

        EXT_TYPE: 'extType',
        IMAGE: 'image',
        TOOL_TIP:  'toolTip',
        DS9_REGION_DATA: 'ds9RegionData',
        DOWNLOAD_REQUEST: 'downloadRequest',
        SELECTION_INFO: 'selectionInfo',
        SORT_ORDER: 'sortOrder',
        IMAGE_SOURCES: 'imageSources',
        EXTERNAL : 'external',
        IRSA : 'irsa',
        LSST : 'lsst',
        ALL : 'all',
        CDS : 'cds',
        HIPS_SOURCES : 'hipsSources',
        HIPS_DATATYPES: 'hipsDataTypes',
        HIPS_DEFSOURCES: 'defHipsSources',
        HIPS_MERGE_PRIORITY: 'mergedListPriority',
        CUBE: 'cube',
        CATALOG: 'catalog',

        GEOSHAPE : 'shape',
        ROTATION : 'rotation',

        // commands
        FILE_FLUX_JSON : 'CmdFileFluxJson',
        CREATE_PLOT : 'CmdCreatePlot',
        CREATE_PLOT_GROUP : 'CmdCreatePlotGroup',
        ZOOM : 'CmdZoom',
        STRETCH : 'CmdStretch',
        CHANGE_COLOR : 'CmdChangeColor',
        FLIP_Y : 'CmdFlipY',
        HISTOGRAM : 'CmdHistogram',
        CROP : 'CmdCrop',
        STAT : 'CmdStat',
        USER_KEY : 'CmdUserKey',
        VERSION : 'CmdVersion',
        GET_USER_INFO : 'CmdGetUserInfo',
        GET_ALERTS : 'CmdAlerts',
        RAW_DATA_SET : 'RawDataSet',
        JSON_DATA : 'JsonData',
        RESOLVE_NAME: 'CmdResolveName',
        RESOLVE_NAIFID: 'CmdResolveNaifid',
        SUB_BACKGROUND_SEARCH: 'subBackgroundSearch',
        GET_STATUS: 'status',
        REMOVE_JOB: 'removeBgJob',
        ADD_JOB: 'addBgJob',
        CANCEL: 'cancel',
        CLEAN_UP: 'cleanup',
        DOWNLOAD_PROGRESS: 'downloadProgress',
        SET_EMAIL: 'setEmail',
        SET_ATTR: 'setAttribute',
        GET_EMAIL: 'getEmail',
        RESEND_EMAIL: 'resendEmail',
        CLEAR_PUSH_ENTRY: 'clearPushEntry',
        REPORT_USER_ACTION: 'reportUserAction',
        CREATE_DOWNLOAD_SCRIPT: 'createDownoadScript',
        DS9_REGION: 'ds9Region',
        SAVE_DS9_REGION: 'saveDS9Region',
        TITLE: 'Title',
        JSON_SEARCH: 'jsonSearch',
        CLIENT_IS_NORTH: 'clientIsNorth',
        CLIENT_ROT_ANGLE: 'clientRotAngle',
        CLIENT_FlIP_Y: 'clientFlipY',
        ACTION: 'action',
        PACKAGE_REQUEST: 'packageRequest',
        TABLE_SEARCH: 'tableSearch',
        QUERY_TABLE: 'queryTable',
        SELECTED_VALUES: 'selectedValues',
        TABLE_SAVE: 'tableSave',
        UPLOAD: 'upload',
        LOG_OUT: 'CmdLogout',
        INIT_APP: 'CmdInitApp',
        GET_IMAGE_MASTER_DATA: 'getImageMasterData',
        GET_FLOAT_DATA: 'getFloatData',
        GET_BYTE_DATA: 'getStretchedByteData',
        BACK_TO_URL: 'backToUrl',
        VIS_PUSH_ALIVE_CHECK: 'pushAliveCheck',
        VIS_PUSH_ALIVE_COUNT: 'pushAliveCount',
        VIS_PUSH_ACTION: 'pushAction',
        TILE_SIZE: 'tileSize',
        USER_TARGET_WORLD_PT : 'UserTargetWorldPt',
        WS_LIST : 'wsList',
        WS_GET_FILE : 'wsGet',
        WS_UPLOAD_FILE : 'wsUpload', // to get the path of the file uploaded into firefly server from WS
        WS_PUT_IMAGE_FILE : 'wsPut', //FITS, PNG, comes from edu.caltech.ipac.firefly.server.servlets.AnyFileDownload
        WS_PUT_TABLE_FILE : 'wsPutTable',
        WS_DELETE_FILE : 'wsDel',
        WS_MOVE_FILE : 'wsMove',
        WS_GET_METADATA : 'wsGetMeta',
        WS_CREATE_FOLDER : 'wsParent',
        SOURCE_FROM : 'sourceFrom',
        IS_WS : 'isWs'
};
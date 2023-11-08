/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import {truncate, get, set} from 'lodash';
import {defer, truncate, get, set} from 'lodash';
import {getAppOptions, getSearchActions} from '../../core/AppDataCntlr.js';
import {ActionsDropDownButton, isTableActionsDropVisible} from '../../ui/ActionsDropDownButton.jsx';

import {useStoreConnector} from '../../ui/SimpleComponent.jsx';
import {dispatchTableRemove, dispatchTblExpanded, dispatchTableFetch, dispatchTableAddLocal, dispatchTableUiUpdate} from '../TablesCntlr.js';
import {
    uniqueTblId,
    getTableUiById,
    makeBgKey,
    getResultSetRequest,
    isClientTable,
    getTableState,
    TBL_STATE, getMetaEntry, getTblById
} from '../TableUtil.js';
import {TablePanelOptions} from './TablePanelOptions.jsx';
import {BasicTableView} from './BasicTableView.jsx';
import {TableInfo, MetaInfo} from './TableInfo.jsx';
import {makeConnector} from '../TableConnector.js';
import {SelectInfo} from '../SelectInfo.js';
import {PagingBar} from '../../ui/PagingBar.jsx';
import {ToolbarButton} from '../../ui/ToolbarButton.jsx';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode} from '../../core/LayoutCntlr.js';
import {HelpIcon} from '../../ui/HelpIcon.jsx';
import {showTableDownloadDialog} from './TableSave.jsx';
import {showOptionsPopup} from '../../ui/PopupUtil.jsx';
import {BgMaskPanel} from '../../core/background/BgMaskPanel.jsx';
import {Logger} from '../../util/Logger.js';
import {AddColumnBtn} from './AddOrUpdateColumn.jsx';

import FILTER from 'html/images/icons-2014/24x24_Filter.png';
import OUTLINE_EXPAND from 'html/images/icons-2014/24x24_ExpandArrowsWhiteOutline.png';
import OPTIONS from 'html/images/icons-2014/24x24_GearsNEW.png';
import {PropertySheetAsTable} from 'firefly/tables/ui/PropertySheet';
import {META} from '../TableRequestUtil.js';

const logger = Logger('Tables').tag('TablePanel');

const TT_INFO = 'Show additional table info';
const TT_OPTIONS = 'Edit Table Options';
const TT_SAVE = 'Save the content as an IPAC, CSV, or TSV table';
const TT_TEXT_VIEW = 'Text View';
const TT_TABLE_VIEW = 'Table View';
const TT_CLEAR_FILTER = 'Remove all filters';
const TT_SHOW_FILTER = 'Filters can be used to remove unwanted rows from the search results';
const TT_EXPAND = 'Expand this panel to take up a larger area';
const TT_PROPERTY_SHEET = 'Show details for the selected row';


export const TBL_CLZ_NAME = 'TablePanel__table';

export function TablePanel(props) {
    let {tbl_id, tbl_ui_id, tableModel, ...options} = props;
    tbl_id = tbl_id || tableModel?.tbl_id || uniqueTblId();
    tbl_ui_id = tbl_ui_id || `${tbl_id}-ui`;

    const uiState = useStoreConnector(() => getTableUiById(tbl_ui_id) || {columns:[]}, [tbl_ui_id]);
    const searchActions= getSearchActions();

    useEffect( () => {
        dispatchTableUiUpdate({tbl_ui_id, tbl_id, options});
    }, [tbl_id, tbl_ui_id]);

    useEffect( () => {
        if (tableModel && !tableModel.origTableModel) {
            tableModel.tbl_id = tbl_id;
            set(tableModel, 'request.tbl_id', tbl_id);
            dispatchTableAddLocal(tableModel, undefined, false);
        }
    }, [tbl_id, tableModel]);

    const {selectable, expandable, expandedMode, border, renderers, title, removable, rowHeight, rowHeightGetter, help_id,
        showToolbar, showTitle, showInfoButton, showMetaInfo, showOptions,
        showOptionButton, showPaging, showSave, showFilterButton,showSearchButton,
        totalRows, showLoading, columns, showHeader, showUnits, allowUnits, showTypes, showFilters, textView, status,
        error, startIdx, hlRowIdx, currentPage, pageSize, selectInfo, showMask, showToggleTextView, showPropertySheetButton,
        filterInfo, filterCount, sortInfo, data, backgroundable, highlightedRowHandler, cellRenderers} = {...options, ...uiState};
    let {leftButtons, rightButtons, showAddColumn} = {...options, ...uiState};

    showAddColumn = isClientTable(tbl_id) ? false : showAddColumn;
    const showPropertySheet = showPropertySheetButton ?? getAppOptions()?.table?.propertySheet ?? true;

    const connector = makeConnector(tbl_id, tbl_ui_id);

    const toggleFilter = () => connector.onOptionUpdate({showFilters: !showFilters});
    const toggleTextView = () => connector.onToggleTextView(!textView);
    const clearFilter = () => connector.applyFilterChanges({filterInfo: '', sqlFilter: ''});
    const toggleOptions = () => connector.onToggleOptions(!showOptions);
    const onOptionUpdate = (value) => connector.onOptionUpdate(value);
    const onOptionReset = () => connector.onOptionReset();

    const expandTable = () => {
        dispatchTblExpanded(tbl_ui_id, tbl_id);
        dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.tables);
    };


    const selectInfoCls = SelectInfo.newInstance(selectInfo, startIdx);
    const viewIcoStyle = 'PanelToolbar__button ' + (textView ? 'tableView' : 'textView');
    const tableTopPos = showToolbar  ? 29 : 0;
    const TT_VIEW = textView ? TT_TABLE_VIEW : TT_TEXT_VIEW;

    // converts the additional left/right buttons into elements
    leftButtons =   leftButtons && leftButtons
        .map((f) => f(uiState))
        .map( (c, idx) => get(c, 'props.key') ? c : React.cloneElement(c, {key: idx})); // insert key prop if missing
    rightButtons = rightButtons && rightButtons
        .map((f) => f(uiState))
        .map( (c, idx) => get(c, 'props.key') ? c : React.cloneElement(c, {key: idx})); // insert key prop if missing

    const showOptionsDialog = () => showTableOptionDialog(onOptionUpdate, onOptionReset, clearFilter, tbl_ui_id, tbl_id);
    const showInfoDialog = () => showTableInfoDialog(tbl_id);

    const tstate = getTableState(tbl_id);
    logger.debug(`render.. state:[${tstate}] -- ${tbl_id}  ${tbl_ui_id}`);

    if ([TBL_STATE.ERROR,TBL_STATE.LOADING].includes(tstate))  return <NotReady {...{showTitle, tbl_id, title, removable, backgroundable, error}}/>;

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%'}}>
            <div className='TablePanel'>
                {showMetaInfo && <MetaInfo tbl_id={tbl_id} /> }
                <div className={'TablePanel__wrapper' + (border ? '--border' : '')}>
                    {showToolbar &&
                    <div className='PanelToolbar TablePanel__toolbar'>
                        <LeftToolBar {...{tbl_id, title, removable, showTitle, leftButtons}}/>
                        {showPaging && <PagingBar {...{currentPage, pageSize, showLoading, totalRows, callbacks:connector}} /> }
                        <div className='PanelToolbar__group'>
                            {rightButtons}
                            {showSearchButton &&  isTableActionsDropVisible(searchActions,tbl_id ) &&
                                <ActionsDropDownButton {...{searchActions, tbl_id}}/>
                            }
                            {showFilterButton && filterCount > 0 &&
                            <div onClick={clearFilter}
                                 title={TT_CLEAR_FILTER}
                                 className='PanelToolbar__button clearFilters'/>}
                            {showFilterButton &&
                            <ToolbarButton icon={FILTER}
                                           tip={TT_SHOW_FILTER}
                                           visible={true}
                                           badgeCount={filterCount}
                                           onClick={toggleFilter}/>
                            }
                            {showToggleTextView && <div onClick={toggleTextView}
                                 title={TT_VIEW}
                                 className={viewIcoStyle}/>}
                            {showSave &&
                            <div onClick={showTableDownloadDialog({tbl_id, tbl_ui_id})}
                                 title={TT_SAVE}
                                 className='PanelToolbar__button save'/> }
                            {showAddColumn && <AddColumnBtn tbl_id={tbl_id} tbl_ui_id={tbl_ui_id}/> }
                            {showInfoButton &&
                            <div style={{marginLeft: '4px'}}
                                 title={TT_INFO}
                                 onClick={showInfoDialog}
                                 className='PanelToolbar__button info'/> }
                            {showPropertySheet &&
                                <div style={{marginLeft: '4px'}}
                                     title={TT_PROPERTY_SHEET}
                                     onClick={() => showTablePropSheetDialog(tbl_id)}
                                     className='PanelToolbar__button propSheet'/> }
                            {showOptionButton &&
                            <div style={{marginLeft: '4px'}}
                                 title={TT_OPTIONS}
                                 onClick={showOptionsDialog}
                                 className='PanelToolbar__button options'/> }
                            { expandable && !expandedMode &&
                            <div className='PanelToolbar__button' onClick={expandTable} title={TT_EXPAND}>
                                <img src={OUTLINE_EXPAND}/>
                            </div>}
                            { help_id && <div style={{marginTop:-10}}> <HelpIcon helpId={help_id} /> </div>}
                        </div>
                    </div>
                    }
                    <div className={TBL_CLZ_NAME} style={{top: tableTopPos}}
                         onClick={stopPropagation}
                         onTouchStart={stopPropagation}
                         onMouseDown={stopPropagation}
                    >
                        <BasicTableView
                            callbacks={connector}
                            { ...{columns, data, hlRowIdx, rowHeight, rowHeightGetter, selectable, showUnits,
                                allowUnits, showTypes, showFilters, selectInfoCls, filterInfo, sortInfo, textView,
                                showMask, currentPage, showHeader, renderers, tbl_ui_id, highlightedRowHandler,
                                startIdx, cellRenderers} }
                        />
                        {showOptionButton && !showToolbar &&
                        <img className='TablePanel__options--small'
                             src={OPTIONS}
                             title={TT_OPTIONS}
                             onClick={showOptionsDialog}/>
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}

function showTableOptionDialog(onChange, onOptionReset, clearFilter, tbl_ui_id, tbl_id) {

    const content = (
         <div className='TablePanelOptionsWrapper'>
               <TablePanelOptions
                  onChange={onChange}
                  onOptionReset={onOptionReset}
                  clearFilter={clearFilter}
                  tbl_ui_id={tbl_ui_id}
                  tbl_id={tbl_id}
               />
         </div>
    );

    showOptionsPopup({content, title: 'Table Options', modal: true, show: true});


}

function showTableInfoDialog(tbl_id)  {
    const content = (
        <div className='TablePanelInfoWrapper' style={{width: 500}}>
            <TableInfo tbl_id={tbl_id}/>
        </div>
    );
    showOptionsPopup({content, title: 'Table Info', modal: true, show: true});
}

function showTablePropSheetDialog(tbl_id) {
    const {title=''} = getTblById(tbl_id) || {};
    showOptionsPopup({show: false});   // hide the dialog if one is currently opened
    const content = (
        <div className='TablePanelOptionsWrapper'>
            <PropertySheetAsTable tbl_id={tbl_id}/>
        </div>
    );
    defer(() => showOptionsPopup({content, title: 'Row Details: ' + title, modal: false, show: true}));
}

const stopPropagation= (ev) => ev.stopPropagation();


TablePanel.propTypes = {
    tbl_id: PropTypes.string,
    tbl_ui_id: PropTypes.string,
    tableModel: PropTypes.object,
    title: PropTypes.string,
    rowHeight: PropTypes.number,
    help_id: PropTypes.string,
    expandedMode: PropTypes.bool,
    pageSize: PropTypes.number,
    selectable: PropTypes.bool,
    expandable: PropTypes.bool,
    removable: PropTypes.bool,
    border: PropTypes.bool,
    showUnits: PropTypes.bool,
    allowUnits: PropTypes.bool,
    highlightedRowHandler: PropTypes.func,
    showMetaInfo: PropTypes.bool,
    showTypes: PropTypes.bool,
    showFilters: PropTypes.bool,
    showToolbar: PropTypes.bool,
    showTitle: PropTypes.bool,
    showPaging: PropTypes.bool,
    showSave: PropTypes.bool,
    showToggleTextView: PropTypes.bool,
    showOptionButton: PropTypes.bool,
    showFilterButton: PropTypes.bool,
    showAddColumn: PropTypes.bool,
    showInfoButton: PropTypes.bool,
    showSearchButton: PropTypes.bool,
    showPropertySheetButton: PropTypes.bool,
    showHeader: PropTypes.bool,
    leftButtons: PropTypes.arrayOf(PropTypes.func),   // an array of functions that returns a button-like component laid out on the left side of this table header.
    rightButtons: PropTypes.arrayOf(PropTypes.func),  // an array of functions that returns a button-like component laid out on the right side of this table header.
    renderers: PropTypes.objectOf(
        PropTypes.shape({
            cellRenderer: PropTypes.func,
            headRenderer: PropTypes.func
        })
    ),
    rowHeightGetter: PropTypes.func
};

TablePanel.defaultProps = {
    showMetaInfo: false,
    allowUnits: true,
    showToolbar: true,
    showTitle: true,
    showPaging: true,
    showSave: true,
    showOptionButton: true,
    showFilterButton: true,
    showInfoButton: true,
    showAddColumn: true,
    showTypes: true,
    selectable: true,
    showSearchButton: true,
    showHeader: true,
    expandedMode: false,
    expandable: true,
    showToggleTextView: true,
    border: true,
};


function LeftToolBar({tbl_id, title, removable, showTitle, leftButtons}) {
    const style = {display: 'inline-flex', alignItems: 'center'};
    const lbStyle = showTitle ? {...style, paddingLeft:10, alignSelf:'center'} : style;

    const doclinkUrl = getMetaEntry(tbl_id, META.doclink.url);
    if (doclinkUrl) {
        const doclinkLabel = getMetaEntry(tbl_id, META.doclink.label, 'Data Help');
        const doclinkDesc = getMetaEntry(tbl_id, META.doclink.desc) || doclinkLabel;
        const doclink = <a href={doclinkUrl} key={doclinkUrl} target='doclink' title={doclinkDesc}><button className='button std'>{doclinkLabel}</button></a>;
        if (leftButtons) {
            leftButtons.push(doclink);
        } else {
            leftButtons = [doclink];
        }
    }

    return (
        <div style={style}>
            { showTitle && <Title {...{title, removable, tbl_id}}/>}
            {leftButtons && <div style={lbStyle}>{leftButtons}</div>}
        </div>
    );
}

function Title({title, removable, tbl_id}) {
    return (
        <div className='TablePanel__title'>
            <div style={{display: 'inline-block', marginLeft: 5, marginTop: 2}}
                 title={title}>{truncate(title)}</div>
            {removable &&
            <div style={{right: -5}} className='btn-close'
                 title='Remove Tab'
                 onClick={() => dispatchTableRemove(tbl_id)}/>
            }
        </div>
    );
}


function NotReady({showTitle, tbl_id, title, removable, backgroundable, error}) {
    if (backgroundable) {
        const height = showTitle ? 'calc(100% - 20px)': '100%';
        return (
            <div style={{position: 'relative', width: '100%', height: '100%', border: 'solid 1px rgba(0,0,0,.2)', boxSizing: 'border-box'}}>
                {showTitle && <Title {...{title, removable, tbl_id}}/>}
                <div style={{height, position: 'relative'}}>
                    <BgMaskPanel componentKey={makeBgKey(tbl_id)}/>
                </div>
            </div>
        );
    } else {
        const prevReq = getResultSetRequest(tbl_id);
        const reloadTable = () => {
            dispatchTableFetch(JSON.parse(prevReq));
        };
        if (error) {
            return (
                <div className='TablePanel__error'>
                    <div style={{textAlign: 'center'}}>
                        <div style={{display: 'flex', flexDirection: 'column', margin: '5px 0'}}>
                            <b>Table Load Error:</b>
                            <pre style={{margin: '7px 0', whiteSpace: 'pre-wrap'}}>{error}</pre>
                        </div>
                        {prevReq && <button type='button' className='button std' onClick={reloadTable}>Back</button>}
                    </div>
                </div>
            );
        } else {
            return (
                <div style={{ position: 'relative', width: '100%', height: '100%'}}>
                    <div className='loading-mask'/>
                </div>
            );
        }
    }
}



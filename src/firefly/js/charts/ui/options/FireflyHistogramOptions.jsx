import React from 'react';
import {get, set} from 'lodash';

import {LayoutOptions, basicFieldReducer, submitChanges, basicOptions} from './BasicOptions.jsx';
import {HistogramOptions} from '../HistogramOptions.jsx';
import {getChartData} from '../../ChartsCntlr.js';

import {useStoreConnector} from '../../../ui/SimpleComponent.jsx';
import {getColValStats} from '../../TableStatsCntlr.js';
import {getChartProps} from '../../ChartUtil.js';
import {FieldGroupCollapsible} from '../../../ui/panel/CollapsiblePanel.jsx';

export function FireflyHistogramOptions({activeTrace:pActiveTrace, tbl_id:ptbl_id, chartId, groupKey}) {

    const [activeTrace] = useStoreConnector(() => {
        return pActiveTrace ?? getChartData(chartId)?.activeTrace;
    });

    groupKey = groupKey || `${chartId}-ffhist-${activeTrace}`;
    const {tbl_id, noColor, multiTrace} = getChartProps(chartId, ptbl_id, activeTrace);
    const colValStats = getColValStats(tbl_id);

    const histogramParams = toHistogramOptions(chartId, activeTrace);
    const {Name, Color} = basicOptions({activeTrace, tbl_id, chartId, groupKey, fieldProps:{labelWidth: 60}});

    const basicFields = (
        <div style={{margin: '5px 0 0 -22px'}}>
            { (multiTrace || !noColor) &&
                <FieldGroupCollapsible  header='Trace Options' initialState= {{ value:'closed' }} fieldKey='traceOptions'>
                    {multiTrace && <Name/>}
                    {!noColor && <Color/>}
                </FieldGroupCollapsible>
            }
            <LayoutOptions {...{activeTrace, tbl_id, chartId, groupKey, xNoLog: true, noXY: false}}/>
        </div>
    );
    const basicFieldsReducer = basicFieldReducer({chartId, activeTrace});
    basicFieldsReducer.ver = chartId+activeTrace;

    return colValStats ?
        <HistogramOptions {...{activeTrace, groupKey, histogramParams, colValStats, basicFields, basicFieldsReducer}}/> :
        'Loading...';
}

export function submitChangesFFHistogram({chartId, activeTrace, fields, tbl_id, renderTreeId}) {
    const changes = histogramOptionsToChanges(activeTrace, fields, tbl_id);
    submitChanges({chartId, fields: changes, tbl_id, renderTreeId});
}

function histogramOptionsToChanges(activeTrace, fields, tbl_id) {
    const changes = {};
    changes[`fireflyData.${activeTrace}.dataType`] = 'fireflyHistogram';
    changes[`fireflyData.${activeTrace}.tbl_id`] = tbl_id;
    fields && Object.entries(fields).forEach( ([k,v]) => {
        if (['data', 'layout', 'fireflyLayout', 'activeTrace', '_'].find((s) => k.startsWith(s))) {
            changes[k] = v;
        } else {
            changes[`fireflyData.${activeTrace}.options.${k}`] = v;
        }
    });

    return changes;
}

function toHistogramOptions(chartId, activeTrace=0) {
    const {fireflyData, layout={}} = getChartData(chartId);
    const options = get(fireflyData, `${activeTrace}.options`, {});
    const histogramOptions = {};
    Object.entries(options).forEach( ([k,v]) => {
        set(histogramOptions, k, v);
    });

    ['x', 'y'].forEach((a) => {
        const opts = [];
        if (get(layout, `${a}axis.autorange`) === 'reversed' ||
            (get(layout, `${a}axis.range.1`) < get(layout, `${a}axis.range.0`))) {
            opts.push('flip');
        }
        if (get(layout, `${a}axis.side`) === (a==='x'?'top':'right')) {
            opts.push('opposite');
        }
        if (get(layout, `${a}axis.type`) === 'log') {
            opts.push('log');
        }
        set(histogramOptions, a, opts.toString());
    });
    return histogramOptions;
}


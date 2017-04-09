import './ChartPanel.css';
import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
import Resizable from 'react-component-resizable';
import {flux} from '../../Firefly.js';
import {get, debounce, defer} from 'lodash';
import {reduxFlux} from '../../core/ReduxFlux.js';

import * as ChartsCntlr from '../ChartsCntlr.js';

import DELETE from 'html/images/blue_delete_10x10.png';

class ChartPanelView extends Component {

    constructor(props) {
        super(props);
        this.state = {
            optionsShown: false,
            componentKey: undefined // used when there are multiple 'options' components
        };

        const normal = (size) => {
            if (size && this.iAmMounted) {
                var widthPx = size.width;
                var heightPx = size.height;
                //console.log('width: '+widthPx+', height: '+heightPx);
                if (widthPx !== this.state.widthPx || heightPx !== this.state.heightPx) {
                    this.setState({widthPx, heightPx});
                }
            }
        };
        const debounced = debounce(normal, 100);
        this.onResize = (size) => {
            if (this.state.widthPx === 0) {
                defer(normal, size);
            } else {
                debounced(size);
            }
        };

        this.toggleOptions = this.toggleOptions.bind(this);
    }

    shouldComponentUpdate(nProps, nState) {
        return sCompare(this, nProps, nState);
    }

    toggleOptions(key) {
        const {optionsShown, componentKey} = this.state;
        if (key === componentKey) {
            const newShowOptions = !optionsShown;
            const newKey = newShowOptions ? key : undefined;
            this.setState({optionsShown: newShowOptions, key: newKey});
        } else if (key) {
            this.setState({optionsShown: true, componentKey: key});
        } else {
            this.setState({optionsShown: false, componentKey: key});
        }
    }

    componentDidMount() {
        const {chartId} = this.props;
        ChartsCntlr.dispatchChartMounted(chartId);
        this.iAmMounted = true;
    }

    componentWillReceiveProps(nextProps) {
        const {chartId} = nextProps;
        if (!chartId) { return; }

        if (chartId !== this.props.chartId) {
            ChartsCntlr.dispatchChartUnmounted(this.props.chartId);
            ChartsCntlr.dispatchChartMounted(chartId);
            this.setState({optionsShown: false});
        }
    }

    componentWillUnmount() {
        this.iAmMounted = false;
        const {chartId} = this.props;
        ChartsCntlr.dispatchChartUnmounted(chartId);
    }

    render() {
        const {chartId, chartData, deletable, expandable, expandedMode, Chart, Options, Toolbar, showToolbar, showChart, eventCallback} = this.props;

        if (!chartData) {
            return (<div/>);
        }

        var {widthPx, heightPx, componentKey, optionsShown} = this.state;
        const knownSize = widthPx && heightPx;
        const errors  = ChartsCntlr.getErrors(chartId);

        if (showChart) {
            // chart with toolbar and options
            if (showToolbar) {
                return (
                    <div className='ChartPanel__container'>
                        <div className='ChartPanel__wrapper'>
                            <Toolbar {...{chartId, expandable, expandedMode, toggleOptions: this.toggleOptions}}/>
                            <div className='ChartPanel__chartarea--withToolbar'>
                                {optionsShown &&
                                <div className='ChartPanelOptions'>
                                    <div style={{height: 14}}>
                                        <div style={{ right: -6, float: 'right'}}
                                             className='btn-close'
                                             title='Remove Panel'
                                             onClick={() => this.toggleOptions()}/>
                                    </div>
                                    <Options {...{chartId, optionsKey: componentKey}}/>
                                </div>}
                                <Resizable id='chart-resizer' onResize={this.onResize}
                                           className='ChartPanel__chartresizer'>
                                    <div style={{overflow:'auto',width:widthPx,height:heightPx}}>
                                        {knownSize ?
                                            errors.length > 0 ?
                                                <ErrorPanel errors={errors}/> :
                                                <Chart {...Object.assign({}, this.props, {widthPx, heightPx})}/> :
                                            <div/>}
                                    </div>
                                </Resizable>
                                { !optionsShown && deletable &&
                                <img style={{display: 'inline-block', position: 'absolute', top: 29, right: 0, alignSelf: 'baseline', padding: 2, cursor: 'pointer'}}
                                     title='Delete this chart'
                                     src={DELETE}
                                     onClick={() => {ChartsCntlr.dispatchChartRemove(chartId);}}
                                />}
                            </div>
                        </div>
                    </div>
                );
            } else {
                // chart only
                return (
                    <div className='ChartPanel__container'>
                        <div className='ChartPanel__chartarea'>
                            <Resizable id='chart-resizer' onResize={this.onResize}
                                       className='ChartPanel__chartresizer'>
                                <div style={{overflow:'auto',width:widthPx,height:heightPx}}>
                                    {knownSize ?
                                        errors.length > 0 ?
                                            <ErrorPanel errors={errors}/> :
                                            <Chart {...Object.assign({}, this.props, {widthPx, heightPx})}/> :

                                        <div/>}
                                </div>
                            </Resizable>
                            {deletable &&
                            <img style={{display: 'inline-block', position: 'absolute', top: 0, right: 0, alignSelf: 'baseline', padding: 2, cursor: 'pointer'}}
                                 title='Delete this chart'
                                 src={DELETE}
                                 onClick={() => {ChartsCntlr.dispatchChartRemove(chartId);}}
                            />}
                        </div>
                    </div>
                );
            }
        } else {
            // toolbar and options
            return (
                <div className='ChartPanel__chartarea'>
                    <Toolbar {...{chartId, expandable, expandedMode, toggleOptions: this.toggleOptions}}/>
                    <div className='ChartPanel__chartarea--withToolbar'>
                        {optionsShown &&
                        <div className='ChartPanelOptions'>
                            <div style={{height: 14}}>
                                <div style={{ right: -6, float: 'right'}}
                                     className='btn-close'
                                     title='Remove Panel'
                                     onClick={() => this.toggleOptions()}/>
                            </div>
                            <Options {...{chartId, optionsKey: componentKey}}/>
                        </div>
                        }
                    </div>
                </div>
            );
        }
    }
}

ChartPanelView.propTypes = {
    chartId: PropTypes.string.isRequired,
    chartData: PropTypes.object,
    deletable: PropTypes.bool,
    expandable: PropTypes.bool,
    expandedMode: PropTypes.bool,
    showToolbar: PropTypes.bool,
    showChart: PropTypes.bool,
    Chart: PropTypes.func,
    Options: PropTypes.func,
    Toolbar: PropTypes.func,
    eventCallback: PropTypes.object
};

ChartPanelView.defaultProps = {
    showToolbar: true,
    showChart: true
};

function ErrorPanel({errors}) {
    return (
      <div style={{position: 'relative', width: '100%', height: '100%'}}>
          {errors.map((error, i) => {
              const {message='Error', reason=''} = error;
                    return (
                        <div key={i} style={{padding: 20, textAlign: 'center', overflowWrap: 'normal'}}>
                            <h3>{message}</h3>
                            {`${reason}`}
                        </div>
                    );
              })}
      </div>
    );
}

ErrorPanel.propTypes = {
    errors: PropTypes.arrayOf(
        PropTypes.shape({
            message: PropTypes.string,
            reason: PropTypes.oneOfType([PropTypes.object,PropTypes.string]) // reason can be an Error object
        }))
};

export class ChartPanel extends Component {

    constructor(props) {
        super(props);
        this.state = this.getNextState();
        this.test = props;
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    componentDidMount() {
        this.removeListener = flux.addListener(() => this.storeUpdate());
        this.iAmMounted = true;
    }

    componentWillUnmount() {
        this.iAmMounted=false;
        this.removeListener && this.removeListener();
    }

    getNextState() {
        const {chartId} = this.props;
        const chartData =  ChartsCntlr.getChartData(chartId);
        if (chartData) {
            const chartType = get(chartData, 'chartType');
            const {Chart,Options,Toolbar,getChartProperties,updateOnStoreChange} = reduxFlux.getChartType(chartType);
            return {
                chartId, ...getChartProperties(chartId),
                Chart,
                Options,
                Toolbar,
                updateOnStoreChange
            };
        } else {
            return {chartId};
        }
    }

    storeUpdate() {
        if (this.iAmMounted) {
            const {updateOnStoreChange} = this.state;
            if (!updateOnStoreChange || updateOnStoreChange(this.state)) {
                    this.setState(this.getNextState());
            }
        }
    }

    render() {

        return (
            <ChartPanelView {...this.props} {...this.state}/>
        );
    }
}

ChartPanel.propTypes = {
    chartId: PropTypes.string.isRequired,
    expandable: PropTypes.bool,
    expandedMode: PropTypes.bool,
    deletable: PropTypes.bool,
    showToolbar: PropTypes.bool,
    showChart: PropTypes.bool,
    eventCallback: PropTypes.object
};
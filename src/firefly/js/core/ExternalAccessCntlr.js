/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import ExternalAccessUtils from './ExternalAccessUtils.js';

const EXTENSION_ADD= 'ExternalAccessCntlr/extensionAdd';
const EXTENSION_ACTIVATE= 'ExternalAccessCntlr/extensionActivate';
const CHANNEL_ACTIVATE= 'ExternalAccessCntlr/channelActivate';

const EXTERNAL_ACCESS_KEY= 'externalAccess';

const ALL_MPW= 'AllMpw';

const initState= {
    extensionList : [],
    remoteChannel : null
};


const extensionActivateActionCreator= function(rawAction) {
    return (dispatcher) => {

        if (rawAction.payload) {
            var {payload : {extension, resultData}}= rawAction;
            if (extension && resultData) {
                ExternalAccessUtils.doExtensionActivate(extension,resultData);
            }
        }
        dispatcher(rawAction);
    };
};




function reducer(state=initState, action={}) {
    if (!action.payload || !action.type) return state;

    var retState= state;
    switch (action.type) {
        case EXTENSION_ADD  :
            retState= addExtension(state,action);
            break;
        case EXTENSION_ACTIVATE  :
            retState= state;// todo something
            break;
        case CHANNEL_ACTIVATE  :
            retState= updateChannel(state,action);
            break;
    }
    return retState;
}

const addExtension= function(state, action) {
    var {extension}= action.payload;
    var newAry= [...state.extensionList, extension];
    return Object.assign({}, state, {extensionList:newAry});
};


const updateChannel= function(state, action) {
    var {channelId}= action.payload;
    return Object.assign({}, state, {remoteChannel:channelId});
};



//============ EXPORTS ===========
//============ EXPORTS ===========

var ExternalAccessCntlr = {
    reducer, extensionActivateActionCreator, EXTENSION_ADD,
    EXTENSION_ACTIVATE, CHANNEL_ACTIVATE, EXTERNAL_ACCESS_KEY,
    ALL_MPW
    };
export default ExternalAccessCntlr;

//============ EXPORTS ===========
//============ EXPORTS ===========

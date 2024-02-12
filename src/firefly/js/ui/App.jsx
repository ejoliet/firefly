import React from 'react';

import {FireflyLayout} from 'firefly/templates/common/FireflyLayout.jsx';
import {DropDownContainer} from 'firefly/ui/DropDownContainer.jsx';
import {useStoreConnector} from 'firefly/ui/SimpleComponent.jsx';
import {getLayouInfo} from 'firefly/core/LayoutCntlr.js';


export  default function App({children, dropdownPanels, watchInitArgs, selected, ...props}) {

    const {dropDown} = useStoreConnector(getLayouInfo);

    const {visible, view} = dropDown || {};

    let dropDownComponent = null;       // when dropDown is null, it will show children(results)
    if (visible && view) {
        dropDownComponent = (
            <DropDownContainer visible={true} {...{dropdownPanels, selected, watchInitArgs}}>
                {view}
            </DropDownContainer>
        );
    }
    return (
        <FireflyLayout {...{dropDownComponent, ...props}}>
            {children}
        </FireflyLayout>
    );
}



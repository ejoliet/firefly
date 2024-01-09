import React, {useEffect} from 'react';
import {CssBaseline, extendTheme, CssVarsProvider, useColorScheme, GlobalStyles} from '@mui/joy';

import {defaultTheme} from './ThemeSetup.js';
import {getAppOptions} from '../core/AppDataCntlr.js';
import {logger} from '../util/Logger.js';

import '@fontsource/inter/200.css'; // Lighter
import '@fontsource/inter/300.css'; // Light
import '@fontsource/inter/400.css'; // Regular
import '@fontsource/inter/500.css'; // Medium
import '@fontsource/inter/600.css'; // Semi-Bold
import '@fontsource/inter/700.css'; // Bold
import '@fontsource/inter/800.css'; // Bolder

export function FireflyRoot({children}) {

    const customTheme = getAppOptions().theme?.customized?.();
    const theme = extendTheme(customTheme || defaultTheme());

    return (
        <CssVarsProvider defaultMode='system' theme={theme}>
            <CssBaseline/>
            <GlobalStyles styles={{
                    html: {fontSize:'87.5%'}
                }}/>
            <App>{children}</App>
        </CssVarsProvider>
    );
}

function App({children}) { // provide a way to experiment with light and dark theme

    // Firefly is setup to take the device's color mode
    // To set device mode on your mac; AppleMenu -> System Settings -> Appearance

    const { mode, systemMode, setMode } = useColorScheme();

    const colorMode = getAppOptions().theme?.colorMode?.();
    // if colorMode is set; must use this mode
    // To add mode switching; make sure colorMode is not set.
    // Then, add a component(Button) to trigger 'setMode'.
    // setMode store the value in localStorage.  It will use this mode
    // until that value is cleared or kill/restart browser.

    logger.info({mode, systemMode, colorMode});

    useEffect(() => {
        const curMode = mode === 'system' ? systemMode : mode;
        // only setMode when colorMode is different from the current mode
        if (colorMode && colorMode !== curMode) {
            setMode(colorMode);
        }
    }, [colorMode, mode]);
    return ( children );
}


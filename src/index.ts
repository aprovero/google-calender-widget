import path from 'path';
import { app, BrowserWindow, Menu, nativeImage, session, Tray, WebContentsView, ipcMain, shell } from 'electron';
import { windowStateKeeper } from './stateKeeper';
import isDevelopment from 'electron-is-dev';
import { readFileSync, writeFileSync, existsSync } from 'fs';


const iconPath = path.join(
    isDevelopment ? process.cwd() + "/resources" : process.resourcesPath,
    "icon.ico"
);
console.log(`iconPath: ${iconPath}`);

// Register IPC handlers for Cashflow widget preferences & interactions
ipcMain.handle('get-preferences', () => {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, "preferences.json");
        if (existsSync(prefsPath)) {
            return JSON.parse(readFileSync(prefsPath).toString());
        }
    } catch (e) {
        console.log('Error reading preferences:', e);
    }
    return {};
});

ipcMain.handle('save-preferences', (event, newPrefs) => {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, "preferences.json");
        let preferences = {};
        if (existsSync(prefsPath)) {
            preferences = JSON.parse(readFileSync(prefsPath).toString());
        }
        const updated = { ...preferences, ...newPrefs };
        writeFileSync(prefsPath, JSON.stringify(updated, null, 2));
        return true;
    } catch (e) {
        console.log('Error saving preferences:', e);
        return false;
    }
});

ipcMain.on('open-external', (event, url) => {
    if (url) {
        shell.openExternal(url);
    }
});


// Calendar view URLs
const CALENDAR_BASE_URL = 'https://calendar.google.com/calendar/u/0/r';
const CALENDAR_VIEWS: Record<string, string> = {
    AGENDA: `${CALENDAR_BASE_URL}/agenda`,
    DAY: `${CALENDAR_BASE_URL}/day`,
    WEEK: `${CALENDAR_BASE_URL}/week`,
    MONTH: `${CALENDAR_BASE_URL}/month`,
    YEAR: `${CALENDAR_BASE_URL}/year`
};
const DEFAULT_VIEW = 'AGENDA';
let cssInjected = false;
let cssContent = '';

// Function to detect calendar view from URL
const detectViewFromUrl = (url: string): string | null => {
    if (!url || !url.includes('calendar.google.com')) return null;

    if (url.includes('/agenda')) return 'AGENDA';
    if (url.includes('/day')) return 'DAY';
    if (url.includes('/week')) return 'WEEK';
    if (url.includes('/month')) return 'MONTH';
    if (url.includes('/year')) return 'YEAR';

    return null;
};

// Function to save the last selected view
const saveLastView = (view: string): void => {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, "preferences.json");

        let preferences: { lastView?: string } = {};
        if (existsSync(prefsPath)) {
            try {
                const prefsContent = readFileSync(prefsPath).toString();
                preferences = JSON.parse(prefsContent);

                if (preferences.lastView === view) {
                    console.log(`Last view already set to ${view}, skipping save`);
                    return;
                }
            } catch (error) {
                console.log(`Error reading preferences: ${error}`);
            }
        }

        preferences.lastView = view;
        writeFileSync(prefsPath, JSON.stringify(preferences, null, 2));
        console.log(`Saved last view: ${view} to ${prefsPath}`);
    } catch (error) {
        console.log(`Error saving last view: ${error}`);
    }
};

// Function to get the last selected view
const getLastView = (): string => {
    try {
        const userDataPath = app.getPath('userData');
        const prefsPath = path.join(userDataPath, "preferences.json");

        if (existsSync(prefsPath)) {
            const prefsContent = readFileSync(prefsPath).toString();
            const preferences = JSON.parse(prefsContent);
            if (preferences.lastView && CALENDAR_VIEWS[preferences.lastView]) {
                console.log(`Loaded last view: ${preferences.lastView} from ${prefsPath}`);
                return preferences.lastView;
            }
        } else {
            console.log(`Preferences file not found at ${prefsPath}, using default view: ${DEFAULT_VIEW}`);
        }
    } catch (error) {
        console.log(`Error loading last view: ${error}`);
    }

    return DEFAULT_VIEW;
};

// Load CSS content once at startup
const loadCssContent = (): void => {
    const stylesPath = path.join(
        isDevelopment ? process.cwd() + "/resources" : process.resourcesPath,
        "styles.css"
    );
    cssContent = readFileSync(stylesPath).toString();
    console.log(`CSS Content Loaded`);
};

const setHomeCss = (calendarView: WebContentsView): void => {
    if (!cssContent) {
        loadCssContent();
    }

    calendarView.webContents.executeJavaScript(`window.location.href`).then((url: string) => {
        console.log(`Current URL for CSS application: ${url}`);

        let currentView = 'unknown';
        if (url.includes('/agenda')) currentView = 'agenda';
        if (url.includes('/day')) currentView = 'day';
        if (url.includes('/week')) currentView = 'week';
        if (url.includes('/month')) currentView = 'month';
        if (url.includes('/year')) currentView = 'year';

        console.log(`Detected view for CSS: ${currentView}`);

        if (cssInjected) {
            try {
                calendarView.webContents.removeInsertedCSS(cssContent);
                console.log(`Previous CSS removed`);
            } catch (error) {
                console.log(`Error removing CSS: ${error}`);
            }
            cssInjected = false;
        }

        let cssToApply = cssContent;

        if (isDevelopment) {
            try {
                const robustStylesPath = path.join(process.cwd(), "/resources/robust-styles.css");
                const robustCss = readFileSync(robustStylesPath).toString();
                if (robustCss) {
                    cssToApply = robustCss;
                    console.log('Using robust CSS');
                }
            } catch (error) {
                console.log('Robust CSS not available, using original CSS');
            }
        }

        cssToApply += `
        /* View-specific overrides for ${currentView} view */
        body {
            overflow: auto !important;
        }
        
        /* Ensure proper sizing for all views */
        body, html {
            width: 100% !important;
            height: 100% !important;
            box-sizing: border-box !important;
        }
        
        /* Hide unnecessary elements */
        .gb_Cd, .gb_Zd, .gb_xd, .gb_Kd, .gb_Qe, .gb_3c, .gb_J, .gb_cd, .gb_0, .gb_Kd, 
        .gb_Wa, .gb_Mf, .gb_H, .gb_3a, .gb_4a, .gb_Od, .gb_Ic, .gb_Sd, .gb_z, .gb_cd, 
        .gb_Mf, .gb_0, .gb_D, .gb_jb, .gb_Mf, .gb_0, .gb_B, .gb_Za, .gb_0, .gb_P, .gbii, 
        .gb_Q, .gb_R, .gb_Ka, .gb_La, .gb_Na {
            display: none !important;
        }
        `;

        if (currentView === 'month') {
            cssToApply += `
            /* Month view specific overrides */
            table {
                table-layout: fixed !important;
                width: 100% !important;
                border-collapse: collapse !important;
            }
            
            td {
                border: 1px solid rgba(0, 0, 0, 0.12) !important;
                padding: 2px !important;
                vertical-align: top !important;
                height: auto !important;
                min-height: 40px !important;
            }
            
            th {
                text-align: center !important;
                padding: 4px 0 !important;
                font-weight: bold !important;
                font-size: 12px !important;
                width: 14.28% !important;
                max-width: 14.28% !important;
                overflow: hidden !important;
                white-space: nowrap !important;
                text-overflow: ellipsis !important;
                border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
            }
            
            th span.abbr, th span.short {
                display: block !important;
                visibility: visible !important;
                font-size: 12px !important;
                font-weight: bold !important;
                text-align: center !important;
            }
            
            div[role="row"].wuX2hf {
                height: auto !important;
                min-height: 24px !important;
                max-height: 30px !important;
                display: flex !important;
                justify-content: space-between !important;
                width: 100% !important;
                border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
            }
            
            div[role="columnheader"] {
                width: 14.28% !important;
                max-width: 14.28% !important;
                text-align: center !important;
                padding: 4px 0 !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }
            
            div[role="columnheader"] .EeuFAf {
                display: block !important;
                font-size: 12px !important;
                text-align: center !important;
                font-weight: bold !important;
                padding: 0 !important;
                margin: 0 !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            tr:first-child td, tr:first-child th {
                text-align: center !important;
                font-weight: bold !important;
                font-size: 12px !important;
                padding: 4px 0 !important;
                height: 24px !important;
                min-height: 24px !important;
                max-height: 30px !important;
                border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
            }
            
            [data-gcw-event], .NlL62b {
                border-radius: 4px !important;
                padding: 2px 4px !important;
                margin: 1px 0 !important;
                background-color: transparent !important;
                border: 1px solid currentColor !important;
                color: inherit !important;
            }
            
            .g3dbUc, .NlL62b, .Jmftzc, [data-eventid], [data-chip], div[data-eventid], 
            div[data-chip], div[jslog], div[jscontroller="L7wjp"] {
                background-color: transparent !important;
                border: 1px solid rgba(0, 0, 0, 0.3) !important;
                color: inherit !important;
            }
            
            div[role="button"][aria-label="Create"], 
            button.E9bth-BIzmGd[jsname="todz4c"] {
                border-radius: 20px !important;
                padding: 8px 16px !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
                background: transparent !important;
                border: 1px solid rgba(0, 0, 0, 0.12) !important;
                color: inherit !important;
                font-weight: 500 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: background-color 0.2s, box-shadow 0.2s !important;
            }
            
            div[role="button"][aria-label="Create"]:hover,
            button.E9bth-BIzmGd[jsname="todz4c"]:hover {
                background-color: rgba(0, 0, 0, 0.04) !important;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
            }
            
            .E9bth-Q0XOV i, 
            div[role="button"][aria-label="Create"] i {
                margin-right: 4px !important;
                font-size: 18px !important;
            }
            
            .E9bth-nBWOSb, 
            div[role="button"][aria-label="Create"] span {
                font-size: 14px !important;
                font-weight: 500 !important;
            }
            `;
        } else if (currentView === 'week') {
            cssToApply += `
            /* Week view specific overrides */
            div[role="row"].wuX2hf {
                height: auto !important;
                min-height: 24px !important;
                max-height: 30px !important;
                display: flex !important;
                justify-content: space-between !important;
                width: 100% !important;
                border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
            }
            
            div[role="columnheader"] {
                width: 14.28% !important;
                max-width: 14.28% !important;
                text-align: center !important;
                padding: 4px 0 !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }
            
            div[role="columnheader"] .EeuFAf {
                display: block !important;
                font-size: 12px !important;
                text-align: center !important;
                font-weight: bold !important;
                padding: 0 !important;
                margin: 0 !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            [data-gcw-event], .NlL62b {
                border-radius: 4px !important;
                padding: 2px 4px !important;
                margin: 1px 0 !important;
                background-color: transparent !important;
                border: 1px solid currentColor !important;
                color: inherit !important;
            }
            
            div[role="button"][aria-label="Create"],
            button.E9bth-BIzmGd[jsname="todz4c"] {
                border-radius: 20px !important;
                padding: 8px 16px !important;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
                background: transparent !important;
                border: 1px solid rgba(0, 0, 0, 0.12) !important;
                color: inherit !important;
                font-weight: 500 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                transition: background-color 0.2s, box-shadow 0.2s !important;
            }
            
            div[role="button"][aria-label="Create"]:hover,
            button.E9bth-BIzmGd[jsname="todz4c"]:hover {
                background-color: rgba(0, 0, 0, 0.04) !important;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3) !important;
            }
            
            .E9bth-Q0XOV i, 
            div[role="button"][aria-label="Create"] i {
                margin-right: 4px !important;
                font-size: 18px !important;
            }
            
            .E9bth-nBWOSb, 
            div[role="button"][aria-label="Create"] span {
                font-size: 14px !important;
                font-weight: 500 !important;
            }
            `;
        }

        calendarView.webContents.insertCSS(cssToApply).then(() => {
            cssInjected = true;
            console.log(`CSS Applied Successfully for ${currentView} view`);
        }).catch((err: Error) => {
            console.log(`Error applying CSS: ${err}`);
        });
    }).catch((err: Error) => {
        console.log(`Error getting current URL: ${err}`);

        if (cssInjected) {
            try {
                calendarView.webContents.removeInsertedCSS(cssContent);
                console.log(`Previous CSS removed (fallback)`);
            } catch (error) {
                console.log(`Error removing CSS: ${error}`);
            }
            cssInjected = false;
        }

        let cssToApply = cssContent;

        if (isDevelopment) {
            try {
                const robustStylesPath = path.join(process.cwd(), "/resources/robust-styles.css");
                const robustCss = readFileSync(robustStylesPath).toString();
                if (robustCss) {
                    cssToApply = robustCss;
                    console.log('Using robust CSS (fallback)');
                }
            } catch (error) {
                console.log('Robust CSS not available, using original CSS (fallback)');
            }
        }

        calendarView.webContents.insertCSS(cssToApply).then(() => {
            cssInjected = true;
            console.log(`CSS Applied Successfully (fallback)`);
        }).catch((err: Error) => {
            console.log(`Error applying CSS: ${err}`);
        });
    });
};

const injectAttributeScript = (calendarView: WebContentsView): void => {
    calendarView.webContents.executeJavaScript(`
        function addDataAttributes() {
            function querySelectorAllSafe(selector) {
                try {
                    return document.querySelectorAll(selector);
                } catch (e) {
                    console.log('Error querying: ' + selector, e);
                    return [];
                }
            }
            
            function detectCalendarView() {
                const url = window.location.href;
                if (url.includes('/agenda')) return 'agenda';
                if (url.includes('/day')) return 'day';
                if (url.includes('/week')) return 'week';
                if (url.includes('/month')) return 'month';
                if (url.includes('/year')) return 'year';
                return 'unknown';
            }
            
            const currentView = detectCalendarView();
            console.log('GCW: Detected calendar view: ' + currentView);
            document.body.setAttribute('data-gcw-view', currentView);
            
            const unnecessaryElements = document.querySelectorAll('.gb_Cd, .gb_Zd, .gb_xd, .gb_Kd, .gb_Qe, .gb_3c, .gb_J, .gb_cd, .gb_0, .gb_Kd, .gb_Wa, .gb_Mf, .gb_H, .gb_3a, .gb_4a, .gb_Od, .gb_Ic, .gb_Sd, .gb_z, .gb_cd, .gb_Mf, .gb_0, .gb_D, .gb_jb, .gb_Mf, .gb_0, .gb_B, .gb_Za, .gb_0, .gb_P, .gbii, .gb_Q, .gb_R, .gb_Ka, .gb_La, .gb_Na');
            unnecessaryElements.forEach(el => {
                el.style.display = 'none';
            });
            
            if (currentView === 'month') {
                fixMonthView();
            } else if (currentView === 'week') {
                fixWeekView();
            }
            
            makeEventsTransparent();
            
            querySelectorAllSafe('div[role="button"][aria-label="Create"], button.E9bth-BIzmGd[jsname="todz4c"]').forEach(el => {
                el.setAttribute('data-gcw-create-button', 'true');
                el.style.borderRadius = '24px';
                el.style.padding = '8px 16px';
                el.style.fontWeight = '500';
                el.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
                el.style.backgroundColor = 'transparent';
                el.style.border = '1px solid rgba(0, 0, 0, 0.12)';
                el.style.color = 'inherit';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                
                el.addEventListener('mouseenter', () => {
                    el.style.backgroundColor = 'rgba(0, 0, 0, 0.04)';
                    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)';
                });
                
                el.addEventListener('mouseleave', () => {
                    el.style.backgroundColor = 'transparent';
                    el.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
                });
                
                const icon = el.querySelector('.E9bth-Q0XOV i, i');
                if (icon) {
                    icon.style.marginRight = '4px';
                    icon.style.fontSize = '18px';
                }
                
                const text = el.querySelector('.E9bth-nBWOSb, span:not(.E9bth-Q0XOV)');
                if (text) {
                    text.style.fontSize = '14px';
                    text.style.fontWeight = '500';
                }
            });
            
            console.log('GCW: Data attributes added to elements for ' + currentView + ' view');
            
            function makeEventsTransparent() {
                const eventSelectors = [
                    '.g3dbUc', '.NlL62b', '.Jmftzc', '[data-eventid]', '[data-chip]',
                    'div[jslog*="20394"]', 'div[jscontroller="L7wjp"]', '.FAxxKc'
                ];
                
                try {
                    const eventElements = document.querySelectorAll(eventSelectors.join(', '));
                    console.log('GCW: Found ' + eventElements.length + ' event elements to make transparent');
                    eventElements.forEach(el => {
                        el.style.backgroundColor = 'transparent';
                        el.style.border = '1px solid rgba(0, 0, 0, 0.3)';
                        el.style.color = 'inherit';
                        el.style.borderRadius = '4px';
                        el.style.padding = '2px 4px';
                        
                        const childrenWithBg = el.querySelectorAll('[style*="background"]');
                        childrenWithBg.forEach(child => {
                            child.style.backgroundColor = 'transparent';
                        });
                    });
                } catch (e) {
                    console.log('Error making events transparent:', e);
                }
            }
            
            function fixMonthView() {
                console.log('GCW: Fixing month view layout');
                document.querySelectorAll('table').forEach(table => {
                    table.style.tableLayout = 'fixed';
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                });
                
                document.querySelectorAll('td').forEach(cell => {
                    cell.style.border = '1px solid rgba(0, 0, 0, 0.12)';
                    cell.style.padding = '2px';
                    cell.style.verticalAlign = 'top';
                    cell.style.height = 'auto';
                    cell.style.minHeight = '40px';
                });
                
                const eventSelectors = [
                    '.g3dbUc', '.NlL62b', '.Jmftzc', '[data-eventid]', '[data-chip]',
                    'div[jslog*="20394"]', 'div[jscontroller="L7wjp"]'
                ];
                const eventElements = document.querySelectorAll(eventSelectors.join(', '));
                eventElements.forEach(el => {
                    el.style.backgroundColor = 'transparent';
                    el.style.border = '1px solid rgba(0, 0, 0, 0.3)';
                    el.style.color = 'inherit';
                    el.style.borderRadius = '4px';
                    el.style.padding = '2px 4px';
                    
                    const childrenWithBg = el.querySelectorAll('[style*="background"]');
                    childrenWithBg.forEach(child => {
                        child.style.backgroundColor = 'transparent';
                    });
                });
            }
            
            function fixWeekView() {
                console.log('GCW: Applying week view specific fixes');
                const dayNameRows = document.querySelectorAll('div[role="row"].wuX2hf');
                dayNameRows.forEach(row => {
                    row.setAttribute('data-gcw-day-name-row', 'true');
                    row.style.height = 'auto';
                    row.style.minHeight = '24px';
                    row.style.maxHeight = '30px';
                    row.style.borderBottom = '1px solid rgba(0, 0, 0, 0.12)';
                    
                    row.querySelectorAll('[role="columnheader"]').forEach(header => {
                        header.setAttribute('data-gcw-day-header', 'true');
                        header.style.width = '14.28%';
                        header.style.maxWidth = '14.28%';
                        header.style.textAlign = 'center';
                        header.style.padding = '4px 0';
                        header.style.overflow = 'hidden';
                        
                        const fullDayName = header.querySelector('.XuJrye');
                        if (fullDayName) {
                            fullDayName.style.display = 'none';
                        }
                        
                        const shortDayName = header.querySelector('.EeuFAf');
                        if (shortDayName) {
                            shortDayName.style.display = 'block';
                            shortDayName.style.fontSize = '12px';
                            shortDayName.style.textAlign = 'center';
                            shortDayName.style.fontWeight = 'bold';
                            shortDayName.style.padding = '0';
                            shortDayName.style.margin = '0';
                            shortDayName.style.visibility = 'visible';
                            shortDayName.style.opacity = '1';
                        }
                    });
                });
            }
        }
        
        addDataAttributes();
        
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            mutations.forEach(mutation => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldUpdate = true;
                }
            });
            if (shouldUpdate) {
                addDataAttributes();
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        true;
    `).then(() => {
        console.log('Attribute script injected successfully');
    }).catch((err: Error) => {
        console.log('Error injecting attribute script:', err);
    });
};

const generateRobustCSS = (): string | null => {
    if (isDevelopment) {
        try {
            const stylesPath = path.join(process.cwd(), "/resources/styles.css");
            const robustStylesPath = path.join(process.cwd(), "/resources/robust-styles.css");

            if (existsSync(robustStylesPath)) {
                console.log('Robust CSS file already exists, skipping generation');
                return readFileSync(robustStylesPath).toString();
            }

            let css = readFileSync(stylesPath).toString();

            const replacements = [
                { from: 'div[role="gridcell"]', to: 'div[data-gcw-gridcell]' },
                { from: 'div[role="row"]', to: 'div[data-gcw-row]' },
                { from: 'div[role="button"]', to: 'div[data-gcw-button]' },
                { from: 'div[role="presentation"]', to: 'div[data-gcw-presentation]' },
                { from: 'button.nUt0vb', to: 'button[data-gcw-date-circle]' },
                { from: '.NlL62b', to: '[data-gcw-event]' },
                { from: 'div[aria-hidden="true"].uVnp9b', to: 'div[data-gcw-divider]' },
                {
                    from: 'div[role="rowgroup"] > div[aria-hidden="true"]:not(.uVnp9b):not([data-gcw-divider])',
                    to: 'div[role="rowgroup"] > div[aria-hidden="true"]:not([data-gcw-divider])'
                },
                { from: '.r4nke', to: '[data-gcw-date-section]' },
                { from: '.Jmftzc.gVNoLb', to: '[data-gcw-event-time]' },
                { from: '.Jmftzc.EiZ8Dd', to: '[data-gcw-event-title]' },
                { from: '.g3dbUc', to: '[data-gcw-month-event]' },
                { from: 'td.rymPhb', to: '[data-gcw-month-date-cell]' },
                { from: '.JPdR6b', to: '[data-gcw-year-month]' },
                { from: '.d29e1c', to: '[data-gcw-nav-button]' },
                { from: '.rSoRzd', to: '[data-gcw-view-header]' },
                { from: '.yzifAd', to: '[data-gcw-day-name]' },
                { from: '[role="columnheader"]', to: '[data-gcw-day-header]' },
                { from: '.XuJrye', to: '[data-gcw-day-name-full]' },
                { from: '.EeuFAf', to: '[data-gcw-day-name-short]' },
                { from: 'div[role="row"].wuX2hf', to: '[data-gcw-day-name-row]' },
                { from: 'div[role="button"][aria-label="Create"]', to: '[data-gcw-create-button]' },
                { from: 'header', to: '[data-gcw-header]' },
                { from: 'div[role="grid"]', to: '[data-gcw-grid]' }
            ];

            replacements.forEach(({ from, to }) => {
                const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedFrom, 'g');
                css = css.replace(regex, to);
            });

            css += `
/* Common styles for all views */
[data-gcw-create-button] {
    background-color: transparent !important;
    border: 1px solid rgba(0, 0, 0, 0.12) !important;
    color: inherit !important;
    border-radius: 24px !important;
    padding: 8px 16px !important;
    font-weight: 500 !important;
    box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15) !important;
}

[data-gcw-header] {
    padding: 8px !important;
    box-sizing: border-box !important;
}

[data-gcw-grid] {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: auto !important;
}

[data-gcw-event] {
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
}

/* Day name fixes for all views */
[data-gcw-day-header] {
    padding: 2px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
}

[data-gcw-day-name-full] {
    display: none !important;
}

[data-gcw-day-name-short] {
    display: block !important;
    font-size: 12px !important;
    text-align: center !important;
    font-weight: bold !important;
    padding: 4px 0 !important;
    margin: 0 !important;
    visibility: visible !important;
    opacity: 1 !important;
}

[data-gcw-day-name-row] {
    height: auto !important;
}

/* Agenda view specific styles */
body[data-gcw-view="agenda"] [data-gcw-event] {
    margin: 4px 0 !important;
    padding: 4px !important;
}

/* Day/Week view specific styles */
body[data-gcw-view="day"] [data-gcw-event],
body[data-gcw-view="week"] [data-gcw-event] {
    padding: 2px 4px !important;
    font-size: 12px !important;
    background-color: transparent !important;
    border: 1px solid currentColor !important;
}

body[data-gcw-view="day"] [data-gcw-day-name],
body[data-gcw-view="week"] [data-gcw-day-name] {
    font-size: 12px !important;
    padding: 2px 0 !important;
    text-align: center !important;
    overflow: hidden !important;
}

/* Week view specific styles */
body[data-gcw-view="week"] [data-gcw-day-header] {
    width: 14.28% !important;
    max-width: 14.28% !important;
}

/* Month view specific styles */
body[data-gcw-view="month"] [data-gcw-month-date-cell] {
    padding: 2px !important;
    height: auto !important;
    min-height: 40px !important;
}

body[data-gcw-view="month"] [data-gcw-month-event] {
    font-size: 11px !important;
    line-height: 16px !important;
    padding: 0 4px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    background-color: transparent !important;
    border: 1px solid rgba(0, 0, 0, 0.3) !important;
    color: inherit !important;
}

body[data-gcw-view="month"] table {
    table-layout: fixed !important;
    width: 100% !important;
}

/* Year view specific styles */
body[data-gcw-view="year"] [data-gcw-year-month] {
    padding: 4px !important;
    margin: 2px !important;
}
`;

            writeFileSync(robustStylesPath, css);
            console.log('Generated robust CSS file with view-specific styles');

            return css;
        } catch (error) {
            console.log('Error generating robust CSS:', error);
            return null;
        }
    }
    return null;
};

const fixDividerLines = (calendarView: WebContentsView): void => {
    calendarView.webContents.executeJavaScript(`
        function fixDividerLines() {
            function detectCalendarView() {
                const url = window.location.href;
                if (url.includes('/agenda')) return 'agenda';
                if (url.includes('/day')) return 'day';
                if (url.includes('/week')) return 'week';
                if (url.includes('/month')) return 'month';
                if (url.includes('/year')) return 'year';
                return 'unknown';
            }
            
            const currentView = detectCalendarView();
            const dividers = document.querySelectorAll('div[aria-hidden="true"].uVnp9b');
            
            if (dividers.length > 0) {
                console.log('GCW: Found ' + dividers.length + ' divider lines to fix in ' + currentView + ' view');
                dividers.forEach(divider => {
                    divider.style.display = 'block';
                    divider.style.height = '1px';
                    divider.style.backgroundColor = 'rgba(0, 0, 0, 0.12)';
                    divider.style.margin = '0';
                    divider.style.width = '100%';
                    divider.setAttribute('data-gcw-fixed', 'true');
                });
            }
            
            const createButtons = document.querySelectorAll('div[role="button"][aria-label="Create"], button.E9bth-BIzmGd[jsname="todz4c"]');
            if (createButtons.length > 0) {
                console.log('GCW: Found ' + createButtons.length + ' create buttons to fix');
                createButtons.forEach(button => {
                    button.style.borderRadius = '24px';
                    button.style.padding = '8px 16px';
                    button.style.fontWeight = '500';
                    button.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
                    button.style.backgroundColor = 'transparent';
                    button.style.border = '1px solid rgba(0, 0, 0, 0.12)';
                    button.style.color = 'inherit';
                    button.style.display = 'flex';
                    button.style.alignItems = 'center';
                    button.style.justifyContent = 'center';
                    
                    const icon = button.querySelector('.E9bth-Q0XOV i, i');
                    if (icon) {
                        icon.style.marginRight = '4px';
                        icon.style.fontSize = '18px';
                    }
                    
                    const text = button.querySelector('.E9bth-nBWOSb, span:not(.E9bth-Q0XOV)');
                    if (text) {
                        text.style.fontSize = '14px';
                        text.style.fontWeight = '500';
                    }
                });
            }
            
            makeEventsTransparent();
            
            if (currentView === 'month') {
                fixMonthView();
                return true;
            } else if (currentView === 'week') {
                fixWeekView();
                return true;
            } else if (currentView === 'year') {
                fixYearView();
                return true;
            }
            
            return dividers.length > 0;
            
            function makeEventsTransparent() {
                const eventSelectors = [
                    '.g3dbUc', '.NlL62b', '.Jmftzc', '[data-eventid]', '[data-chip]',
                    'div[jslog*="20394"]', 'div[jscontroller="L7wjp"]', '.FAxxKc'
                ];
                
                try {
                    const eventElements = document.querySelectorAll(eventSelectors.join(', '));
                    console.log('GCW: Found ' + eventElements.length + ' event elements to make transparent');
                    eventElements.forEach(el => {
                        el.style.backgroundColor = 'transparent';
                        el.style.border = '1px solid rgba(0, 0, 0, 0.3)';
                        el.style.color = 'inherit';
                        el.style.borderRadius = '4px';
                        el.style.padding = '2px 4px';
                        
                        const childrenWithBg = el.querySelectorAll('[style*="background"]');
                        childrenWithBg.forEach(child => {
                            child.style.backgroundColor = 'transparent';
                        });
                    });
                } catch (e) {
                    console.log('Error making events transparent:', e);
                }
            }
            
            function fixMonthView() {
                console.log('GCW: Fixing month view layout');
                document.querySelectorAll('table').forEach(table => {
                    table.style.tableLayout = 'fixed';
                    table.style.width = '100%';
                    table.style.borderCollapse = 'collapse';
                });
                
                document.querySelectorAll('td').forEach(cell => {
                    cell.style.border = '1px solid rgba(0, 0, 0, 0.12)';
                    cell.style.padding = '2px';
                    cell.style.verticalAlign = 'top';
                    cell.style.height = 'auto';
                    cell.style.minHeight = '40px';
                });
                
                const eventSelectors = [
                    '.g3dbUc', '.NlL62b', '.Jmftzc', '[data-eventid]', '[data-chip]',
                    'div[jslog*="20394"]', 'div[jscontroller="L7wjp"]'
                ];
                const eventElements = document.querySelectorAll(eventSelectors.join(', '));
                eventElements.forEach(el => {
                    el.style.backgroundColor = 'transparent';
                    el.style.border = '1px solid rgba(0, 0, 0, 0.3)';
                    el.style.color = 'inherit';
                    el.style.borderRadius = '4px';
                    el.style.padding = '2px 4px';
                    
                    const childrenWithBg = el.querySelectorAll('[style*="background"]');
                    childrenWithBg.forEach(child => {
                        child.style.backgroundColor = 'transparent';
                    });
                });
            }
            
            function fixWeekView() {
                console.log('GCW: Fixing week view layout');
                const dayNameRows = document.querySelectorAll('div[role="row"].wuX2hf');
                dayNameRows.forEach(row => {
                    row.setAttribute('data-gcw-day-name-row', 'true');
                    row.style.height = 'auto';
                    row.style.minHeight = '24px';
                    row.style.maxHeight = '30px';
                    row.style.borderBottom = '1px solid rgba(0, 0, 0, 0.12)';
                    
                    row.querySelectorAll('[role="columnheader"]').forEach(header => {
                        header.setAttribute('data-gcw-day-header', 'true');
                        header.style.width = '14.28%';
                        header.style.maxWidth = '14.28%';
                        header.style.textAlign = 'center';
                        header.style.padding = '4px 0';
                        header.style.overflow = 'hidden';
                        
                        const fullDayName = header.querySelector('.XuJrye');
                        if (fullDayName) {
                            fullDayName.style.display = 'none';
                        }
                        
                        const shortDayName = header.querySelector('.EeuFAf');
                        if (shortDayName) {
                            shortDayName.style.display = 'block';
                            shortDayName.style.fontSize = '12px';
                            shortDayName.style.textAlign = 'center';
                            shortDayName.style.fontWeight = 'bold';
                            shortDayName.style.padding = '0';
                            shortDayName.style.margin = '0';
                            shortDayName.style.visibility = 'visible';
                            shortDayName.style.opacity = '1';
                        }
                    });
                });
            }
            
            function fixYearView() {
                console.log('GCW: Fixing year view layout');
                const monthContainers = document.querySelectorAll('[data-gcw-year-month]');
                if (monthContainers.length > 0) {
                    monthContainers.forEach(container => {
                        (container as HTMLElement).style.border = '1px solid rgba(0, 0, 0, 0.12)';
                        (container as HTMLElement).style.borderRadius = '4px';
                        (container as HTMLElement).style.margin = '4px';
                        (container as HTMLElement).style.padding = '4px';
                    });
                    return true;
                }
                return false;
            }
        }
        
        const result = fixDividerLines();
        setInterval(fixDividerLines, 2000);
        result;
    `).then((result) => {
        if (result) {
            console.log('View-specific fixes applied successfully');
        } else {
            console.log('No view-specific fixes needed');
        }
    }).catch((err: Error) => {
        console.log('Error applying view-specific fixes:', err);
    });
};

const createWindow = (): void => {
    loadCssContent();

    if (isDevelopment) {
        generateRobustCSS();
    }

    const mainWindow = new BrowserWindow({
        height: 600,
        width: 400,
        maximizable: true,
        minimizable: true,
        icon: iconPath,
        skipTaskbar: !isDevelopment,
        alwaysOnTop: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    // Create split views
    const calendarView = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.contentView.addChildView(calendarView);

    const cashflowView = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });
    mainWindow.contentView.addChildView(cashflowView);

    const lastView = getLastView();
    let currentView = lastView;

    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, "preferences.json");
    let splitRatio = 2 / 3; // Default: Agenda occupies 2/3, Cashflow occupies 1/3
    if (existsSync(prefsPath)) {
        try {
            const prefs = JSON.parse(readFileSync(prefsPath).toString());
            if (prefs.splitRatio !== undefined) {
                splitRatio = prefs.splitRatio;
            }
        } catch (e) {
            console.log('Error reading splitRatio:', e);
        }
    }

    const saveSplitRatio = (ratio: number) => {
        try {
            let preferences: any = {};
            if (existsSync(prefsPath)) {
                preferences = JSON.parse(readFileSync(prefsPath).toString());
            }
            preferences.splitRatio = ratio;
            writeFileSync(prefsPath, JSON.stringify(preferences, null, 2));
        } catch (e) {
            console.log('Error saving splitRatio:', e);
        }
    };

    const resizeViews = () => {
        const [width, height] = mainWindow.getContentSize();
        if (currentView === 'AGENDA') {
            const splitHeight = Math.floor(height * splitRatio);
            calendarView.setBounds({ x: 0, y: 0, width, height: splitHeight });
            cashflowView.setBounds({ x: 0, y: splitHeight, width, height: height - splitHeight });
            cashflowView.setVisible(true);
        } else {
            calendarView.setBounds({ x: 0, y: 0, width, height });
            cashflowView.setVisible(false);
        }
    };

    ipcMain.on('adjust-split', (event, deltaY) => {
        const [width, height] = mainWindow.getContentSize();
        const currentSplitHeight = Math.floor(height * splitRatio);
        let newSplitHeight = currentSplitHeight + deltaY;

        const minHeight = 100;
        if (newSplitHeight < minHeight) newSplitHeight = minHeight;
        if (newSplitHeight > height - minHeight) newSplitHeight = height - minHeight;

        splitRatio = newSplitHeight / height;
        resizeViews();
        saveSplitRatio(splitRatio);
    });

    mainWindow.on('closed', () => {
        ipcMain.removeAllListeners('adjust-split');
    });

    mainWindow.on('resize', resizeViews);

    calendarView.webContents.loadURL(CALENDAR_VIEWS[lastView]);

    const cashflowHtmlPath = path.join(
        isDevelopment ? process.cwd() + "/resources" : process.resourcesPath,
        "cashflow_widget.html"
    );
    cashflowView.webContents.loadFile(cashflowHtmlPath);

    calendarView.webContents.setWindowOpenHandler(({ url }) => {
        calendarView.webContents.loadURL(url);
        return { action: 'deny' };
    });

    const updateViewAndResize = (url: string) => {
        const view = detectViewFromUrl(url);
        if (view) {
            saveLastView(view);
            if (view !== currentView) {
                currentView = view;
                resizeViews();
            }
        }
    };

    calendarView.webContents.on("will-navigate", (e, url) => {
        console.log(`will-navigate to: ${url}`);
        updateViewAndResize(url);
    });

    calendarView.webContents.on("did-start-loading", () => {
        console.log(`Page started loading`);
    });

    calendarView.webContents.on("did-finish-load", () => {
        const currentURL = calendarView.webContents.getURL();
        console.log(`Page finished loading: ${currentURL}`);

        if (currentURL.includes('calendar.google.com')) {
            updateViewAndResize(currentURL);

            injectAttributeScript(calendarView);

            setTimeout(() => {
                setHomeCss(calendarView);

                setTimeout(() => {
                    fixDividerLines(calendarView);
                }, 1000);
            }, 500);
        }
    });

    calendarView.webContents.on("did-redirect-navigation", (e, url) => {
        console.log(`Redirected to: ${url}`);
        updateViewAndResize(url);
    });

    setHomeCss(calendarView);

    windowStateKeeper('main')
        .then((mwk) => {
            if (mwk) {
                const { x, y, width, height } = mwk;
                if (x !== undefined && y !== undefined && width && height) {
                    mainWindow.setBounds({ x, y, width, height });
                }
                mwk.track(mainWindow);
            }
            // Trigger resize after loading window bounds
            resizeViews();
        })
        .catch((e) => {
            console.log(`Error in windowStateKeeper:`, e);
            resizeViews();
        });

    if (isDevelopment) {
        calendarView.webContents.openDevTools({ mode: "undocked" });
    } else {
        mainWindow.setMenu(null);
        app.setLoginItemSettings({
            openAtLogin: true,
        });
    }

    const isSingleInstance = app.requestSingleInstanceLock();

    if (!isSingleInstance) {
        app.quit();
        mainWindow.focus();
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                mainWindow.focus();
            }
        });
    }

    createTray(mainWindow, calendarView, (viewName) => {
        currentView = viewName;
        resizeViews();
    });
};

const createTray = (mainWindow: BrowserWindow, calendarView: WebContentsView, onSetView: (view: string) => void): void => {
    const trayIcon = nativeImage.createFromPath(iconPath);
    const tray = new Tray(trayIcon);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Calendar Views', submenu: [
                {
                    label: 'Agenda', click: () => {
                        calendarView.webContents.loadURL(CALENDAR_VIEWS.AGENDA);
                        saveLastView('AGENDA');
                        onSetView('AGENDA');
                    }
                },
                {
                    label: 'Day', click: () => {
                        calendarView.webContents.loadURL(CALENDAR_VIEWS.DAY);
                        saveLastView('DAY');
                        onSetView('DAY');
                    }
                },
                {
                    label: 'Year', click: () => {
                        calendarView.webContents.loadURL(CALENDAR_VIEWS.YEAR);
                        saveLastView('YEAR');
                        onSetView('YEAR');
                    }
                }
            ]
        },
        { type: 'separator' },
        {
            label: 'Reload', click: () => {
                calendarView.webContents.reload();
            }
        },
        {
            label: 'Logout', click: () => {
                session.defaultSession.clearStorageData();
                calendarView.webContents.loadURL(CALENDAR_VIEWS.AGENDA);
                onSetView('AGENDA');
            }
        },
        {
            label: 'Quit', click: () => {
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
    tray.setToolTip('Google Calendar Widget');
    tray.setTitle("GCW");

    tray.on('click', () => {
        mainWindow.show();
    });

    console.log(`Tray icon added`);
};

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

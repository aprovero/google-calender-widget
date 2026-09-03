import settings from 'electron-settings';
import { BrowserWindow } from 'electron';

export interface WindowState {
    x?: number;
    y?: number;
    width: number;
    height: number;
    maxWidth?: number;
    isMaximized?: boolean;
}

export const windowStateKeeper = async (windowName: string) => {
    let window: BrowserWindow | undefined;
    let windowState: WindowState = {
        x: undefined,
        y: undefined,
        height: 480,
        width: 320,
        maxWidth: 320,
    };

    const setBounds = async () => {
        // Restore from appConfig
        if (await settings.has(`windowState.${windowName}`)) {
            windowState = await settings.get(`windowState.${windowName}`) as unknown as WindowState;
            console.log(`setBounds`, windowState);
        }
    };

    const saveState = async () => {
        if (!window) return;
        // bug: lots of save state events are called. they should be debounced
        if (!windowState.isMaximized) {
            windowState = { ...windowState, ...window.getBounds() };
        }
        windowState.isMaximized = window.isMaximized();
        console.log(`windowState`, windowState);
        await settings.set(`windowState.${windowName}`, windowState as any);
    };

    const track = async (win: BrowserWindow) => {
        window = win;
        (['resize', 'move', 'close'] as const).forEach((event) => {
            win.on(event as any, saveState);
        });
    };

    await setBounds();

    return {
        x: windowState.x,
        y: windowState.y,
        width: windowState.width,
        height: windowState.height,
        isMaximized: windowState.isMaximized,
        track,
    };
};

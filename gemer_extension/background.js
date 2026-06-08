let nativePort = null;
let activeContentPort = null;

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "gemer-bridge") {
        activeContentPort = port;
        
        try {
            // 1. 前端页面连接时，自动唤醒并对接本地 Python (com.gemer.bridge)
            nativePort = chrome.runtime.connectNative("com.gemer.bridge");
            
            // 监听 Python 返回的物理执行结果并安全回传给网页前端
            nativePort.onMessage.addListener((msg) => {
                if (activeContentPort) {
                    activeContentPort.postMessage({ type: "FROM_HOST", data: msg });
                }
            });
            
            nativePort.onDisconnect.addListener(() => {
                if (activeContentPort) {
                    activeContentPort.postMessage({ type: "STATUS", status: "disconnected" });
                }
                nativePort = null;
            });
            
            activeContentPort.postMessage({ type: "STATUS", status: "connecting" });
        } catch (e) {
            console.error("唤醒本地 Gemer 服务失败：", e);
        }

        // 2. 监听来自网页前端的控制指令，安全下发至本地 Python
        port.onMessage.addListener((msg) => {
            if (msg.action === "execute" && nativePort) {
                nativePort.postMessage({ action: "execute", cmd: msg.cmd });
            }
        });

        // 3. 当用户手动收起面板，或者刷新/关闭当前网页标签页导致断开时
        port.onDisconnect.addListener(() => {
            activeContentPort = null;
            // 主动切断本地连接，Chrome 会在此瞬间自动将后台 Python 进程安全杀掉
            if (nativePort) {
                nativePort.disconnect();
                nativePort = null;
            }
        });
    }
});
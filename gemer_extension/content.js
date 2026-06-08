const PROCESSED_COMMANDS = new Set();
let bgPort = null;
let isLocalConnected = false;

// 初始化页面微件
function initWidget() {
    if (document.getElementById("gemer-bridge-widget")) return;

    const widget = document.createElement("div");
    widget.id = "gemer-bridge-widget";
    widget.innerHTML = `
        <div class="gemer-panel" id="gemer-panel">
            <div class="gemer-panel-header">
                <span>✦ Gemer 控制面板</span>
                <span class="gemer-panel-close" id="gemer-close-btn">×</span>
            </div>
            <div class="gemer-panel-body">
                <div class="gemer-connection-status" id="gemer-conn-status">
                    🔴 本地通道未激活 (点开面板后自动唤醒)
                </div>
                <button class="gemer-action-btn btn-primary" id="gemer-inject-prompt">
                    📝 注入系统设定并自动建立通道
                </button>
                <div id="gemer-pending-command-area">
                     <!-- 动态弹出的批准卡片将被插在此处 -->
                </div>
            </div>
        </div>
        <button class="gemer-trigger-btn" id="gemer-trigger-btn">
            ✦ Gemer
        </button>
    `;
    document.body.appendChild(widget);

    // 事件绑定：点击触发按钮
    document.getElementById("gemer-trigger-btn").addEventListener("click", () => {
        const panel = document.getElementById("gemer-panel");
        if (panel.style.display === "block") {
            panel.style.display = "none";
            // 【核心逻辑】：关闭面板时，自动断开连接，通知后台安全关闭 Python
            if (bgPort) {
                bgPort.disconnect();
                bgPort = null;
                updateStatusText("disconnected");
            }
        } else {
            panel.style.display = "block";
            // 【核心逻辑】：展开面板时，自动唤醒并长连接至后台 Python
            connectToLocalBridge();
        }
    });

    document.getElementById("gemer-close-btn").addEventListener("click", () => {
        document.getElementById("gemer-panel").style.display = "none";
        if (bgPort) {
            bgPort.disconnect();
            bgPort = null;
            updateStatusText("disconnected");
        }
    });

    // 注入并自动提交
    document.getElementById("gemer-inject-prompt").addEventListener("click", () => {
        injectPrompt(GEMER_SYSTEM_PROMPT);
        setTimeout(triggerSend, 500); 
    });
    
    // 周期性扫描页面中的 AI 指令
    setInterval(scanPageForCommands, 1500);
}

// 建立长连接生命周期：通知 background.js 唤醒本地守护
function connectToLocalBridge() {
    if (bgPort) return;
    
    bgPort = chrome.runtime.connect({ name: "gemer-bridge" });
    
    bgPort.onMessage.addListener((msg) => {
        if (msg.type === "STATUS") {
            updateStatusText(msg.status);
        } else if (msg.type === "FROM_HOST") {
            handleHostResponse(msg.data);
        }
    });
}

function updateStatusText(status) {
    const statusEl = document.getElementById("gemer-conn-status");
    if (!statusEl) return;
    if (status === "connecting" || status === "running") {
        statusEl.className = "gemer-connection-status status-active";
        statusEl.innerText = "🟢 本地物理通道已对接 (后台守护中)";
        isLocalConnected = true;
    } else {
        statusEl.className = "gemer-connection-status status-inactive";
        statusEl.innerText = "🔴 本地物理通道未激活 (点开面板后自动唤醒)";
        isLocalConnected = false;
    }
}

// 寻找适配当前网页（包括 ChatGPT, Gemini, AI Studio）的 AI 输入框
function findChatInput() {
    return document.querySelector(
        'textarea[aria-label="Type something"], ' + 
        'textarea[placeholder*="type a prompt"], ' + 
        '#prompt-textarea, ' + 
        'div[contenteditable="true"], ' + 
        'textarea[placeholder*="Ask"], textarea[placeholder*="输入"], textarea[placeholder*="Prompt"], ' + 
        'textarea[aria-label*="prompt"], textarea[aria-label*="Ask"], textarea.ITIRGe'
    ) || document.querySelector('textarea');
}

// 高保真文本注入引擎
function injectPrompt(text) {
    const inputEl = findChatInput();
    if (!inputEl) {
        alert("未找到页面输入框，请确保 AI 对话网页已加载完成。");
        return;
    }
    inputEl.focus();

    try {
        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            inputEl.select();
            document.execCommand('insertText', false, text);
        } else {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(inputEl);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('insertText', false, text);
        }
        const eventOptions = { bubbles: true, cancelable: true };
        inputEl.dispatchEvent(new Event('input', eventOptions));
        inputEl.dispatchEvent(new Event('change', eventOptions));
    } catch (e) {
        if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
            inputEl.value = text;
        } else {
            inputEl.innerText = text;
        }
        const eventOptions = { bubbles: true, cancelable: true };
        inputEl.dispatchEvent(new Event('input', eventOptions));
        inputEl.dispatchEvent(new Event('change', eventOptions));
    }
}

// 自动发送指令
function triggerSend() {
    const sendBtn = document.querySelector(
        "button.run-button, button[aria-label*='Run'], button[aria-label*='Send'], button[aria-label*='发送'], button[aria-label*='Submit'], button.send-button, [data-testid*='send-button'], button[data-testid*='send']"
    );
    if (sendBtn && !sendBtn.disabled && !sendBtn.getAttribute('disabled')) {
        sendBtn.click();
        return;
    }
    const buttons = Array.from(document.querySelectorAll('button'));
    const targetBtn = buttons.find(b => {
        const txt = b.innerText.trim().toLowerCase();
        return txt === 'run' || txt === '发送' || txt === 'send';
    });
    if (targetBtn && !targetBtn.disabled && !targetBtn.getAttribute('disabled')) {
        targetBtn.click();
        return;
    }
    const inputEl = findChatInput();
    if (inputEl) {
        const eventInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true, metaKey: true, bubbles: true, cancelable: true };
        inputEl.dispatchEvent(new KeyboardEvent('keydown', eventInit));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', eventInit));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    }
}

// 精准全文检索最新指令
function scanPageForCommands() {
    const bodyText = document.body.innerText;
    const regex = /\[CMD_START\]((?:(?!\[CMD_START\])[\s\S])*?)\[CMD_END\]/g;
    let match;
    let lastCmd = null;

    while ((match = regex.exec(bodyText)) !== null) {
        const rawCmd = match[1].trim();
        if (isPlaceholder(rawCmd)) continue; 
        lastCmd = rawCmd; 
    }

    if (lastCmd && !PROCESSED_COMMANDS.has(lastCmd)) {
        PROCESSED_COMMANDS.add(lastCmd);
        showCommandCard(lastCmd);
    }
}

function isPlaceholder(cmd) {
    const norm = cmd.trim().toLowerCase();
    const list = [
        "具体的命令", "具体命令", "cmd", "command", "your_command", 
        "command_here", "具体的cmd命令", "系统命令", "具体的windows命令", 
        "wmic path win32_videocontroller get name", "真实的 windows 真实命令"
    ];
    return list.includes(norm) || !norm;
}

// 页面内优雅呈现指令批准对话框
function showCommandCard(cmd) {
    document.getElementById("gemer-panel").style.display = "block";
    const area = document.getElementById("gemer-pending-command-area");

    const card = document.createElement("div");
    card.className = "gemer-confirm-card";
    card.innerHTML = `
        <div class="gemer-confirm-title">⚠ 物理接管指令待批准:</div>
        <div class="gemer-command-box">${cmd}</div>
        <div class="gemer-btn-group">
            <button class="gemer-sub-btn btn-approve" id="approve-btn">批准执行</button>
            <button class="gemer-sub-btn btn-reject" id="reject-btn">拒绝</button>
        </div>
    `;
    area.innerHTML = ""; 
    area.appendChild(card);

    card.querySelector("#approve-btn").addEventListener("click", async () => {
        area.innerHTML = "<div style='font-size:12px; color:#86868b;'>正在执行系统指令，请稍候...</div>";
        await runCommandAndFeedBack(cmd);
    });

    card.querySelector("#reject-btn").addEventListener("click", () => {
        area.innerHTML = "";
        injectPrompt("【用户提示】: 我拒绝了执行上述系统指令。请给出其他的替代方案。");
    });
}

// 向 background 发送消息，不占用任何本地网络端口
async function runCommandAndFeedBack(cmd) {
    if (!isLocalConnected || !bgPort) {
        alert("无法执行！物理通道未就绪。");
        return;
    }
    bgPort.postMessage({ action: "execute", cmd: cmd });
}

function handleHostResponse(data) {
    const area = document.getElementById("gemer-pending-command-area");
    if (data.status === "success") {
        const feedback = `【系统物理控制回执】:
刚才你向客户端申请的系统指令已在后台物理层被成功执行。以下是后台返回的最新执行回执数据：

${data.output}

【核心任务要求】:
请仔细分析上述这些物理环境产生的真实数据，在回复中：
1. 为我进行阶段性的结论总结，汇报当前情况。
2. 【强制规则】基于当前复杂的电脑排查上下文，明确指出接下来的【下一步运行建议】，指导我继续推进整套方案流程。
3. 凡是下一步需要执行的 cmd 电脑操控指令，必须且唯一严格包裹在 [CMD_START] 具体的 Windows 真实命令 [CMD_END] 之间，每次仅执行一步。`;

        injectPrompt(feedback);
        area.innerHTML = "<div style='font-size:12px; color:#34c759;'>执行完毕，执行回执已送回网页。</div>";
        setTimeout(triggerSend, 800);
    } else {
        area.innerHTML = `<div style='font-size:12px; color:#ff3b30;'>执行错误: ${data.error || "未知错误"}</div>`;
    }
}

// 系统预设指令（同前）
const GEMER_SYSTEM_PROMPT = `[重要角色提示：你现在是 Gemer，一个全能的智能对话与本地物理接管助手。
1. 你不仅是电脑助手，更是一个全能的 AI，能够流畅、深入地回答用户的科学人文知识、软件架构探讨、复杂代码编写与 debug 问答。
2. 当且仅当用户的提问或当前任务涉及【读取电脑硬件、修改系统配置、管理本地文件、运行本地脚本或排查诊断电脑故障】等本地系统物理操作时，你才需要启用底层接管指令。
3. 启用系统控制指令时，必须且唯一将真实的 Windows cmd 批处理命令包裹在 [CMD_START] 真实的 Windows 真实命令 [CMD_END] 之间（例如: [CMD_START] wmic path win32_VideoController get name [CMD_END]）。一次仅执行一步命令，且必须强制提出“下一步的推进建议”，辅助用户推进流程。
4. 绝对不要直接输出包含 '[CMD_START] 具体的命令 [CMD_END]' 这样未替换的示例占位符。回答正常的技术探讨或普通问答时，正常回答即可，不需要使用该包裹标记。
5. 回复时广泛使用 Markdown 进行加粗排版。]

现在，如果您已完全理解此系统设定与指令格式，请简单回复以下确认语，不要包含任何其他内容：
【Gemer 物理通道建立完毕，请发送您的问题或控制指令。】`;

window.addEventListener("load", () => {
    setTimeout(initWidget, 1000);
});
// --- 0. 引入依赖 ---
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');

// --- 1. 初始化和配置 ---
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// --- 2. 全局状态管理 (内存存储) ---
const ipCooldowns = new Map();

// Meta倒计时状态
let metaTimer = {
    timerId: null,
    endTime: null,
    status: 'idle', // 'idle', 'running', 'finished'
};

const getIp = (req) => req.ip;

// 辅助函数：重置Meta倒计时状态
function resetMetaState() {
    clearTimeout(metaTimer.timerId);
    metaTimer = { timerId: null, endTime: null, status: 'idle' };
    console.log('Meta 倒计时状态已重置。');
}

// --- 3. API 接口实现 ---

/**
 * 接口 1: 验证密钥
 * POST /check-key
 */
app.post('/check-key', (req, res) => {
    const { nodeId, key } = req.body;
    const ip = getIp(req);

    // 冷却检查逻辑
    if (ipCooldowns.has(ip)) {
        const endTime = ipCooldowns.get(ip);
        if (Date.now() < endTime) {
            const remaining = Math.ceil((endTime - Date.now()) / 1000);
            return res.status(429).json({ success: false, message: `请求过于频繁，请稍后再试。`, cooldown: remaining });
        } else {
            ipCooldowns.delete(ip);
        }
    }

    const correctKey = process.env[`${nodeId}_pass`];
    if (!correctKey || !nodeId || typeof key === 'undefined') {
        return res.status(400).json({ success: false, message: '请求无效或缺少参数。' });
    }

    // 密钥不正确
    if (key !== correctKey) {
        const coolTime = parseInt(process.env.cool_time, 10);
        ipCooldowns.set(ip, Date.now() + coolTime * 1000);
        return res.status(401).json({ success: false, message: '密钥错误，已触发冷却。', cooldown: coolTime });
    }

    // --- 密钥正确后的逻辑分支 ---
    
    switch (nodeId) {
        case 'false_meta':
            // 只有在空闲状态时才能启动倒计时
            if (metaTimer.status !== 'idle') {
                return res.status(400).json({ success: false, message: 'Meta倒计时已经启动或已结束。' });
            }
            // 启动倒计时
            const metaDuration = parseInt(process.env.meta_time, 10);
            metaTimer.status = 'running';
            metaTimer.endTime = Date.now() + metaDuration * 1000;
            metaTimer.timerId = setTimeout(() => {
                console.log('Meta 倒计时结束!');
                metaTimer.status = 'finished';
            }, metaDuration * 1000);
            return res.json({ success: true, message: '假Meta正确！最终倒计时已启动。', metaStarted: true });

        case 'true_meta':
            // 只有在倒计时运行时才能提交真Meta
            if (metaTimer.status !== 'running') {
                return res.status(400).json({ success: false, message: '最终阶段尚未激活，无法提交真Meta。' });
            }
            // 获胜，并停止/重置倒计时
            const remaining = metaTimer.endTime - Date.now();
            const remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
            
            // 标记游戏胜利，然后重置状态以便下一轮
            const victoryMessage = `恭喜！你已成功解开最终Meta！`;
            resetMetaState(); 
            // 如果需要保持结束状态直到手动重置，可以注释掉上面一行，并使用下面两行
            // metaTimer.status = 'finished';
            // clearTimeout(metaTimer.timerId);
            return res.json({ success: true, message: victoryMessage, remainingSeconds: remainingSeconds });

        default:
            // 处理 node1-5, meta_front 等所有其他普通节点
            return res.json({ success: true, message: '密钥正确!' });
    }
});

// ... 其他接口 (cooldown-status, meta-status) 保持不变 ...
app.get('/cooldown-status', (req, res) => {
    const ip = getIp(req);
    let remaining = 0;
    if (ipCooldowns.has(ip) && (remaining = Math.ceil((ipCooldowns.get(ip) - Date.now())/1000)) > 0) {
        // do nothing
    } else {
        remaining = 0;
        ipCooldowns.delete(ip);
    }
    res.json({ cooldownRemaining: remaining });
});

app.get('/meta-status', (req, res) => {
    let remainingSeconds = 0;
    if (metaTimer.status === 'running' && metaTimer.endTime) {
        const remaining = metaTimer.endTime - Date.now();
        remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
        if (remainingSeconds === 0) {
            metaTimer.status = 'finished';
        }
    }
    res.json({ status: metaTimer.status, remainingSeconds: remainingSeconds });
});

/**
 * 接口 4: 停止 Meta 倒计时
 */
app.post('/stop-meta', (req, res) => {
    if (metaTimer.status !== 'running') {
        return res.status(400).json({ success: false, message: '当前没有正在运行的 Meta 倒计时。' });
    }
    const remaining = metaTimer.endTime - Date.now();
    const remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    resetMetaState();
    res.json({ success: true, message: 'Meta 倒计时已停止。', remainingSeconds: remainingSeconds });
});

/**
 * 接口 5: 重置 Meta 状态 (管理接口)
 */
app.post('/reset-meta', (req, res) => {
    resetMetaState();
    res.json({ success: true, message: 'Meta 倒计时状态已重置为 idle。' });
});


// --- 5. 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
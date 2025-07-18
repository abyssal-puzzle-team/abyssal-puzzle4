// --- 0. 引入依赖 ---
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const fs = require('fs').promises; // 使用 fs.promises 进行异步文件操作

// --- 1. 初始化和配置 ---
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.set('trust proxy', true);

// 定义文件路径
const ACCOUNT_FILE_PATH = path.join(__dirname, 'account.json');
const META_RANDOM_FILE_PATH = path.join(__dirname, 'meta_random.json');


// --- 2. 全局状态管理 ---

// 原有的基于IP的冷却
const ipCooldowns = new Map();

// 新增的基于用户名的冷却 (内存存储，避免频繁读写文件)
const simpleCooldowns = new Map();
const fourByFourCooldowns = new Map();
const goalkeeperCooldowns = new Map();


// Meta倒计时状态
let metaTimer = {
    timerId: null,
    endTime: null,
    status: 'idle', // 'idle', 'running', 'finished'
};

const getIp = (req) => req.ip;

// --- 辅助函数 ---

// 辅助函数：重置Meta倒计时状态 (原有函数)
function resetMetaState() {
    clearTimeout(metaTimer.timerId);
    metaTimer = { timerId: null, endTime: null, status: 'idle' };
    console.log('Meta 倒计时状态已重置。');
}

// 新增辅助函数：读取账户文件
async function readAccounts() {
    try {
        await fs.access(ACCOUNT_FILE_PATH);
        const data = await fs.readFile(ACCOUNT_FILE_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // 如果文件不存在，返回一个空对象，表示还没有任何账户
        if (error.code === 'ENOENT') {
            return {};
        }
        // 对于其他错误（如JSON格式错误），则抛出
        throw error;
    }
}

// 新增辅助函数：写入账户文件
async function writeAccounts(data) {
    // 使用 null, 2 参数格式化JSON，使其更易读
    await fs.writeFile(ACCOUNT_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}


// --- 3. API 接口实现 ---

// =================================================================
// ============== 新增功能：账户管理 (Account Management) ==============
// =================================================================

/**
 * 接口 1: 添加账号
 * POST /add_acc
 * body: { "username": "user1", "password": "123" }
 */
app.post('/add_acc', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空。' });
    }

    try {
        const accounts = await readAccounts();
        if (accounts[username]) {
            return res.status(409).json({ success: false, message: '用户名已存在。' });
        }

        // 创建新用户并设置默认值
        accounts[username] = {
            password: password,
            cool_down: "0",
            progress: "1",
            meta_xy: "[0,0]",
            meta_progress: "",
            meta_key_number: "0",
            meta_power_number: "0",
            meta_card: false
        };

        await writeAccounts(accounts);
        res.status(201).json({ success: true, message: '账号添加成功！' });
    } catch (error) {
        console.error('添加账号时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口 2: 检查账号密码
 * POST /acc_check_password
 * body: { "username": "user1", "password": "123" }
 */
app.post('/acc_check_password', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];

        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        if (user.password === password) {
            res.json({ success: true, message: '密码正确。', user_data: user });
        } else {
            res.status(401).json({ success: false, message: '密码错误。' });
        }
    } catch (error) {
        console.error('检查密码时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口 3: 获取所有账号信息
 * GET /acc_get
 */
app.get('/acc_get', async (req, res) => {
    try {
        const accounts = await readAccounts();
        res.json({ success: true, accounts: accounts });
    } catch (error) {
        console.error('获取账号列表时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口 4: 删除指定账号
 * DELETE /acc_delete
 * body: { "username": "user1" }
 */
app.delete('/acc_delete', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: '需要提供要删除的用户名。' });
    }

    try {
        const accounts = await readAccounts();
        if (!accounts[username]) {
            return res.status(404).json({ success: false, message: '要删除的账号不存在。' });
        }

        delete accounts[username];
        await writeAccounts(accounts);
        res.json({ success: true, message: `账号 ${username} 已被删除。` });
    } catch (error) {
        console.error('删除账号时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});


// =================================================================
// ==================== 新增接口：通用信息修改 =======================
// =================================================================
/**
 * 接口 5: 更改指定用户的指定信息
 * POST /set_user_data
 * body: { "username": "user1", "option": "progress", "value": "2" }
 */
app.post('/set_user_data', async (req, res) => {
    const { username, option, value } = req.body;

    // 1. 基本验证
    if (!username || !option || typeof value === 'undefined') {
        return res.status(400).json({ success: false, message: '请求参数不完整 (需要 username, option, value)。' });
    }

    // 2. 安全性：定义允许修改的字段白名单
    const editableFields = [
        'password',
        'cool_down',
        'progress',
        'meta_xy',
        'meta_progress',
        'meta_key_number',
        'meta_power_number',
        'meta_card'
    ];

    if (!editableFields.includes(option)) {
        return res.status(403).json({ success: false, message: `不允许修改受保护或不存在的字段: '${option}'。` });
    }
    
    try {
        const accounts = await readAccounts();
        const user = accounts[username];

        // 3. 检查用户是否存在
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        // 4. 更新值 (可以根据字段类型进行特殊处理)
        let processedValue = value;
        if (option === 'meta_card') {
            // 将 "true" 或 true 转换为布尔值 true，其他都为 false
            processedValue = (value === true || String(value).toLowerCase() === 'true');
        }

        user[option] = processedValue;
        
        // 5. 写回文件
        await writeAccounts(accounts);

        // 6. 返回成功响应
        res.json({ 
            success: true, 
            message: `用户 ${username} 的 ${option} 已成功更新。`,
            updated_user: user // 返回更新后的用户信息
        });

    } catch (error) {
        console.error(`更新用户 ${username} 数据时出错:`, error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});


// =================================================================
// ================= 新增功能：Meta 谜题接口 =========================
// =================================================================

/**
 * 接口: 从 meta_random.json 中随机获取谜题
 * GET /random
 */
app.get('/random', async (req, res) => {
    try {
        const data = await fs.readFile(META_RANDOM_FILE_PATH, 'utf-8');
        const content = JSON.parse(data);
        const puzzles = content.puzzles;

        if (!puzzles || puzzles.length === 0) {
            return res.status(404).json({ success: false, message: '没有可用的谜题。' });
        }

        const randomIndex = Math.floor(Math.random() * puzzles.length);
        res.json({ success: true, puzzle: puzzles[randomIndex] });
    } catch (error) {
        console.error('获取随机谜题时出错:', error);
        res.status(500).json({ success: false, message: '无法读取谜题文件。' });
    }
});

/**
 * 接口: 增加用户钥匙数量
 * POST /add_key
 * body: { "username": "user1" }
 */
app.post('/add_key', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: '需要提供用户名。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        let keyCount = parseInt(user.meta_key_number, 10);
        user.meta_key_number = (keyCount + 1).toString();

        await writeAccounts(accounts);
        res.json({ success: true, message: `用户 ${username} 的钥匙数量已增加。`, new_key_count: user.meta_key_number });
    } catch (error) {
        console.error('增加钥匙时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口: 增加用户电力装置数量
 * POST /add_power
 * body: { "username": "user1" }
 */
app.post('/add_power', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: '需要提供用户名。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        let powerCount = parseInt(user.meta_power_number, 10);
        user.meta_power_number = (powerCount + 1).toString();

        await writeAccounts(accounts);
        res.json({ success: true, message: `用户 ${username} 的电力装置数量已增加。`, new_power_count: user.meta_power_number });
    } catch (error) {
        console.error('增加电力时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口: 更改用户门禁卡状态为 true
 * POST /add_card
 * body: { "username": "user1" }
 */
app.post('/add_card', async (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ success: false, message: '需要提供用户名。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        user.meta_card = true;

        await writeAccounts(accounts);
        res.json({ success: true, message: `用户 ${username} 已获得门禁卡。` });
    } catch (error) {
        console.error('添加门禁卡时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口: 增加 Meta 解谜进度
 * POST /add_meta
 * body: { "username": "user1", "progress": "[x,y]" }
 */
app.post('/add_meta', async (req, res) => {
    const { username, progress } = req.body;
    if (!username || !progress) {
        return res.status(400).json({ success: false, message: '需要提供用户名和进度。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        // 在现有进度基础上增加，如果原进度为空则不加逗号
        if (user.meta_progress) {
            user.meta_progress += `,${progress}`;
        } else {
            user.meta_progress = progress;
        }

        await writeAccounts(accounts);
        res.json({ success: true, message: `用户 ${username} 的 Meta 进度已更新。`, new_progress: user.meta_progress });
    } catch (error) {
        console.error('增加Meta进度时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口: 更改用户的 Meta 坐标
 * POST /change_meta_xy
 * body: { "username": "user1", "new_xy": "[1,7]" }
 */
app.post('/change_meta_xy', async (req, res) => {
    const { username, new_xy } = req.body;
    if (!username || !new_xy) {
        return res.status(400).json({ success: false, message: '需要提供用户名和新坐标。' });
    }

    try {
        const accounts = await readAccounts();
        const user = accounts[username];
        if (!user) {
            return res.status(404).json({ success: false, message: '账号不存在。' });
        }

        user.meta_xy = new_xy;

        await writeAccounts(accounts);
        res.json({ success: true, message: `用户 ${username} 的坐标已更新。`, new_xy: user.meta_xy });
    } catch (error) {
        console.error('更新坐标时出错:', error);
        res.status(500).json({ success: false, message: '服务器内部错误。' });
    }
});

/**
 * 接口: 减少 Meta 总倒计时时间
 * POST /diminish_meta_time
 */
app.post('/diminish_meta_time', (req, res) => {
    if (metaTimer.status !== 'running') {
        console.log('[拒绝减少] 当前状态为:', metaTimer.status);
        return res.status(400).json({ success: false, message: 'Meta 倒计时未在运行中。' });
    }
    
    const reductionSeconds = parseInt(process.env.SIMPLE_PUZZLE_TIME_REDUCTION, 10);
    if (isNaN(reductionSeconds) || reductionSeconds <= 0) {
        console.error('[配置错误] SIMPLE_PUZZLE_TIME_REDUCTION 无效:', process.env.SIMPLE_PUZZLE_TIME_REDUCTION);
        return res.status(500).json({ success: false, message: '.env 中未配置或配置了无效的 SIMPLE_PUZZLE_TIME_REDUCTION' });
    }
    
    const oldEndTime = metaTimer.endTime;
    metaTimer.endTime -= reductionSeconds * 1000;

    // 确保 endTime 不会早于当前时间
    if (metaTimer.endTime < Date.now()) {
        metaTimer.endTime = Date.now();
    }

    console.log(`[减少成功] 原结束时间: ${new Date(oldEndTime).toISOString()}`);
    console.log(`[减少成功] 新结束时间: ${new Date(metaTimer.endTime).toISOString()}`);
    console.log(`[减少成功] 当前时间: ${new Date().toISOString()}`);

    res.json({ success: true, message: `Meta 总时间已减少 ${reductionSeconds} 秒。` });
});

// =================================================================
// =============== 新增功能：用户专属冷却系统 ========================
// =================================================================

// 辅助函数：检查用户冷却状态
const checkUserCooldown = (cooldownMap, username) => {
    if (cooldownMap.has(username)) {
        const endTime = cooldownMap.get(username);
        if (Date.now() < endTime) {
            return Math.ceil((endTime - Date.now()) / 1000);
        } else {
            cooldownMap.delete(username); // 冷却结束，自动移除
        }
    }
    return 0; // 没有冷却
};

// --- 小谜题冷却 ---
app.post('/simple_cooldown_status', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "需要用户名" });
    const remaining = checkUserCooldown(simpleCooldowns, username);
    res.json({ cooldownRemaining: remaining });
});

app.post('/start_simple_cooldown', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "需要用户名" });
    const coolTime = parseInt(process.env.SIMPLE_PUZZLE_COOLDOWN, 10) || 120;
    simpleCooldowns.set(username, Date.now() + coolTime * 1000);
    res.json({ success: true, message: `用户 ${username} 的小谜题冷却已开始，持续 ${coolTime} 秒。`});
});

// --- 4x4 谜题冷却 ---
app.post('/check_4x4_key', (req, res) => {
    const { username, keys } = req.body; // keys 是一个包含四行数据的数组，例如 ["k1", "k2", "k3", "k4"]
    if (!username || !Array.isArray(keys) || keys.length !== 4) {
        return res.status(400).json({ success: false, message: '请求参数无效，需要用户名和包含4个密钥的数组。' });
    }
    
    const correctKeys = [
        process.env.FOUR_BY_FOUR_KEY_1,
        process.env.FOUR_BY_FOUR_KEY_2,
        process.env.FOUR_BY_FOUR_KEY_3,
        process.env.FOUR_BY_FOUR_KEY_4,
    ];

    const isCorrect = keys.every((key, index) => key === correctKeys[index]);

    if (isCorrect) {
        res.json({ success: true, message: '4x4 密钥正确！' });
    } else {
        const coolTime = parseInt(process.env.FOUR_BY_FOUR_COOLDOWN, 10) || 300;
        fourByFourCooldowns.set(username, Date.now() + coolTime * 1000);
        res.status(401).json({ success: false, message: `密钥错误，已触发冷却。`, cooldown: coolTime });
    }
});

app.post('/4x4_cooldown_status', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "需要用户名" });
    const remaining = checkUserCooldown(fourByFourCooldowns, username);
    res.json({ cooldownRemaining: remaining });
});

// --- 守门员格子冷却 ---
app.post('/check_goalkeeper_key', (req, res) => {
    const { username, id, key } = req.body;
    if (!username || !id || !key) {
        return res.status(400).json({ success: false, message: '需要提供用户名、格子ID和密钥。' });
    }

    const correctKey = process.env[`GOALKEEPER_KEY_${id}`];

    if (!correctKey) {
        return res.status(404).json({ success: false, message: `未找到ID为 ${id} 的守门员格子的密钥配置。` });
    }
    
    if (key === correctKey) {
        res.json({ success: true, message: `守门员格子 ${id} 密钥正确！` });
    } else {
        const coolTime = parseInt(process.env.GOALKEEPER_COOLDOWN, 10) || 180;
        goalkeeperCooldowns.set(username, Date.now() + coolTime * 1000);
        res.status(401).json({ success: false, message: `密钥错误，已触发冷却。`, cooldown: coolTime });
    }
});

app.post('/goalkeeper_cooldown_status', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: "需要用户名" });
    const remaining = checkUserCooldown(goalkeeperCooldowns, username);
    res.json({ cooldownRemaining: remaining });
});


// =================================================================
// ===================== 原有功能 (保持不变) ========================
// =================================================================

/**
 * 接口: 验证密钥
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
            return res.status(429).json({ success: false, message: '请求过于频繁，请稍后再试。', cooldown: remaining });
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
            if (metaTimer.status !== 'idle') {
                return res.status(400).json({ success: false, message: 'Meta倒计时已经启动或已结束。' });
            }
            const metaDuration = parseInt(process.env.meta_time, 10);
            metaTimer.status = 'running';
            metaTimer.endTime = Date.now() + metaDuration * 1000;
            metaTimer.timerId = setTimeout(() => {
                console.log('Meta 倒计时结束!');
                metaTimer.status = 'finished';
            }, metaDuration * 1000);
            return res.json({ success: true, message: '假Meta正确！最终倒计时已启动。', metaStarted: true });

        case 'true_meta':
            if (metaTimer.status !== 'running') {
                return res.status(400).json({ success: false, message: '最终阶段尚未激活，无法提交真Meta。' });
            }
            const remaining = metaTimer.endTime - Date.now();
            const remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
            
            const victoryMessage = `恭喜！你已成功解开最终Meta！`;
            resetMetaState(); 
            return res.json({ success: true, message: victoryMessage, remainingSeconds: remainingSeconds });

        default:
            return res.json({ success: true, message: '密钥正确!' });
    }
});

app.get('/cooldown-status', (req, res) => {
    const ip = getIp(req);
    let remaining = 0;
    if (ipCooldowns.has(ip) && (remaining = Math.ceil((ipCooldowns.get(ip) - Date.now()) / 1000)) > 0) {
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

app.post('/stop-meta', (req, res) => {
    if (metaTimer.status !== 'running') {
        return res.status(400).json({ success: false, message: '当前没有正在运行的 Meta 倒计时。' });
    }
    const remaining = metaTimer.endTime - Date.now();
    const remainingSeconds = remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    resetMetaState();
    res.json({ success: true, message: 'Meta 倒计时已停止。', remainingSeconds: remainingSeconds });
});

app.post('/reset-meta', (req, res) => {
    resetMetaState();
    res.json({ success: true, message: 'Meta 倒计时状态已重置为 idle。' });
});


// --- 5. 启动服务器 ---
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});
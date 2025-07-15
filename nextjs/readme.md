## **后端 API 开发手册 (v1.3)**

### **一、 概述**

本文档详细描述了游戏后端服务器提供的所有 API 接口。前端开发人员应遵循此文档与后端进行数据交互。

*   **服务器基地址**: 默认为 `http://111.170.11.168:15114/proxy/3000`。
*   **数据格式**: 所有 `POST` 和 `DELETE` 请求的请求体（Request Body）均为 JSON 格式。请确保请求头包含 `Content-Type: application/json`。
*   **身份验证**: 本系统采用 Cookie 进行身份验证。成功登录后，服务器会设置 `username` 和 `password` 的 Cookie。前端在发起需要用户身份的请求时，浏览器会自动携带这些 Cookie。
*   **响应格式**: 所有接口的响应均为 JSON 格式。响应体中通常包含 `success` (布尔值) 和 `message` (字符串) 字段，用以判断请求是否成功和获取相关信息。

---

### **二、 账户与会话管理接口 (Account & Session)**

#### **1. 添加账号**

*   **接口**: `POST /add_acc`
*   **功能**: 创建一个新的玩家账号，并初始化默认数据。
*   **请求体示例**:
    ```json
    {
      "username": "new_player_123",
      "password": "his_secret_password"
    }
    ```
*   **响应示例**:
    *   **成功 (201 Created)**: `{"success": true, "message": "账号添加成功！"}`
    *   **失败 (用户名已存在, 409 Conflict)**: `{"success": false, "message": "用户名已存在。"}`

---

#### **2. 检查账号密码 (登录并设置 Cookie)**

*   **接口**: `POST /acc_check_password`
*   **功能**: 验证用户提供的账号和密码是否正确。成功登录后，服务器会在客户端设置 `username` 和 `password` 的 Cookie，用于后续的身份验证，并返回该用户的完整数据。
*   **请求体示例**:
    ```json
    {
      "username": "existing_player_456",
      "password": "the_correct_password"
    }
    ```
*   **响应示例**:
    *   **成功 (200 OK)**:
        ```json
        {
          "success": true,
          "message": "密码正确。",
          "user_data": {
            "password": "the_correct_password",
            "cool_down": "0",
            "progress": "1",
            "meta_xy": "[1,7]",
            "meta_progress": "[1,7],[4,6]",
            "meta_key_number": "2",
            "meta_power_number": "1",
            "meta_card": true
          }
        }
        ```
    *   **失败 (密码错误, 401 Unauthorized)**: `{"success": false, "message": "密码错误。"}`
    *   **失败 (账号不存在, 404 Not Found)**: `{"success": false, "message": "账号不存在。"}`

---

#### **3. 检查登录状态**

*   **接口**: `GET /check_login_status`
*   **功能**: 检查浏览器中是否存在有效登录 Cookie。用于页面加载时自动恢复用户登录状态。
*   **请求体**: 无
*   **响应示例**:
    *   **成功 (已登录, 200 OK)**:
        ```json
        {
            "success": true,
            "message": "用户已登录。",
            "user_data": {
                "password": "the_correct_password",
                "progress": "1",
                "..." : "..."
             }
        }
        ```
    *   **失败 (未登录, 401 Unauthorized)**: `{"success": false, "message": "用户未登录。"}`

---

#### **4. 登出**

*   **接口**: `POST /logout`
*   **功能**: 清除服务端的登录 Cookie，实现用户登出。
*   **请求体**: 无
*   **响应示例 (200 OK)**: `{"success": true, "message": "已成功登出。"}`

---

#### **5. 更改用户信息 (通用)**

*   **接口**: `POST /set_user_data`
*   **功能**: 一个通用的接口，用于修改指定用户的特定信息。
*   **请求体**: `{ "username": "...", "option": "...", "value": "..." }`
*   **重要提示**: 出于安全考虑，仅允许修改白名单内的字段 (`password`, `progress`, `meta_xy`, `meta_progress`, `meta_key_number`, `meta_power_number`, `meta_card`, `cool_down`)。
*   **请求示例**:
    *   修改进度: `{"username": "player_one", "option": "progress", "value": "5"}`
    *   修改门禁卡状态: `{"username": "player_one", "option": "meta_card", "value": true}`
*   **响应示例**:
    *   **成功 (200 OK)**:
        ```json
        {
          "success": true,
          "message": "用户 player_one 的 progress 已成功更新。",
          "updated_user": {
             "password": "p1", "progress": "5", "..." : "..."
          }
        }
        ```
    *   **失败 (禁止修改, 403 Forbidden)**: `{"success": false, "message": "不允许修改受保护或不存在的字段: 'isAdmin'。"}`

---

#### **6. 获取所有账号信息 (管理功能)**

*   **接口**: `GET /acc_get`
*   **功能**: 获取当前存储的所有用户信息。
*   **响应示例 (200 OK)**:
    ```json
    {
      "success": true,
      "accounts": {
        "player_one": {
          "password": "p1", "progress": "3", "meta_key_number": "1", "...": "..."
        },
        "player_two": {
          "password": "p2", "progress": "5", "meta_key_number": "3", "...": "..."
        }
      }
    }
    ```

---

#### **7. 删除指定账号 (管理功能)**

*   **接口**: `DELETE /acc_delete`
*   **功能**: 根据用户名删除一个账号。
*   **请求体示例**: `{ "username": "player_to_be_deleted" }`
*   **响应示例 (200 OK)**: `{"success": true, "message": "账号 player_to_be_deleted 已被删除。"}`

---

### **三、 Meta 谜题与玩家状态接口**

#### **1. 获取随机谜题**

*   **接口**: `GET /random`
*   **功能**: 从 `meta_random.json` 文件中随机抽取一道谜题及其答案。
*   **响应示例 (200 OK)**:
    ```json
    {
      "success": true,
      "puzzle": {
        "puzzle": "什么东西早上四条腿，中午两条腿，晚上三条腿？",
        "key": "人"
      }
    }
    ```

---

#### **2. 更新玩家状态与道具**

*   **增加钥匙数量**: `POST /add_key`
    *   请求体: `{"username": "player_one"}`
    *   响应: `{"success": true, "message": "用户 player_one 的钥匙数量已增加。", "new_key_count": "3"}`

*   **增加电力装置数量**: `POST /add_power`
    *   请求体: `{"username": "player_one"}`
    *   响应: `{"success": true, "message": "用户 player_one 的电力装置数量已增加。", "new_power_count": "2"}`

*   **获得门禁卡**: `POST /add_card`
    *   请求体: `{"username": "player_one"}`
    *   响应: `{"success": true, "message": "用户 player_one 已获得门禁卡。"}`

*   **增加 Meta 解谜进度**: `POST /add_meta`
    *   请求体: `{"username": "player_one", "progress": "[5,5]"}`
    *   响应: `{"success": true, "message": "用户 player_one 的 Meta 进度已更新。", "new_progress": "[1,7],[4,6],[5,5]"}`

*   **更改玩家 Meta 坐标**: `POST /change_meta_xy`
    *   请求体: `{"username": "player_one", "new_xy": "[5,5]"}`
    *   响应: `{"success": true, "message": "用户 player_one 的坐标已更新。", "new_xy": "[5,5]"}`

---

### **四、 冷却系统接口 (User-Specific Cooldowns)**

**通用流程**:
1.  在用户尝试输入答案**之前**，先调用对应的 `..._cooldown_status` 接口。
2.  如果返回的 `cooldownRemaining` 大于 0，则禁止用户输入，并显示倒计时。
3.  如果等于 0，则允许用户输入。
4.  用户提交答案后，根据答案正确与否，调用对应的 `check_..._key` 或 `start_..._cooldown` 接口。

---

#### **1. 小谜题 (Simple Puzzle)**

*   **检查冷却状态**: `POST /simple_cooldown_status`
    *   请求体: `{"username": "player_two"}`
    *   响应: `{"cooldownRemaining": 110}` (表示还需冷却110秒) 或 `{"cooldownRemaining": 0}` (无冷却)
*   **开启冷却 (前端判断答案错误后调用)**: `POST /start_simple_cooldown`
    *   请求体: `{"username": "player_two"}`
    *   响应: `{"success": true, "message": "用户 player_two 的小谜题冷却已开始，持续 120 秒。"}`

---

#### **2. 4x4 谜题**

*   **检查冷却状态**: `POST /4x4_cooldown_status`
    *   请求体: `{"username": "player_two"}`
    *   响应: `{"cooldownRemaining": 290}`
*   **验证密钥并触发冷却**: `POST /check_4x4_key`
    *   请求体: `{ "username": "player_two", "keys": ["row1_wrong", "row2_correct", "row3_correct", "row4_correct"] }`
    *   成功响应 (200 OK): `{"success": true, "message": "4x4 密钥正确！"}`
    *   失败响应 (401 Unauthorized): `{"success": false, "message": "密钥错误，已触发冷却。", "cooldown": 300}`

---

#### **3. 守门员谜题 (Goalkeeper Puzzle)**

*   **检查冷却状态**: `POST /goalkeeper_cooldown_status`
    *   请求体: `{"username": "player_two"}`
    *   响应: `{"cooldownRemaining": 175}`
*   **验证密钥并触发冷却**: `POST /check_goalkeeper_key`
    *   请求体: `{ "username": "player_two", "id": "east_gate", "key": "wrong_key_for_east_gate" }`
    *   成功响应 (200 OK): `{"success": true, "message": "守门员格子 east_gate 密钥正确！"}`
    *   失败响应 (401 Unauthorized): `{"success": false, "message": "密钥错误，已触发冷却。", "cooldown": 180}`

---

### **五、 核心解谜及全局倒计时接口**

这些接口使用 **IP 地址** 进行冷却，与用户登录状态无关。

---

#### **1. 验证节点密钥 (IP 冷却)**

*   **接口**: `POST /check-key`
*   **请求体**: `{ "nodeId": "node1", "key": "correct_key_for_node1" }`
*   **响应示例**:
    *   **普通节点正确**:
        ```json
        {"success": true, "message": "密钥正确!"}
        ```
    *   **假 Meta 正确 (启动倒计时)**:
        ```json
        {"success": true, "message": "假Meta正确！最终倒计时已启动。", "metaStarted": true}
        ```
    *   **真 Meta 正确 (获胜)**:
        ```json
        {"success": true, "message": "恭喜！你已成功解开最终Meta！", "remainingSeconds": 1500}
        ```
    *   **密钥错误 (触发 IP 冷却, 401 Unauthorized)**:
        ```json
        {"success": false, "message": "密钥错误，已触发冷却。", "cooldown": 60}
        ```
    *   **请求频繁 (IP 冷却中, 429 Too Many Requests)**:
        ```json
        {"success": false, "message": "请求过于频繁，请稍后再试。", "cooldown": 45}
        ```

---

#### **2. 获取 IP 冷却状态**

*   **接口**: `GET /cooldown-status`
*   **功能**: 检查当前用户的 IP 是否处于 `/check-key` 接口的冷却中。
*   **响应示例**: `{"cooldownRemaining": 50}`

---

#### **3. 获取全局 Meta 倒计时状态**

*   **接口**: `GET /meta-status`
*   **功能**: 查询最终倒计时的状态和剩余时间。
*   **响应示例**:
    *   **倒计时进行中**: `{"status": "running", "remainingSeconds": 1780}`
    *   **空闲状态**: `{"status": "idle", "remainingSeconds": 0}`
    *   **已结束**: `{"status": "finished", "remainingSeconds": 0}`

---

#### **4. 减少 Meta 倒计时总时间**

*   **接口**: `POST /diminish_meta_time`
*   **功能**: 当玩家完成特定小谜题时，调用此接口以减少全局倒计时的总时间。
*   **响应示例 (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Meta 总时间已减少 60 秒。"
    }
    ```

---

### **六、 管理接口**

#### **1. 重置 Meta 状态**

*   **接口**: `POST /reset-meta`
*   **功能**: (管理功能) 重置全局 Meta 倒计时状态为 `idle`。
*   **响应示例 (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Meta 倒计时状态已重置为 idle。"
    }
    ```

#### **2. 停止 Meta 倒计时**

*   **接口**: `POST /stop-meta`
*   **功能**: (管理功能) 强制停止正在运行的 Meta 倒计时。
*   **响应示例 (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Meta 倒计时已停止。",
      "remainingSeconds": 1234
    }
    ```
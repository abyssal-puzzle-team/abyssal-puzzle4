**解谜游戏后端 API 开发文档 (v4.1 - 详细版)**
--------------------------------

### 1\. 简介 (Introduction)

#### 1.1 项目目标

本文档为“解谜游戏”后端API提供全面、详细的规范。该API旨在支持一个多阶段的在线解谜活动，其核心功能包括：

-   **分步密钥验证**: 验证玩家为不同谜题节点提交的答案。
    
-   **IP冷却机制**: 为防止暴力破解，对提交错误答案的玩家IP进行临时限制。
    
-   **全局Meta倒计时**: 一个由所有玩家共享的、用于最终挑战的游戏事件。
    

#### 1.2 目标读者

本文档主要面向**前端开发人员**，以及任何需要与此API进行集成的团队成员。

### 2\. 通用规范 (General Principles)

#### 2.1 API 根路径 (Base URL)

所有API路径都基于以下根路径。

-   **开发环境**: http://localhost:3000
    

#### 2.2 数据格式 (Data Format)

-   所有请求体（Request Body）和响应体（Response Body）均采用 application/json 格式。
    
-   客户端在发送 POST 请求时，必须设置 Content-Type: application/json 请求头。
    

#### 2.3 HTTP 状态码 (HTTP Status Codes)

API使用标准的HTTP状态码来表示请求的结果：

-   200 OK: 请求成功。
    
-   400 Bad Request: 请求无效。通常是由于缺少必要的参数或参数格式错误。响应体中会包含具体的错误信息。
    
-   401 Unauthorized: 密钥错误。这特指玩家提交的答案不正确。
    
-   429 Too Many Requests: 请求被拒绝，因为客户端IP正处于冷却状态。
    

#### 2.4 标准错误响应格式

当请求发生错误时（4xx状态码），响应体将遵循以下格式，以便前端统一处理：

```
{
    ”success“: false,
    ”message“: ”描述错误的字符串“,
    ”cooldown“: 0 // (可选) 如果是冷却相关的错误，会包含此字段
}
```

Use code [with caution](https://support.google.com/legal/answer/13505487). Json

### 3\. 核心概念详解 (Core Concepts Explained)

#### 3.1 IP 冷却机制

-   **目的**: 防止恶意用户通过脚本对答案进行暴力破解。
    
-   **触发**: 当且仅当通过 POST /check-key 接口提交的 key 与服务器端存储的密码不匹配时。
    
-   **作用域**: 冷却状态是与客户端的**公网IP地址**绑定的。
    
-   **影响**: 处于冷却状态的IP在调用 POST /check-key 时会收到 429 错误，直到冷却时间结束。此机制**不影响**其他API的调用（如状态查询接口）。
    
-   **生命周期**:
    
    -   玩家提交错误密钥。
        
    -   服务器记录 \[IP\_Address, Cooldown\_End\_Timestamp\]。
        
    -   玩家再次提交，服务器检查当前时间是否小于 Cooldown\_End\_Timestamp。
        
    -   冷却时间过后，记录自动失效（或在下一次请求时被清除）。
        
    

#### 3.2 全局 Meta 倒计时

-   **目的**: 创造一个有时间限制的、所有玩家共同参与的最终挑战阶段。
    
-   **性质**: 这是一个**全局共享状态**。无论哪个玩家触发了倒计时，所有其他玩家通过状态查询接口都会看到同一个倒计时。
    
-   **状态机 (State Machine)**: Meta倒计时有三种状态：
    
    -   idle (空闲): 初始状态。可以被 false\_meta 密钥触发。
        
    -   running (运行中): 倒计时正在进行。此状态下可以提交 true\_meta 密钥。
        
    -   finished (已结束): 倒计时自然走完或被 true\_meta 成功解开。
        
    
-   **流程**:
    
    -   游戏开始时，状态为 idle。
        
    -   某玩家提交正确的 false\_meta 密钥，状态切换到 running，并开始计时。
        
    -   在 running 状态下，某玩家提交正确的 true\_meta 密钥，游戏胜利，状态被**重置**回 idle（为下一轮游戏做准备）。
        
    -   如果在 running 状态下时间耗尽，状态自动切换到 finished。需要管理员调用 /reset-meta 才能再次开始。
        
    

### 4\. 接口端点详述 (Endpoint Specification)

* * *

#### **接口 1: POST /check-key**

-   **描述**: 这是游戏的核心交互接口。用于验证玩家为任意节点提交的密钥，并根据节点类型触发不同的游戏事件。
    
-   **请求体参数**:
    

<table _ngcontent-ng-c2459883256=”“ style=”box-sizing: border-box; border-radius: 8px; overflow-x: scroll;“><tbody><tr _ngcontent-ng-c2459883256=”“ class=”table-header ng-star-inserted“ style=”box-sizing: border-box;“><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 700; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-top-width: medium; border-top-style: none; border-top-color: currentcolor; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>字段名</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 700; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-top-width: medium; border-top-style: none; border-top-color: currentcolor; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>类型</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 700; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-top-width: medium; border-top-style: none; border-top-color: currentcolor; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>是否必填</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 700; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-top-width: medium; border-top-style: none; border-top-color: currentcolor; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>描述</span></ms-cmark-node></td></tr><tr _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>nodeId</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>String</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>是</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>目标节点的ID。有效值包括：</span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”node1“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”node2“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”node3“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”node4“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”node5“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”meta_front“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”false_meta“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>,<span class=”Apple-converted-space“>&nbsp;</span></span><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>”true_meta“</span><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>。</span></ms-cmark-node></td></tr><tr _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”inline-code ng-star-inserted“ style=”box-sizing: border-box; background: var(--color-surface-container-low); border: 1px solid var(--color-surface-container-low); border-radius: 3px; font-size: 13px; padding: 0px 3px; display: inline-block; font-family: &quot;DM Mono&quot;, monospace;“>key</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>String</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>是</span></ms-cmark-node></td><td _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box; padding: 6px 12px; overflow-wrap: normal; font-size: 14px; font-weight: 400; line-height: 20px; font-family: &quot;Google Sans Text&quot;, &quot;Helvetica Neue&quot;, sans-serif; letter-spacing: normal; border-right-width: medium; border-right-style: none; border-right-color: currentcolor;“><ms-cmark-node _ngcontent-ng-c2459883256=”“ _nghost-ng-c2459883256=”“ style=”box-sizing: border-box; display: contents;“><span _ngcontent-ng-c2459883256=”“ class=”ng-star-inserted“ style=”box-sizing: border-box;“>玩家输入的密钥字符串。</span></ms-cmark-node></td></tr></tbody></table>

-   **请求体示例**:
    
    ```
    {
        ”nodeId“: ”node1“,
        ”key“: ”puzzle_alpha“
    }
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Json
    
-   **成功响应 (200 OK)**:
    
    -   **场景**: 验证普通节点密钥正确。
        
    -   **响应体**:
        
        ```
        {
            ”success“: true,
            ”message“: ”密钥正确!“
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    -   **场景**: 验证 false\_meta 密钥正确，并成功启动倒计时。
        
    -   **响应体**:
        
        ```
        {
            ”success“: true,
            ”message“: ”假Meta正确！最终倒计时已启动。“,
            ”metaStarted“: true
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    -   **场景**: 在倒计时期间验证 true\_meta 密钥正确，赢得游戏。
        
    -   **响应体**:
        
        ```
        {
            ”success“: true,
            ”message“: ”恭喜！你已成功解开最终Meta！“,
            ”remainingSeconds“: 178
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    
-   **失败响应 (4xx)**:
    
    -   **场景**: 提交的 key 不正确。
        
    -   **响应**: 401 Unauthorized
        
    -   **响应体**:
        
        ```
        {
            ”success“: false,
            ”message“: ”密钥错误，已触发冷却。“,
            ”cooldown“: 60
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    -   **场景**: IP正处于冷却中。
        
    -   **响应**: 429 Too Many Requests
        
    -   **响应体**:
        
        ```
        {
            ”success“: false,
            ”message“: ”请求过于频繁，请稍后再试。“,
            ”cooldown“: 42
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    -   **场景**: 尝试启动一个已在运行的倒计时。
        
    -   **响应**: 400 Bad Request
        
    -   **响应体**:
        
        ```
        {
            ”success“: false,
            ”message“: ”Meta倒计时已经启动或已结束。“
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
    
-   **cURL 示例**:
    
    ```
    # 验证一个普通节点
    curl -X POST -H ”Content-Type: application/json“ -d ’{”nodeId“: ”node1“, ”key“: ”puzzle_alpha“}‘ http://localhost:3000/check-key
    
    # 启动Meta倒计时
    curl -X POST -H ”Content-Type: application/json“ -d ’{”nodeId“: ”false_meta“, ”key“: ”almost_there“}‘ http://localhost:3000/check-key
    
    # 提交错误密钥以触发冷却
    curl -X POST -H ”Content-Type: application/json“ -d ’{”nodeId“: ”node2“, ”key“: ”wrong_key“}‘ http://localhost:3000/check-key
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Bash
    

* * *

#### **接口 2: GET /cooldown-status**

-   **描述**: 查询发起请求的客户端IP当前的冷却状态。此接口不受冷却机制限制，可随时调用。
    
-   **响应 (200 OK)**:
    
    -   **响应体**:
        
        ```
        {
            ”cooldownRemaining“: 28
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
        cooldownRemaining (Number): 剩余的冷却秒数。如果为 0，表示没有冷却。
        
    
-   **cURL 示例**:
    
    ```
    curl http://localhost:3000/cooldown-status
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Bash
    

* * *

#### **接口 3: GET /meta-status**

-   **描述**: 查询全局Meta倒计时的当前状态。前端应定时轮询此接口（推荐每秒一次）以实时更新UI。
    
-   **响应 (200 OK)**:
    
    -   **响应体**:
        
        ```
        {
            ”status“: ”running“,
            ”remainingSeconds“: 295
        }
        ```
        
        Use code [with caution](https://support.google.com/legal/answer/13505487). Json
        
        status (String): 当前状态，值为 ”idle“, ”running“, 或 ”finished“。  
        remainingSeconds (Number): 当状态为 running 时，表示剩余秒数。
        
    
-   **cURL 示例**:
    
    ```
    curl http://localhost:3000/meta-status
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Bash
    

* * *

#### **接口 4: POST /stop-meta**

-   **描述**: （管理/调试功能）强制停止当前正在运行的Meta倒计时，并将其状态重置为 idle。
    
-   **响应 (200 OK)**:
    
    ```
    {
        ”success“: true,
        ”message“: ”Meta 倒计时已停止。“,
        ”remainingSeconds“: 210
    }
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Json
    
-   **cURL 示例**:
    
    ```
    curl -X POST http://localhost:3000/stop-meta
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Bash
    

* * *

#### **接口 5: POST /reset-meta**

-   **描述**: （管理功能）一个更强大的重置工具，无论当前处于何种状态（running 或 finished），都将其强制恢复到初始的 idle 状态。主要用于游戏结束后为下一轮做准备。
    
-   **响应 (200 OK)**:
    
    ```
    {
        ”success“: true,
        ”message“: ”Meta 倒计时状态已重置为 idle。“
    }
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Json
    
-   **cURL 示例**:
    
    ```
    curl -X POST http://localhost:3000/reset-meta
    ```
    
    Use code [with caution](https://support.google.com/legal/answer/13505487). Bash
    

* * *

### 5\. 前端集成策略 (Frontend Integration Strategy)

-   **初始化与状态轮询**:
    
    -   页面加载完成后，立即启动一个定时器 (setInterval)，每秒执行一次状态获取函数。
        
    -   该函数应并（Promise.all）调用 GET /cooldown-status 和 GET /meta-status。
        
    -   根据返回的数据，实时更新UI，例如显示“冷却中：35秒”或“最终挑战剩余：120秒”。
        
    
-   **处理用户提交**:
    
    -   当用户点击“提交”按钮时，构造 POST /check-key 的请求体。
        
    -   使用 async/await 和 try...catch 结构来处理API调用。
        
    -   **try 块内**:
        
        -   const response = await fetch(...)
            
        -   如果 response.ok (状态码 2xx)，解析 data = await response.json()，并根据 data.message 显示成功提示。如果 data.metaStarted 为 true，可以播放一个特殊的动画或音效。
            
        
    -   **catch 块或 !response.ok**:
        
        -   解析错误响应体 errorData = await response.json()。
            
        -   根据 errorData.message 和 errorData.cooldown向用户显示清晰的错误反馈，例如：“答案错误，请60秒后再试。”
            
        
    
-   **UI/UX 建议**:
    
    -   **反馈要即时**: 无论成功或失败，立即给出视觉反馈。
        
    -   **禁用输入**: 在API请求期间，或在用户IP处于冷却状态时，应禁用输入框和提交按钮，防止用户重复无效操作。
        
    -   **倒计时显示**: 将秒数格式化为 MM:SS (例如 04:55)，对用户更友好。
        
    -   **全局事件**: 当Meta倒计时开始时，可以考虑在页面顶部显示一个全局横幅，让所有玩家都能感知到游戏进入了新阶段。
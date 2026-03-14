# Crux

<p align="center">
  <img src="https://cruxai.cn/icon/i.png" alt="Crux Logo" width="200">
</p>

<p align="center">
  <a href="https://github.com/CZLJCX/Crux">
    <img src="https://img.shields.io/badge/Version-1.1.13-blue.svg" alt="Version">
  </a>
  <a href="https://github.com/CZLJCX/Crux">
    <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License">
  </a>
  <a href="https://nodejs.org/">
    <img src="https://img.shields.io/badge/Node.js-18+-brightgreen.svg" alt="Node.js">
  </a>
  <a href="https://github.com/CZLJCX/Crux">
    <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform">
  </a>
</p>

---

## 📖 简介

**Crux** 是一款强大的 AI Agent 客户端，支持 CLI（命令行）和 Web（网页版）两种客户端形式。

通过 Crux，你可以：

- 🤖 与 AI 助手进行对话交互
- 💻 执行 shell 命令
- 📁 读写、创建、删除文件
- 🔍 搜索文件和内容
- 🌐 获取网页内容
- 🔄 支持多轮工具调用

---

## 🚀 快速开始

### 前置要求

| 环境 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | ≥18.0.0 | 必须安装 |
| npm | ≥9.0.0 | 随 Node.js 一起安装 |

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/CZLJCX/Crux.git
cd Crux

# 2. 安装依赖并初始化
npm run init

# 3. 全局安装（可选）
npm install -g
```

#### 安装过程中

初始化时会提示配置：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| OPENAI_API_KEY | API 密钥（必填） | - |
| OPENAI_BASE_URL | API 地址 | `https://api.openai.com/v1` |
| OPENAI_MODEL | 使用的模型 | `gpt-4o` |
| OPENAI_TEMPERATURE | 创造性参数 | `0.7` |

#### 启动程序

安装完成后，在任意目录运行：

```bash
crux       # CLI 客户端

crux-web   # Web 客户端
```

---

#### ⚠️ 常见问题

**Q: 安装失败提示权限错误？**

确保不在系统保护目录（如 `C:\Windows`、`C:\Program Files`）。程序会自动检测并移动到用户目录。

**Q: 如何使用其他 API？**

修改 `.env` 文件：
```
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

#### 2. 启动程序

```bash
# CLI 客户端
crux

# Web 客户端
crux-web
```

---

## 📋 可用命令

| 命令 | 说明 |
|------|------|
| `npm run init` | 初始化项目（配置、安装依赖、编译、全局安装） |
| `npm run build` | 编译 TypeScript 项目 |
| `npm run cli` | 运行 CLI 客户端 |
| `npm run dev` | 开发模式运行 |
| `npm run install-web` | 安装 Web 客户端依赖 |
| `crux` | 启动 CLI 客户端（全局命令） |
| `crux-web` | 启动 Web 客户端（全局命令） |

### CLI 客户端

命令行交互界面，无需额外依赖。

```bash
npm run cli
```

或全局安装后：

```bash
crux
```

**功能特点：**
- 交互式命令行界面
- Markdown 格式输出
- 多轮工具调用支持
- 会话管理

---

### Web 客户端

网页版应用，基于 React + Vite。

```bash
# 全局命令（推荐）
crux-web

# 或使用 npm
npm run web
```

**首次使用需安装依赖：**
```bash
npm run install-web
```

访问 `http://localhost:5173` 即可使用。

**功能特点：**
- 浏览器直接访问
- 响应式设计
- 无需安装

---

## ⚙️ 配置说明

### 环境变量

在 `.env` 文件中配置：

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | API 密钥（必填） | - |
| `OPENAI_BASE_URL` | API 基础 URL | `https://api.deepseek.com/v1` |
| `OPENAI_MODEL` | 使用的模型 | `deepseek-chat` |
| `OPENAI_MAX_TOKENS` | 最大回复 token 数 | `4096` |
| `OPENAI_TEMPERATURE` | 创造性参数 (0-1) | `0.7` |
| `OPENAI_STREAM` | 是否启用流式输出 | `true` |
| `CRUX_DATA_DIR` | 数据存储目录 | `.crux` |
| `CRUX_SESSION_DIR` | 会话存储目录 | `sessions` |
| `CRUX_CONFIG_FILE` | 配置文件名 | `config.json` |

---

## 📋 可用命令

### CLI 命令

| 命令 | 说明 |
|------|------|
| `/help`, `/h` | 显示帮助信息 |
| `/new`, `/n` | 创建新会话 |
| `/sessions`, `/s` | 切换会话 |
| `/exit`, `/e` | 退出程序 |

### 可用工具

| 工具名称 | 说明 | 用法示例 |
|----------|------|----------|
| `shell` | 执行 shell 命令 | `列出桌面文件` |
| `file` | 文件操作 | `读取 src/index.ts` |
| `glob` | 文件搜索 | `查找所有 ts 文件` |
| `grep` | 内容搜索 | `搜索 function 关键字` |
| `web_fetch` | 获取网页 | `获取百度首页内容` |

---

## 📁 项目结构

```
crux/
├── src/                      # 源代码
│   ├── core/                 # 核心模块
│   │   ├── Agent.ts          # AI Agent
│   │   ├── LLMConnector.ts   # LLM 连接器
│   │   ├── SessionManager.ts  # 会话管理
│   │   ├── ToolRegistry.ts   # 工具注册
│   │   └── config.ts         # 配置管理
│   ├── tools/                # 工具实现
│   │   ├── ShellTool.ts      # Shell 工具
│   │   ├── FileTool.ts       # 文件工具
│   │   ├── GlobTool.ts       # 搜索工具
│   │   ├── GrepTool.ts       # grep 工具
│   │   └── WebFetchTool.ts   # 网页工具
│   ├── clients/              # 客户端
│   │   └── cli/              # CLI 客户端
│   ├── utils/                # 工具函数
│   │   ├── environment.ts    # 环境检测
│   │   └── updater.ts        # 升级检测
│   └── server.ts             # Web 服务器
├── clients/
│   └── web/                  # Web 客户端（React）
├── dist/                     # 编译输出
├── .env.example              # 配置模板
├── package.json              # 项目配置
├── tsconfig.json            # TypeScript 配置
├── init.js                   # 初始化脚本
└── README.md                # 说明文档
```

---

## 🛠️ 开发指南

### 安装开发依赖

```bash
npm install
```

### 开发模式

```bash
# CLI 开发模式
npm run dev

# Web 开发模式
npm run web
```

### 编译项目

```bash
npm run build
```

### 类型检查

```bash
npm run typecheck
```

---

## 📊 依赖列表

### 生产依赖

| 包名 | 版本 | 说明 |
|------|------|------|
| `chalk` | ^5.3.0 | 命令行彩色输出 |
| `conf` | ^12.0.0 | 配置管理 |
| `dotenv` | ^16.4.5 | 环境变量加载 |
| `eventsource` | ^2.0.2 | EventSource 流 |
| `express` | ^4.19.2 | Web 服务器 |
| `glob` | ^10.4.5 | 文件匹配 |
| `inquirer` | ^9.2.23 | 交互式命令行 |
| `marked` | ^17.0.4 | Markdown 解析 |
| `minimatch` | ^9.0.5 | 路径匹配 |
| `openai` | ^4.77.0 | OpenAI API 客户端 |
| `ora` | ^7.0.1 | 加载动画 |

### 开发依赖

| 包名 | 版本 | 说明 |
|------|------|------|
| `typescript` | ^5.5.3 | TypeScript 编译器 |
| `tsx` | ^4.15.7 | TypeScript 执行器 |
| `@types/node` | ^20.14.9 | Node.js 类型定义 |

---

## ❓ 常见问题

### Q1: 运行 `crux` 提示找不到命令

**解决方法：**

```bash
# 方案 1：全局安装
npm install -g

# 方案 2：使用 npx
npx crux

# 方案 3：直接运行
node dist/clients/cli/index.js
```

### Q2: API Key 无效错误

**检查步骤：**
1. 确认 `.env` 文件中的 `OPENAI_API_KEY` 正确
2. 确认 API Key 有足够余额
3. 确认网络可以访问 API

### Q3: Web 客户端无法启动

**前置条件：**
- 安装 Web 依赖: `npm run install-web`

### Q4: 多轮工具调用失败

**错误信息：** `Messages with role 'tool' must be a response to a preceding message with 'tool_calls'`

**解决方法：**
- 确保已更新到最新版本
- 重新编译：`npm run build`

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/xxx`)
3. 提交更改 (`git commit -m 'Add xxx'`)
4. 推送分支 (`git push origin feature/xxx`)
5. 创建 Pull Request

---

## 📄 许可证

MIT License © 2024-2026 CZLJ. All rights reserved.

---

## 🧪 测试示例

### 简单对话

```
➤ 你好，请介绍一下你自己

  你好！我是 Crux，一个 AI Agent，可以帮助你完成各种任务...
```

### 文件操作

```
➤ 列出当前目录下的所有文件

  [Thinking] glob
  [Result] 
  • src/
  • dist/
  • package.json
  • tsconfig.json
  • README.md
```

### 执行命令

```
➤ 列出桌面文件

  [Thinking] shell
  [Result] 
  • 文档.txt
  • 图片.png
  • 下载/
```

---

## 🔗 相关链接

- [GitHub 仓库](https://github.com/CZLJCX/Crux)
- [问题反馈](https://github.com/CZLJCX/Crux/issues)
- [更新日志](./CHANGELOG.md)

---

## 🙏 致谢

感谢以下项目和库的开发者：

- [Chalk](https://github.com/chalk/chalk) - 命令行着色
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) - 交互式 CLI
- [Tauri](https://tauri.app/) - 桌面应用框架

---

<p align="center">
  Made with ❤️ by <a href="https://czlj.net">CZLJ</a>
</p>
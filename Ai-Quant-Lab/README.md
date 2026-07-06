# AI-Quant Lab

A 股 / 港股量化分析与技术指标研究平台。

## 项目结构

```
Ai-Quant-Lab/
├── index.html             ← 项目导航首页
├── docs/
│   ├── SPEC_dashboard.md  ← 交互式技术指标工作台 — 产品设计文档
│   └── mockup.html        ← 交互式界面设计参考（Mockup）
├── app/
│   ├── index.html         ← 技术指标计算工作台 (开发中)
│   ├── css/               ← 样式文件
│   └── js/                ← 指标计算引擎 + ECharts 渲染
├── data/
│   └── smic_hk_sample.csv ← 中芯国际港股样本日线数据
├── notebooks/
│   └── smic_hk_indicators.ipynb ← RSI / MACD / 布林带 / ATR 教学Notebook
└── README.md
```

## 核心应用 — 技术指标交互计算工作台

一个纯前端的 HTML 交互工具，支持：
- **多股票选择**: 7 只 A 股 / 港股预置标的
- **四个指标**: RSI / MACD / 布林带 / ATR
- **参数可调**: 每个指标独立滑块/输入框，即时重绘
- **交互图表**: ECharts 5 驱动的 K 线 + 指标叠加图

### 技术栈
- 可视化: ECharts 5
- 计算引擎: 浏览器端 JavaScript (ES6)
- 数据源: Tushare Pro (预加载 JSON)
- 设计: 左参数面板 + 右图表布局，响应式适配

### 开发计划
| 阶段 | 内容 |
|------|------|
| P0 | 指标计算引擎 (4个指标) |
| P0 | ECharts 图表渲染 + 参数联动 |
| P0 | 股票数据整合 |
| P1 | 视图 Tab 切换 (K线/RSI/MACD/布林/ATR) |
| P1 | 日期范围选择 + 快捷按钮 |
| P2 | 多股票对比 / 策略回测 / 数据导出 |

## 数据说明
- 数据通过 Tushare Pro HTTP API 获取（需 API Token）
- 港股数据需要 APEX 积分 (2000+)
- 备选数据源: yfinance / akshare

> ⚠️ 仅作量化研究与教学使用，不构成投资建议。

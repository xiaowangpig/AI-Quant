#!/usr/bin/env python3
"""Generate HTML dashboard for SMIC stock K-line and volume chart."""

import json

# Load data
with open("D:\\@我的电脑文件整理\\北大量化交易工作坊\\smic_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

records = data["records"]

# Sort by trade_date ascending (oldest first)
records.sort(key=lambda r: r[1])

# Extract data arrays
dates = []
ohlc = []   # [open, close, low, high]
volumes = []
ma5 = []
ma20 = []

for r in records:
    trade_date = r[1]  # "20250630"
    # Format date as "2025-06-30"
    date_str = f"{trade_date[:4]}-{trade_date[4:6]}-{trade_date[6:]}"
    dates.append(date_str)
    
    o, h, l, c = r[2], r[3], r[4], r[5]
    ohlc.append([o, c, l, h])  # ECharts candlestick: [open, close, low, high]
    
    vol = r[9]  # volume in 手
    volumes.append(vol)

# Calculate MA5 and MA20 from close prices
close_prices = [r[5] for r in records]
for i in range(len(close_prices)):
    if i >= 4:
        ma5.append(round(sum(close_prices[i-4:i+1]) / 5, 2))
    else:
        ma5.append(None)
    if i >= 19:
        ma20.append(round(sum(close_prices[i-19:i+1]) / 20, 2))
    else:
        ma20.append(None)

# Build date list for JS
dates_json = json.dumps(dates)
ohlc_json = json.dumps(ohlc)
volumes_json = json.dumps(volumes)
ma5_json = json.dumps(ma5)
ma20_json = json.dumps(ma20)

# Determine color for volume bars based on price change
# We'll handle this in JS by comparing close vs open

# Get stock info
ts_code = data["ts_code"]
stock_name = data["name"]
start_date_formatted = f"{data['start_date'][:4]}-{data['start_date'][4:6]}-{data['start_date'][6:]}"
end_date_formatted = f"{data['end_date'][:4]}-{data['end_date'][4:6]}-{data['end_date'][6:]}"

# Latest price info
latest = records[-1]  # newest
latest_date = f"{latest[1][:4]}-{latest[1][4:6]}-{latest[1][6:]}"
latest_close = latest[5]
latest_change = latest[7]
latest_pct = latest[8]
latest_vol = latest[9]
latest_amount = latest[10]

change_color = "#e53935" if latest_change >= 0 else "#43a047"
change_sign = "+" if latest_change >= 0 else ""

html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>中芯国际 (688981.SH) K线图</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #f5f6fa;
    color: #2c3e50;
    padding: 24px;
  }}
  .container {{ max-width: 1200px; margin: 0 auto; }}
  
  /* Header */
  .header {{
    background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
    color: white;
    border-radius: 12px;
    padding: 28px 32px;
    margin-bottom: 20px;
    box-shadow: 0 4px 20px rgba(26,35,126,0.2);
  }}
  .header h1 {{ font-size: 22px; font-weight: 600; margin-bottom: 4px; }}
  .header .subtitle {{ font-size: 13px; opacity: 0.8; }}
  .header .code {{ font-size: 14px; opacity: 0.7; margin-left: 8px; }}
  
  /* Key metrics */
  .metrics {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }}
  .metric-card {{
    background: white;
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }}
  .metric-card .label {{ font-size: 12px; color: #90a4ae; margin-bottom: 4px; }}
  .metric-card .value {{ font-size: 22px; font-weight: 700; }}
  .metric-card .change {{ font-size: 13px; margin-top: 2px; }}
  .up {{ color: #e53935; }}
  .down {{ color: #43a047; }}
  
  /* Chart area */
  .chart-wrapper {{
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    margin-bottom: 20px;
  }}
  .chart-title {{ font-size: 15px; font-weight: 600; margin-bottom: 12px; color: #37474f; }}
  #klineChart {{ width: 100%; height: 500px; }}
  #volumeChart {{ width: 100%; height: 150px; }}
  
  /* Footer */
  .footer {{
    text-align: center;
    font-size: 12px;
    color: #90a4ae;
    padding: 16px 0;
  }}
  .footer a {{ color: #5c6bc0; text-decoration: none; }}
  
  .data-range {{ font-size: 13px; color: #78909c; margin-bottom: 12px; }}
  
  /* Tooltip */
  .data-table-wrapper {{ overflow-x: auto; }}
  .data-table {{
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }}
  .data-table th {{
    background: #f5f6fa;
    padding: 10px 12px;
    text-align: right;
    font-weight: 600;
    color: #546e7a;
    border-bottom: 2px solid #e0e0e0;
    white-space: nowrap;
  }}
  .data-table th:first-child {{ text-align: left; }}
  .data-table td {{
    padding: 8px 12px;
    text-align: right;
    border-bottom: 1px solid #f0f0f0;
    white-space: nowrap;
  }}
  .data-table td:first-child {{ text-align: left; color: #78909c; }}
  .data-table tr:hover {{ background: #fafafa; }}
</style>
</head>
<body>
<div class="container">
  
  <!-- Header -->
  <div class="header">
    <h1>{stock_name} <span class="code">{ts_code}</span></h1>
    <div class="subtitle">数据来源：Tushare Pro | 近1年日线数据</div>
  </div>
  
  <!-- Key Metrics -->
  <div class="metrics">
    <div class="metric-card">
      <div class="label">最新收盘</div>
      <div class="value" style="color:{change_color}">{latest_close:.2f}</div>
      <div class="change { 'up' if latest_change >= 0 else 'down' }">
        {change_sign}{latest_change:.2f} ({change_sign}{latest_pct:.2f}%)
      </div>
    </div>
    <div class="metric-card">
      <div class="label">最新交易日</div>
      <div class="value" style="font-size:16px; color:#546e7a;">{latest_date}</div>
    </div>
    <div class="metric-card">
      <div class="label">近1年最高</div>
      <div class="value up">{max(r[3] for r in records):.2f}</div>
    </div>
    <div class="metric-card">
      <div class="label">近1年最低</div>
      <div class="value down">{min(r[4] for r in records):.2f}</div>
    </div>
    <div class="metric-card">
      <div class="label">近1年涨幅</div>
      <div class="value" style="color:{change_color}">
        {change_sign}{((latest_close / records[0][5] - 1) * 100):.2f}%
      </div>
      <div class="change { 'up' if latest_close >= records[0][5] else 'down' }">
        起始价: {records[0][5]:.2f}
      </div>
    </div>
    <div class="metric-card">
      <div class="label">日均成交量</div>
      <div class="value" style="font-size:18px;">{sum(r[9] for r in records) / len(records) / 10000:.0f}万手</div>
    </div>
  </div>
  
  <!-- K-line Chart -->
  <div class="chart-wrapper">
    <div class="chart-title">日K线图</div>
    <div class="data-range">数据区间：{dates[0]} ~ {dates[-1]}（共{len(dates)}个交易日）</div>
    <div id="klineChart"></div>
  </div>
  
  <!-- Volume Chart -->
  <div class="chart-wrapper">
    <div class="chart-title">成交量</div>
    <div id="volumeChart"></div>
  </div>
  
  <!-- Data Table (collapsible for precision) -->
  <div class="chart-wrapper">
    <div class="chart-title" style="cursor:pointer;" onclick="toggleTable()">📊 查看详细数据表 ▼</div>
    <div id="dataTable" style="display:none;">
      <div class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>开盘</th>
              <th>最高</th>
              <th>最低</th>
              <th>收盘</th>
              <th>涨跌幅(%)</th>
              <th>成交量(万手)</th>
              <th>成交额(亿元)</th>
            </tr>
          </thead>
          <tbody>
"""

# Add table rows (most recent first)
for r in reversed(records):
    d = f"{r[1][:4]}-{r[1][4:6]}-{r[1][6:]}"
    op, hi, lo, cl = r[2], r[3], r[4], r[5]
    pct = r[8]
    vol_wan = r[9] / 10000  # convert to 万手
    amount_yi = r[10] / 10000  # convert to 亿元
    pct_color = "#e53935" if pct >= 0 else "#43a047"
    pct_sign = "+" if pct >= 0 else ""
    html_content += f"""            <tr>
              <td>{d}</td>
              <td style="color:{pct_color}">{op:.2f}</td>
              <td style="color:{pct_color}">{hi:.2f}</td>
              <td style="color:{pct_color}">{lo:.2f}</td>
              <td style="color:{pct_color}">{cl:.2f}</td>
              <td style="color:{pct_color}">{pct_sign}{pct:.2f}%</td>
              <td>{vol_wan:.1f}</td>
              <td>{amount_yi:.2f}</td>
            </tr>
"""

html_content += f"""          </tbody>
        </table>
      </div>
    </div>
  </div>
  
  <div class="footer">
    数据来源：<a href="https://tushare.pro" target="_blank">Tushare Pro</a> | 
    中芯国际 (688981.SH) | 仅作展示，不构成投资建议
  </div>
</div>

<script>
// ========== Data ==========
const dates = {dates_json};
const ohlc = {ohlc_json};
const volumes = {volumes_json};
const ma5 = {ma5_json};
const ma20 = {ma20_json};

// Calculate volume colors (red if close >= open, green if close < open)
const volumeColors = ohlc.map(item => (item[0] <= item[1] ? '#e53935' : '#43a047'));

// ========== K-line Chart ==========
const klineChart = echarts.init(document.getElementById('klineChart'));

// Calculate min/max for y-axis range
const allPrices = ohlc.flat();
const priceMin = Math.min(...allPrices);
const priceMax = Math.max(...allPrices);
const padding = (priceMax - priceMin) * 0.08;

const klineOption = {{
    tooltip: {{
        trigger: 'axis',
        axisPointer: {{ type: 'cross' }},
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#ddd',
        borderWidth: 1,
        textStyle: {{ color: '#333', fontSize: 12 }},
        formatter: function(params) {{
            const p = params[0];
            if (!p) return '';
            const idx = p.dataIndex;
            const d = ohlc[idx];
            const dateStr = dates[idx];
            const volVal = (volumes[idx] / 10000).toFixed(1);
            const amtVal = (d[0] === 0 ? 0 : (volumes[idx] * d[1] / 10000).toFixed(2));
            const changePct = ((d[1] - d[0]) / d[0] * 100).toFixed(2);
            const color = d[0] <= d[1] ? '#e53935' : '#43a047';
            const sign = d[0] <= d[1] ? '+' : '';
            return `
                <div style="font-weight:600;margin-bottom:4px;">${{dateStr}}</div>
                <div>开盘: <b>${{d[0].toFixed(2)}}</b></div>
                <div>收盘: <b style="color:${{color}}">${{d[1].toFixed(2)}}</b></div>
                <div>最高: <b>${{d[2].toFixed(2)}}</b></div>
                <div>最低: <b>${{d[3].toFixed(2)}}</b></div>
                <div>涨跌幅: <b style="color:${{color}}">${{sign}}${{changePct}}%</b></div>
                <div>成交量: <b>${{volVal}}万手</b></div>
            `;
        }}
    }},
    grid: {{
        left: '6%',
        right: '6%',
        bottom: '8%',
        top: '6%'
    }},
    xAxis: {{
        type: 'category',
        data: dates,
        axisLine: {{ lineStyle: {{ color: '#ddd' }} }},
        axisLabel: {{
            color: '#78909c',
            fontSize: 11,
            rotate: 30,
            interval: Math.max(Math.floor(dates.length / 20), 1)
        }},
        splitLine: {{ show: false }}
    }},
    yAxis: {{
        scale: true,
        min: priceMin - padding,
        max: priceMax + padding,
        splitLine: {{ lineStyle: {{ color: '#f0f0f0', type: 'dashed' }} }},
        axisLabel: {{ color: '#78909c', fontSize: 11 }},
        name: '价格(元)',
        nameTextStyle: {{ color: '#90a4ae', fontSize: 11 }}
    }},
    dataZoom: [
        {{ type: 'inside', xAxisIndex: 0, start: 0, end: 100 }},
        {{ type: 'slider', xAxisIndex: 0, start: 0, end: 100, height: 20, bottom: 2,
           borderColor: '#ddd', fillerColor: 'rgba(92,107,192,0.15)',
           handleStyle: {{ color: '#5c6bc0' }},
           textStyle: {{ color: '#78909c' }}
        }}
    ],
    series: [
        {{
            name: '日K',
            type: 'candlestick',
            data: ohlc,
            itemStyle: {{
                color: '#e53935',
                color0: '#43a047',
                borderColor: '#e53935',
                borderColor0: '#43a047'
            }},
            markLine: {{
                silent: true,
                data: [
                    {{ yAxis: priceMax, label: {{ formatter: '最高 ' + priceMax.toFixed(2), color: '#e53935', fontSize: 11 }}, lineStyle: {{ color: '#e53935', type: 'dashed', opacity: 0.5 }} }},
                    {{ yAxis: priceMin, label: {{ formatter: '最低 ' + priceMin.toFixed(2), color: '#43a047', fontSize: 11 }}, lineStyle: {{ color: '#43a047', type: 'dashed', opacity: 0.5 }} }}
                ]
            }}
        }},
        {{
            name: 'MA5',
            type: 'line',
            data: ma5,
            smooth: true,
            showSymbol: false,
            lineStyle: {{ width: 1.5, color: '#fdd835' }},
            symbol: 'none'
        }},
        {{
            name: 'MA20',
            type: 'line',
            data: ma20,
            smooth: true,
            showSymbol: false,
            lineStyle: {{ width: 1.5, color: '#7b1fa2' }},
            symbol: 'none'
        }}
    ]
}};

klineChart.setOption(klineOption);

// ========== Volume Chart ==========
const volumeChart = echarts.init(document.getElementById('volumeChart'));

const volumeOption = {{
    tooltip: {{
        trigger: 'axis',
        axisPointer: {{ type: 'shadow' }},
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: '#ddd',
        borderWidth: 1,
        textStyle: {{ color: '#333', fontSize: 12 }},
        formatter: function(params) {{
            const p = params[0];
            if (!p) return '';
            const idx = p.dataIndex;
            const dateStr = dates[idx];
            const volVal = (volumes[idx] / 10000).toFixed(1);
            const d = ohlc[idx];
            const amtVal = (d[0] * volumes[idx] / 10000).toFixed(2);
            return `${{dateStr}}<br/>成交量: <b>${{volVal}}万手</b><br/>成交额: <b>${{amtVal}}亿元</b>`;
        }}
    }},
    grid: {{
        left: '6%',
        right: '6%',
        bottom: '8%',
        top: '6%'
    }},
    xAxis: {{
        type: 'category',
        data: dates,
        axisLine: {{ show: false }},
        axisLabel: {{ show: false }},
        splitLine: {{ show: false }}
    }},
    yAxis: {{
        type: 'value',
        splitLine: {{ lineStyle: {{ color: '#f0f0f0', type: 'dashed' }} }},
        axisLabel: {{
            color: '#78909c',
            fontSize: 11,
            formatter: function(v) {{ return (v / 10000).toFixed(0) + '万'; }}
        }},
        name: '成交量(手)',
        nameTextStyle: {{ color: '#90a4ae', fontSize: 11 }}
    }},
    series: [
        {{
            name: '成交量',
            type: 'bar',
            data: volumes.map((v, i) => ({{
                value: v,
                itemStyle: {{ color: volumeColors[i] }}
            }})),
            barWidth: '60%'
        }}
    ]
}};

volumeChart.setOption(volumeOption);

// ========== Responsive ==========
window.addEventListener('resize', function() {{
    klineChart.resize();
    volumeChart.resize();
}});

// ========== Toggle Data Table ==========
function toggleTable() {{
    const el = document.getElementById('dataTable');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}}
</script>
</body>
</html>
"""

# Save HTML
html_path = "D:\\@我的电脑文件整理\\北大量化交易工作坊\\smic_kline_dashboard.html"
with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML saved to: {html_path}")
print("Done!")

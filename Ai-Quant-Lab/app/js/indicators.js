/**
 * indicators.js — 技术指标计算引擎
 * 纯函数实现，无DOM依赖，可在浏览器和Node.js中运行
 */

// ============================================================
// RSI — 相对强弱指标
// ============================================================
function computeRSI(closePrices, period = 14, overbought = 70, oversold = 30) {
  const rsi = [];
  const n = closePrices.length;

  for (let i = 0; i < n; i++) {
    if (i < period) {
      rsi.push(null);
      continue;
    }

    let gain = 0, loss = 0;
    // Wilder平滑：第一段用SMA，之后用SMMA
    if (i === period) {
      for (let j = 1; j <= period; j++) {
        const diff = closePrices[i - period + j] - closePrices[i - period + j - 1];
        if (diff > 0) gain += diff;
        else loss -= diff;
      }
      gain /= period;
      loss /= period;
    } else {
      const diff = closePrices[i] - closePrices[i - 1];
      gain = ((rsi[i - 1] === null ? 0 : (gain || 0)) * (period - 1) + (diff > 0 ? diff : 0)) / period;
      loss = ((loss || 0) * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    }

    if (loss === 0) {
      rsi.push(100);
    } else {
      const rs = gain / loss;
      rsi.push(100 - 100 / (1 + rs));
    }
  }

  return rsi;
}

// ============================================================
// MACD — 指数平滑异同移动平均线
// ============================================================
function computeMACD(closePrices, fast = 12, slow = 26, signal = 9) {
  const emaFast = computeEMA(closePrices, fast);
  const emaSlow = computeEMA(closePrices, slow);

  const macdLine = [];
  for (let i = 0; i < closePrices.length; i++) {
    if (emaFast[i] === null || emaSlow[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
  }

  const signalLine = computeEMA(macdLine, signal);
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || signalLine[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return { macdLine, signalLine, histogram, emaFast, emaSlow };
}

// ============================================================
// 布林带 — Bollinger Bands
// ============================================================
function computeBollingerBands(closePrices, period = 20, k = 2, maType = 'sma') {
  const middle = [];
  const upper = [];
  const lower = [];
  const pctB = [];
  const bandwidth = [];

  for (let i = 0; i < closePrices.length; i++) {
    if (i < period - 1) {
      middle.push(null);
      upper.push(null);
      lower.push(null);
      pctB.push(null);
      bandwidth.push(null);
      continue;
    }

    const slice = closePrices.slice(i - period + 1, i + 1);
    let avg;
    if (maType === 'ema') {
      const ema = computeEMA(slice, period);
      avg = ema[ema.length - 1];
    } else {
      avg = slice.reduce((a, b) => a + b, 0) / period;
    }

    const std = Math.sqrt(slice.reduce((sum, v) => sum + (v - avg) ** 2, 0) / period);
    const up = avg + k * std;
    const low = avg - k * std;

    middle.push(avg);
    upper.push(up);
    lower.push(low);
    bandwidth.push(avg !== 0 ? ((up - low) / avg * 100) : 0);
    pctB.push(up !== low ? ((closePrices[i] - low) / (up - low)) : 0.5);
  }

  return { middle, upper, lower, pctB, bandwidth };
}

// ============================================================
// ATR — 平均真实波幅
// ============================================================
function computeATR(highPrices, lowPrices, closePrices, period = 14, smooth = 'sma') {
  const tr = [];
  const atr = [];

  for (let i = 0; i < closePrices.length; i++) {
    if (i === 0) {
      tr.push(highPrices[i] - lowPrices[i]);
    } else {
      const hl = highPrices[i] - lowPrices[i];
      const hc = Math.abs(highPrices[i] - closePrices[i - 1]);
      const lc = Math.abs(lowPrices[i] - closePrices[i - 1]);
      tr.push(Math.max(hl, hc, lc));
    }
  }

  for (let i = 0; i < tr.length; i++) {
    if (i < period) {
      atr.push(null);
    } else if (i === period) {
      const sum = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
      atr.push(sum / period);
    } else {
      if (smooth === 'ema') {
        atr.push((atr[i - 1] * (period - 1) + tr[i]) / period);
      } else {
        const slice = tr.slice(i - period + 1, i + 1);
        atr.push(slice.reduce((a, b) => a + b, 0) / period);
      }
    }
  }

  return { tr, atr };
}

// ============================================================
// 工具函数: EMA 计算
// ============================================================
function computeEMA(data, period) {
  const result = [];
  let multiplier = 2 / (period + 1);

  for (let i = 0; i < data.length; i++) {
    if (data[i] === null) {
      result.push(null);
      continue;
    }
    if (i < period) {
      // 前 period-1 个用 SMA 填充，第 period 个开始 EMA
      if (i === period - 1) {
        let sum = 0;
        for (let j = 0; j < period; j++) {
          sum += (data[j] !== null ? data[j] : 0);
        }
        result.push(sum / period);
      } else {
        result.push(null);
      }
    } else {
      result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }

  return result;
}

// ============================================================
// 工具函数: SMA 计算
// ============================================================
function computeSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

// ============================================================
// 股票数据 (预加载 7 只 A 股 / 港股, 供所有看板使用)
// ============================================================
const STOCKS_DATA = (function() {
  function genPrice(base, days, volatility) {
    const data = [];
    let price = base;
    let d = new Date('2025-07-03');
    for (let i = 0; i < days; i++) {
      d = new Date(d.getTime() + 86400000);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const trend = Math.sin(i / days * Math.PI * 1.5) * base * 0.3;
      const noise = (Math.random() - 0.5) * base * volatility;
      const open = Math.round((price + noise) * 100) / 100;
      const range = base * volatility * (0.5 + Math.random());
      const high = Math.round((open + range * (0.6 + Math.random() * 0.4)) * 100) / 100;
      const low = Math.round((open - range * (0.3 + Math.random() * 0.3)) * 100) / 100;
      const close = Math.round((low + (high - low) * (0.2 + Math.random() * 0.6)) * 100) / 100;
      const vol = Math.round((1000000 + Math.random() * 50000000) * (1 + range / base));
      data.push({date: formatDate(d), open, high, low, close, vol});
      price = close + trend * 0.01;
    }
    return data;
  }
  function formatDate(d) {
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+day;
  }
  return {
    '688981.SH': { name:'中芯国际', market:'科创板', data: genPrice(88, 380, 0.035) },
    '000725.SZ': { name:'京东方A', market:'深市', data: genPrice(4, 380, 0.04) },
    '002594.SZ': { name:'比亚迪', market:'深市', data: genPrice(280, 380, 0.038) },
    '600900.SH': { name:'长江电力', market:'沪市', data: genPrice(28, 380, 0.025) },
    '600519.SH': { name:'贵州茅台', market:'沪市', data: genPrice(1500, 380, 0.03) },
    '00700.HK': { name:'腾讯控股', market:'港股', data: genPrice(380, 380, 0.035) },
    '00981.HK': { name:'中芯国际(港)', market:'港股', data: genPrice(45, 380, 0.045) },
  };
})();

/**
 * turtle.js — 海龟交易法则回测引擎
 * 
 * 核心规则:
 *   - 入场: 价格突破 N 日高点 → 做多; 跌破 N 日低点 → 做空
 *   - 离场: 价格反向突破 M 日低点 (多单) / M 日高点 (空单)
 *   - 头寸: 1 unit = 1% × 账户 / (ATR × 每点价值)  (假设每点价值=1)
 *   - 加仓: 每上涨 0.5×ATR 加 1 unit, 最多 4 units
 *   - 止损: 入场价 ± 2×ATR
 *   - 手续费: 万三 | 滑点: 万一
 * ============================================================
 */

function runTurtleBacktest(data, entryPeriod, exitPeriod, atrPeriod, 
                           commission = 0.0003, slippage = 0.0001) {
  if (!data || data.length < Math.max(entryPeriod, exitPeriod, atrPeriod) + 20) {
    return null;
  }

  const close = data.map(d => d.close);
  const high = data.map(d => d.high);
  const low = data.map(d => d.low);
  const dates = data.map(d => d.date);
  const n = data.length;

  // 1. 计算 ATR(N)
  const atrResult = computeATR(high, low, close, atrPeriod, 'sma');
  const N = atrResult.atr;  // N = ATR, 核心波动率单位

  // 2. 计算 N 日最高/最低 (用于入场)
  const highest = [];
  const lowest = [];
  for (let i = 0; i < n; i++) {
    if (i < entryPeriod - 1) {
      highest.push(null);
      lowest.push(null);
      continue;
    }
    let h = -Infinity, l = Infinity;
    for (let j = i - entryPeriod + 1; j <= i; j++) {
      if (high[j] > h) h = high[j];
      if (low[j] < l) l = low[j];
    }
    highest.push(h);
    lowest.push(l);
  }

  // 3. 计算 M 日最高/最低 (用于离场, exitPeriod)
  const exitHigh = [];
  const exitLow = [];
  for (let i = 0; i < n; i++) {
    if (i < exitPeriod - 1) {
      exitHigh.push(null);
      exitLow.push(null);
      continue;
    }
    let h = -Infinity, l = Infinity;
    for (let j = i - exitPeriod + 1; j <= i; j++) {
      if (high[j] > h) h = high[j];
      if (low[j] < l) l = low[j];
    }
    exitHigh.push(h);
    exitLow.push(l);
  }

  // 4. 回测模拟
  let cash = 1000000;
  let positions = [];  // [{entryPrice, entryN, units, dir: 1| -1}]
  let tradeCount = 0;
  let winCount = 0;
  let totalCommission = 0;
  let totalSlippage = 0;
  const trades = [];
  const equity = [];

  for (let i = 0; i < n; i++) {
    if (i < entryPeriod || i < exitPeriod || i < atrPeriod) {
      equity.push(cash);
      continue;
    }
    const curN = N[i];
    if (curN === null || curN <= 0) { equity.push(cash + calcPositionValue(positions, close[i])); continue; }

    const px = close[i];
    const buySlipPx = px * (1 + slippage);
    const sellSlipPx = px * (1 - slippage);
    const totalLong = positions.filter(p => p.dir === 1).length;

    // === 做多信号: 价格突破 entryPeriod 日高点 ===
    const shouldLong = px > highest[i - 1] && px <= highest[i];
    // === 做空信号: 价格跌破 entryPeriod 日低点 ===
    const shouldShort = px < lowest[i - 1] && px >= lowest[i];

    // === 离场: 多单在价格跌破 exitPeriod 低点离场 ===
    const shouldExitLong = px < exitLow[i - 1] && px >= exitLow[i];
    // === 离场: 空单在价格突破 exitPeriod 高点离场 ===
    const shouldExitShort = px > exitHigh[i - 1] && px <= exitHigh[i];

    // --- 离场优先 ---
    // 平多
    if (shouldExitLong) {
      const toClose = positions.filter(p => p.dir === 1);
      for (const pos of toClose) {
        const revenue = pos.units * sellSlipPx;
        const fee = revenue * commission;
        const profit = revenue - fee - pos.units * pos.entryPrice;
        if (profit > 0) winCount++;
        cash += revenue - fee;
        totalCommission += fee;
        totalSlippage += pos.units * px * slippage;
        tradeCount++;
        trades.push({
          date: dates[i], type: '平多', price: sellSlipPx, units: pos.units,
          profit, profitPct: (profit / (pos.units * pos.entryPrice)) * 100, fee, cash
        });
      }
      positions = positions.filter(p => p.dir !== 1);
    }

    // 平空
    if (shouldExitShort) {
      const toClose = positions.filter(p => p.dir === -1);
      for (const pos of toClose) {
        const buyback = pos.units * buySlipPx;
        const fee = buyback * commission;
        const profit = (pos.units * pos.entryPrice) - buyback - fee;
        if (profit > 0) winCount++;
        cash -= (buyback + fee);
        totalCommission += fee;
        totalSlippage += pos.units * px * slippage;
        tradeCount++;
        trades.push({
          date: dates[i], type: '平空', price: buySlipPx, units: pos.units,
          profit, profitPct: (profit / (pos.units * pos.entryPrice)) * 100, fee, cash
        });
      }
      positions = positions.filter(p => p.dir !== -1);
    }

    // --- 止损检查 ---
    const toRemove = [];
    for (let pi = 0; pi < positions.length; pi++) {
      const pos = positions[pi];
      const stopDist = 2 * pos.entryN;
      const stopHit = pos.dir === 1 ? (px < pos.entryPrice - stopDist) : (px > pos.entryPrice + stopDist);
      if (stopHit) {
        const exitPx = pos.dir === 1 ? sellSlipPx : buySlipPx;
        const revenue = pos.units * exitPx;
        const fee = revenue * commission;
        const profit = pos.dir === 1
          ? (revenue - fee - pos.units * pos.entryPrice)
          : (pos.units * pos.entryPrice - revenue - fee);
        if (profit > 0) winCount++;
        cash += (pos.dir === 1) ? (revenue - fee) : (-revenue - fee);
        totalCommission += fee;
        totalSlippage += pos.units * px * slippage;
        tradeCount++;
        trades.push({
          date: dates[i], type: '止损' + (pos.dir === 1 ? '多' : '空'), price: exitPx,
          units: pos.units, profit, profitPct: (profit / (pos.units * pos.entryPrice)) * 100,
          fee, cash
        });
        toRemove.push(pi);
      }
    }
    positions = positions.filter((_, idx) => !toRemove.includes(idx));

    // --- 入场 ---
    if (shouldLong) {
      const unitSize = Math.max(1, Math.floor((cash * 0.01) / curN));
      if (unitSize > 0 && totalLong < 4) {
        const cost = unitSize * buySlipPx;
        const fee = cost * commission;
        cash -= (cost + fee);
        totalCommission += fee;
        totalSlippage += unitSize * px * slippage;
        tradeCount++;
        positions.push({ entryPrice: buySlipPx, entryN: curN, units: unitSize, dir: 1, addLevel: 1 });
        trades.push({ date: dates[i], type: '开多', price: buySlipPx, units: unitSize, profit: '-', fee, cash });
      }
    }

    if (shouldShort) {
      const unitSize = Math.max(1, Math.floor((cash * 0.01) / curN));
      if (unitSize > 0 && positions.filter(p => p.dir === -1).length < 4) {
        const deposit = unitSize * buySlipPx;  // 保证金
        const fee = deposit * commission;
        cash -= fee;
        totalCommission += fee;
        totalSlippage += unitSize * px * slippage;
        tradeCount++;
        positions.push({ entryPrice: sellSlipPx, entryN: curN, units: unitSize, dir: -1, addLevel: 1 });
        trades.push({ date: dates[i], type: '开空', price: sellSlipPx, units: unitSize, profit: '-', fee, cash });
      }
    }

    // --- 加仓 (金字塔) ---
    const longs = positions.filter(p => p.dir === 1);
    if (longs.length > 0 && longs.length < 4) {
      const lastLong = longs[longs.length - 1];
      const addPrice = lastLong.entryPrice + 0.5 * lastLong.entryN;
      if (px >= addPrice && px < addPrice * 1.01) {
        const unitSize = Math.max(1, Math.floor((cash * 0.01) / curN));
        if (unitSize > 0) {
          const cost = unitSize * buySlipPx;
          const fee = cost * commission;
          cash -= (cost + fee);
          totalCommission += fee;
          tradeCount++;
          positions.push({ entryPrice: buySlipPx, entryN: curN, units: unitSize, dir: 1, addLevel: longs.length + 1 });
          trades.push({ date: dates[i], type: `加仓+${longs.length + 1}`, price: buySlipPx, units: unitSize, profit: '-', fee, cash });
        }
      }
    }

    const shorts = positions.filter(p => p.dir === -1);
    if (shorts.length > 0 && shorts.length < 4) {
      const lastShort = shorts[shorts.length - 1];
      const addPrice = lastShort.entryPrice - 0.5 * lastShort.entryN;
      if (px <= addPrice && px > addPrice * 0.99) {
        const unitSize = Math.max(1, Math.floor((cash * 0.01) / curN));
        if (unitSize > 0) {
          const fee = unitSize * buySlipPx * commission;
          cash -= fee;
          totalCommission += fee;
          tradeCount++;
          positions.push({ entryPrice: sellSlipPx, entryN: curN, units: unitSize, dir: -1, addLevel: shorts.length + 1 });
          trades.push({ date: dates[i], type: `加空-${shorts.length + 1}`, price: sellSlipPx, units: unitSize, profit: '-', fee, cash });
        }
      }
    }

    // 记录每日资产
    const posValue = positions.reduce((sum, p) => sum + p.units * (p.dir === 1 ? px : (2 * p.entryPrice - px)), 0);
    equity.push(cash + posValue);
  }

  // 最后强制平仓
  const lastIdx = n - 1;
  for (const pos of positions) {
    const exitPx = pos.dir === 1 ? (close[lastIdx] * (1 - slippage)) : (close[lastIdx] * (1 + slippage));
    const revenue = pos.units * exitPx;
    const fee = revenue * commission;
    const profit = pos.dir === 1
      ? (revenue - fee - pos.units * pos.entryPrice)
      : (pos.units * pos.entryPrice - revenue - fee);
    if (profit > 0) winCount++;
    cash += (pos.dir === 1) ? (revenue - fee) : (-revenue - fee);
    totalCommission += fee;
    tradeCount++;
    trades.push({ date: dates[lastIdx], type: '强平' + (pos.dir === 1 ? '多' : '空'), price: exitPx,
      units: pos.units, profit, profitPct: (profit / (pos.units * pos.entryPrice)) * 100, fee, cash });
  }
  positions = [];
  equity[lastIdx] = cash;

  // 计算绩效指标
  const initialCapital = 1000000;
  const finalEquity = equity[equity.length - 1];
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;
  const firstClose = close.find(c => c > 0);
  const lastClose = close[close.length - 1];
  const buyHoldReturn = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;
  const years = data.length / 252;
  const annualReturn = years > 0 ? ((1 + totalReturn / 100) ** (1 / years) - 1) * 100 : 0;

  let peak = equity[0];
  let maxDrawdown = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) peak = equity[i];
    const drawdown = (peak - equity[i]) / peak * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const closedPnL = trades.filter(t => t.profit !== '-');
  const wins = closedPnL.filter(t => t.profit > 0).length;
  const winRate = closedPnL.length > 0 ? (wins / closedPnL.length) * 100 : 0;

  const dailyReturns = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i] - equity[i-1]) / equity[i-1]);
  }
  const avgR = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdR = Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - avgR) ** 2, 0) / dailyReturns.length);
  const sharpe = stdR > 0 ? Math.sqrt(252) * (avgR - 0.02/252) / stdR : 0;

  return {
    summary: {
      initialCapital, finalEquity: Math.round(finalEquity),
      totalReturn: totalReturn.toFixed(2),
      annualReturn: annualReturn.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      winRate: winRate.toFixed(1),
      tradeCount: Math.round(tradeCount / 2),
      sharpe: sharpe.toFixed(2),
      totalCommission: Math.round(totalCommission),
      totalSlippage: Math.round(totalSlippage),
      buyHoldReturn: buyHoldReturn.toFixed(2),
    },
    equity, trades, dates,
    extra: { close, N, highest, lowest },
  };
}

function calcPositionValue(positions, price) {
  return positions.reduce((sum, p) => sum + p.units * (p.dir === 1 ? price : (2 * p.entryPrice - price)), 0);
}

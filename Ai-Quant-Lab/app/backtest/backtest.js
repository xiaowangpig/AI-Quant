/**
 * backtest.js — 双均线策略回测引擎
 * 手续费: 万三 (0.03%) | 滑点: 万一 (0.01%)
 */

function runBacktest(data, fastPeriod, slowPeriod, commission = 0.0003, slippage = 0.0001) {
  if (!data || data.length < Math.max(fastPeriod, slowPeriod) + 10) {
    return null;
  }

  const close = data.map(d => d.close);
  const dates = data.map(d => d.date);

  // 1. 计算快慢均线
  const fastMA = computeSMA(close, fastPeriod);
  const slowMA = computeSMA(close, slowPeriod);

  // 2. 检测交叉信号
  const signals = []; // 'buy', 'sell', null
  for (let i = 0; i < close.length; i++) {
    if (i < 1 || fastMA[i] === null || fastMA[i-1] === null || slowMA[i] === null || slowMA[i-1] === null) {
      signals.push(null);
      continue;
    }
    // 金叉: fast 上穿 slow
    if (fastMA[i-1] <= slowMA[i-1] && fastMA[i] > slowMA[i]) {
      signals.push('buy');
    }
    // 死叉: fast 下穿 slow
    else if (fastMA[i-1] >= slowMA[i-1] && fastMA[i] < slowMA[i]) {
      signals.push('sell');
    } else {
      signals.push(null);
    }
  }

  // 3. 回测模拟
  let cash = 1000000;          // 初始资金 100万
  let shares = 0;
  let tradeCount = 0;
  let winCount = 0;
  let totalCommission = 0;
  let totalSlippage = 0;
  let entryPrice = 0;
  let trades = [];             // 交易记录
  const equity = [];           // 每日总资产
  const balance = [];          // 每日现金+持仓市值

  for (let i = 0; i < close.length; i++) {
    const sig = signals[i];
    const price = close[i];
    const buyPrice = price * (1 + slippage);   // 买入: 滑点使价格更高
    const sellPrice = price * (1 - slippage);   // 卖出: 滑点使价格更低

    // 买入信号 & 有现金
    if (sig === 'buy' && cash > 0) {
      const cost = cash * 0.99;  // 留1%现金避免无法凑整
      const fee = cost * commission;
      const actualCost = cost + fee;
      if (actualCost < cash) {
        shares = Math.floor(cost / buyPrice);
        const totalCost = shares * buyPrice;
        const tradeFee = totalCost * commission;
        cash = cash - totalCost - tradeFee;
        totalCommission += tradeFee;
        totalSlippage += totalCost * slippage;
        entryPrice = buyPrice;
        tradeCount++;
        trades.push({
          date: dates[i],
          type: 'buy',
          price: buyPrice,
          shares,
          cash: cash,
          fee: tradeFee,
        });
      }
    }

    // 卖出信号 & 有持仓
    if (sig === 'sell' && shares > 0) {
      const revenue = shares * sellPrice;
      const tradeFee = revenue * commission;
      const netRevenue = revenue - tradeFee;
      const profit = netRevenue - (shares * entryPrice);
      if (profit > 0) winCount++;
      cash = cash + netRevenue;
      totalCommission += tradeFee;
      totalSlippage += revenue * slippage;
      tradeCount++;
      trades.push({
        date: dates[i],
        type: 'sell',
        price: sellPrice,
        shares,
        cash: cash,
        profit: profit,
        profitPct: (profit / (shares * entryPrice)) * 100,
        fee: tradeFee,
      });
      shares = 0;
    }

    // 记录每日总资产
    const positionValue = shares > 0 ? shares * close[i] : 0;
    const totalValue = cash + positionValue;
    equity.push(totalValue);
    balance.push({ date: dates[i], totalValue, cash, shares });
  }

  // 最后强制平仓
  if (shares > 0) {
    const lastIdx = close.length - 1;
    const price = close[lastIdx] * (1 - slippage);
    const revenue = shares * price;
    const tradeFee = revenue * commission;
    cash = cash + revenue - tradeFee;
    totalCommission += tradeFee;
    totalSlippage += revenue * slippage;
    tradeCount++;
    trades.push({
      date: dates[lastIdx],
      type: 'close',
      price,
      shares,
      cash,
      fee: tradeFee,
    });
    shares = 0;
    equity[lastIdx] = cash;
  }

  // 4. 计算指标
  const initialCapital = 1000000;
  const finalEquity = equity[equity.length - 1];
  const totalReturn = ((finalEquity - initialCapital) / initialCapital) * 100;

  // Buy & hold return (benchmark)
  const firstClose = close.find(c => c > 0);
  const lastClose = close[close.length - 1];
  const buyHoldReturn = firstClose ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  // 年化收益 (按252个交易日)
  const years = (data.length) / 252;
  const annualReturn = years > 0 ? ((1 + totalReturn / 100) ** (1 / years) - 1) * 100 : 0;

  // 最大回撤
  let peak = equity[0];
  let maxDrawdown = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) peak = equity[i];
    const drawdown = (peak - equity[i]) / peak * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  // 胜率
  const closedTrades = trades.filter(t => t.type === 'sell' || t.type === 'close');
  const wins = closedTrades.filter(t => t.profit > 0).length;
  const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

  // Sharpe ratio (简化: 假设无风险利率=2%)
  const dailyReturns = [];
  for (let i = 1; i < equity.length; i++) {
    dailyReturns.push((equity[i] - equity[i-1]) / equity[i-1]);
  }
  const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdReturn = Math.sqrt(dailyReturns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / dailyReturns.length);
  const riskFree = 0.02 / 252;
  const sharpe = stdReturn > 0 ? Math.sqrt(252) * (avgReturn - riskFree) / stdReturn : 0;

  return {
    summary: {
      initialCapital,
      finalEquity: Math.round(finalEquity),
      totalReturn: totalReturn.toFixed(2),
      annualReturn: annualReturn.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      winRate: winRate.toFixed(1),
      tradeCount,
      sharpe: sharpe.toFixed(2),
      totalCommission: Math.round(totalCommission),
      totalSlippage: Math.round(totalSlippage),
      buyHoldReturn: buyHoldReturn.toFixed(2),
    },
    equity,            // 每日总资产曲线
    trades,            // 交易记录
    signals,           // 原始信号
    params: { fastPeriod, slowPeriod, commission: '万三', slippage: '万一' },
    extra: {
      fastMA,
      slowMA,
      dates,
      close,
    },
  };
}

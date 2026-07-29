# strategies/__init__.py — Strategy Registry

from strategies.ema_crossover import EMACrossoverStrategy
from strategies.rsi import RSIStrategy
from strategies.macd import MACDStrategy
from strategies.bollinger import BollingerStrategy
from strategies.breakout import BreakoutStrategy
from strategies.support_resistance import SupportResistanceStrategy
from strategies.trend_pullback import TrendPullbackStrategy

# Registry: name → class
STRATEGY_REGISTRY = {
    "ema_crossover":       EMACrossoverStrategy,
    "rsi":                 RSIStrategy,
    "macd":                MACDStrategy,
    "bollinger":           BollingerStrategy,
    "breakout":            BreakoutStrategy,
    "support_resistance":  SupportResistanceStrategy,
    "trend_pullback":      TrendPullbackStrategy,
}


def get_strategy(name: str, params: dict = None):
    """Instantiate a strategy by name."""
    name = name.lower()
    if name not in STRATEGY_REGISTRY:
        raise ValueError(
            f"Unknown strategy '{name}'. "
            f"Available: {list(STRATEGY_REGISTRY.keys())}"
        )
    return STRATEGY_REGISTRY[name](params=params)


def all_strategies(params_override: dict = None):
    """Return all strategy instances for a full sweep."""
    return [cls(params=params_override) for cls in STRATEGY_REGISTRY.values()]

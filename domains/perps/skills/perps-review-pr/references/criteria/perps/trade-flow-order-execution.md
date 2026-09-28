# Trade Flow & Order Execution

- **Signed bounds collapsed into magnitudes**: A gain-side and loss-side RoE are different inputs. Preserve direction through clamps and conversions; test long and short positions at the accepted boundary, not only typical positive values.

Order submission runs the shared pre-trade checks, carries the user's slippage, and refreshes state after confirmation.

- **Pre-trade checks missing** — submitting trade without verifying: sufficient balance, market open, position limit, leverage within bounds, slippage tolerance set.
- **Post-trade state not refreshed** — after trade confirmation, not triggering refresh of balances, positions, orders. User sees stale data until next WS tick.
- **Missing slippage in order params** — creating order without slippage tolerance, or hardcoding slippage instead of user preference.

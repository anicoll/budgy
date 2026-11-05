# @budgy/engine

The calculation code behind the public tools. Pure TypeScript: no UI, no I/O, money in integer cents.

- `money/cents`: the `Cents` type and helpers
- `dates`: calendar helpers on ISO date strings, in UTC
- `mortgage/simulate`: **lender-style simulation for the mortgage what-if tool**. Daily interest charged monthly, repayments on real dates, both fortnightly methods (half of monthly, or true fortnightly), rate changes that recalculate the minimum, offset with monthly deposits, one-off and yearly lump sums
- `mortgage/scenarios`: run scenarios against a base loan, compare them, and solve the extra repayment needed to finish by a date
- `mortgage/refinance`: **the refinance check**. Runs the current and new loan side by side from the switch date and tracks how far ahead switching leaves you each month (interest and fees saved, less costs and cashback), the break-even date, and the lifetime result. Handles costs added to the loan, intro rates that revert, and keeping the same repayment or dropping to the new minimum
- `mortgage/fixed`: **fixed or variable**. Runs the loan all variable along a rate path, and as a split (any share fixed for a set period, then reverting to the path plus a margin), and compares interest month by month. Also the flat variable rate at which fixing breaks even over the fixed period, a ballpark break cost, and preset rate paths
- `mortgage/amortise`, `inverse`, `split`: the original budgy code, copied unchanged from the original app (see the repo README). `split` (co-borrowers) will move onto the simulation later

```bash
pnpm --filter @budgy/engine test
```

# @budgy/engine

The calculation code behind the public tools. Pure TypeScript: no UI, no I/O, money in integer cents.

- `money/cents`: the `Cents` type and helpers
- `mortgage/`: amortisation with offset, extra repayments and redraw; inverse repayment (repayment to loan size); split loans between several parties

The mortgage code is copied unchanged from `deprecated/budgy-v1`. The gaps listed in the mortgage what-if spec (daily interest, real calendar dates, rate changes, offset deposits, lump sums on any loan, both fortnightly methods) are closed in follow-up PRs, test first.

```bash
pnpm --filter @budgy/engine test
```

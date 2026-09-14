# Demo approval to walkthrough — local fix

September 12, 2026

Approving a sample purchase on the released site did not show the walkthrough suggestion or record demo use. Visitors who used this path could be missed by campaign measurement.

The fix moves the existing demo-use event into the sample change audit, after the check for an actual change. Approval, receiving and other applied sample changes now use the same event as stock edits. The existing backend deduplicates each visitor/event pair. The existing chat event and dismissal behavior remain in place.

## Scope

- Isolated worktree: `/Users/facundo/.codex/worktrees/marketing-demo-engagement/buyer`
- Branch: `codex/marketing-demo-engagement`
- Commit: `59277a1`
- Base: marketing release `68718f1c75ef1ed04d675c93949e3dbf81af257d`
- Changed file: `src/components/desk/demo.tsx`; one event dispatch moved.
- Deployment target, if approved: BUY HARD production frontend, `buyhard.app`, using `reliable-albatross-463`. No backend change is required.
- Status: committed locally; not pushed, merged or deployed. Shared checkout changes were preserved.

## Verification

- Reproduced the missing suggestion after a direct sample approval on the released site.
- In-app browser: local sample approval shows the walkthrough suggestion and preserves the QA campaign tags in its link.
- In-app browser at 390 × 844: no horizontal overflow; the suggestion and its dismiss control are accessible. Dismissal remains respected after sample receipt.
- The released analytics backend recorded one QA visit and one demo-use event across approval and receiving. Both use `utm_source=launch-check`, excluded from campaign results. [Readback](2026-09-12-demo-use-proof.json).
- Typecheck, production build, focused lint and both marketing attribution tests passed. `git diff --check` passed.

All purchasing checks used the explicitly labeled in-memory sample. No supplier was contacted and no real order, inquiry or booking was submitted. Early local tracking attempts pointed at the development backend, which lacks the marketing endpoint; restarting the local server with the explicit production public URL resolved that test configuration issue. The final readback above is the successful check.

After deployment, repeat the direct sample approval and verify the prompt and excluded QA event before claiming the released site has this improvement.

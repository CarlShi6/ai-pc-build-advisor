#!/usr/bin/env bash
# Usage: run_pass.sh <workDir> <passId> [--no-generate]
# Generate → render → Tier 1 (+advisory IoU) → multi-angle → pass gate → comparison sheet.
# The review decision (append_review) is made separately after inspecting the sheet.
set -u
export PYTHONIOENCODING=utf-8
WORK="$1"; PASS="$2"; GEN="${3:-}"
PY="$LOCALAPPDATA/Programs/Python/Python312/python.exe"
K=~/.claude/skills/img2threejs
H="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$H/../../.." && pwd)"
cd "$WORK" || exit 1
export EXPOSURE="${EXPOSURE:-1}"
REF="${REF:-reference.jpg}"
mark() { "$PY" "$K/forge/state.py" mark "$1" --state .img2threejs/state.json --evidence "$2" >/dev/null 2>&1 || echo "  (state mark $1 skipped/out of order)"; }
if [ "$GEN" != "--no-generate" ]; then
  "$PY" "$H/i2t.py" gen object-sculpt-spec.json --out src/createObjectModel.ts --pass-id "$PASS" --force >gen.log 2>&1 || { echo "GENERATE FAILED"; tail -5 gen.log; exit 1; }
  mark build-current-pass src/createObjectModel.ts
fi
( cd "$REPO" && BG="#8a9096" FOV=8 FILL=${FIXED_FILL:-0.78} node "$H/render.cjs" "$REPO" "$WORK" "$PASS-fixed" front >/dev/null 2>&1 \
  && UNLIT=1 SHADOWS=off BG="#8a9096" FOV=8 FILL=${FIXED_FILL:-0.78} node "$H/render.cjs" "$REPO" "$WORK" "$PASS-unlit" front >/dev/null 2>&1 \
  && BG="#8a9096" FOV=30 node "$H/render.cjs" "$REPO" "$WORK" "$PASS" orbit side rear >/dev/null 2>&1 ) || { echo "RENDER FAILED"; exit 1; }
mark render-capture "renders/$PASS-fixed-front.png"
mark review-contract-read "$K/grimoire/review/gates_reference.md"
"$PY" "$K/forge/stage4_review/diagnose_render.py" --reference "$REF" --render "renders/$PASS-fixed-front.png" --map-stripped-render "renders/$PASS-unlit-front.png" --json > tier1.json 2>/dev/null
"$PY" "$K/forge/stage4_review/divine_eye.py" --reference "$REF" --render "renders/$PASS-fixed-front.png" --json > eye.json 2>/dev/null
"$PY" -I "$H/advisory_tier1.py" object-sculpt-spec.json tier1.json eye.json "$PASS" || exit 1
mark tier1-diagnostics tier1.json
"$PY" "$K/forge/stage4_review/diagnose_render_multi_angle.py" --reference "renders/$PASS-fixed-front.png" --orbit "renders/$PASS-orbit.png" --orbit "renders/$PASS-side.png" --json > multi.json 2>/dev/null
"$PY" -c "import json;d=json.load(open('multi.json'));print('MULTI', {k:d.get(k) for k in ('status','degenerateViews','passed') if k in d} or str(d)[:200])"
mark multi-angle-review multi.json
"$PY" "$H/i2t.py" orch check object-sculpt-spec.json --pass-id "$PASS" 2>&1 | tail -1
mark pass-gate-check object-sculpt-spec.json
"$PY" "$K/forge/stage4_review/make_comparison_sheet.py" --reference "$REF" --render "renders/$PASS-fixed-front.png" --out "renders/$PASS-cmp.png" >/dev/null 2>&1 && echo "SHEET renders/$PASS-cmp.png"

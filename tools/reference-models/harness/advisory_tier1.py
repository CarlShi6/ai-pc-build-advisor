"""Record a Tier 1 result where silhouette IoU is advisory (user decision, Option A, 2026-10-25).

Only applies when IoU is the ONLY failure and Divine Eye objectness >= 0.48 (its own
"same object" threshold). Any other failure leaves the pass blocked.
Usage: python advisory_tier1.py <spec> <tier1.json> <eye.json> <pass-id>
"""
import json
import sys

spec_path, tier1_path, eye_path, pass_id = sys.argv[1:5]
spec = json.load(open(spec_path, encoding="utf-8"))
tier1 = json.load(open(tier1_path, encoding="utf-8"))
eye = json.load(open(eye_path, encoding="utf-8"))
failures = tier1.get("failures", [])
other = [f for f in failures if "silhouette IoU" not in f]
objectness = (eye.get("signals") or {}).get("objectness")
if other:
    print("BLOCKED: non-IoU Tier 1 failures:", other)
    sys.exit(1)
if failures and not (isinstance(objectness, (int, float)) and objectness >= 0.48):
    print("BLOCKED: IoU failed and objectness", objectness, "< 0.48")
    sys.exit(1)
record = dict(tier1)
record["passId"] = pass_id
record["passed"] = True
if failures:
    record["advisoryGates"] = {
        "silhouetteIoU": {
            "value": tier1["checks"]["silhouetteIoU"],
            "reason": "white-on-white manufacturer reference; IoU advisory by user decision 2026-10-25 (Option A)",
            "evidence": {
                "objectness": objectness,
                "phashSimilarity": (eye.get("signals") or {}).get("phashSimilarity"),
                "reconstructionModeSuspected": eye.get("reconstructionModeSuspected"),
            },
        }
    }
    record["failures"] = []
record["gatesStillEnforced"] = ["aspectRatioDelta", "scaleDelta", "bilateralSymmetryError", "map-stripped evidence"]
spec.setdefault("tier1Results", []).append(record)
json.dump(spec, open(spec_path, "w", encoding="utf-8"), indent=2)
print("RECORDED", pass_id, tier1["checks"], "objectness", objectness)

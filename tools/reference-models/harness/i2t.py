"""Run the img2threejs generator / pass orchestrator with one documented deviation.

img2threejs v2.0.0's spec validator (validate_sculpt_spec.validate_look_dev_targets) skips the
texture-channel bar for a material whose `textureless` declaration is present and evidence-backed
(validate_textureless hard-checks it). The pass orchestrator's quality_first_material_gaps does
not apply the same skip, so a flat factory-finish material can never clear material-pass without
fabricating texture numbers. This wrapper applies the validator's own rule in the orchestrator and
nothing else. The installed skill is not modified.

Usage: python i2t.py gen <generate_threejs_factory args...>
       python i2t.py orch <orchestrate_passes args...>
"""
import sys
from pathlib import Path

FORGE = Path.home() / ".claude" / "skills" / "img2threejs" / "forge"
sys.path[:0] = [str(FORGE / "stage3_build"), str(FORGE / "stage2_spec"), str(FORGE)]

import orchestrate_passes  # noqa: E402
from validate_sculpt_spec import is_textureless  # noqa: E402

_original = orchestrate_passes.quality_first_material_gaps


def _gaps(spec, material):
    if is_textureless(material):
        return []
    return _original(spec, material)


orchestrate_passes.quality_first_material_gaps = _gaps

tool, args = sys.argv[1], sys.argv[2:]
if tool == "gen":
    import generate_threejs_factory  # noqa: E402

    raise SystemExit(generate_threejs_factory.main(args))
raise SystemExit(orchestrate_passes.main(args))

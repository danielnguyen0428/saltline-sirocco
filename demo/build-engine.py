from pathlib import Path
import hashlib
root = Path(__file__).resolve().parent
source = (root.parent / "evidence/game.bundle.js").read_text()
assert hashlib.sha256(source.encode()).hexdigest() == "8d0057dc4d6dac77e20be2ef1f2b623e19346b5803fde1b3dbabbab508d75d9d"
needle = "QC().catch(i=>bM(i&&i.stack||i));"
assert source.count(needle) == 1
exports = "window.SaltlineEngine={THREE:lt,createMaterials:Gg,createProps:Yg,createPhysics:d3,createInput:v_,createPlayer:x_,createAudio:c_,synthesize:r_,synthesizeSteps:a_,audioDefinitions:Go,createEvents:Dy,createRng:il,world:oi,playerConfig:Pi,playerTuning:Mt,beveledBox:p3,roundedBox:Wi,valueNoise3:gn,mergeStatic:By,mergeGeometries:Ii,createRenderer:Hg,qualityPresets:Pr,sunSettings:Mn,skySettings:en,createCombatFX:Cf,RigBuilder:iu,createRig:pm,createWeaponHand:Vv,createMuzzleFlash:N_,applyWeaponDetail:Bf,weaponRain:Wv,stepSpring:ma};"
(root / "saltline-engine.js").write_text(source.replace(needle, exports))
print("PASS: generated engine from verified original; only bootstrap call replaced")

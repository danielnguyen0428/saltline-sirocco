// Observe Saltline's real pass graph and bind its startup-only tuning values.
export function createRenderDiagnostics(g) {
  const T=g.THREE, renderer=g.renderer, originalRender=renderer.render.bind(renderer);
  const bindings={
    'post-ao':{uRadius:'aoRadius',uIntensity:'aoIntensity'},
    'post-vol':{uSigma:'volSigma',uFarHaze:'volFarHaze',uMaxDist:'volMaxDist'},
    'post-composite':{uAoStrength:'aoStrength'},
    'post-up':{uMix:'bloomMix'},
  };
  const targets=new Map(), outputs=new Map();let passes=[],enabled=true,collecting=false,debugPass='final';
  renderer.render=(object,camera)=>{
    const material=object.material,tune=g.render.tune;
    for(const [uniform,key] of Object.entries(bindings[material?.name]||{}))
      if(Number.isFinite(tune[key]))material.uniforms[uniform].value=tune[key];
    if(material?.name==='post-grade'){
      const power=tune.lookPower.toFixed(3),saturation=tune.lookSat.toFixed(3);
      if(material.defines.LOOK_POWER!==power||material.defines.LOOK_SAT!==saturation){
        material.defines.LOOK_POWER=power;material.defines.LOOK_SAT=saturation;material.needsUpdate=true;
      }
    }
    if(enabled&&collecting){
      const target=renderer.getRenderTarget();
      const name=object.material?.name||(camera===g.camera?'world':camera===g.viewCamera?'viewmodel':'scene');
      passes.push({name,width:target?.width||renderer.domElement.width,height:target?.height||renderer.domElement.height,
        samples:target?.samples||0,hdr:target?.texture.type===T.HalfFloatType,depth:!!target?.depthTexture,
        tuning:Object.fromEntries(Object.keys(bindings[name]||{}).map(key=>[key,material.uniforms[key].value]))});
      if(target){targets.set(target.texture.uuid,target);outputs.set(name,target);}
    }
    return originalRender(object,camera);
  };
  const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{map:{value:null},depthMode:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:'uniform sampler2D map; uniform float depthMode; varying vec2 vUv; void main(){vec3 c=texture2D(map,vUv).rgb;if(depthMode>.5)c=vec3(1.-exp(-c.r*.06));gl_FragColor=vec4(c,1.);}' });
  const quad=new T.Mesh(new T.PlaneGeometry(2,2),material),camera=new T.Camera();
  return {
    begin(){passes=[];collecting=true;},
    setDebug(name){debugPass=name;},
    draw(){
      const target=outputs.get(debugPass);if(!target||debugPass==='final')return;
      enabled=false;material.uniforms.map.value=target.texture;material.uniforms.depthMode.value=debugPass==='post-depthhalf'?1:0;
      renderer.setRenderTarget(null);originalRender(quad,camera);enabled=true;
    },
    stats(){
      return {passes,targets:[...targets.values()].map(target=>({width:target.width,height:target.height,
        type:target.texture.type===T.HalfFloatType?'HalfFloat':'other',samples:target.samples||0,depth:!!target.depthTexture})),debugPass};
    },
  };
}

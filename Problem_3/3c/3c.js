/**
 * WebXR ar demo using hit-test, anchors, and depth sensing
 * 
 * Every press on the screen will add a figure in the requested position (if the ring is displayed). Those meshes will be kept in place by the AR system you are using.
 * 
 * Working on android devices and the latest chrome browser, or the oculus quest 3.
 * 
 * Created by Raanan Weber (@RaananW)
 */

var createScene = async function () {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new BABYLON.Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1, -5), scene);

    // This targets the camera to scene origin
    camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // AR availability check and GUI in non-AR mode
    const arAvailable = await BABYLON.WebXRSessionManager.IsSessionSupportedAsync('immersive-ar');

    const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI(
        "FullscreenUI"
    );

    const rectangle = new BABYLON.GUI.Rectangle("rect");
    rectangle.background = "black";
    rectangle.color = "blue";
    rectangle.width = "80%";
    rectangle.height = "50%";

    advancedTexture.addControl(rectangle);
    const nonXRPanel = new BABYLON.GUI.StackPanel();
    rectangle.addControl(nonXRPanel);

    const text1 = new BABYLON.GUI.TextBlock("text1");
    text1.fontFamily = "Helvetica";
    text1.textWrapping = true;
    text1.color = "white";
    text1.fontSize = "14px";
    text1.height = "400px"
    text1.paddingLeft = "10px";
    text1.paddingRight = "10px";
 
    if (!arAvailable) {
        text1.text = "AR is not available in your system. Please make sure you use a supported device such as a Meta Quest 3 or a modern Android device and a supported browser like Chrome.\n \n Make sure you have Google AR services installed and that you enabled the WebXR incubation flag under chrome://flags";
        nonXRPanel.addControl(text1);
        return scene;
    } else {
        text1.text = "WebXR Demo: Hit test and depth sensing.\n \n Please enter AR with the button on the lower right corner to start. Once in AR, look at the floor for a few seconds (and move a little): the hit-testing ring will appear. Then click anywhere on the screen to place a model in your space.";
        nonXRPanel.addControl(text1);
    }

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    var dirLight = new BABYLON.DirectionalLight('light', new BABYLON.Vector3(0, -1, -0.5), scene);
    dirLight.position = new BABYLON.Vector3(0, 5, -5);

    var shadowGenerator = new BABYLON.ShadowGenerator(1024, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurKernel = 32;

    const model = await BABYLON.ImportMeshAsync("https://raw.githubusercontent.com/pranhav16/jhu_ar_example/main/2020_mclaren_gt.glb", scene);

    const xr = await scene.createDefaultXRExperienceAsync({
        uiOptions: {
            sessionMode: 'immersive-ar'
        },
        inputOptions: {
            doNotLoadControllerMeshes: true
        },
        handSupportOptions: {
            handMeshes: {
                disableDefaultMeshes: true,
            },
            jointMeshes: {
                keepOriginalVisible: false,
                invisible: true
            }
        }
    });

   
    xr.baseExperience.sessionManager.onXRSessionInit.add(() => {
        rectangle.isVisible = false;
    })
    xr.baseExperience.sessionManager.onXRSessionEnded.add(() => {
        rectangle.isVisible = true;

    })

   
    xr.baseExperience.featuresManager.enableFeature(
        BABYLON.WebXRFeatureName.DEPTH_SENSING,
        "latest",
        {
            dataFormatPreference: ["ushort", "float"],
            usagePreference: ["cpu", "gpu"],
        },
    );

    const fm = xr.baseExperience.featuresManager;

    const xrTest = fm.enableFeature(BABYLON.WebXRHitTest.Name, "latest");
    const anchors = fm.enableFeature(BABYLON.WebXRAnchorSystem.Name, 'latest');

    fm.enableFeature(BABYLON.WebXRBackgroundRemover.Name);

    let b = model.meshes[0];
    b.rotationQuaternion = new BABYLON.Quaternion();
    shadowGenerator.addShadowCaster(b, true);

    const marker = BABYLON.MeshBuilder.CreateTorus('marker', { diameter: 0.15, thickness: 0.05 });
    marker.isVisible = false;
    marker.rotationQuaternion = new BABYLON.Quaternion();
/*
    var skeleton = model.skeletons[0];

    // ROBOT
    skeleton.animationPropertiesOverride = new BABYLON.AnimationPropertiesOverride();
    skeleton.animationPropertiesOverride.enableBlending = true;
    skeleton.animationPropertiesOverride.blendingSpeed = 0.05;
    skeleton.animationPropertiesOverride.loopMode = 1;

    var idleRange = skeleton.getAnimationRange("YBot_Idle");
    scene.beginAnimation(skeleton, idleRange.from, idleRange.to, true);
*/
    let hitTest;

    b.isVisible = false;

    xrTest.onHitTestResultObservable.add((results) => {
        if (results.length) {
            marker.isVisible = true;
            hitTest = results[0];
            hitTest.transformationMatrix.decompose(undefined, b.rotationQuaternion, b.position);
            hitTest.transformationMatrix.decompose(undefined, marker.rotationQuaternion, marker.position);
        } else {
            marker.isVisible = false;
            hitTest = undefined;
        }
    });
    const mat1 = new BABYLON.StandardMaterial('1', scene);
    mat1.diffuseColor = BABYLON.Color3.Red();
    const mat2 = new BABYLON.StandardMaterial('1', scene);
    mat2.diffuseColor = BABYLON.Color3.Blue();

let currentCar = null; 

anchors.onAnchorAddedObservable.add(anchor => {

  const pivot = new BABYLON.TransformNode("pivot_" + (anchor?.id ?? Date.now()), scene);
  anchor.attachedNode = pivot;

  const car = b.clone("car_" + (anchor?.id ?? Date.now()));
  car.rotationQuaternion = b.rotationQuaternion.clone();
  car.scaling.copyFrom(b.scaling);
  car.position.set(0, 0, 0);
  car.isVisible = true;
  car.parent = pivot;

  shadowGenerator.addShadowCaster(car, true);
  currentCar = car; 
});

   xr.input.onControllerAddedObservable.add((controller) => {
       controller.onMotionControllerInitObservable.add((motionController) => {
           if (motionController.handness === 'right') {
                const xr_ids = motionController.getComponentIds();
                let triggerComponent = motionController.getComponent(xr_ids[0]);//xr-standard-trigger
                triggerComponent.onButtonStateChangedObservable.add(() => {
                    if (triggerComponent.pressed) {
                                if (hitTest && anchors && xr.baseExperience.state === BABYLON.WebXRState.IN_XR) {
            anchors.addAnchorPointUsingHitTestResultAsync(hitTest);
        }
                    
                    }
                        
                    
                    
                });
                
                let thumbstickComponent = motionController.getComponent(xr_ids[2]);
                thumbstickComponent.onAxisValueChangedObservable.add((axes) => {
                 
                    currentCar.position.x += axes.x/100;
                    currentCar.position.z += axes.y/100;
  // move here each time the stick changes
});


           }

       })

   });
    return scene;

};

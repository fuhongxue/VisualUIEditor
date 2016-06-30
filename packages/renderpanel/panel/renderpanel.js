(() => {
  'use strict';

//   var RenderUndo = require('../../../js/renderUndo.js');
  var Fs = require('fire-fs');
  var dragIdName = "NodeMoveUUID";
  
  Editor.polymerPanel('renderpanel', {
    properties: {
      filterText: {
        type: String,
        value: '',
      },

      zoomScale: {
        type: Number,
        value: 1,
        observer: '_zoomScaleChange'
      }
    },

    listeners: {
        'panel-resize': 'resize',
        'mousemove' : "_mouseMove",
        'mousewheel' : "_mouseWheel",
        'mousedown' : "_mouseDown",
    },

    _mouseDown : function(ev) {
    },

    _zoomScaleChange: function(newValue, location) {
        let gameCanvas = this.$.scene.$.gameCanvas;
        let isNeedFix = false;
        let preLocation = null;
        if(location) {
            isNeedFix = true;
            preLocation = this.calcSceneLocation(location.x, location.y);
        }
        let rect = gameCanvas.getBoundingClientRect();
        gameCanvas.style.zoom = "" + newValue;
        if(!isNeedFix) {
            return;
        }
        let rect1 = gameCanvas.getBoundingClientRect();
        let nowLocation = this.calcSceneLocation(location.x, location.y);
        let stepX = nowLocation.x - preLocation.x, stepY = nowLocation.y - preLocation.y;
        
        gameCanvas.style.left = parseFloat(gameCanvas.style.left)  + stepX + "px";
        gameCanvas.style.top = parseFloat(gameCanvas.style.top) + stepY + "px";

        let afterFix = this.calcSceneLocation(location.x, location.y);
    },

    _mouseWheel: function(ev) {
        this.$.zoomSlider.value = this.$.zoomSlider.value + (ev.deltaY < 0 ? 0.05 : -0.05);
        this._zoomScaleChange(this.$.zoomSlider.value, {x : ev.clientX, y : ev.clientY});

        this.updateForgeCanvas();
    },

    _mouseMove: function(ev) {
        let location = this.calcSceneLocation(ev.clientX, ev.clientY);
        this.$.location.textContent = location.x + "X" + location.y;
    },

    sceneToDom: function(x, y) {
        let gameCanvas = this.$.scene.$.gameCanvas;
        let rect = gameCanvas.getBoundingClientRect();
        let ratio = this.calcGameCanvasZoom();
        y = rect.height - y;
        return {x : (rect.left + x) * ratio, y : (rect.top + y) * ratio};
    },

    calcGameCanvasZoom: function() {
        let zoom = this.$.scene.$.gameCanvas.style.zoom;
        if(zoom) {
            if(zoom.indexOf("%") >= 0) {
                return parseFloat(zoom) / 100;
            } else {
                return parseFloat(zoom);
            }
        }
        return 1
    },

    calcSceneLocation: function(x, y) {
        let gameCanvas = this.$.scene.$.gameCanvas;
        let rect = gameCanvas.getBoundingClientRect();
        let zoom = gameCanvas.style.zoom;
        let left = rect.left, top = rect.top;
        let ratio = this.calcGameCanvasZoom();
        left = left * ratio;
        top = top * ratio;
        x = (x - left) / ratio;
        y = (y - top) / ratio;
        return {x : x.toFixed(1), y : (rect.height - y).toFixed(1)};
    },

    isCollection: function(rectSrc, rectDest) {
        return !(   rectSrc.left + rectSrc.width < rectDest.left ||
                    rectDest.left + rectDest.width < rectSrc.left ||
                    rectSrc.top + rectSrc.height < rectDest.top || 
                    rectDest.top + rectDest.height < rectSrc.top );
    },

    addNodeControl: function(node) {
        let canvas = this.$.scene.getFabricCanvas();
        let forgeRect = this.$.scene.$.forgeCanvas.getBoundingClientRect();
        let nodeRect = this.getNodeWorldRectToFabric(node);
        nodeRect.left -= forgeRect.left;
        nodeRect.top -= forgeRect.top;
        nodeRect.scaleX = nodeRect.scaleX || 1;
        nodeRect.scaleY = nodeRect.scaleY || 1;
        nodeRect.opacity = 0.5;
        nodeRect.fill = "red";
        nodeRect.hasRotatingPoint = true;
        var block = new fabric.Rect(nodeRect);
        block._innerItem = node;
        block._preInfo = nodeRect;
        block.hasRotatingPoint = true;
        canvas.add(block);
        return true;
    },

    recursiveAddChild: function(node, rect, isClick) {
        let canvas = this.$.scene.getFabricCanvas();

        let forgeRect = this.$.scene.$.forgeCanvas.getBoundingClientRect();
        let nodeRect = this.getNodeWorldRectToFabric(node);
        nodeRect.left -= forgeRect.left;
        nodeRect.top -= forgeRect.top;
        let isCollect = this.isCollection(nodeRect, rect);

        if(isCollect) {
            this.addNodeControl(node);
            return true;
        }

        var children = node.getChildren();
        for(var i = 0; i < children.length; i++) {
            let isSuccessAdd = this.recursiveAddChild(children[i], rect, isClick);
            if(isClick && isSuccessAdd) {
                return true;
            }
        }

        return false;
    },

    getSelectItems: function() {
        let canvas = this.$.scene.getFabricCanvas();

        let objects = canvas.getObjects();
        let select_items = [];
        for(var i = 0; i < objects.length; i++) {
            let uuid = objects[i]._innerItem.uuid;
            if(uuid) 
                select_items.push(uuid);
        }

        return select_items;
    },

    updateForgeCanvas: function() {

        let canvas = this.$.scene.getFabricCanvas();
        let select_items = this.getSelectItems();
        canvas.clear();

        for(var i = 0; i < select_items.length; i++) {
            let sourceNode = cocosGetItemByUUID(this.$.scene.getRunScene(),select_items[i]);
            if(!sourceNode) {
                continue;
            }
            this.addNodeControl(sourceNode);
        }

        this.updateAllObjectSelect();
    },

    updateAllObjectSelect: function() {
        let canvas = this.$.scene.getFabricCanvas();
        var group = canvas.getObjects();
        // do not create group for 1 element only
        if (group.length === 1) {
            canvas.setActiveObject(group[0], null);
        }
        else if (group.length > 1) {
            group = new fabric.Group(group.reverse(), {
                canvas: canvas
            });
            group.addWithUpdate();
            canvas.setActiveGroup(group, null);
            group.saveCoords();
            canvas.fire('selection:created', { target: group });
            canvas.renderAll();
        }
    },

    isBaseType: function(node) {

    },

    getNodeWorldRectToFabric: function(node) {
        let rect = this.getWorldNodeRect(node);
        return {
            top : rect.y,
            left: rect.x,
            width: rect.width,
            height: rect.height,
        }
    },


    getNodeRectToFabric: function(node) {
        let rect = this.getNodeRect(node);
        return {
            top : rect.y + rect.height / 2,
            left: rect.x + rect.width / 2,
            width: rect.width,
            height: rect.height,
        }
    },

    getWorldNodeRect: function(node) {
        let rect = node.getBoundingBoxToWorld();
        let start = this.sceneToDom(rect.x, rect.y);
        let zoom = this.calcGameCanvasZoom();
        let height = rect.height * zoom;

        return {
            x : start.x, y : start.y - height,
            width: rect.width * zoom,
            height: height,
        }
    },

    getNodeRect: function(node) {
        let rect = node.getBoundingBox();
        let start = this.sceneToDom(rect.x, rect.y);
        let zoom = this.calcGameCanvasZoom();
        let height = rect.height * zoom;

        return {
            x : start.x, y : start.y - height,
            width: rect.width * zoom,
            height: height,
        }
    },

    resize: function() {
        this.$.scene.fixForgeCanvas();
        this.$.scene.initGameCanvas();
    },

    addFunc: function(data) {

    },

    ready: function () {


        this.$.zoomSlider.addEventListener('change', (event => {
            event.stopPropagation();
            this._zoomScaleChange(event.detail.value);
        }).bind(this));

        let canvas = this.$.scene.getFabricCanvas();
        canvas.on({
            'object:moving': this.canvasItemChange.bind(this),
            'object:scaling': this.canvasItemChange.bind(this),
            'object:rotating': this.canvasItemChange.bind(this),
            'selection:preselect': this.preSelectorRect.bind(this),
            'mouseup:touchnull': this.mouseupTouchnull.bind(this),
        });

       this['ondragenter'] = this.dragEnter.bind(this);
       this['ondragover'] = this.dragOver.bind(this);
       this['ondrop'] = this.dragDrop.bind(this);
       this['ondragleave'] = this.dragLeave.bind(this);

       this['onkeydown'] = function(event) {
           if(event.keyCode == Editor.KeyCode('z') && event.ctrlKey) {
               this.undoScene();
           } else if(event.keyCode == Editor.KeyCode('y') && event.ctrlKey) {
               this.redoScene();
           } else if(event.keyCode == Editor.KeyCode('s') && event.ctrlKey) {
               saveSceneToFile("E:/test.ui", this.$.scene.getRunScene());
           } else if(event.keyCode == Editor.KeyCode('n') && event.ctrlKey) {
               let scene = loadSceneFromFile("E:/test.ui");
               scene && (scene._className == "Scene") && this.sceneChange(scene);
           }
       }.bind(this);
    },

    sceneChange: function(newScene) {
        this.$.scene.getFabricCanvas().clear();
        this.$.scene.runScene = newScene;
        window.runScene = newScene;
        cc.director.runScene(newScene);
        Editor.Ipc.sendToAll('ui:scene_change', {});
    },

    undoScene: function() {
        Editor.log("undoScene!!!!!!");
        let runScene = this.$.scene.getRunScene();
        if(!runScene) {
            return;
        }
        runScene._undo.undo();
    },

    redoScene: function() {
        Editor.log("redoScene!!!!!!");
        let runScene = this.$.scene.getRunScene();
        if(!runScene) {
            return;
        }
        runScene._undo.redo();
    },

    mouseupTouchnull: function(e) {
        let canvas = this.$.scene.getFabricCanvas();
        if(e.ctrlKey || canvas.getActiveObject() || canvas.getActiveGroup()) {

        } else {
            canvas.clear();
        }

        this.preSelectorRect({selector: {
            ex : e.offsetX,
            ey : e.offsetY,
            left: 0,
            top: 0,
        }, e : e});
    },

    preSelectorRect: function(object) {
        let rect = object.selector;
        let left = Math.min(rect.ex, rect.ex + rect.left);
        let top = Math.min(rect.ey, rect.ey + rect.top);
        let isClick = rect.left == 0 && rect.top == 0;
        let width = Math.abs(rect.left), height = Math.abs(rect.top);
        let e = object.e;
        rect = {left:left, top:top, width: width, height: height};

        let runScene = this.$.scene.getRunScene();
        let children = runScene.getChildren();

        let canvas = this.$.scene.getFabricCanvas();
        let activeGroup = canvas.getActiveGroup();
        if(e.ctrlKey || canvas.getActiveObject() || canvas.getActiveGroup()) {

        } else {
            canvas.clear();
        }

        let forgeRect = this.$.scene.$.forgeCanvas.getBoundingClientRect();
        let objectLen = canvas.getObjects().length;
        for(var i = 0; i < children.length; i++) {
            let isSuccessAdd = this.recursiveAddChild(children[i], rect, isClick);
            if(isClick && isSuccessAdd) {
                break;
            }
        }
        if(canvas.getObjects().length != objectLen)
            this.updateAllObjectSelect();

        let select_items = this.getSelectItems();
        Editor.Ipc.sendToAll("ui:select_items_change", {select_items : select_items});
    },

    canvasTargetChange: function(target, group) {
       let child = target._innerItem;
        let preInfo = target._preInfo;
        if(!child) {
            return;
        }
        let curInfo = {
            left: target.left,
            top: target.top,
            width: target.width,
            height: target.height,
            scaleX: target.scaleX,
            scaleY: target.scaleY,
            angle: target.getAngle(),
        };

        if(group) {
            curInfo.left = group.left + group.width / 2 + target.left;
            curInfo.top = group.top + group.height / 2 + target.top;

            curInfo.scaleX = curInfo.scaleX * group.scaleX;
            curInfo.scaleY = curInfo.scaleY * group.scaleY;
        }
        let ratio = this.calcGameCanvasZoom();
        let runScene = this.$.scene.getRunScene();
        let undo = runScene._undo;

        if(curInfo.left != preInfo.left) {
            let oldValue = child.x;
            let step = (curInfo.left - preInfo.left) / ratio;
            FixNodeHor(child, step);
            undo.add(newPropCommandChange(runScene, child.uuid, 'x', oldValue, child.x));
        }   

        if(curInfo.top != preInfo.top) {
            let oldValue = child.y;
            let step = - (curInfo.top - preInfo.top) / ratio;
            FixNodeVer(child, step);
            undo.add(newPropCommandChange(runScene, child.uuid, 'y', oldValue, child.y));
        }

        if(curInfo.scaleX != preInfo.scaleX) {
            let oldValue = child.scaleX;
            child.setScaleX(child.getScaleX() * (curInfo.scaleX / preInfo.scaleX));
            undo.add(newPropCommandChange(runScene, child.uuid, 'scaleX', oldValue, child.scaleX));
        }

        if(curInfo.scaleY != preInfo.scaleY) {
            let oldValue = child.scaleY;
            child.setScaleY(child.getScaleY() * (curInfo.scaleY / preInfo.scaleY));
            undo.add(newPropCommandChange(runScene, child.uuid, 'scaleY', oldValue, child.scaleY));
        }
        preInfo.angle = preInfo.angle || 0;
        if(curInfo.angle != preInfo.angle) {
            let oldValue = child.rotation;
            child.setRotation(child.getRotation() + (curInfo.angle - preInfo.angle));
            undo.add(newPropCommandChange(runScene, child.uuid, 'rotation', oldValue, child.rotation));
        }

        
        Editor.Ipc.sendToAll("ui:item_prop_change", {uuid:child.uuid});
        // curInfo.left -= group.left || 0;
        // curInfo.top -= group.top || 0;
        target._preInfo = curInfo;
    },

    canvasItemChange: function(options) {
        if (options.target._objects) {
            options.target._objects.forEach(function(target) {
                this.canvasTargetChange(target, options.target)
            }, this);
        }
        this.canvasTargetChange(options.target);
    },


    dragEnter: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        
        ev.dataTransfer.effectAllowed = "all";
        ev.dataTransfer.dropEffect = "all"; // drop it like it's hot
    },
    dragOver: function(ev) {
        ev.dataTransfer.effectAllowed = "all";
        ev.dataTransfer.dropEffect = "all"; // drop it like it's hot
        ev.preventDefault();
        ev.stopPropagation();
    },
    dragLeave: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
    },
    dragDrop: function(ev) {
        Editor.log("dragDrop!!!!!!!!!!!!!!!!!!!");
        ev.preventDefault();
        ev.stopPropagation();
        ev.target.style.removeProperty("background");
        
        var data = ev.dataTransfer.getData("controlType");
        let runScene = this.$.scene.getRunScene();
        let scenePosition = this.calcSceneLocation(ev.clientX, ev.clientY);
        let uuid = gen_uuid();
        var node = null;
        if(data == "Sprite") {
            node = new _ccsg.Sprite("res/default/Sprite.png");
            runScene.addChild(node, 0);
        } else if(data == "LabelTTF") {
            node = new cc.LabelTTF("VisualUI", "Arial", 20);
            runScene.addChild(node);
        } else if(data == "Scale9") {
            node = new cc.Scale9Sprite("res/default/Scale9.png");
            node.setRenderingType(cc.Scale9Sprite.RenderingType.SLICED);
            runScene.addChild(node);
        } else if(data == "Input") {
            node = new _ccsg.EditBox(cc.size(100, 20), new cc.Scale9Sprite("res/default/shurukuang.png"));
            runScene.addChild(node);
        } else if(data == "Slider") {
            node = new cc.ControlSlider("res/default/Slider_Back.png", "res/default/Slider_Bar.png", "res/default/SliderNode_Normal.png");
            runScene.addChild(node);
        } else if(data == "Button") {
            node = new cc.ControlButton(new cc.LabelTTF("VisualUI", "Arial", 24), new cc.Scale9Sprite("res/default/Button_Disable.png"));
            runScene.addChild(node);
        }

        if (node) {
            node.setPosition(parseFloat(scenePosition.x), parseFloat(scenePosition.y));
            node.uuid = uuid;
            node.uiname = data;
            Editor.Ipc.sendToAll("ui:scene_item_add", {uuid:uuid});
        }
    },

    insertItemBefore: function(sourceNode, compareNode) {
        let compareParent = compareNode.getParent();
        if(!compareParent) {
            return;
        }
        sourceNode.removeFromParent(false);
        let afterNode = [];
        let children = compareParent.getChildren();
        let index = children.indexOf(compareNode);
        for(var i = index; i < children.length; i++) {
            afterNode.push(children[i]);
        }
        for(var i = index; i < children.length; i++) {
            children[i].removeFromParent(false);
        }
        compareParent.addChild(sourceNode);
        for(var i = 0; i < afterNode.length; i++) {
            compareParent.addChild(afterNode[i]);
        }
    },

    insertItemAfter: function(sourceNode, compareNode) {
        let compareParent = compareNode.getParent();
        if(!compareParent) {
            return;
        }
        sourceNode.removeFromParent(false);
        let afterNode = [];
        let children = compareParent.getChildren();
        let index = children.indexOf(compareNode);
        for(var i = index + 1; i < children.length; i++) {
            afterNode.push(children[i]);
        }
        for(var i = index + 1; i < children.length; i++) {
            children[i].removeFromParent(false);
        }

        compareParent.addChild(sourceNode);
        for(var i = 0; i < afterNode.length; i++) {
            compareParent.addChild(afterNode[i]);
        }
    },

    changeItemPosition : function(sourceUUID, compareUUID, mode) {
        let sourceNode = cocosGetItemByUUID(this.$.scene.getRunScene(), sourceUUID);
        let compareNode = cocosGetItemByUUID(this.$.scene.getRunScene(),compareUUID);
        if(!sourceNode || !compareNode || isSelfOrAncient(compareNode, sourceNode)) {
            return;
        }

        if(mode == "top") {
            this.insertItemBefore(sourceNode, compareNode);
        } else if(mode == "bottom") {
            this.insertItemAfter(sourceNode, compareNode);
        } else {
            sourceNode.removeFromParent(false);
            compareNode.addChild(sourceNode);
        }
    },

    changeItemSelect: function(info) {
        let sourceNode = cocosGetItemByUUID(this.$.scene.getRunScene(),info.uuid);
        if(!sourceNode) {
            return;
        }
        if(!info.ctrlKey) {
            this.$.scene.getFabricCanvas().clear();
        }
        this.addNodeControl(sourceNode);
        this.updateForgeCanvas();

        let select_items = this.getSelectItems();
        Editor.Ipc.sendToAll("ui:select_items_change", {select_items : select_items});
    },

    messages: {
        "ui:change_item_position" (event, message) {
            this.changeItemPosition(message.sourceUUID, message.compareUUID, message.mode);
            this.updateForgeCanvas();
        },
        "ui:select_item" (event, message) {
            this.changeItemSelect(message);
        },
        "ui:scene_change"(event, message) {
            let runScene = this.$.scene.getRunScene();
            if(!runScene._undo)
                runScene._undo =  new UndoObj();
        },
        "ui:has_item_change"(event, message) {
            this.updateForgeCanvas();
        }

    },

  });

})();

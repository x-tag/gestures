
(function(){
  
  var directions = {
    up: 0,
    down: 180,
    left: 270,
    right: 90
  };
  
  xtag.pseudos.gesture = {
    onAdd: function(pseudo){
      var gesture = pseudo.source.gesture = xtag.merge(pseudo.source.gesture, JSON.parse(pseudo.value));
      switch (pseudo.source.type) {    
        case 'swipe':
          var hasDir = gesture.direction in directions;
          if (hasDir) gesture.degree = directions[gesture.direction];
          if (gesture.degree != null) {
            gesture.inverse = (gesture.degree + 180) % 360;
            gesture.range = {};
            var poles = [gesture.degree];
            if (!hasDir && !gesture.directional) poles.push(gesture.inverse);
            poles.forEach(function(degree){
              var tolerance = -gesture.tolerance
                  span = (gesture.tolerance * -2) - 1;
              while (span++) {
                var item = degree + tolerance;
                if (item < 0) gesture.range[361 + tolerance] = 1;
                else if (item > 360) gesture.range[item - 360] = 1;
                else gesture.range[item] = 1;
                ++tolerance;
              }
            });
          }
          break;
      }
    }
  };
  
/*   var touchFxEnd = false;
  xtag.pseudos.touchFx = {
    fx: {
      'ring': function(event, element){
        xtag.addEvent(element, 'animationend', function(){
          if (document.contains(element)) document.body.removeChild(element);
        })
      }
    },
    action: function(pseudo, event){
      var touches = event.touches,
          fx = xtag.pseudos.touchFx.fx[pseudo.value];
      if (touches && fx) {
        var i = touches.length;
        while(i--) {
          var id = 'touch-fx-' + pseudo.value + '-' + touches[i].identifier,
              div = document.getElementById(id);
          if (div) {
            div.className
          }
          else {
            div = document.createElement('div');
            div.id = id;
            div.className = 'touch-fx touch-fx-' + pseudo.value;
            document.body.appendChild(div);
          }
          div.style.top = touches[i].pageY + 'px';
          div.style.left = touches[i].pageX + 'px';
          fx.call(this, event, div);
        }
      }
      return true;
    }
  }; */
  
  xtag.pseudos.touches = {
    onCompiled: function(stack, pseudo){
      var condition = pseudo.source.condition;
      pseudo.source.condition = function(e){
        return ((Number(pseudo.value) || 1) == (e.touches ? e.touches.length : 1)) ? 
          condition.apply(this, xtag.toArray(arguments)) : null;
      }
    }
  }; 
  
  function cancelGesture(el, type){
    xtag.fireEvent(el, 'gesturecancel', { detail: { gesture: type } });
  }
  
  function checkTimeout(time){
    return new Date().getTime() < time;
  }
  
  function checkDistance(start, now, distance){
    return xtag.toArray(now.touches).every(function(touch, i){
      return !start.touches[i] ||
        (Math.abs(touch.pageX - start.touches[i].pageX) > distance ||
        Math.abs(touch.pageY - start.touches[i].pageY) > distance);
    });
  }
  
  var degrad = 180 / Math.PI;
  function checkAngle(custom, event){
    if (custom.gesture.degree == null) return true;
    return xtag.toArray(event.touches).every(function(touch, i){
      if (!custom.startEvent.touches[i]) return true;
      var degree = ~~(Math.atan2(touch.pageY - custom.startEvent.touches[i].pageY, touch.pageX - custom.startEvent.touches[i].pageX) * degrad);
          degree += ((degree < -90) ? 450 : 90);
      return custom.gesture.range[degree];
    });
  }


/*** Swipe ***/  

  xtag.customEvents.swipe = {
    attach: ['tapstart', 'tapmove', 'tapend', 'dragend'],
    gesture: {  
      degree: null,
      timeout: 1000,
      tolerance: 25,
      distance: 100,
      direction: null,
      directional: true
    },
    condition: function(event, custom){
      if (event.type == 'dragend' || event.type == 'tapend') {
        delete custom.startEvent;
        delete custom.startTime;
        return;
      }
      var start = custom.startEvent;  
      if (start && event.type == 'tapmove') {
        if (checkTimeout(custom.startTime)) {
          if (checkDistance(start, event, custom.gesture.distance) && checkAngle(custom, event)) {
            delete custom.startEvent;
            delete custom.startTime;
            return true;
          }
        }
        else cancelGesture(event.target, 'swipe');
      }
      if (event.type == 'tapstart') {
        custom.startEvent = event;
        custom.startTime = new Date().getTime() + custom.gesture.timeout;
      }
    }
  };


/*** Pinch ***/
  
  function getCentroid(touches){
    var x = [], y = [],
        i = touches.length;
    while (i--) {
        x[i] = touches[i].pageX;
        y[i] = touches[i].pageY;
    }
    return {
        x: (Math.min.apply(Math, x) + Math.max.apply(Math, x)) / 2,
        y: (Math.min.apply(Math, y) + Math.max.apply(Math, y)) / 2
    };
  }
  
  function getAverageDistance(touches) {
    var d = 0,
        distance = 0,
        i = touches.length;
    while (i--) {
      var x = 0, x = (x = touches[d].pageX - touches[i].pageX) * x,   
          y = 0, y = (y = touches[d].pageY - touches[i].pageY) * y;
      distance += Math.sqrt(x + y);
      d = i;
    }
    return distance / touches.length;
  }
  
  xtag.customEvents.pinch = {
    attach: ['tapstart', 'touchmove', 'tapend', 'dragend', 'scrollwheel', 'touchcancel'],
    gesture: {},
    condition: function(event, custom){
      if (event.type == 'scrollwheel') {
        console.log('delta', event.delta);
      }
      else if (event.touches){
        var touches = event.touches,
            count = touches.length;
        
        switch (event.type) {
          case 'tapstart': case 'tapend':
            if (count > 1) custom.startDistance = getAverageDistance(touches);
          
          case 'tapend': case 'touchcancel':
            if (count < 2) delete custom.startDistance;
            break;
            
          case 'touchmove': 
            if (count > 1) {
              var start = custom.startDistance,
                  distance = getAverageDistance(touches);
              if ('startDistance' in custom && distance != start) {
                custom.startDistance = distance;
                return {
                  area: 0,
                  distance: distance,
                  centroid: getCentroid(touches),
                  direction: distance > start ? 'out' : 'in'
                }
              }
            }
            break;
        }
      }
    }
  };


/*** Long Tap ***/
  
  function clearLongtap(custom){
    clearTimeout(custom.timer);
    xtag.removeEvents(document, custom.move);
  }
  
  xtag.customEvents.longtap = {
    attach: ['tapstart'],
    gesture: {
      tolerance: 6,
      duration: 450
    },
    condition: function(event, custom){
      clearTimeout(custom.timer);   
      custom.startEvent = event;
      custom.timer = setTimeout(function(){
        xtag.fireEvent(event.target, 'longtap', { baseEvent: event });
      }, custom.gesture.duration);
      custom.move = xtag.addEvents(document, {
        move: function(e){
          if (checkDistance(custom.startEvent, e, custom.gesture.tolerance)) {
            clearLongtap(custom);
          }
        },
        tapend: function(e){
          clearLongtap(custom);
        }
      });
    }
  };

})();
'use strict';

let VSOP = (function() {
	let _widthMobile = new WeakMap();
	let _idMain = new WeakMap();
	let _currentSection = new WeakMap();
	let _amountSection = new WeakMap();
	let _currentHeight = new WeakMap();
	let _isPaused = new WeakMap();
	let _transitionSpeed = new WeakMap();
	let _inAnimation = new WeakMap();
	let _currentState = new WeakMap();

	let _transformSupport;
	let _transitionSupport;
	let _transitionEndSupport;

	let _idObj;
	let _htmlObj;
	let _bodyObj;

	let _getWindowHeight = function _getWindowHeight() {
		return window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
	}

	let _getWindowWidth = function _getWindowWidth() {
		return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
	}

	let _getTransformSupport = function _getTransformSupport() {
		let el = document.createElement('fakeelement');

		let transforms = [
			'transform',
			'msTransform',
			'WebkitTransform'
		];

		for (let i = 0; i < transforms.length; i++) {
			if (el.style[transforms[i]] !== undefined) {
				return transforms[i];
			}
		}
	}

	let _whichTransitionEvent = function _whichTransitionEvent() {
		let el = document.createElement('fakeelement');

		let transitions = {
			'transition' : 'transitionend',
			'OTransition' : 'oTransitionEnd',
			'MozTransition' : 'transitionend',
			'WebkitTransition' : 'webkitTransitionEnd'
		}

		let support = {
			support: function() {
				for (let t in transitions) {
					if (el.style[t] !== undefined) {
						return t;
					}
				}
			},
			endSupport: function() {
				for (let t in transitions) {
					if (el.style[t] !== undefined) {
						return transitions[t];
					}
				}
			}
		}

		return support;
	}

	let _transitionScroll = function _transitionScroll(vsop, toTop) {
		if (!_inAnimation.get(vsop)) {
			if (toTop) {
				if (_currentSection.get(vsop) > 0) {
					_inAnimation.set(vsop, true);
					_currentSection.set(vsop, _currentSection.get(vsop) - 1);
					_currentHeight.set(vsop, _currentHeight.get(vsop) + _getWindowHeight());
				}
			} else {
				if (_currentSection.get(vsop) < _amountSection.get(vsop) - 1) {
					_inAnimation.set(vsop, true);
					_currentSection.set(vsop, _currentSection.get(vsop) + 1);
					_currentHeight.set(vsop, _currentHeight.get(vsop) - _getWindowHeight());
				}
			}

			let el = document.getElementById(vsop.idMain);
			el.style[_transformSupport] = 'translate(0px,'+_currentHeight.get(vsop)+'px)';

			let transformEndHandle = function transformEndHandle(event) {
				_endEventListener(el, _transitionEndSupport, transformEndHandle);
				_inAnimation.set(vsop, false);
			}

			_initEventListener(el, _transitionEndSupport, transformEndHandle);
		}
	}

	let _initEventListener = function _initEventListener(eventTarget, eventType, eventHandle) {
		if (window.addEventListener) {
			eventTarget.addEventListener(eventType, eventHandle, false);
		} else if (window.attachEvent) {
			eventTarget.attachEvent('on' + eventType, eventHandle);
		} else {
			eventTarget['on' + eventType] = eventHandle;
		}
	}

	let _endEventListener = function _endEventListener(eventTarget, eventType, eventHandle) {
		if (window.removeEventListener) {
			eventTarget.removeEventListener(eventType, eventHandle, false);
		} else if (window.detachEvent) {
			eventTarget.detachEvent('on' + eventType, eventHandle);
		} else {
			eventTarget['on' + eventType] = null;
		}
	}

	let _resizeEvent = function _resizeEvent(vsop) {
		let resizeTimeout;

		let resizeThrottler = function resizeThrottler() {
			// ignore resize events as long as an actualResizeHandler execution is in the queue
			if (!resizeTimeout) {
				resizeTimeout = setTimeout(function() {
					resizeTimeout = null;
					resizeHandle();
				}, 66);
			}
		}

		let resizeHandle = function resizeHandle() {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				if (_currentState.get(vsop) !== 'Desktop') {
					_setDesktop(vsop);
				}
				_setSection(vsop, _getWindowHeight()+'px');
			} else {
				if (_currentState.get(vsop) !== 'Mobile') {
					_setMobile(vsop);
				}
			}
		}

		_initEventListener(window, 'resize', resizeThrottler);
	}

	let _keydownEvent = function _ketdownEvent(vsop) {
		let keydownHandle = function keydownHandle(event) {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				switch(event.keyCode) {
					case 38:
						_transitionScroll(vsop, true);
						break;
					case 40:
						_transitionScroll(vsop, false);
						break;
					default:
						break;
				}
				event.preventDefault();
			}
		}

		_initEventListener(document, 'keydown', keydownHandle);
	}

	let _mousewheelEvent = function _mousewheelEvent(vsop) {
		let mousewheelHandle = function mousewheelHandle(event) {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				let ev = window.event || event;
				let delta = Math.max(-1, Math.min(1, (ev.wheelDelta || -ev.detail)));
				_transitionScroll(vsop, (delta > 0) ? true : false);
			}
		}

		let mousewheelEvent = (/Firefox/i.test(navigator.userAgent)) ? 'DOMMouseScroll' : 'mousewheel';

		_initEventListener(document, mousewheelEvent, mousewheelHandle);
	}

	let _touchEvent = function _touchEvent(vsop) {
		let dir;
		let swipeType;
		let startX;
		let startY;
		let distX;
		let distY;
		let threshold = 150; // required min distance traveled to be considered swipe
		let restraint = 100; // maximum distance allowed at the same time in perpendicular direction
		let allowedTime = 500; // maximum time allowed to travel that distance
		let elapsedTime;
		let startTime;

		let touchStartHandle = function touchStartHandle(event) {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				let touchobj = event.changedTouches[0];

				dir = 'none';
				swipeType = 'none';

				startX = touchobj.clientX;
				startY = touchobj.clientY;

				startTime = new Date().getTime(); // record time when finger first makes contact with surface
			}
		}

		_initEventListener(document, 'touchstart', touchStartHandle);

		let touchMoveHandle = function touchMoveHandle(event) {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				let touchobj = event.changedTouches[0];

				distX = touchobj.clientX - startX // get horizontal dist traveled by finger while in contact with surface
				distY = touchobj.clientY - startY // get vertical dist traveled by finger while in contact with surface

				if (Math.abs(distX) > Math.abs(distY)) { // if distance traveled horizontally is greater than vertically, consider this a horizontal movement
					dir = (distX < 0) ? 'left' : 'right';
				} else { // else consider this a vertical movement
					dir = (distY < 0) ? 'up' : 'down';
				}
			}
		}

		_initEventListener(document, 'touchmove', touchMoveHandle);

		let touchEndHandle = function touchEndHandle(event) {
			if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
				let touchobj = event.changedTouches[0];

				elapsedTime = new Date().getTime() - startTime; // get time elapsed

				if (elapsedTime <= allowedTime) { // first condition for awipe met
					if (Math.abs(distX) >= threshold && Math.abs(distY) <= restraint) { // 2nd condition for horizontal swipe met
						// set swipeType to either "left" or "right"
					} else if (Math.abs(distY) >= threshold && Math.abs(distX) <= restraint) { // 2nd condition for vertical swipe met
						_transitionScroll(vsop, (dir === 'up') ? true : false); // set swipeType to either "top" or "down"
					}
				}
			}
		}

		_initEventListener(document, 'touchend', touchEndHandle);
	}

	let _htmlAttr = function _htmlAttr(el, of, he) {
		el.style.overflow = of;
		el.style.height = he;
	}

	let _sectionAttr = function _sectionAttr(as, he) {
		for (let i = 0; i < as; i++) {
			document.getElementById('section'+i).style.height = he;
		}
	}

	let _setSection = function _setSection(vsop, he) {
		_sectionAttr(_amountSection.get(vsop), he);
		_currentHeight.set(vsop, -_getWindowHeight() * _currentSection.get(vsop));
		_idObj.style[_transformSupport] = 'translate(0px,'+_currentHeight.get(vsop)+'px)';
	}

	let _vsopAttr = function _vsopAttr(el, he, sp, tr) {
		el.style.height = he;
		el.style.position = 'relative';
		el.style[_transitionSupport] = 'all '+sp+'s ease 0s';
		el.style[_transformSupport] = 'translate(0px,'+tr+'px)';
	}

	let _isActive = function _isActive(widthMobile, isPaused) {
		if (isPaused) {
			return false;
		}
		return (widthMobile < _getWindowWidth()) ? true : false; // check if is mobile
	}

	let _setDesktop = function _setDesktop(vsop) {
		_htmlAttr(_htmlObj, 'hidden', '100%');
		_htmlAttr(_bodyObj, 'hidden', '100%');
		_vsopAttr(_idObj, '100%', vsop.transitionSpeed, 0);
		_sectionAttr(_amountSection.get(vsop), _getWindowHeight()+'px');
		_currentState.set(vsop, 'Desktop');
	}

	let _setMobile = function _setMobile(vsop) {
		_htmlAttr(_htmlObj, 'visible', 'auto');
		_htmlAttr(_bodyObj, 'visible', 'auto');
		_vsopAttr(_idObj, 'auto', vsop.transitionSpeed, 0);
		_sectionAttr(_amountSection.get(vsop), 'auto');
		_currentState.set(vsop, 'Mobile');
	}

	let _initEvent = function _initEvent(vsop) {
		_keydownEvent(vsop);
		_mousewheelEvent(vsop);
		_touchEvent(vsop);
		_resizeEvent(vsop);
	}

	let _initVSOP = function _initVSOP(vsop) {
		_transformSupport = _getTransformSupport();
		_transitionSupport = _whichTransitionEvent().support();
		_transitionEndSupport = _whichTransitionEvent().endSupport();

		if (!_transformSupport || !_transitionSupport) {
			throw 'Browsers Do Not Support CSS3 Transitions.';
			return;
		}

		_idObj = document.getElementById(vsop.idMain);

		if (!_idObj) {
			throw 'Element Not Found. Fail to init with id: "'+ vsop.idMain +'".';
			return;
		}

		_htmlObj = document.getElementsByTagName('html')[0];
		_bodyObj = document.getElementsByTagName('body')[0];

		let els = _idObj.getElementsByClassName('section');
		for (let i = 0; i < els.length; i++) {
			els[i].setAttribute('id', 'section'+i);
		}

		_amountSection.set(vsop, els.length);
		_currentSection.set(vsop, 0);
		_currentHeight.set(vsop, 0);
		_inAnimation.set(vsop, false);
		_currentState.set(vsop, 'none');

		if (_isActive(vsop.widthMobile, _isPaused.get(vsop))) {
			_setDesktop(vsop);
		} else {
			_setMobile(vsop);
		}

		_initEvent(vsop);
	}

	class VSOP {
		constructor() {
			this.widthMobile = 768;
			this.idMain = 'VerticalScrollOnePage';
			this.transitionSpeed = 1;
			this.unpause();
		}

		set widthMobile(width) {
			_widthMobile.set(this, width);
		}

		get widthMobile() {
			return _widthMobile.get(this);
		}

		set idMain(id) {
			_idMain.set(this, id);
		}

		get idMain() {
			return _idMain.get(this);
		}

		set transitionSpeed(speed) {
			_transitionSpeed.set(this, speed);
		}

		get transitionSpeed() {
			return _transitionSpeed.get(this);
		}

		unpause() {
			_isPaused.set(this, false);
		}

		pause() {
			_isPaused.set(this, true);
		}

		init() {
			_initVSOP(this);
		}
	}

	return VSOP;
}());
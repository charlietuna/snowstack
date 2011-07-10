/*
	Snow Stack 3D CSS Photo Viewer

	Copyright (C) 2009 Charles Ying. All Rights Reserved.
	This source code is available under Apache License 2.0.
	
	Performance Notes (courtesy of Apple):
		on leopard, animating transforms with a transform list > 1 function, animation falls back to software
		shadows (and animated shadows) plus border animations can cause additional redraws
		offsetWidth / offsetHeight should be avoided.
*/

// (function () {  // Module pattern

var global = this;

var CWIDTH;
var CHEIGHT;
var CGAP = 10;
var CXSPACING;
var CYSPACING;

var snowstack_options = {
	rows: 3,
	refreshzoom: true,
	captions: false
};

var vfx = {
	elem: function (name, attrs, child)
	{
		var e = document.createElement(name);
		if (attrs)
		{
			for (var key in attrs)
			{
				if (attrs.hasOwnProperty(key))
				{
					e.setAttribute(key, attrs[key]);
				}
			}
		}
		
		if (child)
		{
			e.appendChild(child);
		}
		return e;
	},
	byid: function (id)
	{
		return document.getElementById(id);
	},
	loadhandler: function (elem, callback)
	{
		elem.addEventListener("load", callback, false);
	},
	translate3d: function (x, y, z)
	{
		return "translate3d(" + x + "px, " + y + "px, " + z + "px)";
	}
};

var currentCellIndex = -1;
var cells = [];

var dolly;
var camera;
var caption;

var cellstack;
var reflectionstack;

var magnifyMode;
var newbieUser = true;

var zoomTimer = null;
var currentTimer = null;

function cameraTransformForCell(n)
{
	var x = Math.floor(n / snowstack_options.rows);
	var y = n - x * snowstack_options.rows;
	var cx = (x + 0.5) * CXSPACING;
	var cy = (y + 0.5) * CYSPACING;

	if (magnifyMode)
	{
		return vfx.translate3d(-cx, -cy, 180);
	}
	else
	{
		return vfx.translate3d(-cx, -cy, 0);
	}	
}

function layoutElement(elem, iwidth, iheight)
{
	var ratio = Math.min(CHEIGHT / iheight, CWIDTH / iwidth);
	
	iwidth *= ratio;
	iheight *= ratio;

	elem.style.width = Math.round(iwidth) + "px";
	elem.style.height = Math.round(iheight) + "px";

	elem.style.left = Math.round((CWIDTH - iwidth) / 2) + "px";
	elem.style.top = Math.round((CHEIGHT - iheight) / 2) + "px";
}

function layoutMediaInCell(media)
{
	if (media.tagName == "VIDEO")
	{
		layoutElement(media, media.videoWidth, media.videoHeight);
	}
	else
	{
		layoutElement(media, media.width, media.height);
	}
}

var currentVideo = null;

function play_video(newVideo, passive)
{
	if (newVideo.tagName != "VIDEO")
	{
		return;
	}

	if (currentVideo && !currentVideo.paused)
	{
		if (passive)
		{
			newVideo.pause();
			return;
		}
		currentVideo.pause();
	}
	
	currentVideo = newVideo;
	
	currentVideo.play();
}

function refreshImage(elem, cell)
{
	if (zoomTimer)
	{
		clearTimeout(zoomTimer);
	}
	
	if (cell.video)
	{
		if (cell.video.paused)
		{
			play_video(cell.video);
		}
		return;
	}

	zoomTimer = setTimeout(function ()
	{
		if (cell.info.video)
		{
			cell.video = vfx.elem("video", { "class": "media" });

			var videolayout = function (e)
			{
				layoutMediaInCell(cell.video);
				elem.parentNode.removeChild(elem);
				cell.video.visibility = "visible";
				return false;
			};
	
			var playstarter = function (e)
			{
				play_video(cell.video);	
				return false;
			};
	
			cell.video.visibility = "hidden";
			cell.video.addEventListener("loadedmetadata", videolayout, false);
			cell.video.addEventListener("canplay", playstarter, false);
			elem.parentNode.appendChild(cell.video);
			cell.video.src = cell.info.video;
			cell.video.load();
		}
		else if (cell.info.zoom)
		{
			elem.src = cell.info.zoom;
		}
		
		zoomTimer = null;
	}, 2000);
}

function setcellclass(c, name)
{
	c.div.className = name;
	if (c.reflection)
	{
		c.reflection.className = name;
	}
}

function snowstack_update(newIndex, newmagnifymode)
{
	if (currentCellIndex == newIndex && magnifyMode == newmagnifymode)
	{
		return;
	}
	
	if (currentCellIndex != -1)
	{
		var oldCell = cells[currentCellIndex];
		setcellclass(oldCell, "cell");
	}
	
	newIndex = Math.min(Math.max(newIndex, 0), cells.length - 1);
	currentCellIndex = newIndex;

	var cell = cells[newIndex];

	magnifyMode = newmagnifymode;
	
	if (magnifyMode)
	{
		// User figured out magnify mode, not a newbie.
		newbieUser = false;

		// Show the photo caption
		
		if (snowstack_options.captions)
		{
			caption.innerText = cell.info.title;
			caption.style.opacity = 1;
		}
		else if (caption)
		{
			caption.style.opacity = 0;
		}

		cell.div.className = "cell magnify";
		
		if (snowstack_options.refreshzoom)
		{
			refreshImage(cell.divimage, cell);
		}
	}
	else
	{
		setcellclass(cell, "cell selected");
		
		if (snowstack_options.captions)
		{
			caption.style.opacity = 0;
		}
	}

	if (newbieUser)
	{
		newbieUser = false;
		
		if (snowstack_options.captions)
		{
			caption.style.opacity = 0;
		}
	}

	dolly.style.webkitTransform = cameraTransformForCell(newIndex);
	
	var currentMatrix = new WebKitCSSMatrix(document.defaultView.getComputedStyle(dolly, null).webkitTransform);
	var targetMatrix = new WebKitCSSMatrix(dolly.style.webkitTransform);
	
	var dx = currentMatrix.e - targetMatrix.e;
	var angle = Math.min(Math.max(dx / (CXSPACING * 3), -1), 1) * 45;

	camera.style.webkitTransform = "rotateY(" + angle + "deg)";
	camera.style.webkitTransitionDuration = "330ms";

	if (currentTimer)
	{
		clearTimeout(currentTimer);
	}
	
	currentTimer = setTimeout(function ()
	{
		camera.style.webkitTransform = "rotateY(0)";
		camera.style.webkitTransitionDuration = "5s";
	}, 330);
}

function snowstack_addimage(info)
{
	var cell = {};
	var n = cells.length;
	cells.push(cell);

	var x = Math.floor(n / snowstack_options.rows);
	var y = n - x * snowstack_options.rows;
	
	if (typeof info === "string")
	{
		var imageurl = info;
		info = { "thumb": imageurl, "zoom": imageurl, "title": "" };
	}

	cell.info = info;
	
	function make_celldiv()
	{
		var div = vfx.elem("div", { "class": "cell", "style": 'width: ' + CWIDTH + 'px; height: ' + CHEIGHT + 'px' });
		div.style.webkitTransform = vfx.translate3d(x * CXSPACING, y * CYSPACING, 0);
		return div;
	}

	cell.div = make_celldiv();

	cell.divimage = vfx.elem("img", { "class": "media" });

	vfx.loadhandler(cell.divimage, function ()
	{
		layoutMediaInCell(cell.divimage);
		cell.divimage.style.opacity = 0;
		
		if (cell.info.link)
		{
			cell.div.appendChild(vfx.elem("a", { "class": "mover view", "href": cell.info.link, "target": "_blank" }, cell.divimage));
		}
		else
		{
			cell.div.appendChild(vfx.elem("div", { "class": "mover view" }, cell.divimage));
		}
		
		cell.divimage.style.opacity = 1.0;
	});
	
	cellstack.appendChild(cell.div);
	cell.divimage.src = info.thumb;

	if (y == (snowstack_options.rows - 1))
	{
		cell.reflection = make_celldiv();

		cell.reflectionimage = vfx.elem("img", { "class": "media reflection" });
	
		vfx.loadhandler(cell.reflectionimage, function ()
		{
			layoutMediaInCell(cell.reflectionimage);
			cell.reflectionimage.style.opacity = 0;
			cell.reflection.appendChild(vfx.elem("div", { "class": "mover view" }, cell.reflectionimage));
			cell.reflectionimage.style.opacity = 1.0;
		});
	
		reflectionstack.appendChild(cell.reflection);
		cell.reflectionimage.src = info.thumb;
	}
}

global.snowstack_init = function (imagefun, options)
{
	var loading = true;
	
	camera = vfx.byid("camera");
	
	reflectionstack = vfx.elem("div", { "class": "view" });
	var mirror = vfx.elem("div", { "class": "view" }, reflectionstack);
	cellstack = vfx.elem("div", { "class": "view" });
	dolly = vfx.elem("div", { "class": "dolly view" });
	dolly.appendChild(cellstack);
	dolly.appendChild(mirror);
	
	while (camera.hasChildNodes())
	{
		camera.removeChild(camera.firstChild);
	}

	camera.appendChild(dolly);

	if (options)
	{
		for (var key in options)
		{
			if (options.hasOwnProperty(key))
			{
				snowstack_options[key] = options[key];
			}
		}
	}
	
	if (typeof imagefun !== "function")
	{
		var images_array = imagefun;
		imagefun = function (callback)
		{
			callback(images_array);
			images_array = [];
		};
	}

	CHEIGHT = Math.round(window.innerHeight / (snowstack_options.rows + 2));
	CWIDTH = Math.round(CHEIGHT * 300 / 180);
	CXSPACING = CWIDTH + CGAP;
	CYSPACING = CHEIGHT + CGAP;

	mirror.style.webkitTransform = "scaleY(-1.0) " + vfx.translate3d(0, - CYSPACING * (snowstack_options.rows * 2) - 1, 0);

	imagefun(function (images)
	{
		images.forEach(snowstack_addimage);
		snowstack_update(Math.floor(snowstack_options.rows / 2), false);
		loading = false;
	});

	var keys = { left: false, right: false, up: false, down: false };

	var keymap = { 37: "left", 38: "up", 39: "right", 40: "down" };

	var keytimer = null;
	var keydelay = 330;

	function updatekeys()
	{
		var newCellIndex = currentCellIndex;
		if (keys.left)
		{
			/* Left Arrow */
			if (newCellIndex >= snowstack_options.rows)
			{
				newCellIndex -= snowstack_options.rows;
			}
		}
		if (keys.right)
		{
			/* Right Arrow */
			if ((newCellIndex + snowstack_options.rows) < cells.length)
			{
				newCellIndex += snowstack_options.rows;
			}
			else if (!loading)
			{
				/* We hit the right wall, add some more */
				loading = true;
				imagefun(function (images)
				{
					images.forEach(snowstack_addimage);
					loading = false;
				});
			}
		}
		if (keys.up)
		{
			/* Up Arrow */
			newCellIndex -= 1;
		}
		if (keys.down)
		{
			/* Down Arrow */
			newCellIndex += 1;
		}

		snowstack_update(newCellIndex, magnifyMode);
	}

	function repeattimer()
	{
		updatekeys();
		keytimer = setTimeout(repeattimer, keydelay);
		keydelay = 60;
	}

	function keycheck()
	{
		if (keys.left || keys.right || keys.up || keys.down)
		{
			if (keytimer === null)
			{
				keydelay = 330;
				repeattimer();
			}
		}
		else
		{
			clearTimeout(keytimer);
			keytimer = null;
		}
	}

	/* Limited keyboard support for now */
	window.addEventListener('keydown', function (e)
	{
		if (e.keyCode == 32)
		{
			/* Magnify toggle with spacebar */
			snowstack_update(currentCellIndex, !magnifyMode);
		}
		else
		{
			keys[keymap[e.keyCode]] = true;
		}
		
		keycheck();
	});

	window.addEventListener('keyup', function (e)
	{
		keys[keymap[e.keyCode]] = false;
		keycheck();
	});
};

//})(); // end module pattern

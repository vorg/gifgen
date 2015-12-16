var plask       = require('plask');
var fs          = require('fs');
var omggif      = require('omggif');
var neuquant    = require('neuquant');


if (!Uint8Array.prototype.slice && 'subarray' in Uint8Array.prototype) {
  Uint8Array.prototype.slice = Uint8Array.prototype.subarray;
}

var IN_X = 0;
var IN_Y = 0;
var OUT_SIZE = 512;
var FPS = 60;

var paint = new plask.SkPaint();

function fileToFrameImage(file) {
    var img = plask.SkCanvas.createFromImage(file);
    var w, h;
    if (img.width > img.height) {
        w = OUT_SIZE;
        h = Math.floor(OUT_SIZE * img.height / img.width);
    }
    else {
        w = Math.floor(OUT_SIZE * img.width / img.height);
        h = OUT_SIZE;
    }
    var canvas = plask.SkCanvas.create(w, h);
    canvas.drawCanvas(paint, img, 0, 0, w, h);
    return canvas;
}

function canvasToRgb(canvas) {
    var bytes = [];
    var pixels = canvas.pixels || canvas;
    var w = canvas.width;
    var h = canvas.height;
    for(var y=0; y<h; y++) {
        for(var x=0; x<w; x++) {
            bytes.push(pixels[(x + y*w)*4 + 2]);//R
            bytes.push(pixels[(x + y*w)*4 + 1]);//G
            bytes.push(pixels[(x + y*w)*4 + 0]);//B
        }
    }
    return bytes;
}

function makeGif(files) {
    console.log('makeGif files', files.length);
    console.log('makeGif load');
    var frames = files.map(fileToFrameImage);
    console.log('makeGif get rgb');
    var rgbFrames = frames.map(canvasToRgb);
    var allPixels = rgbFrames.reduce(function(all, frame) {
        return all.concat(frame);
    }, []);

    console.log('makeGif quantize');
    var quality = 1;
    var palette = neuquant.quantize(rgbFrames[0], quality).palette;
    var bytesPalette = [];
    for(var i=0; i<palette.length; i+=3) {
        var color = palette[i+0] << 16 | palette[i+1] << 8 | palette[i+2] << 0;
        bytesPalette.push(color);
    }

    console.log('makeGif index');
    var indexedFrames = rgbFrames.map(function(frame) {
        return neuquant.index(frame, palette);
    })

    console.log('makeGif encode');
    var w = frames[0].width;
    var h = frames[0].height;
    var buffer = new Uint8Array( w * h * frames.length * 3 * 8 );
    var gif = new omggif.GifWriter( buffer, w, h, { loop: 0 } );
    indexedFrames.forEach(function(pixels) {
        gif.addFrame( 0, 0, w, h, pixels, { palette: bytesPalette, delay : Math.floor(1000/FPS) });
    });

    var dot = files[0].lastIndexOf('.');
    var out = files[0].slice(0, dot) + '_anim.gif';

    console.log('makeGif write');
    var end = gif.end();
    var buff = new Buffer(buffer.slice(0, end), 'binary');
    fs.writeFileSync(out, buff, 'binary');

    console.log('makeGif done!');
    return frames;
}


plask.simpleWindow({
  settings: {
    type: '2d',
    width: 512,
    height: 512
  },
  init: function() {
      this.on('filesDropped', function(e) {
          this.frames = makeGif(e.paths);
      }.bind(this));
      this.framerate(FPS/10);
  },
  draw: function() {
    var paint = this.paint;
    var canvas = this.canvas;
    canvas.drawColor(0,0,0,255);

    if (this.frames) {
        var frame = this.frames[this.framenum % this.frames.length];
        var w, h;
        if (frame.width > frame.height) {
            w = OUT_SIZE;
            h = Math.floor(OUT_SIZE * frame.height / frame.width);
        }
        else {
            w = Math.floor(OUT_SIZE * frame.width / frame.height);
            h = OUT_SIZE;
        }
        var x = (this.width - w)/2;
        var y = (this.height - h)/2;
        canvas.drawCanvas(paint, frame, x, y, x + w, y + h);
    }
    else {
        paint.setFill();
        paint.setColor(255,255,255,255);
        paint.setTextSize(30);
        paint.setAntiAlias(true);
        var msg = 'Drop images here';
        canvas.drawText(paint, msg, this.width/2 - paint.measureText(msg)/2, this.height/2);
    }
  }
})

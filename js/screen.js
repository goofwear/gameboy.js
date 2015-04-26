var Screen = function(canvas, cpu) {
    cpu.screen = this;
    this.WIDTH = 160;
    this.HEIGHT = 144;
    this.PIXELSIZE = 2;
    this.FREQUENCY = 60;
    this.colors = [
        '#000',
        '#555',
        '#AAA',
        '#FFF'
    ];
    this.SCY = 0xFF42;
    this.SCX = 0xFF43;
    //this.colors = ['red','green','blue','yellow'];
    this.vram = cpu.memory.vram.bind(cpu.memory);
    this.tilemap = {
        HEIGHT: 32,
        WIDTH: 32,
        START_0: 0x9800,
        START_1: 0x9C00,
        LENGTH: 0x0400 // 1024 bytes = 32*32
    };
    this.deviceram = cpu.memory.deviceram.bind(cpu.memory);
    this.LCDC = 0;

    canvas.width = this.WIDTH * this.PIXELSIZE;
    canvas.height = this.HEIGHT * this.PIXELSIZE;

    this.context = canvas.getContext('2d');
};

Screen.prototype.drawFrame = function() {

    this.clearScreen();
    this.LCDC = this.deviceram(0xFF40);
    var enable = Memory.readBit(this.LCDC, 7);
    if (enable) {
        this.drawBackground();
        this.drawWindow();
    }
};

Screen.prototype.drawBackground = function() {
    if (!Memory.readBit(this.LCDC, 0)) {
        return;
    }

    var buffer = new Array(256*256);
    var mapStart = Memory.readBit(this.LCDC, 3) ? this.tilemap.START_1 : this.tilemap.START_0;
    // browse BG tilemap
    for (var i = 0; i < this.tilemap.LENGTH; i++) {
        var tileIndex = this.vram(i + mapStart);

        var tileData = this.readTileData(tileIndex);
        this.drawTile(tileData, i, buffer);
    }

    var bgx = this.deviceram(this.SCX);
    var bgy = this.deviceram(this.SCY);
    for (var x = 0; x < this.WIDTH; x++) {
        for (var y = 0; y < this.HEIGHT; y++) {
            color = buffer[((x-bgx) & 255) + ((y-bgy) & 255) * 256]; // "n & 255" gets correct n%256 even if n<0
            this.drawPixel(x, y, color);
        }
    }
};

Screen.prototype.drawTile = function(tileData, index, buffer) {
    var x = index % 32;
    var y = (index / 32) | 0;

    for (var line = 0; line < 8; line++) {
        var b1 = tileData.shift();
        var b2 = tileData.shift();

        for (var pixel = 7; pixel >= 0; pixel--) {
            var colorValue = ((b1 & (1 << pixel)) >> pixel) + ((b2 & (1 << pixel)) >> pixel)*2;
            buffer[(x*8 + 7-pixel) + ((y*8)+line) * 256] = colorValue;
        }
    }
};

Screen.prototype.readTileData = function(tileIndex) {
    var dataStart = Memory.readBit(this.LCDC, 4) ? 0x8000 : 0x8800;
    var tileSize  = 0x10; // 16 bytes / tile
    var tileData = new Array();

    tileStart = dataStart + (tileIndex*tileSize);
    for (var i = tileStart; i < tileStart + tileSize; i++) {
        tileData.push(this.vram(i));
    }

    return tileData;
};

Screen.prototype.drawWindow = function() {

};

Screen.prototype.clearScreen = function() {
    this.context.fillStyle = '#FFF';
    this.context.fillRect(0, 0, this.WIDTH * this.PIXELSIZE, this.HEIGHT * this.PIXELSIZE);
};
Screen.prototype.drawPixel = function(x, y, color) {
    if (this.colors[color] == '#FFF') {
        return;
    }
    this.context.fillStyle = this.colors[color];
    this.context.fillRect(x * this.PIXELSIZE, y * this.PIXELSIZE, this.PIXELSIZE, this.PIXELSIZE);
};

var Processor = function() {

    this.INTERRUPTS = {
        TIMER: 2
    };
    this.interruptRoutines = {
        2: timerInterrupt
    };

    var proc = this;
    function timerInterrupt() {
        console.log('timer');
        proc.memory[0xFF42]++;
    }

    this.r = {A:0, F: 0, B:0, C:0, D:0, E:0, H:0, L:0, pc:0, sp:0};
    this.clock = {c: 0, serial: 0};
    this.memory = new Memory(this);
    this.interruptEnable = true;
    this.SERIAL_INTERNAL_INSTR = 512; // instr to wait per bit if internal clock
    this.enableSerial = 0;
    this.serialHandler = {out:function(data) {console.log('serial: '+String.fromCharCode(data)+'('+data+')' );}, in:function(){return 0xFF;}};
};

Processor.prototype.reset = function() {
    this.memory.reset();

    this.r.sp = 0xFFFE;
    this.r.pc = 0x0100;
};

Processor.prototype.loadRom = function(data) {
    this.memory.setRomData(data);
};

Processor.prototype.run = function() {
    this.frame();
};

Processor.prototype.frame = function() {
    this.nextFrameTimer = setTimeout(this.frame.bind(this), 1000 / this.screen.FREQUENCY);

    var maxInstructions = 70224;
    this.clock.c = 0;
    var skipped = 0;

    while (this.clock.c < maxInstructions) {
        var opcode = this.memory[this.r.pc++];
        if (!map[opcode]) {
            skipped++;
            this.clock.c += 4;
            continue;
        }
        var oldInstrCount = this.clock.c;
        map[opcode](this);
        if (this.enableSerial) {
            var instr = this.clock.c - oldInstrCount;
            this.clock.serial += instr;
            if (this.clock.serial >= 8 * this.SERIAL_INTERNAL_INSTR) {
                this.endSerialTransfer();
            }
        }
    }
    this.screen.drawFrame();

};

Processor.prototype.timer = function() {
    var time = 1000;
    setTimeout(this.timer.bind(this), time);
    this.memory[this.TIMER_COUNTER]++;
    if (this.memory[this.TIMER_COUNTER] > 255) {
        this.memory[this.TIMER_COUNTER] = this.memory[this.TIMER_OVERFLOW];
    }

    this.interrupt(this.INTERRUPTS.TIMER);
};

Processor.prototype.interrupt = function(type) {
    if (this.isInterruptEnable(type)) {
        this.interruptRoutines[type]();
    }
};

Processor.prototype.isInterruptEnable = function(type) {
    return true;
};

Processor.prototype.enableSerialTransfer = function() {
    this.enableSerial = 1;
    this.clock.serial = 0;
};

Processor.prototype.endSerialTransfer = function() {
    this.enableSerial = 0;
    var data = this.memory[0xFF01];
    this.memory.wb(0xFF02, 0);
    this.serialHandler.out(data);
    this.memory.wb(this.serialHandler.in());
};

var map = {
    0x00: function(p){p.clock.c += 4;},
    0x01: function(p){ops.LDrrnn(p, 'B', 'C');},
    0x02: function(p){ops.LDrrar(p, 'B', 'C', 'A');},
    0x03: function(p){ops.INCrr(p, 'B', 'C');},
    0x04: function(p){ops.INCr(p, 'B');},
    0x05: function(p){ops.DECr(p, 'B');},
    0x06: function(p){ops.LDrn(p, 'B');},
    0x07: function(p){p.r.F=0;var out=p.r.A & 0x80?1:0; out ? p.r.F|=0x10:p.r.F&=0xEF; p.r.A=((p.r.A<<1)+out)&0xFF;p.clock.c+=4;},
    //0x08: function(p){},
    0x09: function(p){ops.ADDrrrr(p, 'H', 'L', 'B', 'C');},
    0x0A: function(p){ops.LDrrra(p, 'A', 'B', 'C');},
    0x0B: function(p){ops.DECrr(p, 'B', 'C');},
    0x0C: function(p){ops.INCr(p, 'C');},
    0x0D: function(p){ops.DECr(p, 'C');},
    0x0E: function(p){ops.LDrn(p, 'C');},
    0x0F: function(p){p.r.F=0;var out=p.r.A & 0x01; out ? p.r.F|=0x10:p.r.F&=0xEF; p.r.A=(p.r.A>>1)|(out*0x80);p.clock.c+=4;},

    0x10: function(p){p.r.pc++;p.clock.c+=4;},
    0x11: function(p){ops.LDrrnn(p, 'D', 'E');},
    0x12: function(p){ops.LDrrar(p, 'D', 'E', 'A');},
    0x13: function(p){ops.INCrr(p, 'D', 'E');},
    0x14: function(p){ops.INCr(p, 'D');},
    0x15: function(p){ops.DECCr(p, 'D');},
    0x16: function(p){ops.LDrn(p, 'D');},
    0x17: function(p){var c = (p.r.F&0x10)?1:0;p.r.F=0;var out=p.r.A & 0x80?1:0; out ? p.r.F|=0x10:p.r.F&=0xEF; p.r.A=(p.r.A<<1)+c;p.clock.c+=4;},
    0x18: function(p){ops.JRn(p);},
    0x19: function(p){ops.ADDrrrr(p, 'H', 'L', 'D', 'E');},
    0x1A: function(p){ops.LDrrra(p, 'A', 'D', 'E');},
    0x1B: function(p){ops.DECrr(p, 'D', 'E');},
    0x1C: function(p){ops.INCr(p, 'E');},
    0x1D: function(p){ops.DECr(p, 'E');},
    0x1E: function(p){ops.LDrn(p, 'E');},
    0x1F: function(p){var c = (p.r.F&0x10)?1:0;p.r.F=0;var out=p.r.A & 0x01; out ? p.r.F|=0x10:p.r.F&=0xEF; p.r.A=(p.r.A>>1)|(c*0x80);p.clock.c+=4;},

    0x20: function(p){ops.JRccn(p, 'NZ');},
    0x21: function(p){ops.LDrrnn(p, 'H', 'L');},
    0x22: function(p){ops.LDrrar(p, 'H', 'L', 'A');ops.INCrr(p, 'H', 'L');p.clock.c -= 8;},
    0x23: function(p){ops.INCrr(p, 'H', 'L');},
    0x24: function(p){ops.INCr(p, 'H');},
    0x25: function(p){ops.DECr(p, 'H');},
    0x26: function(p){ops.LDrn(p, 'H');},
    // 0x27: function(p) {ops.DAA(p);}, not implemented
    0x28: function(p){ops.JRccn(p, 'Z');},
    0x29: function(p){ops.ADDrrrr(p, 'H', 'L', 'H', 'L');},
    0x2A: function(p){ops.LDrrra(p, 'A', 'H', 'L');ops.INCrr(p, 'H', 'L');p.clock.c -= 8;},
    0x2B: function(p){ops.DECrr(p, 'H', 'L');},
    0x2C: function(p){ops.INCr(p, 'L');},
    0x2D: function(p){ops.DECr(p, 'L');},
    0x2E: function(p){ops.LDrn(p, 'L');},
    0x2F: function(p){ops.CPL(p);},

    0x30: function(p){ops.JRccn(p, 'NC');},
    0x31: function(p){ops.LDspnn(p);},
    0x32: function(p){ops.LDrrar(p, 'H', 'L', 'A');ops.DECrr(p, 'H', 'L');p.clock.c -= 8;},
    0x35: function(p){ops.DECrra(p, 'H', 'L');},
    0x37: function(p){ops.SCF(p);},
    0x38: function(p){ops.JRccn(p, 'C');},
    0x3C: function(p){ops.INCr(p, 'A');},
    0x3D: function(p){ops.DECr(p, 'A');},
    0x3E: function(p){ops.LDrn(p, 'A');},
    0x3F: function(p){ops.CCF(p);},

    0x40: function(p){ops.LDrr(p, 'B', 'B');},
    0x41: function(p){ops.LDrr(p, 'B', 'C');},
    0x42: function(p){ops.LDrr(p, 'B', 'D');},
    0x43: function(p){ops.LDrr(p, 'B', 'E');},
    0x44: function(p){ops.LDrr(p, 'B', 'H');},
    0x45: function(p){ops.LDrr(p, 'B', 'L');},
    0x46: function(p){ops.LDrrra(p, 'B', 'H', 'L');},
    0x47: function(p){ops.LDrr(p, 'B', 'A');},
    0x48: function(p){ops.LDrr(p, 'C', 'B');},
    0x49: function(p){ops.LDrr(p, 'C', 'C');},
    0x4A: function(p){ops.LDrr(p, 'C', 'D');},
    0x4B: function(p){ops.LDrr(p, 'C', 'E');},
    0x4C: function(p){ops.LDrr(p, 'C', 'H');},
    0x4D: function(p){ops.LDrr(p, 'C', 'L');},
    0x4E: function(p){ops.LDrrra(p, 'C', 'H', 'L');},
    0x4F: function(p){ops.LDrr(p, 'C', 'A');},

    0x50: function(p){ops.LDrr(p, 'D', 'B');},
    0x51: function(p){ops.LDrr(p, 'D', 'C');},
    0x52: function(p){ops.LDrr(p, 'D', 'D');},
    0x53: function(p){ops.LDrr(p, 'D', 'E');},
    0x54: function(p){ops.LDrr(p, 'D', 'H');},
    0x55: function(p){ops.LDrr(p, 'D', 'L');},
    0x56: function(p){ops.LDrrra(p, 'D', 'H', 'L');},
    0x57: function(p){ops.LDrr(p, 'D', 'A');},
    0x58: function(p){ops.LDrr(p, 'E', 'B');},
    0x59: function(p){ops.LDrr(p, 'E', 'C');},
    0x5A: function(p){ops.LDrr(p, 'E', 'D');},
    0x5B: function(p){ops.LDrr(p, 'E', 'E');},
    0x5C: function(p){ops.LDrr(p, 'E', 'H');},
    0x5D: function(p){ops.LDrr(p, 'E', 'L');},
    0x5E: function(p){ops.LDrrra(p, 'E', 'H', 'L');},
    0x5F: function(p){ops.LDrr(p, 'E', 'A');},

    0x60: function(p){ops.LDrr(p, 'H', 'B');},
    0x61: function(p){ops.LDrr(p, 'H', 'C');},
    0x62: function(p){ops.LDrr(p, 'H', 'D');},
    0x63: function(p){ops.LDrr(p, 'H', 'E');},
    0x64: function(p){ops.LDrr(p, 'H', 'H');},
    0x65: function(p){ops.LDrr(p, 'H', 'L');},
    0x66: function(p){ops.LDrrra(p, 'H', 'H', 'L');},
    0x67: function(p){ops.LDrr(p, 'H', 'A');},
    0x68: function(p){ops.LDrr(p, 'L', 'B');},
    0x69: function(p){ops.LDrr(p, 'L', 'C');},
    0x6A: function(p){ops.LDrr(p, 'L', 'D');},
    0x6B: function(p){ops.LDrr(p, 'L', 'E');},
    0x6C: function(p){ops.LDrr(p, 'L', 'H');},
    0x6D: function(p){ops.LDrr(p, 'L', 'L');},
    0x6E: function(p){ops.LDrrra(p, 'L', 'H', 'L');},
    0x6F: function(p){ops.LDrr(p, 'L', 'A');},

    0x70: function(p){ops.LDrrar(p, 'H', 'L', 'B');},
    0x71: function(p){ops.LDrrar(p, 'H', 'L', 'C');},
    0x72: function(p){ops.LDrrar(p, 'H', 'L', 'D');},
    0x73: function(p){ops.LDrrar(p, 'H', 'L', 'E');},
    0x74: function(p){ops.LDrrar(p, 'H', 'L', 'H');},
    0x75: function(p){ops.LDrrar(p, 'H', 'L', 'L');},
    0x76: function(p){p.clock.c+=4;},
    0x77: function(p){ops.LDrrar(p, 'H', 'L', 'A');},
    0x78: function(p){ops.LDrr(p, 'A', 'B');},
    0x79: function(p){ops.LDrr(p, 'A', 'C');},
    0x7A: function(p){ops.LDrr(p, 'A', 'D');},
    0x7B: function(p){ops.LDrr(p, 'A', 'E');},
    0x7C: function(p){ops.LDrr(p, 'A', 'H');},
    0x7D: function(p){ops.LDrr(p, 'A', 'L');},
    0x7E: function(p){ops.LDrrra(p, 'A', 'H', 'L');},
    0x7F: function(p){ops.LDrr(p, 'A', 'A');},

    0x80: function(p){ops.ADDrr(p, 'A', 'B');},
    0x81: function(p){ops.ADDrr(p, 'A', 'C');},
    0x82: function(p){ops.ADDrr(p, 'A', 'D');},
    0x83: function(p){ops.ADDrr(p, 'A', 'E');},
    0x84: function(p){ops.ADDrr(p, 'A', 'H');},
    0x85: function(p){ops.ADDrr(p, 'A', 'L');},
    0x86: function(p){ops.ADDrrra(p, 'A', 'H', 'L');},
    0x87: function(p){ops.ADDrr(p, 'A', 'A');},
    0x88: function(p){ops.ADCrr(p, 'A', 'B');},
    0x89: function(p){ops.ADCrr(p, 'A', 'C');},
    0x8A: function(p){ops.ADCrr(p, 'A', 'D');},
    0x8B: function(p){ops.ADCrr(p, 'A', 'E');},
    0x8C: function(p){ops.ADCrr(p, 'A', 'H');},
    0x8D: function(p){ops.ADCrr(p, 'A', 'L');},
    0x8E: function(p){ops.ADCrrra(p, 'A', 'H', 'L');},
    0x8F: function(p){ops.ADCrr(p, 'A', 'A');},

    0x90: function(p){ops.SUBr(p, 'B');},
    0x91: function(p){ops.SUBr(p, 'C');},
    0x92: function(p){ops.SUBr(p, 'D');},
    0x93: function(p){ops.SUBr(p, 'E');},
    0x94: function(p){ops.SUBr(p, 'H');},
    0x95: function(p){ops.SUBr(p, 'L');},
    0x97: function(p){ops.SUBr(p, 'A');},

    0xA0: function(p){ops.ANDr(p, 'B');},
    0xA1: function(p){ops.ANDr(p, 'C');},
    0xA2: function(p){ops.ANDr(p, 'D');},
    0xA3: function(p){ops.ANDr(p, 'E');},
    0xA4: function(p){ops.ANDr(p, 'H');},
    0xA5: function(p){ops.ANDr(p, 'L');},
    //0xA6: function(p){},
    0xA7: function(p){ops.ANDr(p, 'A');},
    0xA8: function(p){ops.XORr(p, 'B');},
    0xA9: function(p){ops.XORr(p, 'C');},
    0xAA: function(p){ops.XORr(p, 'D');},
    0xAB: function(p){ops.XORr(p, 'E');},
    0xAC: function(p){ops.XORr(p, 'H');},
    0xAD: function(p){ops.XORr(p, 'L');},
    0xAE: function(p){ops.XORrra(p, 'H', 'L');},
    0xAF: function(p){ops.XORr(p, 'A');},

    0xB0: function(p){ops.ORr(p, 'B');},
    0xB1: function(p){ops.ORr(p, 'C');},
    0xB2: function(p){ops.ORr(p, 'D');},
    0xB3: function(p){ops.ORr(p, 'E');},
    0xB4: function(p){ops.ORr(p, 'H');},
    0xB5: function(p){ops.ORr(p, 'L');},
    0xB6: function(p){ops.ORrra(p, 'H', 'L');},
    0xB7: function(p){ops.ORr(p, 'A');},
    0xB8: function(p){ops.CPr(p, 'B');},
    0xB9: function(p){ops.CPr(p, 'C');},
    0xBA: function(p){ops.CPr(p, 'D');},
    0xBB: function(p){ops.CPr(p, 'E');},
    0xBC: function(p){ops.CPr(p, 'H');},
    0xBD: function(p){ops.CPr(p, 'L');},
    0xBE: function(p){ops.CPrra(p, 'H', 'L');},
    0xBF: function(p){ops.CPr(p, 'A');},

    0xC0: function(p){ops.RETcc(p, 'NZ');},
    0xC1: function(p){ops.POPrr(p, 'B', 'C');},
    0xC2: function(p){ops.JPccnn(p, 'NZ');},
    0xC3: function(p){ops.JPnn(p);},
    0xC4: function(p){ops.CALLccnn(p, 'NZ');},
    0xC5: function(p){ops.PUSHrr(p, 'B', 'C');},
    0xC6: function(p){ops.ADDrn(p, 'A');},
    0xC7: function(p){ops.RSTn(p, 0x00);},
    0xC8: function(p){ops.RETcc(p, 'Z');},
    0xC9: function(p){ops.RET(p);},
    0xCA: function(p){ops.JPccnn(p, 'Z');},
    0xCB: function(p){ops.CB(p);},
    0xCC: function(p){ops.CALLccnn(p, 'Z');},
    0xCD: function(p){ops.CALLnn(p);},
    0xCE: function(p){ops.ADCrn(p, 'A');},
    0xCF: function(p){ops.RSTn(p, 0x08);},

    0xD0: function(p){ops.RETcc(p, 'NC');},
    0xD1: function(p){ops.POPrr(p, 'D', 'E');},
    0xD2: function(p){ops.JPccnn(p, 'NC');},
    //0xD3 empty
    0xD4: function(p){ops.CALLccnn(p, 'NC');},
    0xD5: function(p){ops.PUSHrr(p, 'D', 'E');},
    0xD6: function(p){ops.SUBn(p);},
    0xD7: function(p){ops.RSTn(p, 0x10);},
    0xD8: function(p){ops.RETcc(p, 'C');},
    0xDA: function(p){ops.JPccnn(p, 'C');},
    //0xDB empty
    0xDC: function(p){ops.CALLccnn(p, 'C');},
    //0xDD empty
    0xDF: function(p){ops.RSTn(p, 0x18);},

    0xE0: function(p){ops.LDHnar(p, 'A');},
    0xE1: function(p){ops.POPrr(p, 'H', 'L');},
    0xE2: function(p){ops.LDrar(p, 'C', 'A');},
    //0xE3 empty
    //0xE4 empty
    0xE5: function(p){ops.PUSHrr(p, 'H', 'L');},
    0xE6: function(p){ops.ANDn(p);},
    0xE7: function(p){ops.RSTn(p, 0x20);},
    0xE9: function(p){ops.JPrr(p, 'H', 'L');},
    0xEA: function(p){ops.LDnnar(p, 'A');},
    //0xEB empty
    //0xEC empty
    //0xED empty
    0xEE: function(p){ops.XORn(p);},
    0xEF: function(p){ops.RSTn(p, 0x28);},

    0xF0: function(p){ops.LDHrna(p, 'A');},
    0xF1: function(p){ops.POPrr(p, 'A', 'F');},
    0xF2: function(p){ops.LDrra(p, 'A', 'C');},
    //0xF4 empty
    0xF5: function(p){ops.PUSHrr(p, 'A', 'F');},
    0xF6: function(p){ops.ORn(p);},
    0xF7: function(p){ops.RSTn(p, 0x30);},
    0xFA: function(p){ops.LDrnna(p, 'A');},
    //0xFC empty
    //0xFD empty
    0xFE: function(p){ops.CPn(p);},
    0xFF: function(p){ops.RSTn(p, 0x38);}
};

var cbmap = {
    0x08: function(p){ops.RRCr(p, 'B');},
    0x09: function(p){ops.RRCr(p, 'C');},
    0x0A: function(p){ops.RRCr(p, 'D');},
    0x0B: function(p){ops.RRCr(p, 'E');},
    0x0C: function(p){ops.RRCr(p, 'H');},
    0x0D: function(p){ops.RRCr(p, 'L');},
    //0x0E: function(p){ops.RRCrra(p, 'H', 'L');},
    0x0F: function(p){ops.RRCr(p, 'A');},

    0x18: function(p){ops.RRr(p, 'B');},
    0x19: function(p){ops.RRr(p, 'C');},
    0x1A: function(p){ops.RRr(p, 'D');},
    0x1B: function(p){ops.RRr(p, 'E');},
    0x1C: function(p){ops.RRr(p, 'H');},
    0x1D: function(p){ops.RRr(p, 'L');},
    //0x1E: function(p){ops.RRrra(p, 'H', 'L');},
    0x1F: function(p){ops.RRr(p, 'A');},

    0x28: function(p){ops.SRAr(p, 'B');},
    0x29: function(p){ops.SRAr(p, 'C');},
    0x2A: function(p){ops.SRAr(p, 'D');},
    0x2B: function(p){ops.SRAr(p, 'E');},
    0x2C: function(p){ops.SRAr(p, 'H');},
    0x2D: function(p){ops.SRAr(p, 'L');},
    0x2F: function(p){ops.SRAr(p, 'A');},

    0x38: function(p){ops.SRLr(p, 'B');},
    0x39: function(p){ops.SRLr(p, 'C');},
    0x3A: function(p){ops.SRLr(p, 'D');},
    0x3B: function(p){ops.SRLr(p, 'E');},
    0x3C: function(p){ops.SRLr(p, 'H');},
    0x3D: function(p){ops.SRLr(p, 'L');},
    0x3F: function(p){ops.SRLr(p, 'A');},

    0x40: function(p){ops.BITir(p, 0, 'B');},
    0x41: function(p){ops.BITir(p, 0, 'C');},
    0x42: function(p){ops.BITir(p, 0, 'D');},
    0x43: function(p){ops.BITir(p, 0, 'E');},
    0x44: function(p){ops.BITir(p, 0, 'H');},
    0x45: function(p){ops.BITir(p, 0, 'L');},
    //0x46: function(p){ops.BITir(p, 0, 'B');},
    0x47: function(p){ops.BITir(p, 0, 'A');},
    0x48: function(p){ops.BITir(p, 1, 'B');},
    0x49: function(p){ops.BITir(p, 1, 'C');},
    0x4A: function(p){ops.BITir(p, 1, 'D');},
    0x4B: function(p){ops.BITir(p, 1, 'E');},
    0x4C: function(p){ops.BITir(p, 1, 'H');},
    0x4D: function(p){ops.BITir(p, 1, 'L');},
    //0x4E: function(p){ops.BITir(p, 1, 'B');},
    0x4F: function(p){ops.BITir(p, 1, 'A');},

    0x50: function(p){ops.BITir(p, 2, 'B');},
    0x51: function(p){ops.BITir(p, 2, 'C');},
    0x52: function(p){ops.BITir(p, 2, 'D');},
    0x53: function(p){ops.BITir(p, 2, 'E');},
    0x54: function(p){ops.BITir(p, 2, 'H');},
    0x55: function(p){ops.BITir(p, 2, 'L');},
    //0x56: function(p){ops.BITir(p, 2, 'B');},
    0x57: function(p){ops.BITir(p, 2, 'A');},
    0x58: function(p){ops.BITir(p, 3, 'B');},
    0x59: function(p){ops.BITir(p, 3, 'C');},
    0x5A: function(p){ops.BITir(p, 3, 'D');},
    0x5B: function(p){ops.BITir(p, 3, 'E');},
    0x5C: function(p){ops.BITir(p, 3, 'H');},
    0x5D: function(p){ops.BITir(p, 3, 'L');},
    //0x5E: function(p){ops.BITir(p, 3, 'B');},
    0x5F: function(p){ops.BITir(p, 3, 'A');},

    0x60: function(p){ops.BITir(p, 4, 'B');},
    0x61: function(p){ops.BITir(p, 4, 'C');},
    0x62: function(p){ops.BITir(p, 4, 'D');},
    0x63: function(p){ops.BITir(p, 4, 'E');},
    0x64: function(p){ops.BITir(p, 4, 'H');},
    0x65: function(p){ops.BITir(p, 4, 'L');},
    //0x66: function(p){ops.BITir(p, 4, 'B');},
    0x67: function(p){ops.BITir(p, 4, 'A');},
    0x68: function(p){ops.BITir(p, 5, 'B');},
    0x69: function(p){ops.BITir(p, 5, 'C');},
    0x6A: function(p){ops.BITir(p, 5, 'D');},
    0x6B: function(p){ops.BITir(p, 5, 'E');},
    0x6C: function(p){ops.BITir(p, 5, 'H');},
    0x6D: function(p){ops.BITir(p, 5, 'L');},
    //0x6E: function(p){ops.BITir(p, 5, 'B');},
    0x6F: function(p){ops.BITir(p, 5, 'A');},

    0x70: function(p){ops.BITir(p, 6, 'B');},
    0x71: function(p){ops.BITir(p, 6, 'C');},
    0x72: function(p){ops.BITir(p, 6, 'D');},
    0x73: function(p){ops.BITir(p, 6, 'E');},
    0x74: function(p){ops.BITir(p, 6, 'H');},
    0x75: function(p){ops.BITir(p, 6, 'L');},
    //0x76: function(p){ops.BITir(p, 6, 'B');},
    0x77: function(p){ops.BITir(p, 6, 'A');},
    0x78: function(p){ops.BITir(p, 7, 'B');},
    0x79: function(p){ops.BITir(p, 7, 'C');},
    0x7A: function(p){ops.BITir(p, 7, 'D');},
    0x7B: function(p){ops.BITir(p, 7, 'E');},
    0x7C: function(p){ops.BITir(p, 7, 'H');},
    0x7D: function(p){ops.BITir(p, 7, 'L');},
    //0x7E: function(p){ops.BITir(p, 7, 'B');},
    0x7F: function(p){ops.BITir(p, 7, 'A');}


};

var ops = {
    LDrrnn: function(p, r1, r2) {p.r[r2] = p.memory[p.r.pc];p.r[r1] = p.memory[p.r.pc+1]; p.r.pc+=2;p.clock.c += 12;},
    LDrrar: function(p, r1, r2, r3) {p.memory.wb((p.r[r1] << 8)+ p.r[r2],p.r[r3]);p.clock.c += 8;},
    LDrrra: function(p, r1, r2, r3) {p.r[r1] = p.memory[(p.r[r2] << 8)+ p.r[r3]];p.clock.c += 8;},
    LDrn:   function(p, r1) {p.r[r1] = p.memory[p.r.pc++];p.clock.c += 8;},
    LDrr:   function(p, r1, r2) {p.r[r1] = p.r[r2];p.clock.c += 4;},
    LDrar:  function(p, r1, r2) {p.memory.wb(p.r[r1]+0xFF, p.r[r2]);p.r.pc++;p.clock.c += 8;},
    LDrra:  function(p, r1, r2) {p.r[r1] = p.memory[p.r[r2]+0xFF];p.r.pc++;p.clock.c += 8;},
    LDspnn: function(p){p.r.sp = (p.memory[p.r.pc + 1] << 8) + p.memory[p.r.pc];p.r.pc+=2;p.clock.c += 12;},
    LDnnar: function(p, r1){var addr=(p.memory[p.r.pc + 1] << 8) + p.memory[p.r.pc];p.memory.wb(addr,p.r[r1]);p.r.pc+=2; p.clock.c += 16;},
    LDrnna: function(p, r1){var addr=(p.memory[p.r.pc + 1] << 8) + p.memory[p.r.pc];p.r[r1]=p.memory[addr];p.r.pc+=2; p.clock.c += 16;},
    LDHnar: function(p, r1){p.memory.wb(0xFF00 + p.memory[p.r.pc++],p.r[r1]);p.clock.c+=12;},
    LDHrna: function(p, r1){p.r[r1]=p.memory[0xFF00 + p.memory[p.r.pc++]];p.clock.c+=12;},
    INCrr:  function(p, r1, r2) {p.r[r2]=(p.r[r2]+1)&255; p.r[r2] == 0 ? p.r[r1] = (p.r[r1]+1)&255:null;p.clock.c += 8;},
    INCr:   function(p, r1) {var h = (p.r[r1]&0xF + 1)&0x10;p.r[r1] = (p.r[r1] + 1) & 255;var z = p.r[r1]==0;
        p.r.F&=0x10;if(h)p.r.F|=0x20;if(z)p.r.F|=0x80;
        p.clock.c += 4;},
    DECrr:  function(p, r1, r2) {p.r[r2] = (p.r[r2] - 1) & 255; if (p.r[r2] == 255) p.r[r1] = (p.r[r1] - 1) & 255;p.clock.c += 8;},
    DECr:   function(p, r1) {var h = (p.r[r1]&0xF) < 1;p.r[r1] = (p.r[r1] - 1) & 255;var z = p.r[r1]==0;
        p.r.F&=0x10;p.r.F|=0x40;if(h)p.r.F|=0x20;if(z)p.r.F|=0x80;
        p.clock.c += 4;},
    DECrra: function(p, r1, r2){var addr = (p.r[r1] << 8)+ p.r[r2];var val = p.memory[addr]-1;var z = val==0;var h=(p.memory[addr]&0xF) < 1;
        p.memory.wb(addr, val);
        p.r.F&=0x10;p.r.F|=0x40;if(h)p.r.F|=0x20;if(z)p.r.F|=0x80;
        p.clock.c+=12;},
    ADDrr:  function(p, r1, r2) {var n = p.r[r2];ops._ADDrn(p, r1, n); p.clock.c += 4;},
    ADDrn:  function(p, r1) {var n = p.memory[p.r.pc++];ops._ADDrn(p, r1, n); p.clock.c+=8;},
    _ADDrn: function(p, r1, n) {var h=((p.r[r1]&0xF)+(n&0xF))&0x10;p.r[r1]+=n;var c=p.r[r1]&0x100;p.r[r1]&=255;
            var f = 0;if (p.r[r1]==0)f|=0x80;if (h)f|=0x20;if (c)f|=0x10;p.r.F=f;},
    ADDrrrr:function(p, r1, r2, r3, r4) {var v1 = (p.r[r1]<<8) + p.r[r2];var v2 = (p.r[r3]<<8) + p.r[r4];
        var res = v1 + v2;var c = res&0x10000;var h = ((v1&0xFFF) + (v2&0xFFF))&0x1000;var z = p.r.F&0x80;
        res&=0xFFFF;p.r[r2]=res&0xFF;res=res>>8;p.r[r1]=res&0xFF;
        var f=0;if(z)f|=0x80;if(h)f|=0x20;if(c)f|=0x10;p.r.F=f; p.clock.c+=8;},
    ADCrr:  function(p, r1, r2) {var n = p.r[r2]; ops._ADCrn(p, r1, n); p.clock.c += 4;},
    ADCrn:  function(p, r1) {var n = p.memory[p.r.pc++]; ops._ADCrn(p, r1, n); p.clock.c += 8;},
    _ADCrn: function(p, r1, n) {
        var c = p.r.F&0x10?1:0;var h=((p.r[r1]&0xF)+(n&0xF)+c)&0x10;
        p.r[r1]+=n+c;c=p.r[r1]&0x100;p.r[r1]&=255;
        var f = 0;if (p.r[r1]==0)f|=0x80;if (h)f|=0x20;if (c)f|=0x10;p.r.F=f;},
    ADCrrra:function(p, r1, r2, r3) {var n = p.memory[(p.r[r2] << 8)+ p.r[r3]]; ops._ADCrn(p, r1, n); p.clock.c += 8;},
    ADDrrra:function(p, r1, r2, r3) {var v = p.memory[(p.r[r2] << 8)+ p.r[r3]];var h=((p.r[r1]&0xF)+(v&0xF))&0x10;p.r[r1]+=v;var c=p.r[r1]&0x100;p.r[r1]&=255;
        var f = 0;if (p.r[r1]==0)f|=0x80;if (h)f|=0x20;if (c)f|=0x10;p.r.F=f;
        p.clock.c += 8;},
    SUBr:   function(p, r1) {var n = p.r[r1];ops._SUBn(p, n);p.clock.c += 4;},
    SUBn:   function(p) {var n = p.memory[p.r.pc++];ops._SUBn(p, n);p.clock.c += 8;},
    _SUBn:  function(p, n) {var c = p.r.A < n;var h = ((p.r.A&0xF) + (n&0xF))&0x10;
        p.r.A -= n;p.r.A&=0xFF; var z = p.r.A==0?1:0;
        var f = 0x40;if (z)f|=0x80;if (h)f|=0x20;if (c)f|=0x10;p.r.F=f;},
    ORr:    function(p, r1) {p.r.A|=p.r[r1];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 4;},
    ORn:    function(p) {p.r.A|=p.memory[p.r.pc++];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 4;},
    ORrra:  function(p, r1, r2) {p.r.A|=p.memory[(p.r[r1] << 8)+ p.r[r2]];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 8;},
    ANDr:   function(p, r1) {p.r.A&=p.r[r1];p.r.F=(p.r.A==0)?0xA0:0x20;p.clock.c += 4;},
    ANDn:   function(p) {p.r.A&=p.memory[p.r.pc++];p.r.F=(p.r.A==0)?0xA0:0x20;p.clock.c += 4;},
    XORr:   function(p, r1) {p.r.A^=p.r[r1];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 4;},
    XORn:   function(p) {p.r.A^=p.memory[p.r.pc++];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 4;},
    XORrra: function(p, r1, r2) {p.r.A^=p.memory[(p.r[r1] << 8)+ p.r[r2]];p.r.F=(p.r.A==0)?0x80:0x00;p.clock.c += 8;},
    CPr:    function(p, r1) {var n = p.r[r1];ops._CPn(p, n); p.clock.c += 4;},
    CPn:    function(p) {var n =p.memory[p.r.pc++];ops._CPn(p, n);p.clock.c+=8;},
    _CPn:   function(p, n) {
        var c = p.r.A < n;var z = p.r.A == n;var h = (p.r.A&0xF) < (n&0xF);
        var f = 0x40;if(z)f+=0x80;if (h)f+=0x20;if (c)f+=0x10;p.r.F=f;},
    RRCr:   function(p, r1) {p.r.F=0;var out=p.r[r1] & 0x01;if(out)p.r.F|=0x10;p.r[r1]=(p.r[r1]>>1)|(out*0x80);if(p.r[r1]==0)p.r.F|=0x80;p.clock.c+=4;},
    RRr:    function(p, r1) {var c=(p.r.F&0x10)?1:0;p.r.F=0;var out=p.r[r1]&0x01;out?p.r.F|=0x10:p.r.F&=0xEF;p.r[r1]=(p.r[r1]>>1)|(c*0x80);if(p.r[r1]==0)p.r.F|=0x80;p.clock.c+=4;},
    SRAr:   function(p, r1) {p.r.F = 0;if (p.r[r1]&0x01)p.r.F|=0x10;var msb=p.r[r1]&0x80;p.r[r1]=(p.r[r1]>>8)|msb;if (p.r[r1]==0)p.r.F|=0x80;p.clock.c+=4;},
    SRLr:   function(p, r1) {p.r.F = 0;if (p.r[r1]&0x01)p.r.F|=0x10;p.r[r1]=p.r[r1]>>8;if (p.r[r1]==0)p.r.F|=0x80;p.clock.c+=4;},
    BITir:  function(p, i, r1) {var mask=1<<i;var z=p.r[r1]&mask?1:0;var c=p.r.F&0x10;;var f = 0x20;if(z)f|=0x80;if(c) f|=0x10;p.r.F=f;p.clock.c+=4;},
    JPnn:   function(p) {p.r.pc = (p.memory[p.r.pc+1] << 8) + p.memory[p.r.pc];p.clock.c += 12;},
    JRccn:  function(p, cc) {var t=1;var mask=0x10;if(cc=='NZ'||cc=='NC')t=0;if(cc=='NZ'||cc=='Z')mask=0x80;
        if ((t && p.r.F&mask) || (!t && !(p.r.F&mask))){var v=p.memory[p.r.pc++];v=v&0x80?v-256:v;p.r.pc += v;p.clock.c+=4;}else{p.r.pc++;}
        p.clock.c += 8;},
    JPccnn: function(p, cc) {var t=1;var mask=0x10;if (cc=='NZ'||cc=='NC')t=0;if(cc=='NZ'||cc=='Z')mask=0x80;
        if ((t && p.r.F&mask) || (!t && !(p.r.F&mask))){p.r.pc = (p.memory[p.r.pc+1] << 8) + p.memory[p.r.pc];p.clock.c+=4;}else{p.r.pc+=2;}
        p.clock.c += 12;},
    JPrr:   function(p, r1, r2) {p.r.pc = (p.r[r1] << 8) + p.r[r2];p.clock.c += 4;},
    JRn:    function(p) {var v=p.memory[p.r.pc++];v=v&0x80?v-256:v;p.r.pc += v;p.clock.c += 12;},
    PUSHrr: function(p, r1, r2) {p.memory.wb(--p.r.sp, p.r[r1]);p.memory.wb(--p.r.sp, p.r[r2]);p.clock.c+=16;},
    POPrr:  function(p, r1, r2) {p.r[r2] = p.memory[p.r.sp++];p.r[r1] = p.memory[p.r.sp++];p.clock.c+=12;},
    RSTn:   function(p, n) {p.memory.wb(--p.r.sp,p.r.pc>>8);p.memory.wb(--p.r.sp,p.r.pc&0xF);p.r.pc=n;p.clock.c+=16;},
    RET:    function(p) {p.r.pc = p.memory[p.r.sp++];p.r.pc+=p.memory[p.r.sp++]<<8;p.clock.c += 16;},
    RETcc:  function(p, cc) {if (ops._testFlag(p, cc)){p.r.pc = p.memory[p.r.sp++];p.r.pc+=p.memory[p.r.sp++]<<8;p.clock.c+=12;}p.clock.c+=8;},
    CALLnn: function(p) {ops._CALLnn(p); p.clock.c+=24;},
    CALLccnn:function(p, cc) {if (ops._testFlag(p, cc)){ops._CALLnn(p);p.clock.c+=12;}else{p.r.pc+=2;}p.clock.c+=12; },
    _CALLnn:function(p){
        p.memory.wb(--p.r.sp, ((p.r.pc+2)&0xFF00)>>8);p.memory.wb(--p.r.sp,(p.r.pc+2)&0x00FF);
        var j=p.memory[p.r.pc]+(p.memory[p.r.pc+1]<<8);p.r.pc=j;},
    CPL:    function(p) {p.r.A = ~p.r.A;p.r.F|=0x60,p.clock.c += 4;},
    CCF:    function(p) {p.r.F&=0x9F;p.r.F&0x10?p.r.F&=0xE0:p.r.F|=0x10;p.clock.c += 4;},
    SCF:    function(p) {p.r.F&=0x9F;p.r.F|=0x10;p.clock.c+=4;},
    DAA:    function(p) {},
    CB:     function(p) {var opcode = p.memory[p.r.pc++];
        if (!cbmap[opcode]){console.log('CB unknown call '+opcode.toString(16));} else cbmap[opcode](p);
        p.clock.c+=4;},
    _testFlag: function(p, cc) {
        var t=1;var mask=0x10;if(cc=='NZ'||cc=='NC')t=0;if(cc=='NZ'||cc=='Z')mask=0x80;
        return (t && p.r.F&mask) || (!t && !(p.r.F&mask));}
};

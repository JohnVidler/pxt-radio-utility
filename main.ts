//% block="Radio Extras"
//% color="#bb2779"
//% icon="\uf1eb"
//% groups=[ "Layer 2", "Layer 3", "Layer 4" ]
namespace RadioUtility {
    enum MessageType {
        INVALID = 0,
        ROUTE_ANNOUNCE = 1
    }

    // Framing tweakables
    const FRAME_START = '$';
    const FRAME_END = '#';
    const LOCAL_ADDRESS = control.deviceSerialNumber();

    function configureRadio() : void {
        // Configure the radio
        radio.on()
        radio.setTransmitSerialNumber(true);
    }

    // This is a terrible checksum, but it should work for now -John.
    function checksum(s: string): number {
        let chk = 0x12345678;
        let len = s.length;
        for (let i = 0; i < len; i++) {
            chk += (s.charCodeAt(i) * (i + 1));
        }

        return (chk & 0xffffffff);
    }

    let _longBuffers: { [key: number]: string } = {};
    let dataHandler: (source: number, data: string) => void = null;
    let errorHandler: (source: number) => void = null;
    let newDeviceHandler: (source: number) => void = null;

    radio.onReceivedBuffer((buff) => {
        let serial = radio.lastPacket.serial;

        if (_longBuffers[serial] == undefined)
            newDeviceEvent(serial);
        
        _longBuffers[serial] = (_longBuffers[serial] || "").concat(buff.toString());

        while (_longBuffers[serial].length > 0 && _longBuffers[serial].charAt(0) != FRAME_START) {
            _longBuffers[serial] = _longBuffers[serial].slice(1);
        }

        // Did we get a valid frame start?
        if (_longBuffers[serial].charAt(0) == FRAME_START && buff.toString().indexOf(FRAME_END) != -1) {
            let line = _longBuffers[serial].split(FRAME_END)[0].slice(1);
            let frameLength = line.length;
            let check = parseInt(line.split(FRAME_START)[1]);
            line = line.split(FRAME_START)[0];

            if (checksum(line) != check)
                failedMessageEvent(serial);
            else
                longStringEvent(serial, line);

            _longBuffers[serial] = _longBuffers[serial].slice(frameLength); // Consume the frame
        }
    })

    function longStringEvent(source: number, longBuffer: string): void {
        if (dataHandler != null)
            dataHandler(source, longBuffer);
    }

    function failedMessageEvent(source: number): void {
        if (errorHandler != null)
            errorHandler(source);
    }

    function newDeviceEvent(source: number): void {
        if(newDeviceHandler != null)
            newDeviceHandler(source);
    }

    //% block="reset radio buffers"
    //% group="Layer 2"
    //% advanced="true"
    export function resetPacketBuffers(): void {
        _longBuffers = {};
    }

    //% block="array of known radio devices"
    //% group="Layer 2"
    //% advanced="true"
    export function knownDevices(): number[] {
        return Object.keys(_longBuffers).map( v => parseInt(v) );
    }

    //% block="radio send long string $message"
    //% group="Layer 2"
    export function sendLongString(message: string): void {
        configureRadio();
        message = message.replaceAll(FRAME_START, '_').replaceAll(FRAME_END, '_');
        message = FRAME_START + message + FRAME_START + checksum(message) + FRAME_END;

        let chunks = Buffer.chunkedFromUTF8(message, 16);
        for (let i = 0; i < chunks.length; i++) {
            radio.sendBuffer(chunks[i]);
            basic.pause(5);
        }
    }

    //% block="on long string from $source with $data"
    //% draggableParameters="reporter"
    //% group="Layer 2"
    export function onLongMessage(handler: (source: number, data: string) => void) {
        configureRadio();
        dataHandler = handler;
    }

    //% block="on bad message from $source"
    //% draggableParameters="reporter"
    //% group="Layer 2"
    //% advanced="true"
    export function onMessageError(handler: (source: number) => void) {
        configureRadio();
        errorHandler = handler;
    }

    //% block="on new device called $source"
    //% draggableParameters="reporter"
    //% group="Layer 2"
    //% advanced="true"
    export function onNewDevice(handler: (source: number) => void) {
        configureRadio();
        newDeviceHandler = handler;
    }
}
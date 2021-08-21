const ClipCC = require('clipcc-extension');

class HelloExtension extends ClipCC.Extension {
    onInit() {
        ClipCC.API.addCategory({
            categoryId: '%[id].category',
            messageId: '%[id].category',
            color: '#66CCFF'
        });
        ClipCC.API.addBlock({
            opcode: '%[id].hello',
            type: ClipCC.Type.BlockType.REPORTER,
            messageId: '%[id].hello',
            categoryId: '%[id].category',
            function: () => "Hello, ClipCC!"
        });
    }
}

module.exports = HelloExtension;

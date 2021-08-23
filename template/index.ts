import { Extension, api, type } from 'clipcc-extension';

class RandomLibrary extends Extension {
    public onInit() {
        api.addCategory({
            categoryId: '%[id].category',
            messageId: '%[id].category',
            color: '#66CCFF'
        });
        api.addBlock({
            opcode: '%[id].hello',
            type: type.BlockType.REPORTER,
            messageId: '%[id].hello',
            categoryId: '%[id].category',
            function: () => "Hello, ClipCC!"
        });
    }
}

export default RandomLibrary;

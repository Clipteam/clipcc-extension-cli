async function copyTemplate(dstPath) {
    const srcPath = path.join(path.dirname(__filename), 'template');
    await eachFile(srcPath, function (filePath, isFile) {
        if (!isFile) {
            if (!fs.existsSync(path.join(dstPath, filePath))) {
                fs.mkdirSync(path.join(dstPath, filePath));
            }
        }
        else {
            console.log(`Copying: ${path.join(dstPath, filePath)}`);
            const data = fs.readFileSync(path.join(srcPath, filePath));
            fs.writeFileSync(path.join(dstPath, filePath), data);
        }
    });
}

async function eachFile(srcPath, callback, retPath = '') {
    fs.readdir(srcPath, (err, files) => {
        if (err) {
            console.error(err);
            return;
        }
        files.forEach(filename => {
            const filePath = path.join(srcPath, filename);
            fs.stat(filePath, (err, stat) => {
                if (err) {
                    console.error(err);
                    return;
                }
                if (stat.isFile()) {
                    callback(path.join(retPath, filename), true);
                }
                else if (stat.isDirectory()) {
                    callback(path.join(retPath, filename), false);
                    eachFile(filePath, callback, path.join(retPath, filename));
                }
            });
        });
    });
}

module.exports = {
    copyTemplate,
    eachFile
};

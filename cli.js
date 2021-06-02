#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const mergeUtil = require('merge-util');

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

const argv = yargs(hideBin(process.argv))
    .usage('Generate ClipCC extension project.')
    .options({
        version: {
            alias: 'v',
            description: 'Show version.'
        },
        generate: {
            alias: 'g',
            description: 'Generate project in current directory.'
        }
    })
    .command('ccext-cli --generate')
    .argv;

if (argv.generate) {
    const cwd = process.cwd();
    if (!fs.existsSync(path.join(cwd, 'package.json'))) {
        console.log('No package.json.');
        return;
    }
    console.log('Writing package.json');
    let data = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
    data = JSON.stringify(mergeUtil(data, {
        dependencies: {
            'clipcc-extension': '^0.1.1'
        },
        devDependencies: {
            'copy-webpack-plugin': '^6.2.0',
            'mkdirp': '^1.0.4',
            'rimraf': '^3.0.2',
            'webpack': '^4.44.2',
            'webpack-cli': '^3.3.12',
            'zip-webpack-plugin': '^3.0.0'
        },
        main: 'dist/main.js',
        scripts: {
            'build': 'rimraf ./build && mkdirp build && rimraf ./dist && mkdirp dist && webpack --colors --bail'
        }
    }), null, 4);
    fs.writeFileSync(path.join(cwd, 'package.json'), data);
    copyTemplate(cwd);
}
else {
    console.log('Unknown command.');
}

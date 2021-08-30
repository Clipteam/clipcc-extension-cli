#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const util = require('util');
const { spawn } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const mergeUtil = require('merge-util');
const chalk = require('chalk');
const inquirer = require('inquirer');

const dependency = {
    plain: ['clipcc-extension']
};

const devDependency = {
    plain: ['mkdirp', 'rimraf'],
    webpack: ['webpack', 'webpack-cli', 'copy-webpack-plugin', 'zip-webpack-plugin'],
    typescript: ['typescript', 'ts-loader']
};

const cmdline = {
    npm: ['npm install --save %s', 'npm install --save-dev %s'],
    yarn: ['yarn add %s', 'yarn add -D %s'],
    berry: ['yarn add %s', 'yarn add -D %s']
};

const scripts = {
    plain: {
        "build": "rimraf ./build && mkdirp build && rimraf ./dist && mkdirp dist && node build.js",
        "build:dist": "NODE_ENV=production npm run build"
    },
    yarn: {
        "build:dist": "NODE_ENV=production yarn run build"
    },
    berry: {
        "build:dist": "NODE_ENV=production yarn run build"
    },
    webpack: {
        "build": "rimraf ./build && mkdirp build && rimraf ./dist && mkdirp dist && webpack --bail"
    }
};

const copyFormatFiles = {
    plain: [{ from: '.gitignore_', to: '.gitignore' }, 'locales'],
    javascript: [{ from: 'js.webpack.config.js', to: 'webpack.config.js' }, 'index.js'],
    typescript: [{ from: 'ts.webpack.config.js', to: 'webpack.config.js' }, 'tsconfig.json', 'index.ts']
};

const copyFiles = {
    plain: ['assets']
};

// 定义了没调用，这是啥
function clone(obj) {
    let res = Array.isArray(obj) ? [] : {};
    if (typeof obj !== 'object') return obj;
    for (const key in obj) res[key] = typeof obj[key] === 'object' ? clone(obj[key]) : obj[key];
    return res;
}

// 运行shell命令
function runCmd(str) {
    return new Promise((resolve, _) => {
        // 回显执行的命令，青色
        process.stdout.write(chalk.cyan(`\$ ${str}\n`));
        // 解析传入的str：cmd为命令，arg是数组形式的参数
        const [cmd, ...arg] = str.split(' ').filter(v => v.length);
        // 把子进程的stdout和stderr打在公屏上
        const sp = spawn(cmd, arg, { encoding: 'utf-8', stdio: 'inherit' });
        // 子进程退出，把返回码传给回调
        sp.on('close', (code) => resolve(code));
    });
}

function convertAuthor(author) {
    // 如果有多位作者，以逗号为分隔符将author转换为数组
    // 例： "Alice, Bob" => ["Alice","Bob"]
    return author.includes(',') ? author.split(',').map(v => v.trim()) : author;
}

function createPackage(types, meta, root) {
    let script = scripts.plain;
    for (const type of types) script = mergeUtil(script, scripts[type]);
    const pkgInfo = {
        name: 'clipcc-extension-' + meta.id.replace('.', '-'),
        version: meta.version,
        author: convertAuthor(meta.author),
        scripts: script,
    };
    const info = {
        id: meta.id,
        author: pkgInfo.author,
        version: meta.version,
        icon: 'assets/icon.jpg',
        inset_icon: 'assets/inset_icon.svg',
        api: 1
    };
    return Promise.all([
        fs.promises.writeFile(path.join(root, 'package.json'), JSON.stringify(pkgInfo, null, 4)),
        fs.promises.writeFile(path.join(root, 'info.json'), JSON.stringify(info, null, 4))
    ]);
}

async function installDependency(pkg, types) {
    const dep = [];
    const dev = [];
    for (const type of types) {
        if (dependency.hasOwnProperty(type)) dep.push(...dependency[type]);
        if (devDependency.hasOwnProperty(type)) dev.push(...devDependency[type]);
    }
    return runCmd(util.format(cmdline[pkg][0], dep.join(' ')))
        .then(_ => runCmd(util.format(cmdline[pkg][1], dev.join(' '))));
}

function formatString(data, fmt) {
    for (const key in fmt) data = data.replace(RegExp(`(?<!%)%\\[${key}\\]`, 'g'), fmt[key]);
    return data;
}

function copyFileWithFormat(from, to, fmt) {
    if (fs.statSync(from).isDirectory()) {
        const files = fs.readdirSync(from);
        if (!fs.existsSync(to)) fs.mkdirSync(to);
        return Promise.all(files.map(file => copyFileWithFormat(path.join(from, file), path.join(to, file), fmt)));
    }
    return new Promise((resolve, reject) => {
        fs.promises.readFile(from, { encoding: 'utf-8' })
            .then(data => fs.promises.writeFile(to, formatString(data, fmt), { encoding: 'utf-8' }))
            .then(_ => {
                process.stdout.write(`Copied ${from} -> ${to}.\n`);
                resolve();
            });
    });
}

function copyFile(from, to) {
    if (fs.statSync(from).isDirectory()) {
        const files = fs.readdirSync(from);
        if (!fs.existsSync(to)) fs.mkdirSync(to);
        return Promise.all(files.map(file => copyFile(path.join(from, file), path.join(to, file))));
    }
    return new Promise((resolve, reject) => {
        fs.promises.copyFile(from, to).then(_ => {
            process.stdout.write(`Copied ${from} -> ${to}.\n`);
            resolve();
        });
    });
}

function copyFilesToDir(types, root, fmt) {
    const pr = [];
    for (const type of types) {
        if (copyFiles.hasOwnProperty(type)) {
            pr.push(copyFiles[type].map(file => typeof (file) === 'string' ?
                copyFile(
                    path.join(path.dirname(__filename), 'template', file),
                    path.join(root, file)
                ) : copyFile(
                    path.join(path.dirname(__filename), 'template', file.from),
                    path.join(root, file.to)
                )));
        }
        if (copyFormatFiles.hasOwnProperty(type)) {
            pr.push(copyFormatFiles[type].map(file => typeof (file) === 'string' ?
                copyFileWithFormat(
                    path.join(path.dirname(__filename), 'template', file),
                    path.join(root, file), fmt
                ) : copyFileWithFormat(
                    path.join(path.dirname(__filename), 'template', file.from),
                    path.join(root, file.to), fmt
                )));
        }
    }
    return Promise.all(pr);
}

// 主函数
async function interactive() {
    console.log(` ____
/    \\
|    |
| |  |     Welcome to use ${chalk.cyan('clipcc-extension-cli')}!
| |  | |   Version: ${chalk.yellow(require('./package.json').version)}
\\ \\__/ /
 \\____/\n`);

    const packageMeta = await inquirer.prompt([{
        type: 'input',
        name: 'id',
        message: 'Extension ID:',
        validate: v => /^([a-z0-9_]+\.)+[a-z0-9_]+$/.test(v) ? true : 'Unvalid ID.'
    }, {
        type: 'input',
        name: 'name',
        message: 'Name:'
    }, {
        type: 'input',
        name: 'description',
        message: 'Description:'
    }, {
        type: 'input',
        name: 'version',
        message: 'Version:'
    }, {
        type: 'input',
        name: 'author',
        message: 'Author:'
    }]);
    const { lang, pkg, bundler, git } = await inquirer.prompt([{
        type: 'list',
        name: 'lang',
        message: 'Choose your development language:',
        choices: ['javascript', 'typescript']
    }, {
        type: 'list',
        name: 'pkg',
        message: 'Choose your package manager:',
        choices: ['npm', 'yarn', 'berry']
    }, {
        type: 'list',
        name: 'bundler',
        message: 'Choose your bundler:',
        choices: ['webpack' /*, 'snowpack'*/]
    }, {
        type: 'confirm',
        name: 'git',
        message: 'Use git?'
    }]);
    if (pkg === 'berry') {
        await runCmd('yarn set version berry');
        await runCmd('yarn set version latest');
    }
    await createPackage(['plain', pkg, bundler, lang], packageMeta, '.');
    await copyFilesToDir(['plain', pkg, bundler, lang], '.', { ...packageMeta });
    if (git) await runCmd('git init');
    await installDependency(pkg, ['plain', pkg, bundler]);
}

// -v 开关显示帮助
const argv = yargs(hideBin(process.argv))
    .usage('Generate ClipCC extension project.')
    .options({
        version: {
            alias: 'v',
            description: 'Show version.'
        }
    })
    .argv;

if (argv.generate) {
    process.stdout.write(chalk.red('Unsupported --generate.\n'));
}
else {
    interactive();
}

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

// 定义几个宏 [ 安装生产环境依赖 , 安装开发环境依赖 ]
const cmdline = {
    npm: ['npm install --save-prod %s', 'npm install --save-dev %s'],
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

// 一个映射表，告诉 copyFilesToDir() 怎么复制文件
const copyFormatFiles = {
    plain: [{ from: '.gitignore_', to: '.gitignore' }, 'locales'],
    javascript: [{ from: 'js.webpack.config.js', to: 'webpack.config.js' }, 'index.js'],
    typescript: [{ from: 'ts.webpack.config.js', to: 'webpack.config.js' }, 'tsconfig.json', 'index.ts']
};

const copyFiles = {
    plain: ['assets']
};

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
    if (author.includes(',')) {
        return author.split(',').map(v => v.trim());
    } else {
        return author;
    }
}

// 把信息填进 package.json 和 info.json
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

// 格式化模板字符串，例：%[id] => com.author.extension_name
function formatString(data, fmt) {
    for (const key in fmt) {
        data = data.replace(RegExp(`(?<!%)%\\[${key}\\]`, 'g'), fmt[key]);
    }
    return data;
}

function copyFileWithFormat(from, to, fmt) {
    // 如果复制源是目录
    if (fs.statSync(from).isDirectory()) {
        // 获取下面所有文件和子目录
        const files = fs.readdirSync(from);
        // 目标目录不存在就创建
        if (!fs.existsSync(to)) fs.mkdirSync(to);
        // 递归复制
        return Promise.all(files.map(file => copyFileWithFormat(path.join(from, file), path.join(to, file), fmt)));
    }
    // 如果是单个文件
    return new Promise((resolve, _) => {
        fs.promises.readFile(from, { encoding: 'utf-8' })
            // 先格式化再写到目标
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
    return new Promise((resolve, _) => {
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
            pr.push(copyFiles[type].map(
                file => {
                    if (typeof (file) === 'string') { // 直接复制
                        copyFile(
                            path.join(path.dirname(__filename), 'template', file),
                            path.join(root, file)
                        )
                    } else { // 指定了从哪到哪
                        copyFile(
                            path.join(path.dirname(__filename), 'template', file.from),
                            path.join(root, file.to)
                        )
                    }
                }
            ));
        }
        if (copyFormatFiles.hasOwnProperty(type)) {
            pr.push(copyFormatFiles[type].map(
                file => {
                    if (typeof (file) === 'string') {
                        copyFileWithFormat(
                            path.join(path.dirname(__filename), 'template', file),
                            path.join(root, file), fmt
                        )
                    } else {
                        copyFileWithFormat(
                            path.join(path.dirname(__filename), 'template', file.from),
                            path.join(root, file.to), fmt
                        )
                    }
                }
            ));
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
        // 匹配例如 com.author.extension_name 允许小写字母、数字、下划线
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
        choices: ['javascript', 'typescript' /*, 'coffeescript'*/]
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

// --help 开关显示帮助
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

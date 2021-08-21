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

const { copyTemplate } = require('./util');

const dependency = {
    plain: [ 'clipcc-extension' ]
};

const devDependency = {
    plain: [ 'mkdirp', 'rimraf' ],
    webpack: [ 'webpack', 'webpack-cli', 'copy-webpack-plugin', 'zip-webpack-plugin' ]
};

const cmdline = {
    npm: [ 'npm install --save %s', 'npm install --save-dev %s' ],
    yarn: [ 'yarn add %s', 'yarn add -D %s' ]
}

const scripts = {
    plain: {
        "build": "rimraf ./build && mkdirp build && rimraf ./dist && mkdirp dist && node build.js",
        "build:dist": "NODE_ENV=production yarn run build"
    },
    webpack: {
        "build": "rimraf ./build && mkdirp build && rimraf ./dist && mkdirp dist && webpack --colors --bail"
    }
}

function runCmd(str) {
    process.stdout.write(chalk.cyan(`\$ ${str}\n`));
    const [ cmd, ...arg ] = str.split(' ').filter(v => v.length);
    const sp = spawn(cmd, arg, { encoding: 'utf-8', stdio: 'inherit' });
    return new Promise((resolve, _) => {
        sp.on('close', code => resolve(code));
    });
}

function initGit() {
    return runCmd('git init');
}

function convertIdToPacakgeName(id) {
    return 'clipcc-extension-' + id.replace('.', '-');
}

function convertAuthor(author) {
    return author.includes(',') ? author.split(',').map(v => v.trim()) : author;
}

function createPackage(types, meta, root) {
    let script = scripts.plain;
    for (const type of types) {
        script = mergeUtil(script, scripts[type]);
    }
    const pkgInfo = {
        name: convertIdToPacakgeName(meta.id),
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
        fs.writeFile(path.join(root, 'package.json'), JSON.stringify(pkgInfo, null, 4)),
        fs.writeFile(path.join(root, 'info.json'), JSON.stringify(info, null, 4))
    ]);
}

async function installDependency(pkg, types) {
    const dep = dependency.plain;
    const dev = devDependency.plain;
    for (const type of types) {
        if (dependency.hasOwnProperty(type)) dep.push(...dependency[type]);
        if (devDependency.hasOwnProperty(type)) dev.push(...devDependency[type]);
    }
    return runCmd(util.format(cmdline[pkg][0], dep.join(' ')))
        .then(_ => runCmd(util.format(cmdline[pkg][1], dev.join(' '))));
}

async function main() {
    process.stdout.write('Welcome to use clipcc-extension-cli!\n');
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
        choices: [ 'JavaScript' /*, 'TypeScript'*/ ]
    }, {
        type: 'list',
        name: 'pkg',
        message: 'Choose your package manager:',
        choices: [ 'npm', 'yarn' /*, 'berry'*/ ]
    }, {
        type: 'list',
        name: 'bundler',
        message: 'Choose your bundler:',
        choices: [ 'webpack' /*, 'snowpack'*/ ]
    }, {
        type: 'confirm',
        name: 'git',
        message: 'Use git?'
    }]);
    if (git) await initGit();
    await createPackage([ bundler ], packageMeta, '.');
    await installDependency(pkg, [ bundler ]);
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
    main();
}



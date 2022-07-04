# ClipCC Extension CLI

## Installation

```bash
npm install -g clipcc-extension-cli
# or
yarn global add clipcc-extension-cli
```

## Usage

```bash
mkdir your.extension.id
cd your.extension.id
ccext-cli
```

Then you will be asked several information.

```plain
 ____
/    \
|    |
| |  |     Welcome to use clipcc-extension-cli!
| |  | |   Version: <cli version>
\ \__/ /
 \____/

? Extension ID: your.extension.id
? Name: Your Extension Name
? Description: Your Extension Description.
? Version: 1.0.0
? Author: Your Name
? Choose your development language:
? Choose your package manager:
? Choose your bundler:
? Use git? Y/n
```

Note:
1. `your.extension.id` must be an valid id, which only contains a-z, 0-9 and `_`, and is split by `.`. To avoid id conflict, a recommended id is `name.extension`, containing both your extension name and your own name (or your team/organization's name) with lower letters (numbers and `_` shouldn't be used if not necessary), like `alexcui.random`, `clipteam.community`, etc.
2. We do recommend to use yarn as your package manager.

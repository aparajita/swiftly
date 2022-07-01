# swiftly

[`swiftlint`](https://realm.github.io/SwiftLint/) is an essential tool for checking and formatting Swift code. But it doesn’t do much formatting, especially compared to `Prettier`. That’s where [`swiftformat`](https://github.com/nicklockwood/SwiftFormat#readme) shines, because it lets you (almost) forget about formatting your code altogether, just like `Prettier`. Wouldn’t it be great to be able to run both `swiftlint` and `swiftformat` as one? Now you can!

This package installs a binary that wraps the functionality of both `swiftlint` and `swiftformat` together, while offering the following advantages:

- Errors from both tools are aggregated and sorted.
- The output from both tools is reformatted in a unified way to be **way** easier to read, including a concise and informative summary at the end.
- You can use globs with `swiftformat`.
- Both binaries return a non-zero exit code if they find problems, which helps with command pipelines.

## Installation

Before installing this package, you will first have to install `swiftlint` and `swiftformat` globally. On macOS, use Homebrew:

```shell
% brew install swiftlint swiftformat
```

For other platforms, see the installation instructions for the respective binaries.

Once you have installed the binaries, you can install this package as a dev dependency.

```shell
% pnpm add -D @aparajita/swiftly
```

## Usage

If you run `swiftly --help`, you will get a description of all of the options:

```text
Usage: swiftly [options] [files]

Options:
      --help         Show help                                 [boolean]
      --version      Show version number                       [boolean]
  -l, --swiftlint    Only run swiftlint                        [boolean]
  -f, --swiftformat  Only run swiftformat                      [boolean]
  -F, --fix          Fix any fixable errors                    [boolean]
  -s, --single-line  Output errors like eslint’s unix format   [boolean]
  -q, --quiet        Do not produce any output                 [boolean]
```

### Choosing the tools to run

By default, if you specify neither `--swiftlint` nor `--swiftformat`, both tools will run. If you specify either of those, only that tool will run. Those two options are mutually exclusive.

### Specifying the format

By default, the results are colorized and output in a format very similar to `eslint`’s [stylish format](https://eslint.org/docs/latest/user-guide/formatters/#stylish), which groups errors under the file path, making the output very easy to read. In WebStorm, the line:column references produced in its terminal by the default format of `swiftly` are clickable links that open the file at that point. VS Code (and presumably many other editors) cannot parse the `stylish` format, so to produce a format with clickable links, you will want to pass the `--single-line` option, which produces output like `eslint`’s [unix format](https://eslint.org/docs/latest/user-guide/formatters/#unix), but with file paths colorized according to the error level!

### Linting vs. fixing

By default, the tools are run in lint-only mode. They will find and report any errors. If you pass `--fix`, first the tools are run in fix mode, and then they are run in lint-only mode to report any errors that could not be fixed. In either case, if there are no errors, there is no output.

### Exit status

If either tool reports any errors, `swiftly` exits with a status of 1. This makes it easy to include it in a script pipeline, for example:

```json
{
  "scripts": {
    "build": "pnpm check && vite build",
    "check": "pnpm lint && pnpm swiftly",
    "swiftly": "swiftly 'src/**/*.swift'"
  }
}
```

Sometimes you may **only** be interested in the exit status. In that case pass `--quiet` and all output will be suppressed, but the exit status will still be set.

### Specifying the files to check

Any non-option arguments passed to `swiftly` are considered either paths or [globs](https://github.com/mrmlnc/fast-glob#readme). Note that to pass a glob to `swiftly` you must enclose it is single or double quotes, otherwise the shell will expand it.

If an argument is a glob, it is expanded, otherwise it is taken as is. For example, given the following file structure:

```
project
  test
    TestList.swift
  src
    Foo.swift
    Bar.swift
    ui
      List.swift
      Dialog.swift
```

this would check every Swift file in the `src` directory and its subdirectories:

```shell
% swiftly src
```

while this would only check Swift files within the `src` directory itself:

```shell
% swiftly 'src/*.swift'
```

and this would check all Swift files in the project:

```shell
% swiftly '**/*.swift'
```

## Configuration

Because `swiftly` is passing arguments to two very different tools, you cannot pass configuration options (other than those listed above) directly to the tools from the command line. You can, however, use configuration files.

Under the hood, `swiftly` uses [`node-swiftlint`](https://github.com/ionic-team/swiftlint#readme) to run `swiftlint`, so in addition to the standard `.swiftlint.yml` configuration file, you can also use an npm package (such as [`@ionic/swiftlint-config`](https://github.com/ionic-team/swiftlint-config)) as a config source.

As for `swiftformat`, you can use a standard [`.swiftformat`](https://github.com/nicklockwood/SwiftFormat#config-file) config file.

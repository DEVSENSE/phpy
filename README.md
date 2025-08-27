# Devsense' PHP CLI Tools 

Standalone NodeJS command-line utility for analyzing and formatting PHP files.

## Installation

Install `phpy` package as a global command line tool:

> npm install -g phpy

## Sample usage

_Analyze problems of `.php` files in current directory:_

> phpy --check

_Analyze `.php` files in current folder, skipt the `tests` folder:_

> phpy --check --root . --exclude tests

_Format all `.php` files in directory using "Laravel" coding style:_

> phpy --format Laravel

## Available options

```
Usage: phpy [options] [path...]

PHP Languge Server CLI

Arguments:
  path                      Files or directories to be analyzed.

Options:
  -V, --version             output the version number
  -r, --root <path>         Root directory, to which are other parameters relative. Current working directory by default.
  -x, --exclude <path...>   Files or directories to be excluded from indexing.
  -c, --check               Perform code analysis and output list of problems.
  -f, --format [CodeStyle]  Perform in-place code format. (choices: "Off", "PHPTools", "PSR2", "WordPress", "Allman", "KaR", "PSR12",
                            "Laravel", "Drupal", "Joomla", "PER", default: "PSR12")
  --verbose                 Enable verbose output.
  -h, --help                display help for command
```

## Background

The tool is a derivate from [PHP Tools](https://www.devsense.com/) software. It provides the same code analysis as [PHP Tools for Visual Studio Code](https://docs.devsense.com/vscode/problems/) and [PHP Tools for Microsoft Visual Studio](https://docs.devsense.com/vs/code%20validation/diagnostics/).

## Benefits

- Does not require `php` executable, only `npm`.
- Fast processing even for large workspaces.
- Wide range of code analysis rules.
- Support for PHPStan, Psalm, PHPDoc Generics, Laravel Idea, and other annotations.
- Support for `.phar` files.
- and more!

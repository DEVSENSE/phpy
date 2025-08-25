# PHP Code Analysis Tool

Standalone NodeJS command-line utility for analyzing PHP code files.

## Installation

Install `phpy` package as a global command line tool:

> npm install -g phpy

## Sample usage

_Analyze problems of `.php` files in current directory:_

> phpy --check

_Analyze `.php.` files in current folder, skipt the `tests` folder:

> phpy --check --root . --exclude tests

## List all options:

> phpy --help

## Background

The tool is a derivate from [PHP Tools](https://www.devsense.com/) software. It provides the same code analysis as [PHP Tools for Visual Studio Code](https://docs.devsense.com/vscode/problems/) and [PHP Tools for Microsoft Visual Studio](https://docs.devsense.com/vs/code%20validation/diagnostics/).

## Benefits

- Does not require `php` executable, only `npm`.
- Fast processing even for large workspaces.
- Wide range of code analysis rules.
- Support for PHPStan, Psalm, PHPDoc Generics, Laravel Idea, and other annotations.
- Support for `.phar` files.
- and more!

#! /usr/bin/env node

const { Command } = require('commander');
const program = new Command('inventive');
const pkg = require('../package.json')

/**
 * define version and usage
 */
program
  .version(pkg.version)
  .usage('command [options]')

/**
 * define create command
 * -f, --force, overwrite when target dir exist
 * --no-commit, do not commit when re-init git
 */
program
  .command('create <project-name>')
  .description('create a new project')
  .option('-f, --force', 'overwrite directory if exist')
  .option('--no-commit', 'do not commit when re-init git')
  .action((name, options) => {
    require('./create')(name, options);
  });

program.parse(process.argv);

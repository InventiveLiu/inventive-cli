const path = require('path');
const fs = require('fs-extra');
const inquirer = require('inquirer');
const execSync = require('child_process').execSync;
const chalk = require('chalk');
const ora = require('ora');
const https = require('https');


/**
 * get repo on github
 *
 */
const getTemplates =  () => new Promise((resolve, reject) => {
  https.get('https://api.github.com/users/inventiveliu/repos', {
    headers: {
      accept: 'application/vnd.github.mercy-preview+json', // needed to show topics
      'content-type': 'application/json',
      'user-agent': 'nodejs', // needed for github api
    },
  }, (res) => {
    const { statusCode } = res;
    const contentType = res.headers['content-type'];

    let error;
    if (statusCode !== 200) {
      error = new Error('Request Failed.\n' +
                        `Status Code: ${statusCode}`);
    } else if (!/^application\/json/.test(contentType)) {
      error = new Error('Invalid content-type.\n' +
                        `Expected application/json but received ${contentType}`);
    }
    if (error) {
      reject(error);
      // Consume response data to free up memory
      res.resume();
      return;
    }

    let result = '';
    res.on('data', (chunk) => {
      result += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(result);
        const templateRepo = jsonData.filter(v => v.topics && v.topics.includes('template'))
          .map(({ name, description, clone_url,  }) => ({ name: description, value: clone_url, short: name }));
        const app = templateRepo.filter(v => v.short.startsWith('application'));
        const lib = templateRepo.filter(v => v.short.startsWith('library'));
        resolve({
          app,
          lib,
        });
      } catch (error) {
        reject(error);
      }
    });

  }).on('error', (err) => {
    reject(err);
  });
});


/**
 * clone template
 * @param {string} url
 * @param {string} des
 */
const tryToClone = (url, des) => {
  const spinner = ora('clone template...\n').start();
  try {
    execSync(`git clone ${url} ${des}`, { stdio: 'inherit' });

    spinner.succeed(chalk.green('clone template succeed'));
  } catch (error) {
    spinner.fail(chalk.red('clone template failed with error message'));
    console.log(chalk.red(error.message));
    process.exit(1);
  }
}

/**
 * git re-init project
 * @param {string} targetDir
 * @param {boolean} commit
 */
const tryToReInit = (targetDir, commit) => {
  try {

    // remove original .git
    fs.removeSync(path.join(targetDir, '.git'));
    execSync('git init', {
      cwd: targetDir,
      stdio: 'ignore'
    });

    if (commit) {
      execSync('git add -A', {
        cwd: targetDir,
        stdio: 'ignore',
      });
      execSync('git commit -m "init project using inventive-cli"', {
        cwd: targetDir,
        stdio: 'ignore',
      });
    }
  } catch (error) {
    console.log(chalk.red('git re-init failed with error message'));
    console.log(chalk.red(error.message));
    process.exit(1);
  }
}


/**
 *
 * @param {string} name
 * @param {object} options
 */
const create = async (name, options) => {

  const targetDir = path.join(process.cwd(), name);
  const isExist = fs.existsSync(targetDir);

  if (isExist) {
    if (options.force) {
      fs.removeSync(targetDir);
    } else {
      console.log(chalk`{yellow target dir exist, you may use {bold create -f or --force} to overwrite it}`);
      process.exit(1);
    }
  }

  const spinner = ora('fetching templates...');

  spinner.start();

  const templates = await getTemplates().catch((err) => {
    spinner.fail(chalk.red('fetch template failed with error message'));
    console.log(chalk.red(err.message));
    return null;
  });

  if(!templates) {
    process.exit(1);
  }

  spinner.succeed(chalk.green('fetch template success'));



  const questions = [
    {
      type: 'list',
      name: 'type',
      message: 'new application or library? they have different bundler and babel config',
      choices: ['application', 'library'],
      default: 0,
    },
    {
      type: 'list',
      name: 'template',
      message: 'choose a template for you',
      choices: (answer) => answer.type === 'application' ? templates.app : templates.lib,
      default: 0,
    },
    {
      type: 'confirm',
      name: 'ts',
      message: 'do you use typescript? strongly recommend for library',
      default: (answer) => answer.type === 'library',
    },
  ];

  const answers = await inquirer.prompt(questions);
  tryToClone(answers.template, name);

  // remove .git directory and re-init
  tryToReInit(targetDir, options.commit);

  console.log(chalk.green('All done! Open your project and read README.md to see how to start coding'));

}

module.exports = create;

#! /usr/bin/env node

const fs = require('fs');
const artifacts = require('./lib/artifacts');
const schema = require('./data/cf_schema.json');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');
const friend = require('@mapbox/cloudfriend');
const path = require('path');
const prompt = require('prompt');
const cp = require('child_process');

const Credentials = require('./lib/creds');

// Modes
const mode = {
    env: require('./lib/env'),
    list: require('./lib/list'),
    init: require('./lib/init'),
    info: require('./lib/info')
}

const argv = require('minimist')(process.argv, {
    boolean: ['help', 'version'],
    string: ['profile', 'template'],
    alias: {
        version: 'v'
    }
});

if (argv.version) {
    console.log('openaddresses-deploy@' + require('./package.json').version);
    return;
}

if (!argv._[2] || argv._[2] === 'help' || (!argv._[2] && argv.help)) {
    console.log();
    console.log('Usage: deploy <command> [--profile <name>] [--template <path>]');
    console.log('              [--version] [--help]');
    console.log()
    console.log('Create, manage and delete Cloudformation Resouces from the CLI');
    console.log();
    console.log('Subcommands:');
    console.log('    init      [--help]         Setup Credentials for a new AWS Account');
    console.log('    list      [--help]         List all stack assoc. with the current repo');
    console.log('    info      [--help]         Get information on a specific stack within the current repo');
    console.log('    create    [--help]         Create a new stack of the current repo');
    console.log('    update    [--help]         Update an existing stack of the current repo');
    console.log('    delete    [--help]         Delete an existing stack of the current repo');
    console.log('    env       [--help]         Setup AWS env vars in current shell');
    console.log();
    console.log('[options]:');
    console.log('    --profile <name>        If there are multiple AWS profiles set up, the profile to deploy');
    console.log('                              with must be defined either via a .deploy file or via this flag');
    console.log('    --template <path>       The master template should be found at "cloudformation/<repo-name>.template.js(on)"')
    console.log('                              if the project has multiple CF Templates, they can be deployed by specifying');
    console.log('                              their location with this flag. The stack will be named:');
    console.log('                              <repo>-<stack name>-<template name>');
    console.log('    --version, -v           Displays version information');
    console.log('    --help                  Prints this help message');
    console.log();
    return;
}

const command = argv._[2];

if (command === 'create' && argv.help) {
    console.log();
    console.log('Usage: deploy create <STACK>');
    console.log();
    console.log('Create new AWS resource from a CF Template');
    console.log('template should be in the following location:');
    console.log('  cloudformation/<reponame>.template.json');
    console.log('  cloudformation/<reponame>.template.js');
    console.log();
    return;
} else if (command === 'update' && argv.help) {
    console.log();
    console.log('Usage: deploy update <STACK>');
    console.log()
    return;
} else if (command === 'delete' && argv.help) {
    console.log();
    console.log('Usage: deploy delete <STACK>');
    console.log()
    return;
} else if (mode[command] && argv.help) {
    mode[command].help();
    return;
} else if (argv.help) {
    console.error('Subcommand not found!');
    process.exit(1);
}

if (['create', 'update', 'delete'].indexOf(command) > -1) {
    if (!argv._[3]) return console.error(`Stack name required: run deploy ${command} --help`);
    const stack = argv._[3];

    Credentials.load(argv, (err, creds) => {
        if (err) throw err;

        cf.preauth(creds);

        const cf_cmd = cf.commands({
            name: creds.repo,
            region: creds.region,
            configBucket: `cfn-config-active-${creds.accountId}-${creds.region}`,
            templateBucket: `cfn-config-templates-${creds.accountId}-${creds.region}`
        });

        friend.build(creds.template).then(template => {
            cf_path = `/tmp/${hash()}.json`;

            template = tagger(template, creds.dotdeploy.tags);

            fs.writeFileSync(cf_path, JSON.stringify(template, null, 4));

            if (command === 'create') {
                artifacts(creds, (err) => {
                    if (err) return console.error(`Artifacts Check Failed: ${err.message}`);

                    cf_cmd.create(stack + creds.name, cf_path, {
                        parameters: {
                            GitSha: creds.sha
                        }
                    }, (err) => {
                        if (err) return console.error(`Create failed: ${err.message}`);
                        fs.unlinkSync(cf_path);
                    });
                });
            } else if (command === 'update') {
                artifacts(creds, (err) => {
                    if (err) return console.error(`Artifacts Check Failed: ${err.message}`);

                    cf_cmd.update(stack + creds.name, cf_path, {
                        parameters: {
                            GitSha: creds.sha
                        }
                    }, (err) => {
                        if (err) return console.error(`Update failed: ${err.message}`);
                        fs.unlinkSync(cf_path);
                    });
                });
            } else if (command === 'delete') {
                cf_cmd.delete(stack + creds.name, (err) => {
                    if (err) return console.error(`Delete failed: ${err.message}`);
                    fs.unlinkSync(cf_path);
                });
            }
        });
    })
} else if (mode[command]) {
    if (['init'].includes(command)) {
        mode[command].main(process.argv);
    } else {
        Credentials.load(argv, (err, creds) => {
            if (err) throw err;

            mode[command].main(creds, process.argv);
        });
    }
} else {
    console.error('Subcommand not found!');
    process.exit(1);
}

/**
 * Add additional global tags
 */
function tagger(template, tags) {
    if (!template.Resources) return template;
    if (!tags || !tags.length) return template;

    for (const name of Object.keys(template.Resources)) {
        if (
            !template.Resources[name].Type
            || !schema.ResourceTypes[template.Resources[name].Type]
            || !schema.ResourceTypes[template.Resources[name].Type].Properties
            || !schema.ResourceTypes[template.Resources[name].Type].Properties.Tags
        ) continue;

        if (!template.Resources[name].Properties) {
            template.Resources[name].Properties = {};
        };

        if (!template.Resources[name].Properties.Tags) {
            template.Resources[name].Properties.Tags = [];
        }

        const tag_names = template.Resources[name].Properties.Tags.map((t) => t.Key);

        for (const oTag of tags) {
            if (tag_names.includes(oTag)) {
                for (const tag of template.Resources[name].Properties.Tags) {
                    if (tag.Key === oTag.Key) {
                        tag.Value = oTag.Value;
                        break;
                    }
                }
            } else {
                template.Resources[name].Properties.Tags.push(oTag);
            }
        }
    }

    return template;
}

function hash() {
     return Math.random().toString(36).substring(2, 15);
}

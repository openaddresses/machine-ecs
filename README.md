<h1 align="center">Deploy</h1>

<p align="center">OpenAddresses Deploy Tools for Cloudformation</p>

## Brief

- Store and manage AWS creds locally for one or more AWS accounts
- Create, Update, & Delete CF based stacks from the terminal

## Install

If you don't have yarn installed - follow the instructions [here](https://classic.yarnpkg.com/en/docs/install)

Clone this repository and run the following from the cloned directory:

```sh
git clone git@github.com:openaddresses/deploy.git

cd deploy

yarn install

yarn link
```

This will make the `deploy` command available globally

### Auth Setup

Before you can make changes to any of the underlying infrastructure you must first authenticate the deploy cli

To do so run:

```sh
deploy init
```

and follow the prompts for your credentials.

Note the `profile name` prompted for should idealy match the profile name as set in your AWS credentials
file located at `~/.aws/credentials` If the profile name is found in your AWS credentials file, the
credentials from the file will be linked. If it does not exist, you will be prompted for a set of credentials

Once finished run

```sh
deploy
```

to see a full list of options

Note: The credentials file can be found in the `~/.deployrc.json` file

#### Required Tags

If an account uses tags for billing, the following can be used in the `~/.deployrc.json` file to ensure that
tags are attached to all stacks deployed to that profile

```JSON
{
    "<profile_name>": {
        "region": "<region>",
        "accountId": "<account_id>",
        "accessKeyId": "<access_key_id>",
        "secretAccessKey": "<secret_access_key>",
        "tags": ["Project", "Owner", "Client", "<another tag>"]
    }
}
```

### Project Management

If you run `deploy init` for a single AWS profile, all resources created with the tool will automatically
be deployed to this "default" account.

If multiple AWS profiles are created via `batch init`, then you will either need to use
the `--profile <name>` flag when interacting with the API, or to specfiy the profile in your `.deploy` file

The `./deploy` file is created in the root directory of the git repo and follows the following format:

```JSON
{
    "profile": "name of AWS Account profile"
}
```

### Watching for Docker Artifacts

By default, if a `Dockerfile` is found in the project root, the ECR will be queried before deploy to ensure
the image has been built. IE: a git repo named `my-project` would look for an image called `my-project:<Git Sha>`.

If you are building multiple docker images, or want to disable this feature, the following options are avaliable
via the `.deploy` file.

**Disable ECR Check**

```JSON
{
    "artifacts": {
        "docker": false
    }
}
```
**Custom Pre/Postfix**

```JSON
{
    "artifacts": {
        "docker": "custom-ecr:{{gitsha}}"
    }
}
```

```JSON
{
    "artifacts": {
        "docker": "{{project}}:prefix-{{gitsha}}-postfix"
    }
}
```

**Multiple Images**

```JSON
{
    "artifacts": {
        "docker": [
            "{{project}}:backend-{{gitsha}}",
            "{{project}}:frontend-{{gitsha}}"
        ]
    }
}
```

### Watching for Docker Artifacts

Lambda uploads are not watched for by default. Set artifact listeners via your `.deploy` file
using the examples below to ensure that they are present on s3 before deploy.

**Disable Lambda Check** (Default)

```JSON
{
    "artifacts": {
        "lambda": false
    }
}
```

**Single Lambda**

```JSON
{
    "artifacts": {
        "lambda": "<bucket>/{{gitsha}}.zip"
    }
}
```

**Multiple Lambdas**

```JSON
{
    "artifacts": {
        "lambda": [
            "<bucket>/deploy-lambda/{{gitsha}}.zip",
            "<bucket:>/{{project}}-{{gitsha}}.zip"
        ]
    }
}
```

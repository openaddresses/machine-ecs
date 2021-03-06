const request = require('request');
const pkg = require('../package.json');

class GH {
     /**
     * Create a new github API object
     *
     * @constructor
     * @param {Credentials} creds Credentials object
     */
    constructor(creds) {
        this.url = 'https://api.github.com';

        this.headers = {
            accept: 'application/vnd.github.v3+json',
            'User-Agent': `openaddresses-deploy@${pkg.version}`,
            'Content-Type': 'application/vnd.github.flash-preview+json'
        };

        this.creds = creds;
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
     * @param {boolean} success Was the deployment successful
     */
    async deployment(stack, success) {
        if (success === undefined) success = 'pending';
        else if (success) success = 'success';
        else if (!success) success = 'failed';

        try {
            if (this.creds.deployment) {
                return await this.deployment_update(stack, success);
            } else {
                const deploy_id = await this.deployment_list(stack);

                if (!deploy_id) {
                    await this.deployment_create(stack);
                } else {
                    this.creds.deployment = deploy_id;

                    await this.deployment_update(stack, success);
                }
            }
        } catch (err) {
            throw err;
        }
    }

    async deployment_list(stack) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.url + `/repos/${this.creds.owner}/${this.creds.repo}/deployments`)
            url.searchParams.append('sha', this.creds.sha);
            url.searchParams.append('task', 'deploy');
            url.searchParams.append('environment', stack);

            request({
                url: url,
                json: true,
                method: 'GET',
                headers: this.headers,
                auth: {
                    user: this.creds.user,
                    password: this.creds.github
                }
            }, (err, res) => {
                if (err) return reject(err);

                if (res.body.length > 0) return resolve(res.body[0].id);

                return resolve(false);
            });
        });
    }

    async deployment_create(stack) {
        return new Promise((resolve, reject) => {
            request({
                url: this.url + `/repos/${this.creds.owner}/${this.creds.repo}/deployments`,
                method: 'POST',
                json: true,
                headers: this.headers,
                auth: {
                    user: this.creds.user,
                    password: this.creds.github
                },
                body: {
                    ref: this.creds.sha,
                    task: 'deploy',
                    environment: stack,
                    production_environment: ['prod', 'production'].includes(stack)
                }
            }, (err, res) => {
                if (err) return reject(err);

                this.creds.deployment = res.body.id;

                return resolve();
            });
        });
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
    */
    async deployment_update(stack, success) {
        return new Promise((resolve, reject) => {
            request({
                url: this.url + `/repos/${this.creds.owner}/${this.creds.repo}/deployments/${this.creds.deployment}/statuses`,
                json: true,
                method: 'POST',
                headers: this.headers,
                auth: {
                    user: this.creds.user,
                    password: this.creds.github
                },
                body: {
                    state: success
                }
            }, (err) => {
                if (err) return reject(err);

                return resolve();
            });
        });
    }
}

module.exports = GH;

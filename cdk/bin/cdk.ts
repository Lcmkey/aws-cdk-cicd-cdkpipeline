#!/usr/bin/env node
require("dotenv").config();

import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { SsmStack, PipelineStack } from "./../lib";

let {
    PREFIX: prefix = "[STACK_PREFIX_NAME]",
    STAGE: stage = "[DEPLOYMENT_STAGE]",
    RUN_IN_AWS_PIEPLINE = JSON.parse("true"),
    CDK_ACCOUNT: accountId = "[AWS_ACCOUNT ID]",
    CDK_REGION: region = "ap-southeast-1",
    REPO: repo = "GIT REPO", // *Case Sensitive
    OWNER: owner = "GIT OWNER",
    BRANCH: branch = "GIT BRANCH", // "release","master";
    GITHUB_TOEKN_KEY: gitToken = "[GITHUB_OAUTH_TOKEN]"
} = process.env;

/**
 * AWS defulat ENV config Definition
 */
const env = {
    account: accountId,
    region: region,
};

const app = new cdk.App();

const ssm = new SsmStack(app, `${prefix}-${stage}-SsmStack`, {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    },
    prefix,
    stage
});

try {
    if (JSON.parse(RUN_IN_AWS_PIEPLINE)) {
        prefix = ssm.prefix;
        stage = ssm.stage;
        accountId = ssm.accountId;
        region = ssm.region;
        repo = ssm.repo;
        owner = ssm.owner;
        branch = ssm.owner;
        gitToken = ssm.gitToken;

        console.log(prefix);
    }
} catch (err) {
}

new PipelineStack(app, `${prefix}-${stage}-PipelineStack`, {
    env,
    prefix,
    stage,
    repo,
    owner,
    branch,
    oauthToken: gitToken
});


app.synth();

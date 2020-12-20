import { Stack, Construct, StackProps, SecretValue, } from "@aws-cdk/core";
import { Artifact, } from "@aws-cdk/aws-codepipeline";
import { GitHubSourceAction, GitHubTrigger, CodeBuildAction } from "@aws-cdk/aws-codepipeline-actions";
import { Project, LinuxBuildImage, BuildSpec } from "@aws-cdk/aws-codebuild";
import { Repository } from "@aws-cdk/aws-ecr"
import { Role, ServicePrincipal } from "@aws-cdk/aws-iam";
import { CdkPipeline, SimpleSynthAction } from "@aws-cdk/pipelines";
import { StringParameter } from '@aws-cdk/aws-ssm';

import { PipelineStage } from "./pipeline-stage";

interface PipelineStackProps extends StackProps {
    readonly prefix: string;
    readonly stage: string;
    readonly repo: string;
    readonly owner: string;
    readonly branch: string;
    readonly oauthToken: string;
}

// NOTE: Create the pipeline and CI/CD infra such as ECR/S3
export class PipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: PipelineStackProps) {
        super(scope, id, props);

        /**
         * Get Env Variables
         */
        const { env, prefix, stage, repo, owner, branch, oauthToken } = props;

        /**
         * Arifact Definitions
         */

        /**
         * Defines the artifact representing the sourcecode
         */
        const sourceArtifact = new Artifact("SRC_OUTPUT");
        /**
         * Defines the artifact representing the cloud assembly 
         * (cloudformation template + all other assets)
         */
        const cdkOutputArtifact = new Artifact("CDK_OUTPUT");

        /**
         * Git respository
         */
        const sourceAction = new GitHubSourceAction({
            actionName: "GitHub_Source_Download",
            repo,
            owner,
            branch,
            // oauthToken: SecretValue.plainText("token"),
            oauthToken: SecretValue.plainText(
                StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/${oauthToken}`)),
            // oauthToken: SecretValue.secretsManager(`${prefix}-${stage}-${oauthToken}`, {
            //     jsonField: "token"
            // }),
            trigger: GitHubTrigger.POLL, // "WEBHOOK", "NONE"
            output: sourceArtifact
        });

        /**
         * Pipeline Definition
         */
        /**
         * The basic pipeline declaration. This sets the initial structure of our pipeline
         */
        const pipeline = new CdkPipeline(this, `${prefix}-${stage}-pipeline`, {
            pipelineName: `${prefix}-${stage}-pipeline`,
            cloudAssemblyArtifact: cdkOutputArtifact,
            sourceAction,
            /**
             * Builds our source code outlined above into a could assembly artifact
             */
            synthAction: SimpleSynthAction.standardNpmSynth({
                sourceArtifact, // Where to get source code to build
                cloudAssemblyArtifact: cdkOutputArtifact, // Where to place built source
                subdirectory: "cdk",
                installCommand: "npm i",
                buildCommand: "npx cdk synth",
                environmentVariables: {
                    commitId: { value: "#{SourceNameSpace.CommitId}" },
                    execId: { value: "#{codepipeline.PipelineExecutionId}" },
                    PREFIX: { value: prefix },
                    STAGE: { value: stage },
                    CDK_ACCOUNT: { value: env?.account },
                    CDK_REGION: { value: env?.region },
                    REPO: { value: repo },
                    OWNER: { value: owner },
                    BRANCH: { value: branch }
                }
            }),
        });

        /**
         * Defines an AWS Ecr resource
         */
        const ecrRepo = new Repository(
            this,
            `${prefix}-${stage}-Repo`,
            {
                repositoryName: `${prefix}-${stage}-Repo`.toLocaleLowerCase()
            }
        );

        /**
         * Build and Publish application artifacts
         */
        const buildRole = new Role(this, `${prefix}-${stage}-Docker-Build-Role`, {
            roleName: `${prefix}-${stage}-Docker-Build-Role`,
            assumedBy: new ServicePrincipal("codebuild.amazonaws.com"),
        });
        ecrRepo.grantPullPush(buildRole);

        const buildStage = pipeline.addStage("AppBuild")
        buildStage.addActions(new CodeBuildAction({
            actionName: "DockerBuild",
            input: sourceArtifact,
            project: new Project(this, "DockerBuild", {
                role: buildRole,
                environment: {
                    buildImage: LinuxBuildImage.STANDARD_4_0,
                    privileged: true,
                },
                buildSpec: this.getDockerBuildSpec(ecrRepo.repositoryUri),
            }),
        }));

        // Deploy - Local
        const localStage = new PipelineStage(this, `App-Deploy-Stage`, { prefix, stage, ecrRepoName: ecrRepo.repositoryName });
        pipeline.addApplicationStage(localStage);
    }

    getDockerBuildSpec(repositoryUri: string): BuildSpec {
        return BuildSpec.fromObject({
            version: "0.2",
            phases: {
                pre_build: {
                    commands: [
                        "echo Logging in to Amazon ECR...",
                        "echo $AWS_DEFAULT_REGION",
                        "$(aws ecr get-login --no-include-email --region $AWS_DEFAULT_REGION)",
                        "cat /root/.docker/config.json",
                    ]
                },
                build: {
                    commands: [
                        "echo Build started on `date`",
                        "echo Building the Docker image...",
                        "cd src && npm i && npm install -g typescript && npm run build && cd ..",
                        `docker build -t ${repositoryUri}:$CODEBUILD_RESOLVED_SOURCE_VERSION .`,
                    ]
                },
                post_build: {
                    commands: [
                        "echo Build completed on `date`",
                        "echo Pushing the Docker image...",
                        `docker push ${repositoryUri}:$CODEBUILD_RESOLVED_SOURCE_VERSION`,
                    ]
                },
            },
        });
    }
}

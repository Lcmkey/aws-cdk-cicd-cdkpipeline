import { Stack, Construct, StackProps, SecretValue, } from "@aws-cdk/core";
import { StringParameter } from '@aws-cdk/aws-ssm';

interface SsmStackProps extends StackProps {
    readonly prefix: string;
    readonly stage: string;
}

export class SsmStack extends Stack {
    readonly prefix: string;
    readonly stage: string;
    readonly accountId: string;
    readonly region: string;
    readonly gitToken: string

    constructor(scope: Construct, id: string, props: SsmStackProps) {
        super(scope, id, props);

        /**
         * Get Env Variables
         */
        const { prefix, stage } = props;

        // const project_prefix = StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/PREFIX`);
        // const project_stage = StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/STAGE`);
        // const project_accountId = StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/CDK_ACCOUNT`);
        // const project_region = StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/CDK_REGION`);
        // const project_region = StringParameter.valueForStringParameter(this, `/${prefix}/${stage}/GITHUB_TOEKN_KEY`);

        const project_prefix = StringParameter.valueFromLookup(this, `/${prefix}/${stage}/PREFIX`);
        const project_stage = StringParameter.valueFromLookup(this, `/${prefix}/${stage}/STAGE`);
        const project_accountId = StringParameter.valueFromLookup(this, `/${prefix}/${stage}/CDK_ACCOUNT`);
        const project_region = StringParameter.valueFromLookup(this, `/${prefix}/${stage}/CDK_REGION`);
        const gitToken = StringParameter.valueFromLookup(this, `/${prefix}/${stage}/GITHUB_TOEKN_KEY`);

        this.prefix = project_prefix;
        this.stage = project_stage;
        this.accountId = project_accountId;
        this.region = project_region;
        this.gitToken = gitToken;
    }
}